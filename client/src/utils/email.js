const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const isEmailAvailable = () => {
  return !!process.env.RESEND_API_KEY;
};

const sendTeamInvitation = async (toEmail, teamName, bookingUrl, inviterName) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.APP_NAME || 'ScheduleSync'} <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: toEmail,
      subject: `You've been invited to join ${teamName} on ScheduleSync`,
      html: `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>You're Invited!</h1><p>${inviterName} has invited you to join ${teamName} on ScheduleSync!</p><p><a href="${bookingUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Your Booking Page</a></p></body></html>`,
    });
    if (error) throw error;
    console.log('✅ Team invitation email sent:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to send team invitation:', error);
    throw error;
  }
};

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
      html: `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>✅ Booking Confirmed!</h1><p>Hi ${attendee_name},</p><p>Your meeting with <strong>${organizer_name || team_name}</strong> has been confirmed!</p><div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;"><h3>📅 Meeting Details</h3><p><strong>Date:</strong> ${meeting_date}</p><p><strong>Time:</strong> ${meeting_time}</p><p><strong>Duration:</strong> ${meeting_duration} minutes</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}</div><p>See you then!</p></body></html>`,
    });
    if (error) throw error;
    console.log('✅ Booking confirmation email sent:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to send booking confirmation:', error);
    throw error;
  }
};

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
      html: `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>📅 New Booking</h1><p>Hi ${organizer_name},</p><p>You have a new booking from <strong>${attendee_name}</strong>.</p><div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;"><h3>📋 Booking Details</h3><p><strong>Guest:</strong> ${attendee_name}</p><p><strong>Email:</strong> ${attendee_email}</p><p><strong>Date:</strong> ${meeting_date}</p><p><strong>Time:</strong> ${meeting_time}</p><p><strong>Duration:</strong> ${meeting_duration} minutes</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}</div></body></html>`,
    });
    if (error) throw error;
    console.log('✅ Organizer notification email sent:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to send organizer notification:', error);
    throw error;
  }
};

module.exports = {
  sendTeamInvitation,
  sendBookingConfirmation,
  sendOrganizerNotification,
  isEmailAvailable,
};