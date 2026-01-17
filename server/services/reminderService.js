/**
 * Email Reminder Service
 * Sends automated reminders for upcoming bookings
 * Run this as a cron job every hour: node server/services/reminderService.js
 */

const pool = require('../config/database');
const { sendEmail } = require('./email');
const { DateTime } = require('luxon');

/**
 * Main function to check and send reminders
 */
async function sendBookingReminders() {
  console.log(`🔔 [${new Date().toISOString()}] Checking for bookings that need reminders...`);

  try {
    // Get all confirmed bookings in the next 48 hours
    const now = new Date();
    const futureWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours ahead

    const bookingsResult = await pool.query(`
      SELECT
        b.*,
        u.email as host_email,
        u.name as host_name,
        u.timezone as host_timezone,
        u.logo_url,
        u.accent_color,
        rs.enabled as reminders_enabled,
        rs.send_to_host,
        rs.send_to_guest,
        rs.custom_hours,
        mc.generated_agenda,
        ap.meeting_count,
        ap.last_meeting_date
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN reminder_settings rs ON rs.user_id = u.id
      LEFT JOIN meeting_context mc ON mc.booking_id = b.id
      LEFT JOIN attendee_profiles ap ON (ap.user_id = u.id AND ap.email = b.attendee_email)
      WHERE b.status = 'confirmed'
        AND b.start_time > $1
        AND b.start_time <= $2
        AND (rs.enabled IS NULL OR rs.enabled = true)
      ORDER BY b.start_time ASC
    `, [now, futureWindow]);

    console.log(`📅 Found ${bookingsResult.rows.length} upcoming bookings`);

    for (const booking of bookingsResult.rows) {
      await processBookingReminders(booking);
    }

    console.log(`✅ Reminder check complete`);
  } catch (error) {
    console.error('❌ Error in reminder service:', error);
    throw error;
  }
}

/**
 * Process reminders for a single booking
 */
async function processBookingReminders(booking) {
  const now = DateTime.now();
  const startTime = DateTime.fromJSDate(new Date(booking.start_time));
  const hoursUntilMeeting = startTime.diff(now, 'hours').hours;

  // Default reminder hours if not configured
  const reminderHours = booking.custom_hours || [24, 1];

  for (const hoursB efore of reminderHours) {
    // Check if we should send this reminder
    // Send if we're within 10 minutes of the reminder time
    const shouldSend =
      hoursUntilMeeting <= hoursBefore &&
      hoursUntilMeeting > (hoursBefore - 0.17); // 10 minutes tolerance

    if (!shouldSend) continue;

    // Check if already sent to host
    if (booking.send_to_host !== false) {
      const hostSent = await hasReminderBeenSent(booking.id, booking.host_email, hoursBefore);
      if (!hostSent) {
        await sendReminderEmail(booking, booking.host_email, 'host', hoursBefore);
      }
    }

    // Check if already sent to guest
    if (booking.send_to_guest !== false && booking.attendee_email) {
      const guestSent = await hasReminderBeenSent(booking.id, booking.attendee_email, hoursBefore);
      if (!guestSent) {
        await sendReminderEmail(booking, booking.attendee_email, 'guest', hoursBefore);
      }
    }
  }
}

/**
 * Check if a reminder has already been sent
 */
async function hasReminderBeenSent(bookingId, email, hoursBefore) {
  const result = await pool.query(`
    SELECT id FROM sent_reminders
    WHERE booking_id = $1
      AND recipient_email = $2
      AND hours_before = $3
  `, [bookingId, email, hoursBefore]);

  return result.rows.length > 0;
}

/**
 * Send reminder email and track it
 */
async function sendReminderEmail(booking, recipientEmail, recipientType, hoursBefore) {
  try {
    const startTime = DateTime.fromJSDate(new Date(booking.start_time))
      .setZone(booking.guest_timezone || booking.host_timezone || 'America/New_York');

    const timeLabel = hoursBefore >= 24
      ? `in ${Math.round(hoursBefore / 24)} day(s)`
      : `in ${hoursBefore} hour(s)`;

    const subject = `Reminder: Meeting ${timeLabel}`;
    const isHost = recipientType === 'host';

    // Build meet link button if available
    let meetLinkHtml = '';
    if (booking.meet_link) {
      meetLinkHtml = `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${booking.meet_link}"
             style="display: inline-block; padding: 14px 32px; background: ${booking.accent_color || '#7c3aed'}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
            🎥 Join Meeting
          </a>
        </div>
      `;
    }

    // Build agenda section if available
    let agendaHtml = '';
    if (booking.generated_agenda) {
      agendaHtml = `
        <div style="margin: 24px 0; padding: 16px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 6px;">
          <div style="font-size: 14px; font-weight: 600; color: #166534; margin-bottom: 8px;">📋 Meeting Agenda</div>
          <div style="font-size: 14px; color: #15803d; line-height: 1.6; white-space: pre-wrap;">${booking.generated_agenda}</div>
        </div>
      `;
    }

    // Build attendee history section if applicable
    let attendeeHistoryHtml = '';
    if (!isHost && booking.meeting_count && booking.meeting_count > 1) {
      const lastMeetingDate = DateTime.fromJSDate(booking.last_meeting_date).toFormat('MMM d, yyyy');
      attendeeHistoryHtml = `
        <div style="margin: 16px 0; padding: 12px; background: #eff6ff; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <div style="font-size: 13px; color: #1e40af;">
            💼 You've met with ${booking.host_name} <strong>${booking.meeting_count} times</strong>. Last meeting: ${lastMeetingDate}
          </div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">

          <!-- Header with gradient -->
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); padding: 40px 20px; text-align: center;">
            <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 32px;">🔔</span>
            </div>
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Meeting Reminder</h1>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">${timeLabel}</p>
          </div>

          <!-- Content -->
          <div style="padding: 32px 24px;">
            <p style="margin: 0 0 24px; font-size: 16px; color: #374151; line-height: 1.6;">
              ${isHost ? 'You have an upcoming meeting:' : 'Your upcoming meeting:'}
            </p>

            <!-- Meeting Details Card -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #7c3aed;">
              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">When</div>
                <div style="font-size: 18px; color: #111827; font-weight: 600;">
                  ${startTime.toFormat('EEEE, MMMM d, yyyy')}
                </div>
                <div style="font-size: 16px; color: #374151; margin-top: 4px;">
                  ${startTime.toFormat('h:mm a ZZZZ')}
                </div>
              </div>

              ${isHost ? `
                <div style="margin-bottom: 16px;">
                  <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">With</div>
                  <div style="font-size: 16px; color: #111827; font-weight: 500;">${booking.attendee_name || booking.attendee_email}</div>
                  <div style="font-size: 14px; color: #6b7280;">${booking.attendee_email}</div>
                </div>
              ` : `
                <div style="margin-bottom: 16px;">
                  <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">With</div>
                  <div style="font-size: 16px; color: #111827; font-weight: 500;">${booking.host_name}</div>
                  <div style="font-size: 14px; color: #6b7280;">${booking.host_email}</div>
                </div>
              `}

              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Duration</div>
                <div style="font-size: 16px; color: #111827;">${booking.duration} minutes</div>
              </div>

              ${booking.location ? `
                <div>
                  <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Location</div>
                  <div style="font-size: 16px; color: #111827;">${booking.location}</div>
                </div>
              ` : ''}

              ${booking.notes ? `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                  <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Notes</div>
                  <div style="font-size: 14px; color: #374151; line-height: 1.5;">${booking.notes}</div>
                </div>
              ` : ''}
            </div>

            <!-- Attendee History (for guests only) -->
            ${attendeeHistoryHtml}

            <!-- Meeting Agenda (if generated) -->
            ${agendaHtml}

            <!-- Meet Link Button -->
            ${meetLinkHtml}

            <!-- Action Button -->
            ${booking.manage_token ? `
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.trucal.xyz/manage/${booking.manage_token}"
                   style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #7c3aed, #ec4899); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                  ${isHost ? 'View Booking Details' : 'Manage Booking'}
                </a>
              </div>
            ` : ''}

            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center;">
                This is an automated reminder from <a href="https://www.trucal.xyz" style="color: #7c3aed; text-decoration: none;">TruCal</a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    await sendEmail(recipientEmail, subject, html);

    // Track sent reminder
    await pool.query(`
      INSERT INTO sent_reminders (booking_id, recipient_email, recipient_type, hours_before, email_status)
      VALUES ($1, $2, $3, $4, 'sent')
      ON CONFLICT (booking_id, recipient_email, hours_before) DO NOTHING
    `, [booking.id, recipientEmail, recipientType, hoursBefore]);

    console.log(`✅ Sent ${hoursBefore}h reminder to ${recipientType}: ${recipientEmail} for booking ${booking.id}`);
  } catch (error) {
    console.error(`❌ Failed to send reminder to ${recipientEmail}:`, error);

    // Track failed reminder
    await pool.query(`
      INSERT INTO sent_reminders (booking_id, recipient_email, recipient_type, hours_before, email_status)
      VALUES ($1, $2, $3, $4, 'failed')
      ON CONFLICT (booking_id, recipient_email, hours_before) DO UPDATE
      SET email_status = 'failed'
    `, [booking.id, recipientEmail, recipientType, hoursBefore]);
  }
}

// Run if called directly
if (require.main === module) {
  sendBookingReminders()
    .then(() => {
      console.log('✅ Reminder service completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Reminder service failed:', error);
      process.exit(1);
    });
}

module.exports = { sendBookingReminders };
