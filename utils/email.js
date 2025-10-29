const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendTeamInvitation = async (toEmail, teamName, bookingUrl, inviterName) => {
  try {
    const emailHtml = `
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
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0;">
              <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 32px;">📅</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">ScheduleSync</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; color: #333333; font-size: 26px; font-weight: bold;">You're Invited! 🎉</h2>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 17px; line-height: 1.6;">
                <strong style="color: #333333;">${inviterName}</strong> has invited you to join <strong style="color: #667eea;">${teamName}</strong> on ScheduleSync!
              </p>
              
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                ScheduleSync makes it easy to manage team scheduling and bookings. You can now accept bookings through your personal scheduling link.
              </p>
              
              <!-- Button -->
              <table role="presentation" style="margin: 0 0 30px 0;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${bookingUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 17px; font-weight: 600;">
                      View Your Booking Page
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Booking URL Box -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 16px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px; font-weight: 600;">Your Personal Booking URL:</p>
                <p style="margin: 0; color: #667eea; font-size: 15px; word-break: break-all;">
                  <a href="${bookingUrl}" style="color: #667eea; text-decoration: none;">${bookingUrl}</a>
                </p>
              </div>
              
              <!-- Info Box -->
              <div style="background-color: #f0f7ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <p style="margin: 0 0 12px 0; color: #333333; font-size: 16px; font-weight: 600;">What you can do:</p>
                <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 15px; line-height: 1.8;">
                  <li>Share your booking link with clients</li>
                  <li>Manage your availability</li>
                  <li>View and track all bookings</li>
                  <li>Collaborate with team members</li>
                </ul>
              </div>
              
              <p style="margin: 0; color: #999999; font-size: 14px; line-height: 1.6;">
                If you have any questions, feel free to reach out to your team admin.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 16px 16px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 8px 0; color: #999999; font-size: 14px;">
                This invitation was sent by ${inviterName}
              </p>
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
    `.trim();

    const { data, error } = await resend.emails.send({
      from: `${process.env.APP_NAME} <${process.env.FROM_EMAIL}>`,
      to: toEmail,
      subject: `You've been invited to join ${teamName} on ScheduleSync`,
      html: emailHtml,
    });

    if (error) {
      console.error('❌ Email sending failed:', error);
      throw error;
    }

    console.log('✅ Email sent successfully:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
};

const sendBookingConfirmation = async (toEmail, bookingDetails) => {
  try {
    const { teamName, memberName, date, time } = bookingDetails;
    
    const emailHtml = `
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
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0;">
              <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 32px;">✅</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">Booking Confirmed!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 17px; line-height: 1.6;">
                Your booking with <strong style="color: #333333;">${memberName}</strong> from <strong style="color: #10b981;">${teamName}</strong> has been confirmed!
              </p>
              
              <!-- Booking Details Box -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 24px; border-radius: 8px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 16px 0; color: #333333; font-size: 18px; font-weight: 600;">Booking Details:</h3>
                <p style="margin: 0 0 12px 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Date:</strong> ${date}
                </p>
                <p style="margin: 0 0 12px 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">Time:</strong> ${time}
                </p>
                <p style="margin: 0; color: #666666; font-size: 16px;">
                  <strong style="color: #333333;">With:</strong> ${memberName}
                </p>
              </div>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 15px; line-height: 1.6;">
                A calendar invitation has been sent to your email. Please check your inbox.
              </p>
              
              <p style="margin: 0; color: #999999; font-size: 14px; line-height: 1.6;">
                If you need to reschedule or have any questions, please contact ${memberName} directly.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
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
    `.trim();

    const { data, error } = await resend.emails.send({
      from: `${process.env.APP_NAME} <${process.env.FROM_EMAIL}>`,
      to: toEmail,
      subject: `Booking Confirmed - ${teamName}`,
      html: emailHtml,
    });

    if (error) {
      console.error('❌ Email sending failed:', error);
      throw error;
    }

    console.log('✅ Booking confirmation email sent:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Failed to send booking confirmation:', error);
    throw error;
  }
};

module.exports = {
  sendTeamInvitation,
  sendBookingConfirmation,
};