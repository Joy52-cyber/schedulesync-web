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
  
  // ✅ FIXED: Use manage_token instead of booking_token
  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;

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

      ${manageUrl ? `<p>Need to reschedule or cancel? <a href="${manageUrl}" style="color: #4F46E5; font-weight: bold;">Manage Your Booking</a></p>` : ''}
      
      <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        Powered by ScheduleSync
      </p>
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
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Meeting Link:</strong> <a href="${booking.meet_link}">Join Meeting</a></p>` : ''}
      </div>
      
      <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        Powered by ScheduleSync
      </p>
    </div>
  `;
};

const bookingCancellation = (booking, reason) => {
  // ✅ FIXED: Use member_booking_token (the organizer's booking page) for rebooking
  const rebookUrl = booking.member_booking_token 
    ? `${process.env.FRONTEND_URL}/book/${booking.member_booking_token}`
    : null;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #DC2626;">Meeting Cancelled ❌</h2>
      <p>The meeting between <strong>${booking.organizer_name}</strong> and <strong>${booking.attendee_name}</strong> has been cancelled.</p>
      ${reason ? `<div style="background: #FEF2F2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #DC2626;"><p style="margin: 0;"><strong>Reason:</strong> ${reason}</p></div>` : ''}
      ${rebookUrl ? `<p>Need to reschedule? <a href="${rebookUrl}" style="color: #4F46E5; font-weight: bold;">Book a New Time</a></p>` : ''}
      
      <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        Powered by ScheduleSync
      </p>
    </div>
  `;
};

const bookingReschedule = (booking, oldStartTime) => {
  const oldDate = new Date(oldStartTime).toLocaleString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  
  const newDate = new Date(booking.start_time).toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const newTime = new Date(booking.start_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });

  // ✅ FIXED: Use manage_token for further changes
  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563EB;">Meeting Rescheduled 🔄</h2>
      <p>The meeting has been moved to a new time.</p>
      
      <div style="background: #FEF2F2; padding: 15px; border-radius: 8px; margin: 15px 0; text-decoration: line-through; opacity: 0.6;">
        <p style="margin: 0;"><strong>Previous Time:</strong> ${oldDate}</p>
      </div>
      
      <div style="background: #ECFDF5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
        <p style="margin: 5px 0;"><strong>📅 New Date:</strong> ${newDate}</p>
        <p style="margin: 5px 0;"><strong>🕒 New Time:</strong> ${newTime}</p>
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Meeting Link:</strong> <a href="${booking.meet_link}">Join Meeting</a></p>` : ''}
      </div>

      ${manageUrl ? `<p>Need to make another change? <a href="${manageUrl}" style="color: #4F46E5; font-weight: bold;">Manage Your Booking</a></p>` : ''}
      
      <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        Powered by ScheduleSync
      </p>
    </div>
  `;
};

// Payment Templates
const bookingConfirmationGuestWithPayment = (booking) => {
  const date = new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  
  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Payment Confirmed & Booking Complete! ✅</h2>
      <p>Hi ${booking.attendee_name},</p>
      <p>Your payment has been processed and your meeting with <strong>${booking.organizer_name}</strong> is confirmed.</p>
      
      <div style="background: #ECFDF5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
        <p style="margin: 5px 0;"><strong>💰 Payment:</strong> ${booking.payment_currency.toUpperCase()} ${booking.payment_amount}</p>
        ${booking.payment_receipt_url ? `<p style="margin: 5px 0;"><a href="${booking.payment_receipt_url}" style="color: #4F46E5;">View Receipt</a></p>` : ''}
      </div>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${date}</p>
        <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${time}</p>
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Location:</strong> <a href="${booking.meet_link}">Google Meet</a></p>` : ''}
      </div>

      ${manageUrl ? `<p>Need to reschedule? <a href="${manageUrl}" style="color: #4F46E5; font-weight: bold;">Manage Your Booking</a></p>` : ''}
      
      <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        Powered by ScheduleSync
      </p>
    </div>
  `;
};

const bookingConfirmationOrganizerWithPayment = (booking) => {
  const date = new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">💰 New Paid Booking Received</h2>
      <p><strong>${booking.attendee_name}</strong> has scheduled and paid for a meeting with you.</p>
      
      <div style="background: #ECFDF5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
        <p style="margin: 5px 0;"><strong>💰 Payment Received:</strong> ${booking.payment_currency.toUpperCase()} ${booking.payment_amount}</p>
      </div>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${booking.attendee_email}</p>
        <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${date}</p>
        <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${time}</p>
        ${booking.notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${booking.notes}</p>` : ''}
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Meeting Link:</strong> <a href="${booking.meet_link}">Join Meeting</a></p>` : ''}
      </div>
      
      <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        Powered by ScheduleSync
      </p>
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