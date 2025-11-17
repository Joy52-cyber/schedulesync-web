const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ============ UTILITY FUNCTIONS ============

// Check if email utilities are available
const isEmailAvailable = () => {
  return !!process.env.RESEND_API_KEY;
};

// ============ EMAIL TEMPLATES ============

// Send team invitation email
const sendTeamInvitation = async (toEmail, teamName, bookingUrl, inviterName) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.APP_NAME || 'ScheduleSync'} <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: toEmail,
      subject: `You've been invited to join ${teamName} on ScheduleSync`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0;">
              <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 32px;">📅</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">ScheduleSync</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; color: #333333; font-size: 26px; font-weight: bold;">You're Invited! 🎉</h2>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 17px; line-height: 1.6;">
                <strong style="color: #333333;">${inviterName}</strong> has invited you to join <strong style="color: #667eea;">${teamName}</strong> on ScheduleSync!
              </p>
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                ScheduleSync makes it easy to manage team scheduling and bookings.
              </p>
              <table role="presentation" style="margin: 0 0 30px 0;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${bookingUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 17px; font-weight: 600;">
                      View Your Booking Page
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 16px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px; font-weight: 600;">Your Personal Booking URL:</p>
                <p style="margin: 0; color: #667eea; font-size: 15px; word-break: break-all;">
                  <a href="${bookingUrl}" style="color: #667eea; text-decoration: none;">${bookingUrl}</a>
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 16px 16px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #999999; font-size: 13px;">
                © ${new Date().getFullYear()} ScheduleSync. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error('❌ Team invitation email failed:', error);
      throw error;
    }

    console.log('✅ Team invitation email sent:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to send team invitation:', error);
    throw error;
  }
};

// Send booking confirmation to guest
const sendBookingConfirmation = async ({
  attendee_email,
  attendee_name,
  organizer_name,
  organizer_email,
  team_name,
  meeting_date,
  meeting_time,
  meeting_duration = 60,
  notes = '',
}) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.APP_NAME || 'ScheduleSync'} <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: attendee_email,
      subject: `Meeting Confirmed with ${organizer_name || team_name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0;">
              <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 32px;">✅</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">Booking Confirmed!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; color: #666666; font-size: 17px; line-height: 1.6;">
                Hi <strong style="color: #333333;">${attendee_name}</strong>,
              </p>
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 17px; line-height: 1.6;">
                Your meeting with <strong style="color: #333333;">${organizer_name || team_name}</strong> has been confirmed!
              </p>
              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 24px; border-radius: 8px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 16px 0; color: #333333; font-size: 18px; font-weight: 600;">📅 Meeting Details</h3>
                <p style="margin: 0 0 12px 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Date:</strong> ${meeting_date}
                </p>
                <p style="margin: 0 0 12px 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Time:</strong> ${meeting_time}
                </p>
                <p style="margin: 0 0 12px 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Duration:</strong> ${meeting_duration} minutes
                </p>
                <p style="margin: 0 ${notes ? '12px' : '0'} 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">With:</strong> ${organizer_name || team_name}
                </p>
                ${notes ? `
                <p style="margin: 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Notes:</strong> ${notes}
                </p>
                ` : ''}
              </div>
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 15px; font-weight: 600;">💡 Don't forget:</p>
                <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px; line-height: 1.8;">
                  <li>Add this meeting to your calendar</li>
                  <li>Prepare any questions you'd like to discuss</li>
                  <li>Join a few minutes early if it's a video call</li>
                </ul>
              </div>
              <p style="margin: 0; color: #999999; font-size: 14px; line-height: 1.6;">
                If you need to reschedule or have any questions, please contact ${organizer_email || 'the organizer'}.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 16px 16px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 8px 0; color: #999999; font-size: 14px;">Powered by ScheduleSync</p>
              <p style="margin: 0; color: #999999; font-size: 13px;">
                © ${new Date().getFullYear()} ScheduleSync. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error('❌ Booking confirmation email failed:', error);
      throw error;
    }

    console.log('✅ Booking confirmation email sent to guest:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to send booking confirmation:', error);
    throw error;
  }
};

// Send notification to organizer
const sendOrganizerNotification = async ({
  organizer_email,
  organizer_name,
  attendee_name,
  attendee_email,
  meeting_date,
  meeting_time,
  meeting_duration = 60,
  notes = ''
}) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.APP_NAME || 'ScheduleSync'} <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: organizer_email,
      subject: `New Booking: ${attendee_name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0;">
              <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 32px;">📅</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">New Booking</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; color: #666666; font-size: 17px; line-height: 1.6;">
                Hi <strong style="color: #333333;">${organizer_name}</strong>,
              </p>
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 17px; line-height: 1.6;">
                You have a new booking from <strong style="color: #333333;">${attendee_name}</strong>.
              </p>
              <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 24px; border-radius: 8px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 16px 0; color: #333333; font-size: 18px; font-weight: 600;">📋 Booking Details</h3>
                <p style="margin: 0 0 12px 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Guest:</strong> ${attendee_name}
                </p>
                <p style="margin: 0 0 12px 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Email:</strong> ${attendee_email}
                </p>
                <p style="margin: 0 0 12px 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Date:</strong> ${meeting_date}
                </p>
                <p style="margin: 0 0 12px 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Time:</strong> ${meeting_time}
                </p>
                <p style="margin: 0 ${notes ? '12px' : '0'} 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Duration:</strong> ${meeting_duration} minutes
                </p>
                ${notes ? `
                <p style="margin: 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Notes:</strong> ${notes}
                </p>
                ` : ''}
              </div>
              <p style="margin: 0; color: #999999; font-size: 14px; line-height: 1.6;">
                This event has been added to your calendar.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 16px 16px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #999999; font-size: 13px;">
                © ${new Date().getFullYear()} ScheduleSync. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error('❌ Organizer notification email failed:', error);
      throw error;
    }

    console.log('✅ Organizer notification email sent:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to send organizer notification:', error);
    throw error;
  }
};

// ============ EXPORTS ============

module.exports = {
  sendTeamInvitation,
  sendBookingConfirmation,
  sendOrganizerNotification,
  isEmailAvailable,
};