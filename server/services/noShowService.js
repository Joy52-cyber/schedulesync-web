const pool = require('../config/database');
const { DateTime } = require('luxon');
const { sendEmail } = require('./email');
const { findAlternativeSlots } = require('./conflictDetection');
const mjml2html = require('mjml');

/**
 * Detect no-shows for meetings that ended but have no summary
 * Called by cron job every 15 minutes
 */
async function detectNoShows() {
  try {
    console.log('🔍 Checking for potential no-shows...');

    // Find meetings that:
    // - Ended 15+ minutes ago (but within last 48 hours)
    // - Are confirmed
    // - Have no summary sent (indicates meeting may not have happened)
    // - Haven't been handled yet
    const result = await pool.query(
      `SELECT b.*, u.email as user_email, u.name as user_name, u.timezone,
              u.logo_url, u.accent_color
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.status = 'confirmed'
         AND b.end_time < NOW() - INTERVAL '15 minutes'
         AND b.end_time > NOW() - INTERVAL '48 hours'
         AND b.meeting_summary IS NULL
         AND b.no_show_handled = FALSE`,
      []
    );

    console.log(`Found ${result.rows.length} potential no-shows`);

    for (const booking of result.rows) {
      await handleNoShow(booking);
    }

  } catch (error) {
    console.error('Error in detectNoShows:', error);
  }
}

/**
 * Handle a detected no-show by marking it and sending rescheduling email
 * @param {object} booking - The booking object with user details
 */
async function handleNoShow(booking) {
  try {
    // Mark as no-show
    await pool.query(
      `UPDATE bookings
       SET no_show_detected = TRUE, no_show_handled = TRUE
       WHERE id = $1`,
      [booking.id]
    );

    console.log(`📭 No-show detected for booking ${booking.id}: "${booking.title}"`);

    // Send rescheduling email to attendee
    await sendNoShowRescheduleEmail(booking);

  } catch (error) {
    console.error(`Error handling no-show for booking ${booking.id}:`, error);
  }
}

/**
 * Send rescheduling email to attendee after no-show
 * @param {object} booking - The booking object with user details
 */
async function sendNoShowRescheduleEmail(booking) {
  try {
    // Find alternative time slots (next 5 available)
    const alternatives = await findAlternativeSlots(
      booking.user_id,
      new Date(), // Start from now
      booking.duration || 30,
      {
        maxSlots: 5,
        maxDaysAhead: 14,
        timezone: booking.timezone || 'America/New_York'
      }
    );

    // Format the missed meeting time
    const missedTime = DateTime.fromJSDate(booking.start_time)
      .setZone(booking.timezone || 'America/New_York');
    const missedDate = missedTime.toFormat('EEEE, MMMM d');
    const missedTimeStr = missedTime.toFormat('h:mm a ZZZZ');

    // Build alternative slots HTML
    let slotsHtml = '';
    if (alternatives.length > 0) {
      const slotsList = alternatives.map((alt, index) => {
        const altTime = DateTime.fromJSDate(alt.start)
          .setZone(booking.timezone || 'America/New_York');
        const altDate = altTime.toFormat('EEE, MMM d');
        const altTimeStr = altTime.toFormat('h:mm a');

        // Generate rescheduling link
        const rescheduleUrl = `${process.env.FRONTEND_URL}/book/reschedule?booking=${booking.id}&time=${alt.start.toISOString()}`;

        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <strong>${altDate}</strong> at ${altTimeStr}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
              <a href="${rescheduleUrl}" style="background-color: ${booking.accent_color || '#6366f1'}; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Book This Time
              </a>
            </td>
          </tr>
        `;
      }).join('\n');

      slotsHtml = `
        <mj-section background-color="#f8f9fa" padding="20px">
          <mj-column>
            <mj-text font-size="18px" font-weight="600" color="#1a1a1a">
              📅 Available Times
            </mj-text>
            <mj-text font-size="14px" color="#6b7280">
              Click any time below to reschedule:
            </mj-text>
            <mj-table>
              ${slotsList}
            </mj-table>
          </mj-column>
        </mj-section>
      `;
    }

    // Cancel link
    const cancelUrl = `${process.env.FRONTEND_URL}/book/cancel?booking=${booking.id}`;

    // Build MJML template
    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="system-ui, -apple-system, sans-serif" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#ffffff">
          <!-- Header -->
          <mj-section background-color="${booking.accent_color || '#6366f1'}" padding="30px">
            <mj-column>
              <mj-text font-size="24px" font-weight="700" color="#ffffff" align="center">
                We Missed You! 👋
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Message -->
          <mj-section padding="30px">
            <mj-column>
              <mj-text font-size="16px" line-height="1.6" color="#1a1a1a">
                Hi ${booking.attendee_name},
              </mj-text>
              <mj-text font-size="16px" line-height="1.6" color="#1a1a1a">
                We noticed you weren't able to make our scheduled meeting on <strong>${missedDate}</strong> at <strong>${missedTimeStr}</strong>.
              </mj-text>
              <mj-text font-size="16px" line-height="1.6" color="#1a1a1a">
                No problem! Life happens. Would you like to reschedule?
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Available Slots -->
          ${slotsHtml}

          <!-- Cancel Option -->
          <mj-section padding="20px">
            <mj-column>
              <mj-text font-size="14px" color="#6b7280" align="center">
                No longer need to meet?
                <a href="${cancelUrl}" style="color: ${booking.accent_color || '#6366f1'}; text-decoration: underline;">
                  Cancel this booking
                </a>
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Footer -->
          <mj-section padding="20px">
            <mj-column>
              <mj-divider border-color="#e5e7eb" />
              <mj-text font-size="12px" color="#9ca3af" align="center">
                This is an automated message from ${booking.user_name} via TruCal
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    const { html } = mjml2html(mjmlTemplate);

    // Send email
    await sendEmail({
      to: booking.attendee_email,
      subject: `Reschedule: ${booking.title}?`,
      html: html,
      replyTo: booking.user_email
    });

    console.log(`✅ No-show reschedule email sent for booking ${booking.id} to ${booking.attendee_email}`);

  } catch (error) {
    console.error(`Error sending no-show email for booking ${booking.id}:`, error);
  }
}

module.exports = {
  detectNoShows,
  handleNoShow,
  sendNoShowRescheduleEmail
};
