const emailVerification = (user, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #4F46E5; margin: 0;">ScheduleSync</h1>
      </div>
      
      <h2 style="color: #333; margin-top: 0;">Verify your email address</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        Hi ${user.name || 'there'},
      </p>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        Thanks for starting your account setup. Please verify your email address to complete your registration.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Email</a>
      </div>
      
      <p style="color: #999; font-size: 14px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        If you didn't sign up for ScheduleSync, you can safely ignore this email.
      </p>
    </div>
  `;
};

const bookingConfirmationGuest = (booking) => {
  const date = new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const manageUrl = `${process.env.FRONTEND_URL}/manage/${booking.booking_token}`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Booking Confirmed! ✅</h2>
      <p>Hi ${booking.attendee_name},</p>
      <p>Your meeting with <strong>${booking.organizer_name}</strong> is confirmed.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${date}</p>
        <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${time}</p>
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Location:</strong> <a href="${booking.meet_link}">Google Meet</a></p>` : ''}
      </div>

      <p>Need to reschedule? <a href="${manageUrl}">Manage Booking</a></p>
    </div>
  `;
};

const bookingConfirmationOrganizer = (booking) => {
  const date = new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">New Booking Received 📅</h2>
      <p><strong>${booking.attendee_name}</strong> has scheduled a meeting with you.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${booking.attendee_email}</p>
        <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${date}</p>
        <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${time}</p>
        ${booking.notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${booking.notes}</p>` : ''}
      </div>
    </div>
  `;
};

const bookingCancellation = (booking, reason) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #DC2626;">Meeting Cancelled ❌</h2>
      <p>The meeting between <strong>${booking.organizer_name}</strong> and <strong>${booking.attendee_name}</strong> has been cancelled.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>You can book a new time here: <a href="${process.env.FRONTEND_URL}/book/${booking.booking_token}">Book Again</a></p>
    </div>
  `;
};

const bookingReschedule = (booking, oldStartTime) => {
  const newDate = new Date(booking.start_time).toLocaleString();
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563EB;">Meeting Rescheduled 🔄</h2>
      <p>The meeting has been moved to a new time.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>New Time:</strong> ${newDate}</p>
        ${booking.meet_link ? `<p><strong>Link:</strong> <a href="${booking.meet_link}">Join Meeting</a></p>` : ''}
      </div>
    </div>
  `;
};

// Payment Templates
const bookingConfirmationGuestWithPayment = (booking) => {
  const base = bookingConfirmationGuest(booking);
  return base.replace('</div>', `
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
      <p><strong>💰 Payment:</strong> ${booking.payment_currency} ${booking.payment_amount}</p>
      <p><a href="${booking.payment_receipt_url}">View Receipt</a></p>
    </div>
    </div>
  `);
};

const bookingConfirmationOrganizerWithPayment = (booking) => {
  const base = bookingConfirmationOrganizer(booking);
  return base.replace('</div>', `
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
      <p><strong>💰 Payment Received:</strong> ${booking.payment_currency} ${booking.payment_amount}</p>
    </div>
    </div>
  `);
};

module.exports = {
  emailVerification,
  bookingConfirmationGuest,
  bookingConfirmationOrganizer,
  bookingCancellation,
  bookingReschedule,
  bookingConfirmationGuestWithPayment,
  bookingConfirmationOrganizerWithPayment
};