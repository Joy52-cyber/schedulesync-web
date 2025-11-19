// emailTemplates.js - COMPLETE FIXED VERSION

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatTime = (dateString) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};

// Base email wrapper with branding
const emailWrapper = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ScheduleSync</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.2); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 32px;">📅</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">ScheduleSync</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 14px;">Smart Team Scheduling</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                This email was sent by <strong style="color: #3B82F6;">ScheduleSync</strong>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Manage your bookings at <a href="${process.env.FRONTEND_URL}" style="color: #3B82F6; text-decoration: none;">schedulesync.com</a>
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

const bookingConfirmationGuest = (booking) => {
  const manageUrl = `${process.env.FRONTEND_URL}/manage/${booking.booking_token || booking.id}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="background-color: #10b981; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="font-size: 40px; color: white;">✓</span>
      </div>
      <h2 style="color: #111827; margin: 0 0 8px; font-size: 24px; font-weight: bold;">Booking Confirmed!</h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px;">Your meeting has been scheduled</p>
    </div>

    <div style="background: linear-gradient(135deg, #eff6ff 0%, #f3e8ff 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280; font-size: 14px;">📅 Date</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #111827; font-size: 14px;">${formatDate(booking.start_time)}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280; font-size: 14px;">🕐 Time</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #111827; font-size: 14px;">${formatTime(booking.start_time)}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280; font-size: 14px;">👤 With</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #111827; font-size: 14px;">${booking.organizer_name || booking.team_name}</strong>
          </td>
        </tr>
        ${booking.notes ? `
        <tr>
          <td colspan="2" style="padding: 16px 0 8px; border-top: 1px solid rgba(0,0,0,0.1);">
            <span style="color: #6b7280; font-size: 14px;">📝 Notes</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 0 0 8px;">
            <p style="color: #111827; font-size: 14px; margin: 0; line-height: 1.6;">${booking.notes}</p>
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div style="background-color: #eff6ff; border-left: 4px solid #3B82F6; border-radius: 8px; padding: 16px; margin-bottom: 30px;">
      <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6;">
        <strong>💡 Next Steps:</strong><br>
        • A calendar invite has been sent to your email<br>
        • Add this event to your calendar<br>
        • You'll receive a reminder 24 hours before the meeting
      </p>
    </div>

    <div style="text-align: center;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">
        Need to reschedule or cancel?
      </p>
      <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
        <tr>
          <td style="padding: 0 8px;">
            <a href="${manageUrl}?action=reschedule" style="display: inline-block; background-color: #3B82F6; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              🔄 Reschedule
            </a>
          </td>
          <td style="padding: 0 8px;">
            <a href="${manageUrl}?action=cancel" style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid #e5e7eb;">
              ❌ Cancel
            </a>
          </td>
        </tr>
      </table>
    </div>
  `;
  
  return emailWrapper(content);
};

const bookingConfirmationOrganizer = (booking) => {
  const manageUrl = `${process.env.FRONTEND_URL}/manage/${booking.booking_token || booking.id}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="background-color: #3B82F6; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="font-size: 40px; color: white;">📅</span>
      </div>
      <h2 style="color: #111827; margin: 0 0 8px; font-size: 24px; font-weight: bold;">New Booking Received</h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px;">Someone has scheduled a meeting with you</p>
    </div>

    <div style="background: linear-gradient(135deg, #eff6ff 0%, #f3e8ff 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280; font-size: 14px;">📅 Date</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #111827; font-size: 14px;">${formatDate(booking.start_time)}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280; font-size: 14px;">🕐 Time</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #111827; font-size: 14px;">${formatTime(booking.start_time)}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280; font-size: 14px;">👤 Guest</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #111827; font-size: 14px;">${booking.attendee_name}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280; font-size: 14px;">📧 Email</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #111827; font-size: 14px;">${booking.attendee_email}</strong>
          </td>
        </tr>
        ${booking.notes ? `
        <tr>
          <td colspan="2" style="padding: 16px 0 8px; border-top: 1px solid rgba(0,0,0,0.1);">
            <span style="color: #6b7280; font-size: 14px;">📝 Notes from guest</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 0 0 8px;">
            <p style="color: #111827; font-size: 14px; margin: 0; line-height: 1.6;">${booking.notes}</p>
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div style="text-align: center;">
      <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
        <tr>
          <td style="padding: 0 8px;">
            <a href="${manageUrl}" style="display: inline-block; background-color: #3B82F6; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              📋 View Details
            </a>
          </td>
          <td style="padding: 0 8px;">
            <a href="${manageUrl}?action=reschedule" style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid #e5e7eb;">
              🔄 Reschedule
            </a>
          </td>
        </tr>
      </table>
    </div>
  `;
  
  return emailWrapper(content);
};

const bookingCancellation = (booking, reason) => {
  const rebookUrl = `${process.env.FRONTEND_URL}/book/${booking.booking_token}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="background-color: #ef4444; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="font-size: 40px; color: white;">✕</span>
      </div>
      <h2 style="color: #111827; margin: 0 0 8px; font-size: 24px; font-weight: bold;">Booking Cancelled</h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px;">This meeting has been cancelled</p>
    </div>

    <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280; font-size: 14px;">📅 Original Date</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #111827; font-size: 14px;">${formatDate(booking.start_time)}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280; font-size: 14px;">🕐 Original Time</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #111827; font-size: 14px;">${formatTime(booking.start_time)}</strong>
          </td>
        </tr>
        ${reason ? `
        <tr>
          <td colspan="2" style="padding: 16px 0 8px; border-top: 1px solid rgba(0,0,0,0.1);">
            <span style="color: #6b7280; font-size: 14px;">💬 Reason</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 0 0 8px;">
            <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 1.6;">${reason}</p>
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div style="text-align: center;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">
        Want to book another time?
      </p>
      <a href="${rebookUrl}" style="display: inline-block; background-color: #3B82F6; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        📅 Book Another Time
      </a>
    </div>
  `;
  
  return emailWrapper(content);
};

const bookingReschedule = (booking, oldTime) => {
  const manageUrl = `${process.env.FRONTEND_URL}/manage/${booking.booking_token || booking.id}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="background-color: #f59e0b; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="font-size: 40px; color: white;">🔄</span>
      </div>
      <h2 style="color: #111827; margin: 0 0 8px; font-size: 24px; font-weight: bold;">Booking Rescheduled</h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px;">Your meeting has been moved to a new time</p>
    </div>

    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <p style="color: #92400e; margin: 0 0 8px; font-size: 14px; font-weight: 600;">Previous Time:</p>
      <p style="color: #78350f; margin: 0; font-size: 14px;">
        ${formatDate(oldTime)} at ${formatTime(oldTime)}
      </p>
    </div>

    <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
      <p style="color: #065f46; margin: 0 0 12px; font-size: 14px; font-weight: 600; text-align: center;">✨ New Meeting Time:</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #047857; font-size: 14px;">📅 Date</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #065f46; font-size: 14px;">${formatDate(booking.start_time)}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #047857; font-size: 14px;">🕐 Time</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <strong style="color: #065f46; font-size: 14px;">${formatTime(booking.start_time)}</strong>
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: #eff6ff; border-left: 4px solid #3B82F6; border-radius: 8px; padding: 16px; margin-bottom: 30px;">
      <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6;">
        <strong>💡 Action Required:</strong><br>
        • Update the event in your calendar<br>
        • A new calendar invite has been sent<br>
        • You'll receive a reminder 24 hours before the new time
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${manageUrl}" style="display: inline-block; background-color: #3B82F6; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        📋 View Details
      </a>
    </div>
  `;
  
  return emailWrapper(content);
};

module.exports = {
  bookingConfirmationGuest,
  bookingConfirmationOrganizer,
  bookingCancellation,
  bookingReschedule,
};