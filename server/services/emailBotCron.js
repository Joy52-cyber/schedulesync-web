/**
 * Email Bot Cron Jobs
 * Handles automated follow-ups, reminders, and thread cleanup
 */

const cron = require('node-cron');
const pool = require('../config/database');
const { DateTime } = require('luxon');
const { sendEmail } = require('./email');
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const {
  generateReminderEmail,
  generateExpiredSlotsEmail,
  generateThreadClosedEmail
} = require('./emailTemplates');

// Initialize Mailgun client
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || ''
});

const BOT_NAME = 'TruCal Scheduling Assistant';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mg.trucal.xyz';

/**
 * Initialize all Email Bot cron jobs
 */
function initializeEmailBotCron() {
  console.log('📅 Initializing Email Bot cron jobs...');

  // Run every 6 hours to check for threads needing follow-up
  cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ Running Email Bot follow-up check...');
    await checkAndSendFollowups();
  });

  // Run daily to check for expired slots and thread cleanup
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Running Email Bot expired slots check...');
    await checkExpiredSlots();
    await closeInactiveThreads();
  });

  console.log('✅ Email Bot cron jobs initialized');
}

/**
 * Check for threads needing follow-up and send reminder emails
 * Criteria:
 * - Thread status = 'active'
 * - Has proposed_slots
 * - Last message was outbound (bot sent proposals)
 * - No inbound response in 24 hours
 */
async function checkAndSendFollowups() {
  try {
    const query = `
      SELECT DISTINCT ON (t.id)
        t.id as thread_id,
        t.user_id,
        t.subject,
        t.participants,
        t.proposed_slots,
        t.updated_at,
        u.name as user_name,
        u.username,
        u.email as user_email,
        ebs.intro_message,
        ebs.signature,
        m.created_at as last_message_at,
        m.direction as last_message_direction
      FROM email_bot_threads t
      JOIN users u ON u.id = t.user_id
      JOIN email_bot_settings ebs ON ebs.user_id = t.user_id
      LEFT JOIN email_bot_messages m ON m.thread_id = t.id
      WHERE t.status = 'active'
        AND t.proposed_slots IS NOT NULL
        AND ebs.is_enabled = true
      ORDER BY t.id, m.created_at DESC
    `;

    const result = await pool.query(query);

    for (const thread of result.rows) {
      // Skip if last message was inbound (guest already responded)
      if (thread.last_message_direction === 'inbound') {
        continue;
      }

      // Check if 24 hours have passed since last message
      const lastMessageTime = DateTime.fromJSDate(new Date(thread.last_message_at));
      const now = DateTime.now();
      const hoursSinceLastMessage = now.diff(lastMessageTime, 'hours').hours;

      if (hoursSinceLastMessage < 24) {
        continue;
      }

      // Check if slots haven't all expired
      const proposedData = JSON.parse(thread.proposed_slots);
      const slots = proposedData.slots || [];
      const validSlots = slots.filter(slot => {
        const slotTime = DateTime.fromISO(slot.start);
        return slotTime > now;
      });

      if (validSlots.length === 0) {
        console.log(`⏰ Thread ${thread.thread_id}: All slots expired, skipping follow-up`);
        continue;
      }

      // Send reminder
      console.log(`📧 Sending follow-up reminder for thread ${thread.thread_id}`);
      await sendFollowupReminder(thread, validSlots);

      // Update thread to mark that we sent a follow-up
      await pool.query(`
        UPDATE email_bot_threads
        SET updated_at = NOW()
        WHERE id = $1
      `, [thread.thread_id]);
    }

    console.log(`✅ Checked ${result.rows.length} threads for follow-ups`);
  } catch (error) {
    console.error('❌ Error checking follow-ups:', error);
  }
}

/**
 * Send a follow-up reminder email
 */
async function sendFollowupReminder(thread, validSlots) {
  try {
    const participants = thread.participants || [];
    const guest = participants.find(p => p.email !== thread.user_email);

    if (!guest) {
      console.log(`⚠️ No guest found for thread ${thread.thread_id}`);
      return;
    }

    const guestName = guest.name?.split(' ')[0] || 'there';
    const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';

    const emailBody = generateReminderEmail({
      guestName,
      hostName: thread.user_name,
      slots: validSlots,
      baseUrl: bookingBaseUrl,
      username: thread.username,
      threadId: thread.thread_id,
      calendarUrl: `${bookingBaseUrl}/${thread.username}`,
      signature: thread.signature || 'Powered by <span style="color: #71717a; font-weight: 600;">TruCal</span>'
    });

    const fromEmail = `${thread.username}@${MAILGUN_DOMAIN}`;

    await mg.messages.create(MAILGUN_DOMAIN, {
      from: `${BOT_NAME} <${fromEmail}>`,
      to: guest.email,
      cc: thread.user_email,
      subject: `Re: ${thread.subject}`,
      html: emailBody,
      'h:Reply-To': fromEmail
    });

    // Store the message
    await pool.query(`
      INSERT INTO email_bot_messages (
        thread_id, message_id, direction, from_email, from_name,
        to_emails, subject, body_html
      ) VALUES ($1, $2, 'outbound', $3, $4, $5, $6, $7)
    `, [
      thread.thread_id,
      `followup-${Date.now()}@${MAILGUN_DOMAIN}`,
      fromEmail,
      BOT_NAME,
      JSON.stringify([{ email: guest.email }]),
      `Re: ${thread.subject}`,
      emailBody
    ]);

    console.log(`✅ Sent follow-up reminder to ${guest.email}`);
  } catch (error) {
    console.error('❌ Error sending follow-up reminder:', error);
  }
}

/**
 * Check for expired slots and propose new ones
 * Criteria:
 * - Thread status = 'active'
 * - All proposed slots have expired
 * - Thread age < 7 days
 */
async function checkExpiredSlots() {
  try {
    const query = `
      SELECT
        t.id as thread_id,
        t.user_id,
        t.subject,
        t.participants,
        t.proposed_slots,
        t.created_at,
        u.name as user_name,
        u.username,
        u.email as user_email,
        u.timezone,
        ebs.default_duration,
        ebs.max_slots_to_show,
        ebs.intro_message,
        ebs.signature
      FROM email_bot_threads t
      JOIN users u ON u.id = t.user_id
      JOIN email_bot_settings ebs ON ebs.user_id = t.user_id
      WHERE t.status = 'active'
        AND t.proposed_slots IS NOT NULL
        AND ebs.is_enabled = true
        AND t.created_at > NOW() - INTERVAL '7 days'
    `;

    const result = await pool.query(query);
    const now = DateTime.now();

    for (const thread of result.rows) {
      const proposedData = JSON.parse(thread.proposed_slots);
      const slots = proposedData.slots || [];

      // Check if all slots expired
      const allExpired = slots.every(slot => {
        const slotTime = DateTime.fromISO(slot.start);
        return slotTime <= now;
      });

      if (!allExpired) {
        continue;
      }

      console.log(`🔄 Thread ${thread.thread_id}: All slots expired, proposing new ones`);

      // Get new available slots
      const { getAvailableSlots } = require('./emailBot');
      const duration = proposedData.duration || thread.default_duration || 30;
      const newSlots = await getAvailableSlots(
        thread.user_id,
        duration,
        [], // No preferences
        thread.max_slots_to_show || 5
      );

      if (newSlots.length === 0) {
        console.log(`⚠️ No new slots available for thread ${thread.thread_id}`);
        continue;
      }

      // Send email with new slots
      await sendExpiredSlotsEmail(thread, newSlots);

      // Update thread with new slots
      await pool.query(`
        UPDATE email_bot_threads
        SET proposed_slots = $1, updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify({ ...proposedData, slots: newSlots }), thread.thread_id]);
    }

    console.log(`✅ Checked ${result.rows.length} threads for expired slots`);
  } catch (error) {
    console.error('❌ Error checking expired slots:', error);
  }
}

/**
 * Send email with new slots after previous ones expired
 */
async function sendExpiredSlotsEmail(thread, newSlots) {
  try {
    const participants = thread.participants || [];
    const guest = participants.find(p => p.email !== thread.user_email);

    if (!guest) {
      console.log(`⚠️ No guest found for thread ${thread.thread_id}`);
      return;
    }

    const guestName = guest.name?.split(' ')[0] || 'there';
    const bookingBaseUrl = process.env.FRONTEND_URL || 'https://trucal.xyz';

    const emailBody = generateExpiredSlotsEmail({
      guestName,
      hostName: thread.user_name,
      slots: newSlots,
      baseUrl: bookingBaseUrl,
      username: thread.username,
      threadId: thread.thread_id,
      calendarUrl: `${bookingBaseUrl}/${thread.username}`,
      signature: thread.signature || 'Powered by <span style="color: #71717a; font-weight: 600;">TruCal</span>'
    });

    const fromEmail = `${thread.username}@${MAILGUN_DOMAIN}`;

    await mg.messages.create(MAILGUN_DOMAIN, {
      from: `${BOT_NAME} <${fromEmail}>`,
      to: guest.email,
      cc: thread.user_email,
      subject: `Re: ${thread.subject}`,
      html: emailBody,
      'h:Reply-To': fromEmail
    });

    // Store the message
    await pool.query(`
      INSERT INTO email_bot_messages (
        thread_id, message_id, direction, from_email, from_name,
        to_emails, subject, body_html
      ) VALUES ($1, $2, 'outbound', $3, $4, $5, $6, $7)
    `, [
      thread.thread_id,
      `expired-${Date.now()}@${MAILGUN_DOMAIN}`,
      fromEmail,
      BOT_NAME,
      JSON.stringify([{ email: guest.email }]),
      `Re: ${thread.subject}`,
      emailBody
    ]);

    console.log(`✅ Sent expired slots email to ${guest.email}`);
  } catch (error) {
    console.error('❌ Error sending expired slots email:', error);
  }
}

/**
 * Close inactive threads after 7 days
 * Criteria:
 * - Thread status = 'active'
 * - No activity in 7 days
 */
async function closeInactiveThreads() {
  try {
    const query = `
      UPDATE email_bot_threads
      SET status = 'closed', updated_at = NOW()
      WHERE status = 'active'
        AND updated_at < NOW() - INTERVAL '7 days'
      RETURNING id
    `;

    const result = await pool.query(query);

    if (result.rows.length > 0) {
      console.log(`🔒 Closed ${result.rows.length} inactive threads`);

      // Optionally send closure notification
      for (const thread of result.rows) {
        // Could send a "thread closed" email here if needed
        console.log(`  - Thread ${thread.id} closed`);
      }
    }
  } catch (error) {
    console.error('❌ Error closing inactive threads:', error);
  }
}

module.exports = {
  initializeEmailBotCron,
  checkAndSendFollowups,
  checkExpiredSlots,
  closeInactiveThreads
};
