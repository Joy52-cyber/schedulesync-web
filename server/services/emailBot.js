/**
 * Email Bot Service
 * Handles in-email scheduling via CC'd bot address
 */

const pool = require('../config/database');
const { sendEmail, sendTemplatedEmail } = require('./email');
const crypto = require('crypto');
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const {
  generatePickATimeEmail,
  generateConfirmationEmail,
  generateCancelledEmail,
  generateNoSlotsEmail
} = require('./emailTemplates');

// Initialize Mailgun client
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || ''
});

// Bot name (email will be dynamic per user)
const BOT_NAME = 'TruCal Scheduling Assistant';
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
    const intent = parseEmailIntent(subject, text, from);
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
 * Looks for {username}@mg.trucal.xyz in To/CC and looks up user by username
 */
async function identifyTruCalUser(to, cc) {
  const allRecipients = [...(to || []), ...(cc || [])];

  // Find email matching our domain and extract username
  for (const recipient of allRecipients) {
    const email = recipient.email?.toLowerCase();
    if (email?.endsWith('@mg.trucal.xyz')) {
      // Extract username from email (e.g., joylacaba@mg.trucal.xyz -> joylacaba)
      const username = email.split('@')[0];

      console.log(`🔍 Extracted username from bot email: ${username}`);

      // Look up user by username
      const result = await pool.query(`
        SELECT id, email, name, username, timezone
        FROM users
        WHERE LOWER(username) = $1
        LIMIT 1
      `, [username]);

      if (result.rows[0]) {
        console.log(`✅ Found user by username: ${result.rows[0].email}`);
        return result.rows[0];
      } else {
        console.log(`❌ No user found with username: ${username}`);
      }
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
    // Create default settings
    result = await pool.query(`
      INSERT INTO email_bot_settings (user_id)
      VALUES ($1)
      RETURNING *
    `, [userId]);
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
 * Parse intent from email content
 */
function parseEmailIntent(subject, body, from) {
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
 * Propose available times to the thread participants
 */
async function proposeAvailableTimes(thread, user, settings, intent) {
  // Get user's availability
  const duration = intent.duration || settings.default_duration || 30;
  const slots = await getAvailableSlots(user.id, duration, intent.preferences, settings.max_slots_to_show);

  if (slots.length === 0) {
    return {
      subject: `Re: ${thread.subject}`,
      body: generateNoAvailabilityEmail(user, thread)
    };
  }

  // Store proposed slots
  await pool.query(
    'UPDATE email_bot_threads SET proposed_slots = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(slots), thread.id]
  );

  return {
    subject: `Re: ${thread.subject}`,
    body: generateProposalEmail(user, thread, slots, settings)
  };
}

/**
 * Get available time slots for user
 */
async function getAvailableSlots(userId, duration, preferences, maxSlots = 5) {
  const slots = [];
  const now = new Date();

  // Get user timezone
  const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
  const userTimezone = userResult.rows[0]?.timezone || 'America/New_York';

  // Look at next 14 days
  for (let day = 0; day < 14 && slots.length < maxSlots; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);

    // Skip weekends by default
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // Check day preferences
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (preferences.includes('this_week') && day > 7) continue;
    if (preferences.includes('next_week') && day < 7) continue;
    if (preferences.some(p => ['monday','tuesday','wednesday','thursday','friday'].includes(p))) {
      if (!preferences.includes(dayName)) continue;
    }

    // Get existing bookings for this day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const bookings = await pool.query(`
      SELECT start_time, end_time FROM bookings
      WHERE user_id = $1 AND status = 'confirmed'
        AND start_time >= $2 AND start_time <= $3
    `, [userId, dayStart, dayEnd]);

    const bookedSlots = bookings.rows;

    // Generate available slots (9 AM to 5 PM)
    let startHour = 9;
    let endHour = 17;

    // Apply time preferences
    if (preferences.includes('morning')) {
      endHour = 12;
    } else if (preferences.includes('afternoon')) {
      startHour = 12;
      endHour = 17;
    } else if (preferences.includes('evening')) {
      startHour = 17;
      endHour = 20;
    }

    for (let hour = startHour; hour < endHour && slots.length < maxSlots; hour++) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Skip if in the past
      if (slotStart < now) continue;

      // Skip if conflicts with existing booking
      const hasConflict = bookedSlots.some(b => {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        return slotStart < bEnd && slotEnd > bStart;
      });

      if (!hasConflict) {
        // Calculate day label (Today, Tomorrow, or day name)
        const dayLabel = getDayLabel(slotStart, now);

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          formatted: formatSlotForEmail(slotStart, duration),
          dayLabel: dayLabel
        });
      }
    }
  }

  return slots;
}

/**
 * Format a time slot for display in email
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
 * Get day label for a time slot (Today, Tomorrow, or day name)
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
 * Generate the proposal email body
 */
function generateProposalEmail(user, thread, slots, settings) {
  const participants = thread.participants || [];
  const guestName = participants.find(p => p.email !== user.email)?.name?.split(' ')[0] || 'there';
  const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';
  const duration = settings.default_duration || 30;

  const intro = (settings.intro_message || "I'm helping {{hostName}} schedule a meeting with you.")
    .replace('{{hostName}}', user.name);

  return generatePickATimeEmail({
    guestName,
    introMessage: intro,
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

  // Get default event type
  const settings = await getBotSettings(user.id);
  const duration = settings.default_duration || 30;

  const endTime = new Date(selectedTime);
  endTime.setMinutes(endTime.getMinutes() + duration);

  // Create booking
  const manageToken = crypto.randomBytes(32).toString('hex');

  const booking = await pool.query(`
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

  // Update thread status
  await pool.query(`
    UPDATE email_bot_threads
    SET status = 'booked', booking_id = $1, updated_at = NOW()
    WHERE id = $2
  `, [booking.rows[0].id, thread.id]);

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
      manageUrl: `${bookingBaseUrl}/manage/${manageToken}`
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
 * Send the bot's response email via Mailgun
 */
async function sendBotResponse(thread, user, response, originalEmail) {
  const participants = thread.participants || [];
  const recipients = participants.map(p => p.email).filter(e => e !== user.email);

  // Also CC the TruCal user
  const ccList = [user.email];

  // Generate dynamic FROM email based on user's username
  const fromEmail = `${user.username}@${MAILGUN_DOMAIN}`;
  const fromName = BOT_NAME;

  try {
    // Send via Mailgun
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

    const result = await mg.messages.create(MAILGUN_DOMAIN, messageData);
    console.log(`📤 Mailgun response:`, result);

    // Store outbound message
    await storeMessage(thread.id, 'outbound', {
      from: { email: fromEmail, name: fromName },
      to: recipients.map(e => ({ email: e })),
      subject: response.subject,
      html: response.body,
      messageId: result.id || `bot-${Date.now()}@${MAILGUN_DOMAIN}`
    });

    console.log(`📤 Sent bot response from ${fromEmail} to: ${recipients.join(', ')}`);
  } catch (error) {
    console.error('❌ Failed to send bot response:', error);
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
