const emailVerification = (user, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Verify your email</h2>
      <p>Hi ${user.name},</p>
      <p>Click below to verify your email:</p>
      <a href="${verifyUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Verify Email</a>
    </div>
  `;
};

const bookingConfirmationGuest = (booking) => {
  console.log('📧 EMAIL TEMPLATE - Booking data:', {
    id: booking.id,
    manage_token: booking.manage_token,
    booking_token: booking.booking_token
  });

  const date = new Date(booking.start_time).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric' 
  });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });
  
  // ✅ CRITICAL: Use manage_token, NOT booking_token or id
  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;

  console.log('📧 EMAIL TEMPLATE - Generated URL:', manageUrl);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Booking Confirmed! ✅</h2>
      <p>Hi ${booking.attendee_name},</p>
      <p>Your meeting with <strong>${booking.organizer_name}</strong> is confirmed.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${date}</p>
        <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${time}</p>
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Join:</strong> <a href="${booking.meet_link}">Google Meet</a></p>` : ''}
      </div>

      ${manageUrl ? `
      <div style="margin: 20px 0;">
        <p>Need to make changes?</p>
        <a href="${manageUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Manage Booking</a>
      </div>
      ` : ''}
      
      <p style="color: #999; font-size: 12px; margin-top: 30px;">Powered by ScheduleSync</p>
    </div>
  `;
};

const bookingConfirmationOrganizer = (booking) => {
  const date = new Date(booking.start_time).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric' 
  });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">New Booking Received 📅</h2>
      <p><strong>${booking.attendee_name}</strong> scheduled a meeting.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>📧</strong> ${booking.attendee_email}</p>
        <p><strong>📅</strong> ${date}</p>
        <p><strong>🕒</strong> ${time}</p>
        ${booking.meet_link ? `<p><strong>🎥</strong> <a href="${booking.meet_link}">Join Meeting</a></p>` : ''}
      </div>
    </div>
  `;
};

const bookingCancellation = (booking, reason) => {
  const rebookUrl = booking.member_booking_token 
    ? `${process.env.FRONTEND_URL}/book/${booking.member_booking_token}`
    : null;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #DC2626;">Meeting Cancelled ❌</h2>
      <p>Meeting between <strong>${booking.organizer_name}</strong> and <strong>${booking.attendee_name}</strong> cancelled.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      ${rebookUrl ? `<a href="${rebookUrl}">Book Again</a>` : ''}
    </div>
  `;
};

const bookingReschedule = (booking, oldStartTime) => {
  const newDate = new Date(booking.start_time).toLocaleString();
  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563EB;">Meeting Rescheduled 🔄</h2>
      <p>New time: <strong>${newDate}</strong></p>
      ${booking.meet_link ? `<p><a href="${booking.meet_link}">Join Meeting</a></p>` : ''}
      ${manageUrl ? `<p><a href="${manageUrl}">Manage Booking</a></p>` : ''}
    </div>
  `;
};

const bookingConfirmationGuestWithPayment = (booking) => {
  return bookingConfirmationGuest(booking) + `
    <div style="margin-top: 20px; padding: 20px; background: #ECFDF5; border-radius: 8px;">
      <p><strong>💰 Payment:</strong> ${booking.payment_currency} ${booking.payment_amount}</p>
      ${booking.payment_receipt_url ? `<a href="${booking.payment_receipt_url}">View Receipt</a>` : ''}
    </div>
  `;
};

const bookingConfirmationOrganizerWithPayment = (booking) => {
  return bookingConfirmationOrganizer(booking) + `
    <div style="margin-top: 20px;">
      <p><strong>💰 Payment:</strong> ${booking.payment_currency} ${booking.payment_amount}</p>
    </div>
  `;
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