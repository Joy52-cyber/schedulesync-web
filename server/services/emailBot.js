/**
 * Email Bot Service
 * Handles in-email scheduling via CC'd bot address
 */

const pool = require('../config/database');
const { sendEmail, sendTemplatedEmail } = require('./email');
const { createCalendarEvent } = require('./calendarService');
const { parseRecurrenceFromNaturalLanguage, generateRRule, formatRecurrenceText } = require('./recurrenceService');
const { checkBookingConflicts, findAlternativeSlots, formatConflictMessage } = require('./conflictDetection');
const { generateProactiveSuggestions } = require('./aiAssistantService');
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
 * Get user intelligence data for personalized email responses
 */
async function getUserIntelligence(userId, guestEmail = null) {
  try {
    // Get user's booking stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_bookings,
        COUNT(*) FILTER (WHERE start_time >= date_trunc('month', CURRENT_DATE)) as this_month,
        COUNT(*) FILTER (WHERE start_time >= date_trunc('week', CURRENT_DATE)) as this_week,
        COUNT(*) FILTER (WHERE start_time > NOW() AND status = 'confirmed') as upcoming
      FROM bookings
      WHERE user_id = $1
    `, [userId]);

    // Get behavioral patterns
    const patternsResult = await pool.query(`
      SELECT
        EXTRACT(DOW FROM start_time) as dow,
        COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND status = 'confirmed'
      GROUP BY EXTRACT(DOW FROM start_time)
      ORDER BY count DESC
      LIMIT 1
    `, [userId]);

    const hourPatternsResult = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM start_time) as hour,
        COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND status = 'confirmed'
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY count DESC
      LIMIT 1
    `, [userId]);

    // Get meeting templates
    const templatesResult = await pool.query(`
      SELECT id, name, description, duration, pre_agenda
      FROM meeting_templates
      WHERE (user_id = $1 OR is_public = TRUE)
      LIMIT 10
    `, [userId]).catch(() => ({ rows: [] }));

    // Get attendee relationship data if guestEmail provided
    let attendeeData = null;
    if (guestEmail) {
      const attendeeResult = await pool.query(`
        SELECT
          attendee_email,
          COUNT(*) as meeting_count,
          MAX(start_time) as last_meeting_date,
          SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) as total_minutes
        FROM bookings
        WHERE user_id = $1 AND LOWER(attendee_email) = LOWER($2) AND status != 'cancelled'
        GROUP BY attendee_email
      `, [userId, guestEmail]).catch(() => ({ rows: [] }));

      if (attendeeResult.rows.length > 0) {
        attendeeData = attendeeResult.rows[0];
      }
    }

    // Get top attendees
    const topAttendeesResult = await pool.query(`
      SELECT attendee_email, COUNT(*) as meeting_count
      FROM bookings
      WHERE user_id = $1 AND status != 'cancelled'
      GROUP BY attendee_email
      ORDER BY meeting_count DESC
      LIMIT 5
    `, [userId]).catch(() => ({ rows: [] }));

    // Get active smart rules
    const rulesResult = await pool.query(`
      SELECT id, name, trigger_type, action_type
      FROM scheduling_rules
      WHERE user_id = $1 AND is_active = TRUE
      LIMIT 5
    `, [userId]).catch(() => ({ rows: [] }));

    const stats = statsResult.rows[0];
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const popularDay = patternsResult.rows[0] ? dayMap[patternsResult.rows[0].dow] : null;
    const popularHour = hourPatternsResult.rows[0] ? parseInt(hourPatternsResult.rows[0].hour) : null;

    return {
      stats: {
        total_bookings: parseInt(stats.total_bookings) || 0,
        this_month: parseInt(stats.this_month) || 0,
        this_week: parseInt(stats.this_week) || 0,
        upcoming: parseInt(stats.upcoming) || 0,
        popular_day: popularDay,
        popular_hour: popularHour
      },
      templates: templatesResult.rows,
      attendeeData,
      topAttendees: topAttendeesResult.rows,
      activeRules: rulesResult.rows
    };
  } catch (error) {
    console.error('Error gathering user intelligence:', error);
    return {
      stats: { total_bookings: 0, this_month: 0, this_week: 0, upcoming: 0 },
      templates: [],
      attendeeData: null,
      topAttendees: [],
      activeRules: []
    };
  }
}

/**
 * Get personality instructions based on user preference
 */
function getPersonalityStyle(personality = 'friendly') {
  const styles = {
    friendly: {
      greeting: (name) => `Hi ${name}! 👋`,
      intro: "I'm helping coordinate a meeting",
      tone: 'warm and conversational'
    },
    professional: {
      greeting: (name) => `Good day${name ? ' ' + name : ''},`,
      intro: "I am coordinating a meeting on behalf of",
      tone: 'formal and concise'
    },
    concise: {
      greeting: (name) => name || 'Hello',
      intro: "Meeting request from",
      tone: 'brief and direct'
    }
  };
  return styles[personality] || styles.friendly;
}

/**
 * Detect meeting template based on email content and intent
 */
function detectMeetingTemplate(intent, subject, body, templates) {
  const text = `${subject} ${body}`.toLowerCase();

  // Template matching keywords
  const templateMatchers = {
    'sales': ['sales', 'pitch', 'demo', 'prospect', 'lead'],
    '1-on-1': ['1-on-1', '1:1', 'one-on-one', 'check-in', 'sync', 'catch up'],
    'demo': ['demo', 'walkthrough', 'presentation', 'show'],
    'standup': ['standup', 'stand-up', 'daily', 'scrum'],
    'kickoff': ['kickoff', 'kick-off', 'planning', 'project start'],
    'support': ['support', 'help', 'issue', 'problem', 'bug']
  };

  // Check meeting type from intent first
  if (intent.meetingType) {
    const matchingTemplate = templates.find(t =>
      t.name.toLowerCase().includes(intent.meetingType)
    );
    if (matchingTemplate) {
      console.log(`📋 Template matched from intent: ${matchingTemplate.name}`);
      return matchingTemplate;
    }
  }

  // Check text against template matchers
  for (const [type, keywords] of Object.entries(templateMatchers)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      const matchingTemplate = templates.find(t =>
        t.name.toLowerCase().includes(type) ||
        keywords.some(k => t.name.toLowerCase().includes(k))
      );
      if (matchingTemplate) {
        console.log(`📋 Template matched from keywords: ${matchingTemplate.name}`);
        return matchingTemplate;
      }
    }
  }

  return null;
}

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
 * Parse intent from email content using AI (Claude) - ENHANCED
 */
async function parseEmailIntentWithAI(subject, body, from) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1536,
      system: `You are a scheduling assistant. Parse the user's email to extract scheduling intent. Return ONLY valid JSON with no additional text:
{
  "action": "schedule" | "select_time" | "reschedule" | "cancel",
  "duration": <number in minutes, or null>,
  "preferences": <array of strings like "morning", "afternoon", "evening", "monday", "tuesday", etc., or specific dates>,
  "timeSlot": <ISO datetime string if selecting a specific time, or null>,
  "timezone": <detected timezone like "America/New_York" or null>,
  "meetingType": <detected type: "coffee", "lunch", "call", "video", "zoom", "phone", "in-person", "quick", "sales", "demo", "1-on-1", "standup", "kickoff", "support", or null>,
  "locationType": <"in-person" | "phone" | "video" | null>,
  "location": <specific location if mentioned, e.g., "downtown office", "Starbucks on Main St", null>,
  "isRecurring": <boolean, true if this is a recurring meeting>,
  "recurrencePattern": <string describing the recurrence like "every Monday", "bi-weekly on Tuesdays", "monthly", or null>,
  "additionalAttendees": <array of email addresses mentioned, or empty array>,
  "meetingPurpose": <brief summary of meeting purpose extracted from subject/body, or null>,
  "urgency": <"urgent" | "normal" | "flexible" based on language used>
}

Meeting Type Detection (EXTENDED):
- "coffee" → {meetingType: "coffee", duration: 30, locationType: "in-person", preferences: ["morning", "afternoon"]}
- "lunch" → {meetingType: "lunch", duration: 60, locationType: "in-person", preferences: ["11:00-14:00"]}
- "quick call" → {meetingType: "quick", duration: 15, locationType: "phone"}
- "zoom meeting" → {meetingType: "zoom", duration: 60, locationType: "video"}
- "phone call" → {meetingType: "call", duration: 30, locationType: "phone"}
- "in person" → {locationType: "in-person"}
- "sales call/pitch" → {meetingType: "sales", duration: 30, preferences: ["morning", "afternoon"]}
- "demo/walkthrough" → {meetingType: "demo", duration: 45, locationType: "video"}
- "1-on-1/check-in" → {meetingType: "1-on-1", duration: 30}
- "standup/daily" → {meetingType: "standup", duration: 15, preferences: ["morning"]}
- "kickoff/planning" → {meetingType: "kickoff", duration: 60}
- "support call" → {meetingType: "support", duration: 30}

Multiple Attendees Detection:
- "meeting with John and Sarah" → {additionalAttendees: ["john", "sarah"]}
- "cc john@company.com" → {additionalAttendees: ["john@company.com"]}
- Look for email addresses in body text

Meeting Purpose Extraction:
- "to discuss the Q1 project" → {meetingPurpose: "discuss Q1 project"}
- "about the new feature" → {meetingPurpose: "new feature"}
- Extract main topic/reason for meeting from subject or body

Urgency Detection:
- "ASAP", "urgent", "immediately", "today" → {urgency: "urgent"}
- "when you have time", "no rush", "eventually" → {urgency: "flexible"}
- Default → {urgency: "normal"}

Location Detection:
- "at the downtown office" → {location: "downtown office", locationType: "in-person"}
- "Starbucks on Main St" → {location: "Starbucks on Main St", locationType: "in-person"}

Complex Time Ranges:
- "next Tuesday after 2pm but before 5pm" → {preferences: ["tuesday", "14:00-17:00"]}
- "mornings only, between 9-11" → {preferences: ["morning", "09:00-11:00"]}

Recurring Meeting Detection:
- "every Monday at 2pm" → {isRecurring: true, recurrencePattern: "every Monday", preferences: ["monday", "14:00"]}
- "weekly standup on Tuesdays" → {isRecurring: true, recurrencePattern: "weekly on Tuesdays", preferences: ["tuesday"]}
- "bi-weekly check-in" → {isRecurring: true, recurrencePattern: "bi-weekly"}
- "monthly review on the 15th" → {isRecurring: true, recurrencePattern: "monthly on the 15th"}
- "every weekday at 9am" → {isRecurring: true, recurrencePattern: "every weekday", preferences: ["monday","tuesday","wednesday","thursday","friday", "09:00"]}

Examples:
- "Let's grab coffee next Tuesday to discuss the Q1 project" → {"action": "schedule", "meetingType": "coffee", "duration": 30, "preferences": ["tuesday", "morning"], "meetingPurpose": "discuss Q1 project", "urgency": "normal"}
- "URGENT: Need a quick 15-min call with John ASAP" → {"action": "schedule", "meetingType": "quick", "duration": 15, "locationType": "phone", "additionalAttendees": ["john"], "urgency": "urgent"}
- "Weekly team sync every Monday at 10am with Sarah and Mike" → {"action": "schedule", "duration": 60, "isRecurring": true, "recurrencePattern": "every Monday", "preferences": ["monday", "10:00"], "additionalAttendees": ["sarah", "mike"]}
- "Sales demo next week for Acme Corp" → {"action": "schedule", "meetingType": "sales", "duration": 30, "meetingPurpose": "demo for Acme Corp", "preferences": ["next_week"]}
- "Zoom call next Tuesday after 2pm to review the prototype" → {"action": "schedule", "meetingType": "zoom", "duration": 60, "locationType": "video", "preferences": ["tuesday", "14:00-17:00"], "meetingPurpose": "review prototype"}`,
      messages: [{
        role: 'user',
        content: `Subject: ${subject}\n\nBody: ${body}`
      }]
    });

    const parsed = JSON.parse(response.content[0].text);
    console.log('🤖 Claude parsed intent (enhanced):', parsed);

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
      location: parsed.location || null,
      isRecurring: parsed.isRecurring || false,
      recurrence: recurrence,
      additionalAttendees: parsed.additionalAttendees || [],
      meetingPurpose: parsed.meetingPurpose || null,
      urgency: parsed.urgency || 'normal'
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
 * Propose available times to the thread participants - ENHANCED WITH INTELLIGENCE
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

  // **NEW: Get guest email for intelligence gathering**
  const participants = thread.participants || [];
  const guest = participants.find(p => p.email !== user.email);
  const guestEmail = guest?.email;

  // **NEW: Gather user intelligence data**
  console.log('🧠 Gathering user intelligence for personalized response...');
  const intelligence = await getUserIntelligence(user.id, guestEmail);

  // **NEW: Detect matching meeting template**
  const matchedTemplate = detectMeetingTemplate(intent, thread.subject, '', intelligence.templates);

  // Check for multi-participant scheduling
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

  // **NEW: Generate proactive suggestions**
  const suggestions = generateProactiveSuggestions({
    stats: intelligence.stats,
    upcomingMeetings: [],
    templates: intelligence.templates,
    topAttendees: intelligence.topAttendees,
    activeRules: intelligence.activeRules
  });

  // Store proposed slots, guest timezone, meeting metadata, participant info, recurrence, and intelligence in thread
  await pool.query(
    'UPDATE email_bot_threads SET proposed_slots = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify({
      slots: slots,
      meetingType: meetingType,
      locationType: locationType,
      location: intent.location || null,
      duration: duration,
      trucalParticipants: trucalParticipants.map(p => ({ id: p.id, email: p.email, name: p.name })),
      isRecurring: intent.isRecurring || false,
      recurrence: intent.recurrence || null,
      meetingPurpose: intent.meetingPurpose || null,
      matchedTemplate: matchedTemplate ? { id: matchedTemplate.id, name: matchedTemplate.name } : null,
      urgency: intent.urgency || 'normal'
    }), thread.id]
  );

  return {
    subject: `Re: ${thread.subject}`,
    body: generateProposalEmail(user, thread, slots, settings, guestTimezone, meetingType, intelligence, matchedTemplate, suggestions, intent)
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
 * Generate the proposal email body - ENHANCED WITH INTELLIGENCE
 */
function generateProposalEmail(user, thread, slots, settings, guestTimezone = null, meetingType = null, intelligence = null, matchedTemplate = null, suggestions = [], intent = {}) {
  const participants = thread.participants || [];
  const guest = participants.find(p => p.email !== user.email);
  const guestName = guest?.name?.split(' ')[0] || 'there';
  const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';
  const duration = settings.default_duration || 30;

  // **NEW: Get personality style**
  const personality = settings.personality || 'friendly';
  const style = getPersonalityStyle(personality);

  // **NEW: Build personalized greeting**
  let greeting = style.greeting(guestName);

  // **NEW: Relationship intelligence - check if they've met before**
  let relationshipNote = '';
  if (intelligence?.attendeeData && intelligence.attendeeData.meeting_count > 0) {
    const count = intelligence.attendeeData.meeting_count;
    const lastMeeting = new Date(intelligence.attendeeData.last_meeting_date);
    const daysSince = Math.floor((Date.now() - lastMeeting.getTime()) / (1000 * 60 * 60 * 24));

    if (count === 1) {
      relationshipNote = `<p style="font-size: 14px; color: #6366f1; background-color: #eef2ff; padding: 12px; border-radius: 8px; margin: 12px 0;">💼 You've met with ${user.name} once before${daysSince < 30 ? ` (${daysSince} days ago)` : ''}.</p>`;
    } else {
      relationshipNote = `<p style="font-size: 14px; color: #6366f1; background-color: #eef2ff; padding: 12px; border-radius: 8px; margin: 12px 0;">💼 You've met with ${user.name} <strong>${count} times</strong> before. ${count > 5 ? 'Regular collaborator! 🤝' : ''}</p>`;
    }
  }

  // **NEW: Behavioral pattern insights**
  let behavioralNote = '';
  if (intelligence?.stats) {
    const { popular_day, popular_hour } = intelligence.stats;
    if (popular_day && popular_hour !== null) {
      const hour = popular_hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      behavioralNote = `<p style="font-size: 13px; color: #71717a; font-style: italic; margin: 8px 0;">💡 ${user.name} typically meets on ${popular_day}s around ${displayHour}:00 ${ampm}</p>`;
    }
  }

  // **NEW: Heavy week warning**
  let weeklyWarning = '';
  if (intelligence?.stats && intelligence.stats.this_week > 10) {
    weeklyWarning = `<p style="font-size: 13px; color: #f59e0b; background-color: #fffbeb; padding: 10px; border-radius: 6px; margin: 8px 0;">⚠️ ${user.name} has ${intelligence.stats.this_week} meetings this week. Consider next week if not urgent.</p>`;
  }

  // **NEW: Template-based agenda preview**
  let agendaNote = '';
  if (matchedTemplate && matchedTemplate.pre_agenda) {
    agendaNote = `
      <div style="background-color: #f0fdf4; border-left: 4px solid: #10b981; padding: 16px; margin: 16px 0; border-radius: 8px;">
        <h3 style="margin: 0 0 8px 0; font-size: 15px; color: #047857;">📋 Meeting Agenda</h3>
        <p style="margin: 0; font-size: 13px; color: #065f46; white-space: pre-wrap;">${matchedTemplate.pre_agenda.split('\n').slice(0, 5).join('\n')}</p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #10b981;"><em>Using "${matchedTemplate.name}" template</em></p>
      </div>
    `;
  }

  // **NEW: Proactive suggestions section**
  let suggestionsNote = '';
  if (suggestions && suggestions.length > 0) {
    const suggestionItems = suggestions.map(s =>
      `<li style="font-size: 13px; color: #64748b; margin: 4px 0;">${s.message}</li>`
    ).join('');
    suggestionsNote = `
      <div style="background-color: #fefce8; border-radius: 8px; padding: 14px; margin: 12px 0;">
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #854d0e;">💡 Proactive Tips</p>
        <ul style="margin: 0; padding-left: 20px;">${suggestionItems}</ul>
      </div>
    `;
  }

  // **NEW: Meeting purpose from AI extraction**
  let purposeNote = '';
  if (intent.meetingPurpose) {
    purposeNote = `<p style="font-size: 14px; color: #18181b; margin: 8px 0;"><strong>Purpose:</strong> ${intent.meetingPurpose}</p>`;
  }

  // **NEW: Location info**
  let locationNote = '';
  if (intent.location) {
    locationNote = `<p style="font-size: 14px; color: #18181b; margin: 8px 0;"><strong>📍 Location:</strong> ${intent.location}</p>`;
  }

  // **NEW: Urgency indicator**
  let urgencyNote = '';
  if (intent.urgency === 'urgent') {
    urgencyNote = `<p style="font-size: 14px; color: #dc2626; background-color: #fef2f2; padding: 10px; border-radius: 6px; margin: 12px 0;"><strong>🔥 Urgent Meeting Request</strong></p>`;
  } else if (intent.urgency === 'flexible') {
    urgencyNote = `<p style="font-size: 13px; color: #71717a; font-style: italic; margin: 8px 0;">⏰ Flexible timing - choose what works best for you</p>`;
  }

  // Customize intro based on meeting type and personality
  let intro = settings.intro_message || style.intro;

  if (meetingType && !settings.intro_message) {
    // Use personality-appropriate intros
    const meetingTypeIntros = {
      'coffee': personality === 'friendly' ? "I'm helping {{hostName}} schedule a coffee chat with you. ☕" : "{{hostName}} would like to schedule a coffee meeting with you.",
      'lunch': personality === 'friendly' ? "I'm helping {{hostName}} schedule a lunch meeting with you. 🍽️" : "{{hostName}} requests a lunch meeting.",
      'quick': personality === 'friendly' ? "I'm helping {{hostName}} schedule a quick call with you. 📞" : "{{hostName}} requests a brief call.",
      'call': "{{hostName}} would like to schedule a call with you. 📞",
      'video': "{{hostName}} would like to schedule a video meeting with you. 🎥",
      'zoom': "{{hostName}} would like to schedule a Zoom call with you. 💻",
      'sales': "{{hostName}} would like to schedule a sales call with you. 💼",
      'demo': "{{hostName}} would like to schedule a product demo with you. 🎯",
      '1-on-1': "{{hostName}} would like to schedule a 1-on-1 check-in. 🗣️",
      'support': "{{hostName}} would like to schedule a support call. 🛟"
    };
    intro = meetingTypeIntros[meetingType] || intro;
  }

  intro = intro.replace('{{hostName}}', user.name);

  // Add timezone note if guest timezone is detected
  let timezoneNote = '';
  if (guestTimezone) {
    timezoneNote = `<p style="font-size: 12px; color: #71717a; margin-top: 12px;">🌍 Times shown in both your timezone and ${user.name}'s timezone for convenience.</p>`;
  }

  // **NEW: Combine all intelligent notes**
  const fullIntroMessage = `
    ${greeting ? `<p style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${greeting}</p>` : ''}
    ${intro}
    ${urgencyNote}
    ${relationshipNote}
    ${purposeNote}
    ${locationNote}
    ${behavioralNote}
    ${weeklyWarning}
    ${timezoneNote}
    ${agendaNote}
    ${suggestionsNote}
  `;

  return generatePickATimeEmail({
    guestName,
    introMessage: fullIntroMessage,
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

  // Check if this is a recurring meeting and extract metadata
  const proposedData = thread.proposed_slots ? JSON.parse(thread.proposed_slots) : {};
  const isRecurring = proposedData.isRecurring || false;
  const recurrence = proposedData.recurrence || null;
  const meetingPurpose = proposedData.meetingPurpose || null;
  const matchedTemplate = proposedData.matchedTemplate || null;
  const location = proposedData.location || null;

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

  // **NEW: Build meeting title with purpose**
  let meetingTitle = matchedTemplate
    ? matchedTemplate.name
    : meetingPurpose
      ? `${meetingPurpose}`
      : `Meeting with ${guest.name || guest.email}`;

  // **NEW: Build meeting notes with template agenda and location**
  let meetingNotes = thread.subject || '';
  if (meetingPurpose) {
    meetingNotes += `\n\nPurpose: ${meetingPurpose}`;
  }
  if (location) {
    meetingNotes += `\n\nLocation: ${location}`;
  }
  if (matchedTemplate) {
    meetingNotes += `\n\n--- Template: ${matchedTemplate.name} ---`;
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
        start_time, end_time, status, manage_token, source, notes, location,
        is_recurring, recurrence_rule, recurrence_end_date,
        recurrence_frequency, recurrence_interval, recurrence_days_of_week
      ) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, 'email_bot', $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      user.id,
      meetingTitle,
      guest.name || guest.email.split('@')[0],
      guest.email,
      selectedTime,
      endTime,
      manageToken,
      meetingNotes,
      location,
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
        start_time, end_time, status, manage_token, source, notes, location
      ) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, 'email_bot', $8, $9)
      RETURNING *
    `, [
      user.id,
      meetingTitle,
      guest.name || guest.email.split('@')[0],
      guest.email,
      selectedTime,
      endTime,
      manageToken,
      meetingNotes,
      location
    ]);
  }

  const bookingRecord = booking.rows[0];

  // **NEW: Apply template - create meeting context and action items**
  if (matchedTemplate) {
    console.log(`📋 Applying template "${matchedTemplate.name}" to booking ${bookingRecord.id}`);

    // Try to get full template data
    try {
      const templateResult = await pool.query(
        'SELECT * FROM meeting_templates WHERE id = $1',
        [matchedTemplate.id]
      ).catch(() => ({ rows: [] }));

      if (templateResult.rows.length > 0) {
        const fullTemplate = templateResult.rows[0];

        // Create meeting context with template agenda
        if (fullTemplate.pre_agenda) {
          await pool.query(`
            INSERT INTO meeting_context (booking_id, generated_agenda, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (booking_id) DO UPDATE SET generated_agenda = EXCLUDED.generated_agenda
          `, [bookingRecord.id, fullTemplate.pre_agenda]).catch(err => {
            console.log('⚠️ Could not create meeting_context:', err.message);
          });
        }

        // Create default action items from template
        if (fullTemplate.default_action_items) {
          const actionItems = typeof fullTemplate.default_action_items === 'string'
            ? JSON.parse(fullTemplate.default_action_items)
            : fullTemplate.default_action_items;

          for (const item of actionItems) {
            await pool.query(`
              INSERT INTO booking_action_items (
                booking_id, description, assigned_to, due_date, created_at
              ) VALUES ($1, $2, $3, $4, NOW())
            `, [
              bookingRecord.id,
              item.description,
              item.assigned_to === 'host' ? user.email : guest.email,
              endTime // Due after the meeting
            ]).catch(err => {
              console.log('⚠️ Could not create action item:', err.message);
            });
          }
          console.log(`✅ Created ${actionItems.length} action items from template`);
        }
      }
    } catch (error) {
      console.log('⚠️ Error applying template:', error.message);
    }
  }

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
