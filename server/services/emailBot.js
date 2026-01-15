/**
 * Email Bot Service
 * Handles in-email scheduling via CC'd bot address
 */

const pool = require('../config/database');
const { sendEmail, sendTemplatedEmail } = require('./email');
const crypto = require('crypto');

// Main bot email address
const BOT_EMAIL = process.env.BOT_EMAIL || 'schedule@trucal.xyz';
const BOT_NAME = 'TruCal Scheduling Assistant';

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
 * Looks for bot email in To/CC and matches other recipients to users
 */
async function identifyTruCalUser(to, cc) {
  const allRecipients = [...(to || []), ...(cc || [])];

  // Check if our bot email is in recipients
  const hasBotEmail = allRecipients.some(r =>
    r.email.toLowerCase().includes('schedule@') ||
    r.email.toLowerCase().includes('trucal')
  );

  if (!hasBotEmail) {
    return null;
  }

  // Find TruCal user from other recipients
  const otherEmails = allRecipients
    .filter(r => !r.email.toLowerCase().includes('trucal'))
    .map(r => r.email.toLowerCase());

  if (otherEmails.length === 0) {
    return null;
  }

  // Query for user
  const result = await pool.query(`
    SELECT id, email, name, username, timezone
    FROM users
    WHERE LOWER(email) = ANY($1)
    LIMIT 1
  `, [otherEmails]);

  return result.rows[0] || null;
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
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          formatted: formatSlotForEmail(slotStart, duration)
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
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };

  return date.toLocaleDateString('en-US', options);
}

/**
 * Generate the proposal email body
 */
function generateProposalEmail(user, thread, slots, settings) {
  const participants = thread.participants || [];
  const guestName = participants.find(p => p.email !== user.email)?.name?.split(' ')[0] || 'there';

  const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';

  let slotsHtml = slots.map((slot, i) => {
    const confirmUrl = `${bookingBaseUrl}/quick-book?user=${user.username}&time=${encodeURIComponent(slot.start)}&thread=${thread.id}`;
    return `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
          <a href="${confirmUrl}" style="color: #7c3aed; text-decoration: none; font-weight: 500;">
            📅 ${slot.formatted}
          </a>
        </td>
      </tr>
    `;
  }).join('');

  const intro = (settings.intro_message || "I'm helping {{hostName}} find a time for your meeting.")
    .replace('{{hostName}}', user.name);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 500px; margin: 0 auto; padding: 20px; }
    .header { margin-bottom: 20px; }
    .slots-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; }
    .btn { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p>Hi ${guestName}! 👋</p>
      <p>${intro}</p>
      <p>Here are some available times:</p>
    </div>

    <table class="slots-table">
      ${slotsHtml}
    </table>

    <p style="margin-top: 20px;">
      <strong>Click any time above to book instantly!</strong>
    </p>

    <p style="color: #666; font-size: 14px;">
      Or view all available times:
      <a href="${bookingBaseUrl}/${user.username}" style="color: #7c3aed;">${bookingBaseUrl}/${user.username}</a>
    </p>

    <div class="footer">
      <p>${settings.signature || 'Powered by TruCal'}</p>
      <p style="font-size: 11px; color: #aaa;">
        This is an automated message from TruCal Scheduling Assistant.
        <a href="${bookingBaseUrl}/unsubscribe?thread=${thread.id}" style="color: #aaa;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate email when no availability
 */
function generateNoAvailabilityEmail(user, thread) {
  const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';

  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
  <p>Hi! 👋</p>
  <p>I'm helping ${user.name} find a time for your meeting, but I couldn't find any available slots in the next two weeks based on their current schedule.</p>
  <p>You can check their full availability here:</p>
  <p><a href="${bookingBaseUrl}/${user.username}" style="color: #7c3aed; font-weight: 600;">${bookingBaseUrl}/${user.username}</a></p>
  <p style="color: #888; font-size: 12px; margin-top: 30px;">Powered by TruCal</p>
</body>
</html>
  `;
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
    return {
      subject: `Re: ${thread.subject}`,
      body: `<p>Sorry, I couldn't identify the guest for this booking. Please book directly at the link provided.</p>`
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

  return {
    subject: `✅ Confirmed: ${thread.subject}`,
    body: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
  <div style="background: linear-gradient(135deg, #8b5cf6, #ec4899); padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Confirmed! ✅</h1>
  </div>

  <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 16px 16px;">
    <p>Great news! Your meeting has been scheduled.</p>

    <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <p style="margin: 8px 0;"><strong>📅 Date:</strong> ${selectedTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
      <p style="margin: 8px 0;"><strong>🕐 Time:</strong> ${selectedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
      <p style="margin: 8px 0;"><strong>⏱️ Duration:</strong> ${duration} minutes</p>
      <p style="margin: 8px 0;"><strong>👥 With:</strong> ${user.name} & ${guest.name || guest.email}</p>
    </div>

    <p style="text-align: center;">
      <a href="${bookingBaseUrl}/manage/${manageToken}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Manage Booking
      </a>
    </p>
  </div>

  <p style="color: #888; font-size: 12px; margin-top: 20px; text-align: center;">Powered by TruCal</p>
</body>
</html>
    `
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

  return {
    subject: `Re: ${thread.subject}`,
    body: `
<p>This meeting has already been scheduled for:</p>
<p><strong>${new Date(b.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${new Date(b.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</strong></p>
<p>Need to make changes? <a href="${bookingBaseUrl}/manage/${b.manage_token}">Manage booking</a></p>
    `
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

  return {
    subject: `Re: ${thread.subject}`,
    body: `
<p>The meeting has been cancelled as requested.</p>
<p>If you'd like to schedule a new time in the future, just reply to this thread or CC me again!</p>
<p style="color: #888; font-size: 12px; margin-top: 20px;">Powered by TruCal</p>
    `
  };
}

/**
 * Send the bot's response email
 */
async function sendBotResponse(thread, user, response, originalEmail) {
  const participants = thread.participants || [];
  const recipients = participants.map(p => p.email).filter(e => e !== user.email);

  // Also CC the TruCal user
  const ccList = [user.email];

  try {
    // Send via email service
    await sendEmail(
      recipients,
      response.subject,
      response.body,
      {
        from: `${BOT_NAME} <${BOT_EMAIL}>`,
        cc: ccList,
        replyTo: BOT_EMAIL,
        headers: {
          'In-Reply-To': originalEmail.messageId,
          'References': originalEmail.messageId
        }
      }
    );

    // Store outbound message
    await storeMessage(thread.id, 'outbound', {
      from: { email: BOT_EMAIL, name: BOT_NAME },
      to: recipients.map(e => ({ email: e })),
      subject: response.subject,
      html: response.body,
      messageId: `bot-${Date.now()}@trucal.xyz`
    });

    console.log(`📤 Sent bot response to: ${recipients.join(', ')}`);
  } catch (error) {
    console.error('❌ Failed to send bot response:', error);
    throw error;
  }
}

module.exports = {
  processInboundEmail,
  getBotSettings,
  updateBotSettings,
  BOT_EMAIL,
  BOT_NAME
};
