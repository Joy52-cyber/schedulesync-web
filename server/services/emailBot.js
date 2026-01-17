/**
 * Email Bot Service
 * Handles in-email scheduling via CC'd bot address
 */

const pool = require('../config/database');
const { sendEmail, sendTemplatedEmail } = require('./email');
const { createCalendarEvent } = require('./calendarService');
const { parseRecurrenceFromNaturalLanguage, generateRRule, formatRecurrenceText } = require('./recurrenceService');
const { checkBookingConflicts, findAlternativeSlots, formatConflictMessage } = require('./conflictDetection');
const crypto = require('crypto');
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const { DateTime } = require('luxon');
const {
  generatePickATimeEmail,
  generateConfirmationEmail,
  generateCancelledEmail,
  generateNoSlotsEmail
} = require('./emailTemplates');

// Claude (Anthropic) for AI-powered intent parsing
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Initialize Mailgun client
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || ''
});

// Bot name (email will be dynamic per user)
const BOT_NAME = 'TruCal Assistant';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mg.trucal.xyz';

/**
 * Process an inbound email to the bot
 */
async function processInboundEmail(emailData) {
  console.log('📬 Processing inbound email to bot');

  const {
    from,           // {email, name}
    to,             // [{email, name}]
    cc,             // [{email, name}]
    subject,
    text,
    html,
    messageId,
    inReplyTo,
    references
  } = emailData;

  try {
    // 1. Find which TruCal user this is for
    const trucalUser = await identifyTruCalUser(to, cc);

    if (!trucalUser) {
      console.log('❌ No TruCal user found in recipients');
      return { success: false, reason: 'no_user_found' };
    }

    console.log(`✅ Found TruCal user: ${trucalUser.email} (ID: ${trucalUser.id})`);

    // 2. Check if bot is enabled for this user
    const settings = await getBotSettings(trucalUser.id);
    if (!settings.is_enabled) {
      console.log('⚠️ Bot is disabled for this user');
      return { success: false, reason: 'bot_disabled' };
    }

    // 3. Find or create thread
    const thread = await findOrCreateThread(trucalUser.id, {
      messageId,
      inReplyTo,
      references,
      subject,
      from,
      to,
      cc
    });

    // 4. Store the inbound message
    await storeMessage(thread.id, 'inbound', emailData);

    // 5. Parse intent from the email
    const intent = await parseEmailIntent(subject, text, from);
    console.log('🧠 Parsed intent:', intent);

    // 6. Handle based on intent
    let response;

    if (thread.status === 'booked') {
      response = await handleAlreadyBooked(thread, trucalUser);
    } else if (intent.action === 'select_time') {
      response = await handleTimeSelection(thread, trucalUser, intent);
    } else if (intent.action === 'reschedule') {
      response = await handleRescheduleRequest(thread, trucalUser, intent);
    } else if (intent.action === 'cancel') {
      response = await handleCancelRequest(thread, trucalUser);
    } else {
      // Default: propose available times
      response = await proposeAvailableTimes(thread, trucalUser, settings, intent);
    }

    // 7. Send response email
    if (response) {
      await sendBotResponse(thread, trucalUser, response, emailData);
    }

    return { success: true, threadId: thread.id };

  } catch (error) {
    console.error('❌ Error processing inbound email:', error);
    return { success: false, reason: error.message };
  }
}

/**
 * Identify which TruCal user this email is for
 * Looks for {prefix}@mg.trucal.xyz in To/CC and looks up user by bot_email_prefix or username
 */
async function identifyTruCalUser(to, cc) {
  const allRecipients = [...(to || []), ...(cc || [])];

  // Find email matching our domain and extract prefix
  for (const recipient of allRecipients) {
    const email = recipient.email?.toLowerCase();
    if (email?.endsWith('@mg.trucal.xyz')) {
      // Extract prefix from email (e.g., joylacaba@mg.trucal.xyz -> joylacaba)
      const prefix = email.split('@')[0];

      console.log(`🔍 Extracted prefix from bot email: ${prefix}`);

      // Strategy 1: Look up by bot_email_prefix in settings
      let result = await pool.query(`
        SELECT u.id, u.email, u.name, u.username, u.timezone
        FROM users u
        JOIN email_bot_settings ebs ON ebs.user_id = u.id
        WHERE LOWER(ebs.bot_email_prefix) = $1
        LIMIT 1
      `, [prefix]);

      if (result.rows[0]) {
        console.log(`✅ Found user by bot_email_prefix: ${result.rows[0].email}`);
        return result.rows[0];
      }

      // Strategy 2: Fall back to username lookup (for backwards compatibility)
      result = await pool.query(`
        SELECT id, email, name, username, timezone
        FROM users
        WHERE LOWER(username) = $1
        LIMIT 1
      `, [prefix]);

      if (result.rows[0]) {
        console.log(`✅ Found user by username: ${result.rows[0].email}`);
        return result.rows[0];
      }

      console.log(`❌ No user found with prefix or username: ${prefix}`);
    }
  }

  return null;
}

/**
 * Get or create bot settings for user
 */
async function getBotSettings(userId) {
  let result = await pool.query(
    'SELECT * FROM email_bot_settings WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    // Get user's username to use as default bot_email_prefix
    const userResult = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );
    const username = userResult.rows[0]?.username;

    // Create default settings with bot_email_prefix = username
    result = await pool.query(`
      INSERT INTO email_bot_settings (user_id, bot_email_prefix)
      VALUES ($1, $2)
      RETURNING *
    `, [userId, username]);
  } else if (!result.rows[0].bot_email_prefix) {
    // If settings exist but bot_email_prefix is not set, set it to username
    const userResult = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );
    const username = userResult.rows[0]?.username;

    if (username) {
      result = await pool.query(`
        UPDATE email_bot_settings
        SET bot_email_prefix = $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
      `, [username, userId]);
    }
  }

  return result.rows[0];
}

/**
 * Update bot settings for user
 */
async function updateBotSettings(userId, settings) {
  const allowedFields = [
    'is_enabled', 'bot_email_prefix', 'default_duration',
    'default_event_type_id', 'intro_message', 'signature',
    'max_slots_to_show', 'prefer_time_of_day'
  ];

  const updates = [];
  const values = [userId];
  let paramCount = 2;

  for (const [key, value] of Object.entries(settings)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }

  if (updates.length === 0) {
    return getBotSettings(userId);
  }

  updates.push('updated_at = NOW()');

  const result = await pool.query(`
    UPDATE email_bot_settings
    SET ${updates.join(', ')}
    WHERE user_id = $1
    RETURNING *
  `, values);

  return result.rows[0];
}

/**
 * Find existing thread or create new one
 */
async function findOrCreateThread(userId, emailData) {
  const { messageId, inReplyTo, references, subject, from, to, cc } = emailData;

  // Try to find existing thread by references
  if (inReplyTo || references) {
    const refIds = [inReplyTo, ...(references || [])].filter(Boolean);

    const existing = await pool.query(`
      SELECT t.* FROM email_bot_threads t
      JOIN email_bot_messages m ON m.thread_id = t.id
      WHERE t.user_id = $1 AND m.message_id = ANY($2)
      LIMIT 1
    `, [userId, refIds]);

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
  }

  // Create new thread
  const participants = [
    from,
    ...(to || []),
    ...(cc || [])
  ].filter(p => p && p.email && !p.email.toLowerCase().includes('trucal'));

  const result = await pool.query(`
    INSERT INTO email_bot_threads (user_id, thread_id, subject, participants)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [userId, messageId, subject, JSON.stringify(participants)]);

  return result.rows[0];
}

/**
 * Store a message in the thread
 */
async function storeMessage(threadId, direction, emailData) {
  const { from, to, cc, subject, text, html, messageId } = emailData;

  await pool.query(`
    INSERT INTO email_bot_messages (
      thread_id, message_id, direction, from_email, from_name,
      to_emails, cc_emails, subject, body_text, body_html
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    threadId,
    messageId,
    direction,
    from?.email,
    from?.name,
    JSON.stringify(to),
    JSON.stringify(cc),
    subject,
    text,
    html
  ]);
}

/**
 * Parse intent from email content using AI (Claude)
 */
async function parseEmailIntentWithAI(subject, body, from) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: `You are a scheduling assistant. Parse the user's email to extract scheduling intent. Return ONLY valid JSON with no additional text:
{
  "action": "schedule" | "select_time" | "reschedule" | "cancel",
  "duration": <number in minutes, or null>,
  "preferences": <array of strings like "morning", "afternoon", "evening", "monday", "tuesday", etc., or specific dates>,
  "timeSlot": <ISO datetime string if selecting a specific time, or null>,
  "timezone": <detected timezone like "America/New_York" or null>,
  "meetingType": <detected type: "coffee", "lunch", "call", "video", "zoom", "phone", "in-person", "quick", or null>,
  "locationType": <"in-person" | "phone" | "video" | null>,
  "isRecurring": <boolean, true if this is a recurring meeting>,
  "recurrencePattern": <string describing the recurrence like "every Monday", "bi-weekly on Tuesdays", "monthly", or null>
}

Meeting Type Detection:
- "coffee" → {meetingType: "coffee", duration: 30, locationType: "in-person", preferences: ["morning", "afternoon"]}
- "lunch" → {meetingType: "lunch", duration: 60, locationType: "in-person", preferences: ["11:00-14:00"]}
- "quick call" → {meetingType: "quick", duration: 15, locationType: "phone"}
- "zoom meeting" → {meetingType: "zoom", duration: 60, locationType: "video"}
- "phone call" → {meetingType: "call", duration: 30, locationType: "phone"}
- "in person" → {locationType: "in-person"}

Recurring Meeting Detection:
- "every Monday at 2pm" → {isRecurring: true, recurrencePattern: "every Monday", preferences: ["monday", "14:00"]}
- "weekly standup on Tuesdays" → {isRecurring: true, recurrencePattern: "weekly on Tuesdays", preferences: ["tuesday"]}
- "bi-weekly check-in" → {isRecurring: true, recurrencePattern: "bi-weekly"}
- "monthly review on the 15th" → {isRecurring: true, recurrencePattern: "monthly on the 15th"}
- "every weekday at 9am" → {isRecurring: true, recurrencePattern: "every weekday", preferences: ["monday","tuesday","wednesday","thursday","friday", "09:00"]}

Examples:
- "Let's grab coffee next Tuesday" → {"action": "schedule", "meetingType": "coffee", "duration": 30, "preferences": ["tuesday", "morning"], "isRecurring": false}
- "Can we do a quick 15-min call?" → {"action": "schedule", "meetingType": "quick", "duration": 15, "locationType": "phone", "isRecurring": false}
- "Weekly team sync every Monday at 10am" → {"action": "schedule", "duration": 60, "isRecurring": true, "recurrencePattern": "every Monday", "preferences": ["monday", "10:00"]}
- "Zoom call next week" → {"action": "schedule", "meetingType": "zoom", "duration": 60, "locationType": "video", "isRecurring": false}
- "confirm: 2024-01-22T10:00" → {"action": "select_time", "timeSlot": "2024-01-22T10:00", "isRecurring": false}`,
      messages: [{
        role: 'user',
        content: `Subject: ${subject}\n\nBody: ${body}`
      }]
    });

    const parsed = JSON.parse(response.content[0].text);
    console.log('🤖 Claude parsed intent:', parsed);

    // Parse recurrence pattern if detected
    let recurrence = null;
    if (parsed.isRecurring && parsed.recurrencePattern) {
      recurrence = parseRecurrenceFromNaturalLanguage(parsed.recurrencePattern);
      if (recurrence) {
        console.log('🔄 Recurring pattern detected:', formatRecurrenceText(recurrence));
      }
    }

    return {
      action: parsed.action || 'schedule',
      duration: parsed.duration || null,
      preferences: parsed.preferences || [],
      timeSlot: parsed.timeSlot || null,
      timezone: parsed.timezone || null,
      meetingType: parsed.meetingType || null,
      locationType: parsed.locationType || null,
      isRecurring: parsed.isRecurring || false,
      recurrence: recurrence
    };
  } catch (error) {
    console.error('AI intent parsing error:', error.message);
    // Fall back to regex parsing
    return parseEmailIntentRegex(subject, body, from);
  }
}

/**
 * Parse intent from email content using regex (fallback)
 */
function parseEmailIntentRegex(subject, body, from) {
  const text = `${subject} ${body}`.toLowerCase();

  const intent = {
    action: 'schedule', // default
    duration: null,
    preferences: [],
    timeSlot: null
  };

  // Check for time selection (clicking a proposed time)
  const timeMatch = text.match(/confirm:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (timeMatch) {
    intent.action = 'select_time';
    intent.timeSlot = timeMatch[1];
    return intent;
  }

  // Check for reschedule request
  if (text.includes('reschedule') || text.includes('different time') || text.includes('change the time')) {
    intent.action = 'reschedule';
  }

  // Check for cancellation
  if (text.includes('cancel') || text.includes('no longer') || text.includes('nevermind')) {
    intent.action = 'cancel';
  }

  // Parse duration preferences
  const durationMatch = text.match(/(\d+)\s*(?:min|minute|hour)/);
  if (durationMatch) {
    let duration = parseInt(durationMatch[1]);
    if (text.includes('hour')) duration *= 60;
    intent.duration = duration;
  }

  // Parse time preferences
  if (text.includes('morning')) intent.preferences.push('morning');
  if (text.includes('afternoon')) intent.preferences.push('afternoon');
  if (text.includes('evening')) intent.preferences.push('evening');

  // Parse day preferences
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  days.forEach(day => {
    if (text.includes(day)) intent.preferences.push(day);
  });

  if (text.includes('next week')) intent.preferences.push('next_week');
  if (text.includes('this week')) intent.preferences.push('this_week');

  return intent;
}

/**
 * Parse intent from email content (main entry point)
 */
async function parseEmailIntent(subject, body, from) {
  // Use AI parsing if Claude is configured, otherwise fall back to regex
  if (anthropic) {
    return await parseEmailIntentWithAI(subject, body, from);
  } else {
    console.log('ℹ️  Claude API not configured, using regex intent parsing');
    return parseEmailIntentRegex(subject, body, from);
  }
}

/**
 * Identify TruCal users among thread participants
 */
async function identifyTruCalParticipants(participants, hostUserId) {
  const trucalParticipants = [];

  for (const participant of participants) {
    if (!participant.email) continue;

    // Look up in users table
    const result = await pool.query(
      'SELECT id, email, name, timezone FROM users WHERE LOWER(email) = LOWER($1)',
      [participant.email]
    );

    if (result.rows.length > 0 && result.rows[0].id !== hostUserId) {
      trucalParticipants.push(result.rows[0]);
      console.log(`👥 Found TruCal participant: ${result.rows[0].email}`);
    }
  }

  return trucalParticipants;
}

/**
 * Get mutual available slots across multiple users
 */
async function getMutualAvailableSlots(userIds, duration, preferences, maxSlots = 5, guestTimezone = null) {
  console.log(`🔍 Finding mutual availability for ${userIds.length} participants`);

  // Get slots for the primary user (host)
  const primarySlots = await getAvailableSlots(userIds[0], duration, preferences, maxSlots * 3, guestTimezone);

  if (userIds.length === 1) {
    // No other TruCal participants, return primary user's slots
    return primarySlots.slice(0, maxSlots);
  }

  // Filter slots to only those where all participants are free
  const mutualSlots = [];

  for (const slot of primarySlots) {
    const slotStartUTC = new Date(slot.start);
    const slotEndUTC = new Date(slot.end);

    let allFree = true;

    // Check each additional participant's calendar
    for (let i = 1; i < userIds.length; i++) {
      const userId = userIds[i];

      // Get user's timezone
      const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
      const userTimezone = userResult.rows[0]?.timezone || 'America/New_York';

      // Check if slot falls within working hours
      const workingHoursData = await getUserWorkingHours(userId);
      const workingHours = workingHoursData.hours;

      const { DateTime } = require('luxon');
      const slotStart = DateTime.fromJSDate(slotStartUTC).setZone(userTimezone);
      const dayName = slotStart.toFormat('EEEE').toLowerCase();

      // Check if day is enabled
      if (!workingHours[dayName]?.enabled) {
        allFree = false;
        console.log(`  ❌ ${slotStart.toFormat('MMM d, h:mm a')} - Outside ${userId}'s working hours (day disabled)`);
        break;
      }

      // Check if within working hours time range
      const dayHours = workingHours[dayName];
      const [startHour, startMinute] = dayHours.start.split(':').map(Number);
      const [endHour, endMinute] = dayHours.end.split(':').map(Number);

      const workStart = slotStart.set({ hour: startHour, minute: startMinute });
      const workEnd = slotStart.set({ hour: endHour, minute: endMinute });

      if (slotStart < workStart || slotStart >= workEnd) {
        allFree = false;
        console.log(`  ❌ ${slotStart.toFormat('MMM d, h:mm a')} - Outside ${userId}'s working hours`);
        break;
      }

      // Check for booking conflicts
      const dayStart = slotStart.startOf('day').toUTC().toJSDate();
      const dayEnd = slotStart.plus({ days: 1 }).startOf('day').toUTC().toJSDate();

      const bookings = await pool.query(`
        SELECT start_time, end_time FROM bookings
        WHERE user_id = $1 AND status = 'confirmed'
          AND start_time >= $2 AND start_time < $3
      `, [userId, dayStart, dayEnd]);

      const hasConflict = bookings.rows.some(b => {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);

        // Check overlap
        return slotStartUTC < bEnd && slotEndUTC > bStart;
      });

      if (hasConflict) {
        allFree = false;
        console.log(`  ❌ ${slotStart.toFormat('MMM d, h:mm a')} - Conflict for user ${userId}`);
        break;
      }
    }

    if (allFree) {
      mutualSlots.push(slot);
      console.log(`  ✅ ${slot.formatted} - Available for all participants`);
    }

    if (mutualSlots.length >= maxSlots) {
      break;
    }
  }

  console.log(`🎯 Found ${mutualSlots.length} mutual slots out of ${primarySlots.length} primary slots`);
  return mutualSlots;
}

/**
 * Propose available times to the thread participants
 */
async function proposeAvailableTimes(thread, user, settings, intent) {
  // Get user's availability
  const duration = intent.duration || settings.default_duration || 30;
  const guestTimezone = intent.timezone || null; // From AI parsing
  const meetingType = intent.meetingType || null;
  const locationType = intent.locationType || null;

  // Log meeting type detection
  if (meetingType) {
    console.log(`🎯 Meeting type detected: ${meetingType} (${duration}min, ${locationType || 'any location'})`);
  }

  // Log recurring meeting detection
  if (intent.isRecurring && intent.recurrence) {
    console.log(`🔄 Recurring meeting: ${formatRecurrenceText(intent.recurrence)}`);
  }

  // Check for multi-participant scheduling
  const participants = thread.participants || [];
  const trucalParticipants = await identifyTruCalParticipants(participants, user.id);

  let slots;

  if (trucalParticipants.length > 0) {
    // Multi-participant scheduling: find mutual availability
    const allUserIds = [user.id, ...trucalParticipants.map(p => p.id)];
    console.log(`👥 Multi-participant scheduling for ${allUserIds.length} TruCal users`);
    slots = await getMutualAvailableSlots(allUserIds, duration, intent.preferences, settings.max_slots_to_show, guestTimezone);
  } else {
    // Single-participant: only check host's availability
    slots = await getAvailableSlots(user.id, duration, intent.preferences, settings.max_slots_to_show, guestTimezone);
  }

  if (slots.length === 0) {
    return {
      subject: `Re: ${thread.subject}`,
      body: generateNoAvailabilityEmail(user, thread)
    };
  }

  // Store proposed slots, guest timezone, meeting metadata, participant info, and recurrence in thread
  await pool.query(
    'UPDATE email_bot_threads SET proposed_slots = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify({
      slots: slots,
      meetingType: meetingType,
      locationType: locationType,
      duration: duration,
      trucalParticipants: trucalParticipants.map(p => ({ id: p.id, email: p.email, name: p.name })),
      isRecurring: intent.isRecurring || false,
      recurrence: intent.recurrence || null
    }), thread.id]
  );

  return {
    subject: `Re: ${thread.subject}`,
    body: generateProposalEmail(user, thread, slots, settings, guestTimezone, meetingType)
  };
}

/**
 * Get user's working hours and availability settings from database or use defaults
 */
async function getUserWorkingHours(userId) {
  try {
    // Try to get working hours and availability settings from user's settings
    const result = await pool.query(`
      SELECT working_hours, buffer_time, lead_time_hours, booking_horizon_days
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rows[0]?.working_hours) {
      return {
        hours: result.rows[0].working_hours,
        buffer: result.rows[0].buffer_time || 0,
        leadTime: result.rows[0].lead_time_hours || 0,
        bookingHorizon: result.rows[0].booking_horizon_days || 14
      };
    }
  } catch (error) {
    console.log('No working_hours column, using defaults');
  }

  // Default working hours: 9 AM - 5 PM, Monday-Friday
  // Default: 0 buffer, 0 lead time, 14 days horizon
  return {
    hours: {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' }
    },
    buffer: 0,
    leadTime: 0,
    bookingHorizon: 14
  };
}

/**
 * Get available time slots for user
 */
async function getAvailableSlots(userId, duration, preferences, maxSlots = 5, guestTimezone = null) {
  const slots = [];

  // Get user timezone and working hours
  const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
  const userTimezone = userResult.rows[0]?.timezone || 'America/New_York';

  const workingHoursData = await getUserWorkingHours(userId);
  const workingHours = workingHoursData.hours;
  const bufferMinutes = workingHoursData.buffer || 0;
  const leadTimeHours = workingHoursData.leadTime || 0;
  const bookingHorizonDays = workingHoursData.bookingHorizon || 14;

  // Get current time in user's timezone
  const nowInUserTz = DateTime.now().setZone(userTimezone);

  // Calculate minimum start time based on lead time
  const minStartTime = nowInUserTz.plus({ hours: leadTimeHours });

  console.log(`📅 Generating slots with ${bufferMinutes}min buffer, ${leadTimeHours}hr lead time, ${bookingHorizonDays}-day horizon`);

  // Get blocked times for this user
  let blockedTimes = [];
  try {
    // Try to get blocked times - support both user_id and team_member_id
    const blockedResult = await pool.query(`
      SELECT start_time, end_time, reason FROM blocked_times
      WHERE user_id = $1 OR team_member_id IN (
        SELECT id FROM team_members WHERE user_id = $1
      )
    `, [userId]);
    blockedTimes = blockedResult.rows;

    if (blockedTimes.length > 0) {
      console.log(`🚫 Found ${blockedTimes.length} blocked time periods for user`);
    }
  } catch (error) {
    // Table might not have user_id column, that's okay
    console.log('ℹ️  No blocked times configured or table schema doesn\'t support user_id');
    blockedTimes = [];
  }

  // Look ahead based on booking horizon setting (default 14 days)
  for (let day = 0; day < bookingHorizonDays && slots.length < maxSlots; day++) {
    // Create date in user's timezone
    const dateInUserTz = nowInUserTz.plus({ days: day }).startOf('day');

    // Get day name (monday, tuesday, etc.)
    const dayName = dateInUserTz.toFormat('EEEE').toLowerCase();

    // Skip if day is disabled in working hours
    if (!workingHours[dayName]?.enabled) continue;

    // Check day preferences
    if (preferences.includes('this_week') && day > 7) continue;
    if (preferences.includes('next_week') && day < 7) continue;
    if (preferences.some(p => ['monday','tuesday','wednesday','thursday','friday'].includes(p))) {
      if (!preferences.includes(dayName)) continue;
    }

    // Get existing bookings for this day (in UTC for database query)
    const dayStart = dateInUserTz.toUTC().toJSDate();
    const dayEnd = dateInUserTz.plus({ days: 1 }).toUTC().toJSDate();

    const bookings = await pool.query(`
      SELECT start_time, end_time FROM bookings
      WHERE user_id = $1 AND status = 'confirmed'
        AND start_time >= $2 AND start_time < $3
    `, [userId, dayStart, dayEnd]);

    const bookedSlots = bookings.rows;

    // Get working hours for this specific day
    const dayWorkingHours = workingHours[dayName];
    let startHour = parseInt(dayWorkingHours.start.split(':')[0]);
    let startMinute = parseInt(dayWorkingHours.start.split(':')[1]);
    let endHour = parseInt(dayWorkingHours.end.split(':')[0]);
    let endMinute = parseInt(dayWorkingHours.end.split(':')[1]);

    // Apply time preferences to narrow down the range
    // Check for specific time range preferences (e.g., "11:00-14:00" for lunch)
    const timeRangePref = preferences.find(p => p.includes(':') && p.includes('-'));
    if (timeRangePref) {
      const [rangeStart, rangeEnd] = timeRangePref.split('-');
      const [rangeStartHour, rangeStartMin] = rangeStart.trim().split(':').map(Number);
      const [rangeEndHour, rangeEndMin] = rangeEnd.trim().split(':').map(Number);

      startHour = Math.max(startHour, rangeStartHour);
      startMinute = rangeStartMin || 0;
      endHour = Math.min(endHour, rangeEndHour);
      endMinute = rangeEndMin || 0;

      console.log(`🍽️  Applying time range preference: ${timeRangePref}`);
    } else if (preferences.includes('morning')) {
      endHour = Math.min(endHour, 12);
      endMinute = 0;
    } else if (preferences.includes('afternoon')) {
      startHour = Math.max(startHour, 12);
      startMinute = 0;
      endHour = Math.min(endHour, 17);
    } else if (preferences.includes('evening')) {
      startHour = Math.max(startHour, 17);
      startMinute = 0;
      endHour = Math.min(endHour, 20);
    }

    // Generate slots starting from working hours start time
    for (let hour = startHour; hour < endHour && slots.length < maxSlots; hour++) {
      // Use startMinute for the first hour, otherwise start at :00
      const minute = (hour === startHour) ? startMinute : 0;

      // Create slot start time in user's timezone
      const slotStart = dateInUserTz.set({ hour, minute, second: 0, millisecond: 0 });
      const slotEnd = slotStart.plus({ minutes: duration });

      // Skip if slot end goes past working hours end time
      const workingEndTime = dateInUserTz.set({ hour: endHour, minute: endMinute, second: 0 });
      if (slotEnd > workingEndTime) continue;

      // Skip if in the past (compare in user's timezone)
      if (slotStart <= nowInUserTz) continue;

      // LEAD TIME: Skip if slot is too soon (doesn't meet minimum notice requirement)
      if (slotStart < minStartTime) {
        console.log(`⏰ Skipping ${slotStart.toFormat('MMM d, h:mm a')} - within ${leadTimeHours}hr lead time`);
        continue;
      }

      // Convert to UTC for conflict checking
      const slotStartUTC = slotStart.toUTC().toJSDate();
      const slotEndUTC = slotEnd.toUTC().toJSDate();

      // BUFFER TIME: Check if conflicts with existing bookings (including buffer)
      const hasConflict = bookedSlots.some(b => {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);

        // Add buffer time to both start and end
        const bufferedSlotStart = new Date(slotStartUTC.getTime() - bufferMinutes * 60000);
        const bufferedSlotEnd = new Date(slotEndUTC.getTime() + bufferMinutes * 60000);

        // Check overlap with buffer zones
        const overlaps = bufferedSlotStart < bEnd && bufferedSlotEnd > bStart;

        if (overlaps && bufferMinutes > 0) {
          console.log(`🚫 Buffer conflict: ${slotStart.toFormat('h:mm a')} conflicts with existing booking (${bufferMinutes}min buffer)`);
        }

        return overlaps;
      });

      // BLOCKED TIME: Check if slot falls within any blocked time period
      const isBlocked = blockedTimes.some(block => {
        const blockStart = new Date(block.start_time);
        const blockEnd = new Date(block.end_time);

        // Check if slot overlaps with blocked time
        const overlaps = slotStartUTC < blockEnd && slotEndUTC > blockStart;

        if (overlaps) {
          const reason = block.reason || 'Blocked';
          console.log(`🚫 Blocked time: ${slotStart.toFormat('MMM d, h:mm a')} - ${reason}`);
        }

        return overlaps;
      });

      if (!hasConflict && !isBlocked) {
        // Calculate day label (Today, Tomorrow, or day name) in user's timezone
        const dayLabel = getDayLabelLuxon(slotStart, nowInUserTz);

        slots.push({
          start: slotStart.toUTC().toISO(), // Store as UTC ISO
          end: slotEnd.toUTC().toISO(),     // Store as UTC ISO
          formatted: formatSlotForEmailLuxon(slotStart, duration, guestTimezone), // Format with both timezones if available
          dayLabel: dayLabel
        });
      }
    }
  }

  return slots;
}

/**
 * Format a time slot for display in email (DEPRECATED - use Luxon version)
 */
function formatSlotForEmail(date, duration) {
  const options = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };

  return date.toLocaleDateString('en-US', options);
}

/**
 * Detect guest timezone from email data with enhanced intelligence
 */
function detectGuestTimezone(emailData) {
  try {
    // Priority 1: AI-detected timezone from email content
    if (emailData.detectedTimezone) {
      console.log(`🌍 Timezone detected by AI: ${emailData.detectedTimezone}`);
      return emailData.detectedTimezone;
    }

    // Priority 2: Parse timezone from email headers
    if (emailData.headers) {
      // Try X-Original-Time header (Outlook)
      if (emailData.headers['x-original-time']) {
        const timezone = parseTimezoneFromHeader(emailData.headers['x-original-time']);
        if (timezone) {
          console.log(`🌍 Timezone from X-Original-Time header: ${timezone}`);
          return timezone;
        }
      }

      // Try Date header
      if (emailData.headers.date) {
        const timezone = parseTimezoneFromDateHeader(emailData.headers.date);
        if (timezone) {
          console.log(`🌍 Timezone from Date header: ${timezone}`);
          return timezone;
        }
      }
    }

    // Priority 3: Extract timezone from email signature
    if (emailData.text) {
      const timezone = extractTimezoneFromSignature(emailData.text);
      if (timezone) {
        console.log(`🌍 Timezone from email signature: ${timezone}`);
        return timezone;
      }
    }

    console.log('🌍 No timezone detected, using host timezone');
    return null;
  } catch (error) {
    console.error('Timezone detection error:', error);
    return null;
  }
}

/**
 * Parse timezone from email Date header
 * Example: "Mon, 15 Jan 2024 10:30:00 -0500" or "Mon, 15 Jan 2024 10:30:00 EST"
 */
function parseTimezoneFromDateHeader(dateHeader) {
  try {
    // Match timezone offset like -0500, +0800
    const offsetMatch = dateHeader.match(/([+-])(\d{2})(\d{2})$/);
    if (offsetMatch) {
      const sign = offsetMatch[1];
      const hours = parseInt(offsetMatch[2]);
      const minutes = parseInt(offsetMatch[3]);

      // Convert to timezone name (common ones)
      const offsetMinutes = (hours * 60 + minutes) * (sign === '-' ? -1 : 1);
      return offsetToTimezone(offsetMinutes);
    }

    // Match timezone abbreviation like EST, PST, GMT
    const abbrevMatch = dateHeader.match(/\b([A-Z]{2,4})$/);
    if (abbrevMatch) {
      return abbrevToTimezone(abbrevMatch[1]);
    }

    return null;
  } catch (error) {
    console.error('Error parsing Date header timezone:', error);
    return null;
  }
}

/**
 * Parse timezone from X-Original-Time header
 */
function parseTimezoneFromHeader(headerValue) {
  try {
    const match = headerValue.match(/([+-]\d{2}):?(\d{2})/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const offsetMinutes = hours * 60 + (hours < 0 ? -minutes : minutes);
      return offsetToTimezone(offsetMinutes);
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract timezone from email signature
 * Looks for patterns like "EST", "PST", "GMT+1", etc.
 */
function extractTimezoneFromSignature(emailText) {
  try {
    // Look for common timezone patterns in last 10 lines
    const lines = emailText.split('\n').slice(-10);
    const text = lines.join(' ');

    // Match timezone abbreviations
    const abbrevMatch = text.match(/\b(EST|EDT|PST|PDT|CST|CDT|MST|MDT|GMT|UTC|BST|IST|JST|AEST|AEDT)\b/);
    if (abbrevMatch) {
      return abbrevToTimezone(abbrevMatch[1]);
    }

    // Match GMT+/-N format
    const gmtMatch = text.match(/GMT([+-]\d{1,2})/i);
    if (gmtMatch) {
      const offset = parseInt(gmtMatch[1]) * 60;
      return offsetToTimezone(offset);
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Convert UTC offset (in minutes) to IANA timezone
 */
function offsetToTimezone(offsetMinutes) {
  const timezoneMap = {
    '-480': 'America/Los_Angeles',    // PST/PDT
    '-420': 'America/Denver',          // MST/MDT
    '-360': 'America/Chicago',         // CST/CDT
    '-300': 'America/New_York',        // EST/EDT
    '0': 'Europe/London',              // GMT/UTC
    '60': 'Europe/Paris',              // CET
    '330': 'Asia/Kolkata',             // IST
    '540': 'Asia/Tokyo',               // JST
    '600': 'Australia/Sydney',         // AEST/AEDT
  };

  return timezoneMap[offsetMinutes.toString()] || null;
}

/**
 * Convert timezone abbreviation to IANA timezone
 */
function abbrevToTimezone(abbrev) {
  const abbrevMap = {
    'EST': 'America/New_York',
    'EDT': 'America/New_York',
    'CST': 'America/Chicago',
    'CDT': 'America/Chicago',
    'MST': 'America/Denver',
    'MDT': 'America/Denver',
    'PST': 'America/Los_Angeles',
    'PDT': 'America/Los_Angeles',
    'GMT': 'Europe/London',
    'UTC': 'UTC',
    'BST': 'Europe/London',
    'IST': 'Asia/Kolkata',
    'JST': 'Asia/Tokyo',
    'AEST': 'Australia/Sydney',
    'AEDT': 'Australia/Sydney'
  };

  return abbrevMap[abbrev] || null;
}

/**
 * Format a time slot for display in email using Luxon (timezone-aware)
 * Optionally shows both host and guest timezones
 */
function formatSlotForEmailLuxon(dateTime, duration, guestTimezone = null) {
  // dateTime is already a Luxon DateTime in the user's (host) timezone
  const hostTimeStr = dateTime.toFormat('MMM d, h:mm a');

  // If guest timezone is different, show both
  if (guestTimezone && guestTimezone !== dateTime.zoneName) {
    try {
      const guestTime = dateTime.setZone(guestTimezone);
      const guestTimeStr = guestTime.toFormat('h:mm a');
      const hostTz = dateTime.toFormat('ZZZZ'); // e.g., "EST"
      const guestTz = guestTime.toFormat('ZZZZ');

      return `${hostTimeStr} ${hostTz} (${guestTimeStr} ${guestTz})`;
    } catch (error) {
      // If timezone conversion fails, just show host time
      return hostTimeStr;
    }
  }

  return hostTimeStr;
}

/**
 * Get day label for a time slot (Today, Tomorrow, or day name) (DEPRECATED - use Luxon version)
 */
function getDayLabel(slotDate, now) {
  const slotDay = new Date(slotDate);
  slotDay.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const daysDiff = Math.floor((slotDay - today) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    return 'Today';
  } else if (daysDiff === 1) {
    return 'Tomorrow';
  } else {
    // Return day name (Monday, Tuesday, etc.)
    return slotDate.toLocaleDateString('en-US', { weekday: 'long' });
  }
}

/**
 * Get day label for a time slot using Luxon (timezone-aware)
 */
function getDayLabelLuxon(slotDateTime, nowDateTime) {
  // Both are Luxon DateTime objects in the same timezone
  const slotDay = slotDateTime.startOf('day');
  const nowDay = nowDateTime.startOf('day');

  const daysDiff = Math.floor(slotDay.diff(nowDay, 'days').days);

  if (daysDiff === 0) {
    return 'Today';
  } else if (daysDiff === 1) {
    return 'Tomorrow';
  } else {
    // Return day name (Monday, Tuesday, etc.)
    return slotDateTime.toFormat('EEEE');
  }
}

/**
 * Generate the proposal email body
 */
function generateProposalEmail(user, thread, slots, settings, guestTimezone = null, meetingType = null) {
  const participants = thread.participants || [];
  const guestName = participants.find(p => p.email !== user.email)?.name?.split(' ')[0] || 'there';
  const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';
  const duration = settings.default_duration || 30;

  // Customize intro based on meeting type
  let intro = settings.intro_message || "I'm helping {{hostName}} schedule a meeting with you.";

  if (meetingType && !settings.intro_message) {
    // Use default message, but customize based on meeting type
    const meetingTypeIntros = {
      'coffee': "I'm helping {{hostName}} schedule a coffee chat with you. ☕",
      'lunch': "I'm helping {{hostName}} schedule a lunch meeting with you. 🍽️",
      'quick': "I'm helping {{hostName}} schedule a quick call with you. 📞",
      'call': "I'm helping {{hostName}} schedule a call with you. 📞",
      'video': "I'm helping {{hostName}} schedule a video meeting with you. 🎥",
      'zoom': "I'm helping {{hostName}} schedule a Zoom call with you. 💻"
    };
    intro = meetingTypeIntros[meetingType] || intro;
  }

  intro = intro.replace('{{hostName}}', user.name);

  // Add timezone note if guest timezone is detected
  let timezoneNote = '';
  if (guestTimezone) {
    timezoneNote = `<p style="font-size: 12px; color: #71717a; margin-top: 12px;">Times shown in both your timezone and ${user.name}'s timezone for convenience.</p>`;
  }

  return generatePickATimeEmail({
    guestName,
    introMessage: intro + (timezoneNote ? `\n${timezoneNote}` : ''),
    duration,
    slots,
    baseUrl: bookingBaseUrl,
    username: user.username,
    threadId: thread.id,
    hostName: user.name,
    calendarUrl: `${bookingBaseUrl}/${user.username}`,
    signature: settings.signature || 'Powered by <span style="color: #71717a; font-weight: 600;">TruCal</span>'
  });
}

/**
 * Generate email when no availability
 */
function generateNoAvailabilityEmail(user, thread) {
  const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';
  const participants = thread.participants || [];
  const guestName = participants.find(p => p.email !== user.email)?.name?.split(' ')[0] || 'there';

  return generateNoSlotsEmail({
    guestName,
    hostName: user.name,
    calendarUrl: `${bookingBaseUrl}/${user.username}`
  });
}

/**
 * Generate a Google Meet link for the booking (DEPRECATED - use createCalendarEvent instead)
 * Kept for backwards compatibility
 */
async function generateMeetLink(user, startTime) {
  console.warn('⚠️ generateMeetLink is deprecated, use createCalendarEvent instead');
  const meetCode = crypto.randomBytes(6).toString('hex').substring(0, 10);
  return `https://meet.google.com/${meetCode}`;
}

/**
 * Handle when someone selects a time
 */
async function handleTimeSelection(thread, user, intent) {
  const selectedTime = new Date(intent.timeSlot);

  // Create the booking
  const participants = thread.participants || [];
  const guest = participants.find(p => p.email !== user.email);

  if (!guest) {
    const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';
    return {
      subject: `Re: ${thread.subject}`,
      body: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unable to Book</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td align="center" bgcolor="#f59e0b" style="background-color: #f59e0b; padding: 32px 24px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">Unable to Book</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #71717a; line-height: 1.6;">
                Sorry, I couldn't identify the guest for this booking. Please book directly using the link below.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#8b5cf6" style="background-color: #8b5cf6; border-radius: 8px;">
                    <a href="${bookingBaseUrl}/${user.username}" target="_blank" style="display: block; padding: 16px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; text-align: center;">
                      Book Directly
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 24px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                Powered by <span style="color: #71717a; font-weight: 600;">TruCal</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
    };
  }

  // Get default event type and check for recurring info
  const settings = await getBotSettings(user.id);
  const duration = settings.default_duration || 30;

  const endTime = new Date(selectedTime);
  endTime.setMinutes(endTime.getMinutes() + duration);

  // Check if this is a recurring meeting
  const proposedData = thread.proposed_slots ? JSON.parse(thread.proposed_slots) : {};
  const isRecurring = proposedData.isRecurring || false;
  const recurrence = proposedData.recurrence || null;

  // Check for booking conflicts BEFORE creating the booking
  const conflictCheck = await checkBookingConflicts(
    user.id,
    selectedTime,
    endTime,
    {
      eventTypeId: null,
      includeBuffer: true
    }
  );

  if (conflictCheck?.hasConflict) {
    // Find alternative time slots
    const alternatives = await findAlternativeSlots(
      user.id,
      selectedTime,
      duration,
      {
        maxSlots: 5,
        maxDaysAhead: 14
      }
    );

    console.log('⚠️ Email Bot detected conflict - sending alternatives');

    // Send conflict email with alternative times
    const conflictEmail = await buildConflictEmail(
      user,
      guest,
      {
        originalTime: selectedTime,
        duration,
        conflicts: conflictCheck.conflicts,
        alternatives,
        thread
      }
    );

    // Send the conflict email via Mailgun
    await sendConflictEmailViaMailgun(user, guest.email, thread.subject, conflictEmail);

    return {
      success: false,
      reason: 'conflict_detected',
      sentAlternatives: true
    };
  }

  // Create booking in database first
  const manageToken = crypto.randomBytes(32).toString('hex');

  let booking;
  if (isRecurring && recurrence) {
    // Create recurring booking series
    const rrule = generateRRule(recurrence);
    const recurrenceEndDate = recurrence.endDate || DateTime.fromJSDate(selectedTime).plus({ months: 6 }).toJSDate();

    console.log(`🔄 Creating recurring booking: ${formatRecurrenceText(recurrence)}`);
    console.log(`📅 RRULE: ${rrule}`);

    booking = await pool.query(`
      INSERT INTO bookings (
        user_id, title, attendee_name, attendee_email,
        start_time, end_time, status, manage_token, source,
        is_recurring, recurrence_rule, recurrence_end_date,
        recurrence_frequency, recurrence_interval, recurrence_days_of_week
      ) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, 'email_bot', $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      user.id,
      `Meeting with ${guest.name || guest.email}`,
      guest.name || guest.email.split('@')[0],
      guest.email,
      selectedTime,
      endTime,
      manageToken,
      true, // is_recurring
      rrule, // recurrence_rule
      recurrenceEndDate, // recurrence_end_date
      recurrence.frequency, // recurrence_frequency
      recurrence.interval || 1, // recurrence_interval
      recurrence.daysOfWeek || [] // recurrence_days_of_week
    ]);
  } else {
    // Create one-time booking
    booking = await pool.query(`
      INSERT INTO bookings (
        user_id, title, attendee_name, attendee_email,
        start_time, end_time, status, manage_token, source
      ) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, 'email_bot')
      RETURNING *
    `, [
      user.id,
      `Meeting with ${guest.name || guest.email}`,
      guest.name || guest.email.split('@')[0],
      guest.email,
      selectedTime,
      endTime,
      manageToken
    ]);
  }

  const bookingRecord = booking.rows[0];

  // Create calendar event with Google Meet/Teams link
  console.log('📅 Creating calendar event for booking:', bookingRecord.id);
  const calendarEvent = await createCalendarEvent(user.id, {
    id: bookingRecord.id,
    title: bookingRecord.title,
    attendee_name: bookingRecord.attendee_name,
    attendee_email: bookingRecord.attendee_email,
    start_time: bookingRecord.start_time,
    end_time: bookingRecord.end_time,
    notes: thread.subject,
    additional_guests: [], // Email Bot doesn't support additional guests yet
    recurrence_rule: bookingRecord.recurrence_rule || null,
    recurrence_end_date: bookingRecord.recurrence_end_date || null
  });

  // Update booking with calendar event info
  let meetLink = null;
  if (calendarEvent) {
    meetLink = calendarEvent.meetLink;
    await pool.query(`
      UPDATE bookings
      SET meet_link = $1, calendar_event_id = $2
      WHERE id = $3
    `, [calendarEvent.meetLink, calendarEvent.eventId, bookingRecord.id]);
    console.log('✅ Calendar event created with Meet link:', meetLink);
  } else {
    console.log('⚠️ Calendar event creation failed, continuing without Meet link');
  }

  // Update thread status
  await pool.query(`
    UPDATE email_bot_threads
    SET status = 'booked', booking_id = $1, updated_at = NOW()
    WHERE id = $2
  `, [bookingRecord.id, thread.id]);

  // Generate confirmation email
  const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';
  const formattedDate = selectedTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const formattedTime = selectedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return {
    subject: `Confirmed: ${thread.subject}`,
    body: generateConfirmationEmail({
      formattedDate,
      formattedTime,
      duration,
      participants: `${user.name} & ${guest.name || guest.email}`,
      manageUrl: `${bookingBaseUrl}/manage/${manageToken}`,
      meetLink: meetLink || ''
    })
  };
}

/**
 * Handle already booked thread
 */
async function handleAlreadyBooked(thread, user) {
  const booking = await pool.query(
    'SELECT * FROM bookings WHERE id = $1',
    [thread.booking_id]
  );

  if (!booking.rows[0]) {
    return null;
  }

  const b = booking.rows[0];
  const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';
  const formattedDate = new Date(b.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const formattedTime = new Date(b.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return {
    subject: `Re: ${thread.subject}`,
    body: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Already Scheduled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td align="center" bgcolor="#3b82f6" style="background-color: #3b82f6; padding: 32px 24px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">Already Scheduled</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #71717a; line-height: 1.6;">
                This meeting has already been scheduled:
              </p>
              <!-- Meeting Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="font-size: 14px; color: #71717a;">Date</span><br />
                          <span style="font-size: 16px; font-weight: 600; color: #18181b;">${formattedDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="font-size: 14px; color: #71717a;">Time</span><br />
                          <span style="font-size: 16px; font-weight: 600; color: #18181b;">${formattedTime}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 24px 0; font-size: 15px; color: #71717a; text-align: center;">
                Need to make changes?
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#8b5cf6" style="background-color: #8b5cf6; border-radius: 8px;">
                    <a href="${bookingBaseUrl}/manage/${b.manage_token}" target="_blank" style="display: block; padding: 16px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; text-align: center;">
                      Manage Booking
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 24px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                Powered by <span style="color: #71717a; font-weight: 600;">TruCal</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  };
}

/**
 * Handle reschedule request
 */
async function handleRescheduleRequest(thread, user, intent) {
  // Mark thread for rescheduling and propose new times
  await pool.query(
    "UPDATE email_bot_threads SET status = 'active', booking_id = NULL WHERE id = $1",
    [thread.id]
  );

  const settings = await getBotSettings(user.id);
  return proposeAvailableTimes(thread, user, settings, intent);
}

/**
 * Handle cancel request
 */
async function handleCancelRequest(thread, user) {
  if (thread.booking_id) {
    await pool.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1",
      [thread.booking_id]
    );
  }

  await pool.query(
    "UPDATE email_bot_threads SET status = 'cancelled' WHERE id = $1",
    [thread.id]
  );

  const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';

  return {
    subject: `Re: ${thread.subject}`,
    body: generateCancelledEmail({
      calendarUrl: `${bookingBaseUrl}/${user.username}`
    })
  };
}

/**
 * Send email with exponential backoff retry
 */
async function sendEmailWithRetry(sendFunction, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await sendFunction();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      const errorMessage = error.message?.toLowerCase() || '';
      if (errorMessage.includes('invalid') || errorMessage.includes('forbidden')) {
        console.error(`❌ Non-retryable error: ${error.message}`);
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
      console.warn(`⚠️ Email send attempt ${attempt + 1}/${maxRetries} failed: ${error.message}`);

      if (attempt < maxRetries - 1) {
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`❌ All ${maxRetries} email send attempts failed`);
  throw lastError;
}

/**
 * Send the bot's response email via Mailgun with retry logic
 */
async function sendBotResponse(thread, user, response, originalEmail) {
  const participants = thread.participants || [];
  const recipients = participants.map(p => p.email).filter(e => e !== user.email);

  // Also CC the TruCal user
  const ccList = [user.email];

  // Generate dynamic FROM email based on user's username
  const fromEmail = `${user.username}@${MAILGUN_DOMAIN}`;
  const fromName = BOT_NAME;

  const messageData = {
    from: `${fromName} <${fromEmail}>`,
    to: recipients,
    cc: ccList,
    subject: response.subject,
    html: response.body,
    'h:Reply-To': fromEmail,
    'h:In-Reply-To': originalEmail.messageId || '',
    'h:References': originalEmail.messageId || ''
  };

  try {
    // Send via Mailgun with retry
    const result = await sendEmailWithRetry(async () => {
      return await mg.messages.create(MAILGUN_DOMAIN, messageData);
    });

    console.log(`📤 Mailgun response:`, result);

    // Store outbound message
    await storeMessage(thread.id, 'outbound', {
      from: { email: fromEmail, name: fromName },
      to: recipients.map(e => ({ email: e })),
      subject: response.subject,
      html: response.body,
      messageId: result.id || `bot-${Date.now()}@${MAILGUN_DOMAIN}`
    });

    console.log(`✅ Sent bot response from ${fromEmail} to: ${recipients.join(', ')}`);
  } catch (error) {
    console.error('❌ Failed to send bot response after retries:', error);

    // Store failure in database for monitoring
    try {
      await pool.query(`
        INSERT INTO email_send_failures (thread_id, recipient, error_message, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT DO NOTHING
      `, [thread.id, recipients.join(','), error.message]);
    } catch (dbError) {
      console.error('⚠️ Could not log email failure (table may not exist):', dbError.message);
    }

    throw error;
  }
}

/**
 * Build conflict email HTML with alternative times
 */
async function buildConflictEmail(user, guest, data) {
  const { originalTime, duration, conflicts, alternatives, thread } = data;

  const formattedOriginalTime = DateTime.fromJSDate(originalTime)
    .setZone(user.timezone || 'America/New_York')
    .toFormat('EEE, MMM d \'at\' h:mm a');

  // Build slots HTML for alternative times
  const slotsHtml = alternatives.map((alt, index) => {
    const altStart = DateTime.fromJSDate(alt.start).setZone(user.timezone || 'America/New_York');
    const selectionUrl = `${process.env.FRONTEND_URL || 'https://trucal.xyz'}/book/select?thread=${thread.id}&time=${alt.start.toISOString()}`;

    return `
      <tr>
        <td style="padding: 8px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius: 8px; overflow: hidden; border: 1px solid #E5E7EB;">
            <tr>
              <td style="padding: 12px 16px; background-color: #ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width: 70%;">
                      <p style="margin: 0; font-size: 15px; font-weight: 600; color: #18181b;">
                        ${altStart.toFormat('EEE, MMM d')}
                      </p>
                      <p style="margin: 4px 0 0 0; font-size: 14px; color: #71717a;">
                        ${altStart.toFormat('h:mm a')} - ${altStart.plus({ minutes: duration }).toFormat('h:mm a')}
                      </p>
                    </td>
                    <td style="width: 30%; text-align: right;">
                      <a href="${selectionUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">
                        Select
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');

  const conflictTitle = conflicts[0]?.title || 'another meeting';

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Time Conflict - Pick Another Time</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 24px;">
              <div style="width: 40px; height: 40px; background: rgba(255, 255, 255, 0.25); border-radius: 50%; display: inline-flex; align-items: center; justify-center; margin-bottom: 8px;">
                <span style="font-size: 20px;">⚠️</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">Time Conflict</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 24px 20px;">
              <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #18181b;">
                Hi ${guest.name || guest.email.split('@')[0]}! 👋
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #52525b; line-height: 1.6;">
                Unfortunately, <strong>${formattedOriginalTime}</strong> is no longer available because it conflicts with "${conflictTitle}".
              </p>

              <p style="margin: 0 0 20px 0; font-size: 15px; color: #52525b; line-height: 1.6;">
                Here are some alternative times that work:
              </p>

              <!-- Alternative Slots -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${slotsHtml}
              </table>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #8b5cf6; text-align: center; font-weight: 600;">
                <a href="${process.env.FRONTEND_URL || 'https://trucal.xyz'}/${user.username}" style="color: #8b5cf6; text-decoration: none;">View full calendar →</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-align: center;">
                Powered by <span style="color: #71717a; font-weight: 600;">TruCal</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send conflict email via Mailgun
 */
async function sendConflictEmailViaMailgun(user, guestEmail, subject, htmlContent) {
  const fromEmail = `${user.username}@${MAILGUN_DOMAIN}`;
  const fromName = BOT_NAME;

  const messageData = {
    from: `${fromName} <${fromEmail}>`,
    to: [guestEmail],
    cc: [user.email],
    subject: `Re: ${subject}`,
    html: htmlContent,
    'h:Reply-To': fromEmail
  };

  try {
    const result = await sendEmailWithRetry(async () => {
      return await mg.messages.create(MAILGUN_DOMAIN, messageData);
    });

    console.log(`📤 Conflict email sent from ${fromEmail} to ${guestEmail}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to send conflict email:', error);
    throw error;
  }
}

module.exports = {
  processInboundEmail,
  getBotSettings,
  updateBotSettings,
  BOT_NAME,
  MAILGUN_DOMAIN
};
