/**
 * Email Service
 * Handles all email sending functionality with templating support
 */

const { Resend } = require('resend');
const pool = require('../config/database');

const resend = new Resend(process.env.RESEND_API_KEY);

// Get user's preferred template for a type
const getUserEmailTemplate = async (userId, templateType) => {
  try {
    // First try favorite/default template
    let result = await pool.query(
      `SELECT * FROM email_templates
       WHERE user_id = $1 AND type = $2 AND (is_default = true OR is_active = true)
       ORDER BY is_default DESC, updated_at DESC LIMIT 1`,
      [userId, templateType]
    );

    if (result.rows[0]) return result.rows[0];

    // Fall back to any template of this type
    result = await pool.query(
      `SELECT * FROM email_templates
       WHERE user_id = $1 AND type = $2
       ORDER BY updated_at DESC LIMIT 1`,
      [userId, templateType]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching email template:', error);
    return null;
  }
};

// Replace {{variable}} placeholders with actual values
const replaceTemplateVariables = (text, variables) => {
  if (!text) return '';
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    result = result.replace(regex, value || '');
  });
  return result;
};

// Build variables object from booking data
const buildEmailVariables = (booking, organizer, extras = {}) => {
  const startTime = new Date(booking.start_time);
  const endTime = new Date(booking.end_time);

  return {
    guestName: booking.attendee_name || 'Guest',
    guest_name: booking.attendee_name || 'Guest',
    attendee_name: booking.attendee_name || 'Guest',
    guestEmail: booking.attendee_email || '',
    guest_email: booking.attendee_email || '',
    attendee_email: booking.attendee_email || '',
    organizerName: organizer?.name || 'Your Host',
    organizer_name: organizer?.name || 'Your Host',
    host_name: organizer?.name || 'Your Host',
    organizerEmail: organizer?.email || '',
    organizer_email: organizer?.email || '',
    meetingDate: startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    meeting_date: startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    date: startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    meetingTime: startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    meeting_time: startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    time: startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    meetingLink: booking.meet_link || '',
    meeting_link: booking.meet_link || '',
    meet_link: booking.meet_link || '',
    bookingLink: extras.bookingLink || '',
    booking_link: extras.bookingLink || '',
    manageLink: extras.manageLink || '',
    manage_link: extras.manageLink || '',
    eventName: booking.title || 'Meeting',
    event_name: booking.title || 'Meeting',
    title: booking.title || 'Meeting',
    duration: booking.duration || 30,
    notes: booking.notes || '',
    ...extras
  };
};

// Default templates when user has none - Modern HTML design
const DEFAULT_EMAIL_TEMPLATES = {
  confirmation: {
    subject: 'Meeting Confirmed: {{meetingTitle}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Meeting Confirmed!</h1>
    </div>
    <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hi {{guestName}},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Your meeting with <strong>{{hostName}}</strong> has been confirmed!
      </p>

      <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h2 style="color: #111827; font-size: 18px; margin: 0 0 16px 0;">{{meetingTitle}}</h2>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingDate}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingTime}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Duration</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingDuration}} minutes</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Location</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingLocation}}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="{{manageLink}}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Manage Booking
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
        Need to make changes? Use the button above to reschedule or cancel.
      </p>
    </div>

    <div style="text-align: center; padding: 24px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Powered by <a href="https://trucal.xyz" style="color: #8b5cf6; text-decoration: none;">TruCal</a>
      </p>
    </div>
  </div>
</body>
</html>`
  },

  reminder: {
    subject: 'Reminder: {{meetingTitle}} is coming up!',
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Meeting Reminder</h1>
    </div>
    <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hi {{guestName}},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        This is a friendly reminder that your meeting with <strong>{{hostName}}</strong> is coming up soon!
      </p>

      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 0 12px 12px 0; padding: 24px; margin: 24px 0;">
        <h2 style="color: #1e40af; font-size: 18px; margin: 0 0 16px 0;">{{meetingTitle}}</h2>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingDate}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingTime}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Location</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingLocation}}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="{{manageLink}}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Meeting Details
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
        Cannot make it? <a href="{{manageLink}}" style="color: #3b82f6;">Reschedule or cancel</a>
      </p>
    </div>

    <div style="text-align: center; padding: 24px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Powered by <a href="https://trucal.xyz" style="color: #8b5cf6; text-decoration: none;">TruCal</a>
      </p>
    </div>
  </div>
</body>
</html>`
  },

  cancellation: {
    subject: 'Meeting Cancelled: {{meetingTitle}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Meeting Cancelled</h1>
    </div>
    <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hi {{guestName}},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Your meeting with <strong>{{hostName}}</strong> has been cancelled.
      </p>

      <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 12px 12px 0; padding: 24px; margin: 24px 0;">
        <h2 style="color: #991b1b; font-size: 18px; margin: 0 0 16px 0; text-decoration: line-through;">{{meetingTitle}}</h2>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Was scheduled for</td>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px; text-align: right;">{{meetingDate}} at {{meetingTime}}</td>
          </tr>
        </table>
      </div>

      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 24px 0;">
        Want to reschedule? Book a new time below:
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="{{bookingLink}}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Book New Meeting
        </a>
      </div>
    </div>

    <div style="text-align: center; padding: 24px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Powered by <a href="https://trucal.xyz" style="color: #8b5cf6; text-decoration: none;">TruCal</a>
      </p>
    </div>
  </div>
</body>
</html>`
  },

  reschedule: {
    subject: 'Meeting Rescheduled: {{meetingTitle}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Meeting Rescheduled</h1>
    </div>
    <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hi {{guestName}},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Your meeting with <strong>{{hostName}}</strong> has been rescheduled to a new time.
      </p>

      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 12px 12px 0; padding: 24px; margin: 24px 0;">
        <h2 style="color: #92400e; font-size: 18px; margin: 0 0 16px 0;">{{meetingTitle}}</h2>
        <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">NEW TIME:</p>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingDate}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingTime}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Duration</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingDuration}} minutes</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Location</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{{meetingLocation}}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="{{manageLink}}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Updated Booking
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
        Need to make more changes? <a href="{{manageLink}}" style="color: #f59e0b;">Manage your booking</a>
      </p>
    </div>

    <div style="text-align: center; padding: 24px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Powered by <a href="https://trucal.xyz" style="color: #8b5cf6; text-decoration: none;">TruCal</a>
      </p>
    </div>
  </div>
</body>
</html>`
  }
};

// Send email using user's template or fallback to default
const sendTemplatedEmail = async (to, userId, templateType, variables, options = {}) => {
  try {
    // Check user's email preferences before sending
    if (userId && !options.skipPreferenceCheck) {
      const prefsResult = await pool.query(
        'SELECT email_preferences FROM users WHERE id = $1',
        [userId]
      );

      if (prefsResult.rows.length > 0 && prefsResult.rows[0].email_preferences) {
        const prefs = prefsResult.rows[0].email_preferences;

        // Map template types to preference fields
        const prefMap = {
          'confirmation': 'send_confirmations',
          'reminder': 'send_reminders',
          'cancellation': 'send_cancellations',
          'reschedule': 'send_reschedule'
        };

        const prefKey = prefMap[templateType];
        if (prefKey && prefs[prefKey] === false) {
          console.log(`Skipping ${templateType} email to ${to} - disabled in user preferences`);
          return { skipped: true, reason: 'disabled_by_preference' };
        }
      }
    }

    let subject, body;

    // Try user's custom template first
    const userTemplate = userId ? await getUserEmailTemplate(userId, templateType) : null;

    if (userTemplate) {
      subject = replaceTemplateVariables(userTemplate.subject, variables);
      body = replaceTemplateVariables(userTemplate.body, variables);
      console.log(`Using custom template: ${userTemplate.name}`);
    } else {
      // Use default template
      const defaultTpl = DEFAULT_EMAIL_TEMPLATES[templateType];
      if (defaultTpl) {
        subject = replaceTemplateVariables(defaultTpl.subject, variables);
        body = replaceTemplateVariables(defaultTpl.body, variables);
        console.log(`Using default ${templateType} template`);
      } else {
        // Ultimate fallback
        subject = options.fallbackSubject || 'ScheduleSync Notification';
        body = options.fallbackBody || 'You have a notification from ScheduleSync.';
      }
    }

    // Check if body is already full HTML (starts with <!DOCTYPE or <html>)
    const isFullHtml = body.trim().startsWith('<!DOCTYPE') || body.trim().startsWith('<html');

    const emailPayload = {
      from: options.from || 'ScheduleSync <notifications@trucal.xyz>',
      to: to,
      subject: subject,
      html: isFullHtml ? body : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">
${body}
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            Sent via <a href="https://trucal.xyz" style="color: #6366f1;">TruCal</a>
          </div>
        </div>
      `,
    };

    // Support attachments (like ICS files)
    if (options.attachments) {
      emailPayload.attachments = options.attachments;
    }

    const result = await resend.emails.send(emailPayload);

    console.log(`Templated email sent to ${to}`);
    return result;
  } catch (error) {
    console.error(`Failed to send templated email to ${to}:`, error);
    throw error;
  }
};

// Simple email send (no templating)
const sendEmail = async (to, subject, html, options = {}) => {
  try {
    const result = await resend.emails.send({
      from: options.from || 'ScheduleSync <notifications@trucal.xyz>',
      to,
      subject,
      html,
      ...options
    });
    console.log(`Email sent to ${to}`);
    return result;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
};

module.exports = {
  resend,
  sendEmail,
  sendTemplatedEmail,
  getUserEmailTemplate,
  replaceTemplateVariables,
  buildEmailVariables,
  DEFAULT_EMAIL_TEMPLATES
};
