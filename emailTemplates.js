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
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });
  const endTime = new Date(booking.end_time).toLocaleTimeString('en-US', { 
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
        <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${time} - ${endTime}</p>
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Join:</strong> <a href="${booking.meet_link}" style="color: #4F46E5;">Google Meet</a></p>` : ''}
        ${booking.notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${booking.notes}</p>` : ''}
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
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });
  const endTime = new Date(booking.end_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">New Booking Received 📅</h2>
      <p><strong>${booking.attendee_name}</strong> scheduled a meeting with you.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${booking.attendee_email}</p>
        <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${date}</p>
        <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${time} - ${endTime}</p>
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Join:</strong> <a href="${booking.meet_link}" style="color: #4F46E5;">Google Meet</a></p>` : ''}
        ${booking.notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${booking.notes}</p>` : ''}
      </div>
      
      <p style="color: #999; font-size: 12px; margin-top: 30px;">Powered by ScheduleSync</p>
    </div>
  `;
};

// ✅ NEW: Booking Reminder Email
const bookingReminder = (booking, hoursUntil) => {
  console.log('📧 REMINDER EMAIL - Booking data:', {
    id: booking.id,
    manage_token: booking.manage_token,
    hours_until: hoursUntil
  });

  const date = new Date(booking.start_time).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });
  const endTime = new Date(booking.end_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });

  // Get timezone if available
  const timezone = booking.guest_timezone || 'your timezone';

  // ✅ CRITICAL: Use manage_token, NOT booking.id
  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;

  console.log('📧 REMINDER EMAIL - Generated URL:', manageUrl);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Meeting Reminder</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">Your meeting starts in ${hoursUntil} ${hoursUntil === 1 ? 'hour' : 'hours'}</p>
      </div>

      <!-- Content -->
      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; color: #374151; margin-top: 0;">Hi <strong>${booking.attendee_name}</strong>,</p>
        <p style="font-size: 16px; color: #374151;">This is a friendly reminder about your upcoming meeting:</p>
        
        <!-- Meeting Details Card -->
        <div style="background: #f9fafb; border-left: 4px solid #4F46E5; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <h2 style="color: #4F46E5; margin: 0 0 15px 0; font-size: 20px;">Meeting with ${booking.organizer_name}</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">
                <strong>📅 Date:</strong>
              </td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">
                ${date}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">
                <strong>🕒 Time:</strong>
              </td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">
                ${time} - ${endTime} (${timezone})
              </td>
            </tr>
            ${booking.organizer_name ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">
                <strong>👤 With:</strong>
              </td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">
                ${booking.organizer_name}
              </td>
            </tr>
            ` : ''}
            ${booking.notes ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">
                <strong>📝 Notes:</strong>
              </td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">
                ${booking.notes}
              </td>
            </tr>
            ` : ''}
          </table>
        </div>

        ${booking.meet_link ? `
        <!-- Meeting Link Button -->
        <div style="text-align: center; margin: 25px 0;">
          <a href="${booking.meet_link}" style="display: inline-block; background: #10B981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            🎥 Join Google Meet
          </a>
        </div>
        ` : ''}

        <!-- Tip Box -->
        <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>💡 Tip:</strong> Join a few minutes early to test your audio and video!
          </p>
        </div>

        ${manageUrl ? `
        <!-- Manage Booking -->
        <div style="text-align: center; margin: 25px 0; padding: 20px; background: #f3f4f6; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Need to reschedule or cancel?</p>
          <a href="${manageUrl}" style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 600; font-size: 14px;">
            Manage your booking →
          </a>
        </div>
        ` : ''}

        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Scheduled via <strong>ScheduleSync</strong>
          </p>
        </div>
      </div>
    </div>
  `;
};

const bookingCancellation = (booking, reason) => {
  const date = new Date(booking.start_time).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });

  const rebookUrl = booking.member_booking_token 
    ? `${process.env.FRONTEND_URL}/book/${booking.member_booking_token}`
    : null;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #DC2626;">Meeting Cancelled ❌</h2>
      <p>Hi ${booking.attendee_name},</p>
      <p>Your meeting with <strong>${booking.organizer_name}</strong> has been cancelled.</p>
      
      <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #DC2626; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>📅 Original Date:</strong> ${date}</p>
        <p style="margin: 5px 0;"><strong>🕒 Original Time:</strong> ${time}</p>
        ${reason ? `<p style="margin: 15px 0 5px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
      </div>

      ${rebookUrl ? `
      <div style="text-align: center; margin: 25px 0;">
        <a href="${rebookUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Book Another Time
        </a>
      </div>
      ` : ''}
      
      <p style="color: #999; font-size: 12px; margin-top: 30px;">Powered by ScheduleSync</p>
    </div>
  `;
};

const bookingReschedule = (booking, oldStartTime) => {
  const newDate = new Date(booking.start_time).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const newTime = new Date(booking.start_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });
  const newEndTime = new Date(booking.end_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });

  const oldDate = oldStartTime ? new Date(oldStartTime).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }) : null;
  const oldTime = oldStartTime ? new Date(oldStartTime).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  }) : null;

  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563EB;">Meeting Rescheduled 🔄</h2>
      <p>Hi ${booking.attendee_name},</p>
      <p>Your meeting with <strong>${booking.organizer_name}</strong> has been rescheduled to a new time.</p>
      
      ${oldDate ? `
      <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Previous:</strong> ${oldDate} at ${oldTime}</p>
      </div>
      ` : ''}

      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #2563EB; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>📅 New Date:</strong> ${newDate}</p>
        <p style="margin: 5px 0;"><strong>🕒 New Time:</strong> ${newTime} - ${newEndTime}</p>
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Join:</strong> <a href="${booking.meet_link}" style="color: #2563EB;">Google Meet</a></p>` : ''}
      </div>

      ${manageUrl ? `
      <div style="text-align: center; margin: 25px 0;">
        <a href="${manageUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Manage Booking
        </a>
      </div>
      ` : ''}
      
      <p style="color: #999; font-size: 12px; margin-top: 30px;">Powered by ScheduleSync</p>
    </div>
  `;
};

const bookingConfirmationGuestWithPayment = (booking) => {
  return bookingConfirmationGuest(booking) + `
    <div style="margin-top: 20px; padding: 20px; background: #ECFDF5; border-radius: 8px; border-left: 4px solid #10B981;">
      <p style="margin: 0;"><strong>💰 Payment Received:</strong> ${booking.payment_currency} ${booking.payment_amount}</p>
      ${booking.payment_receipt_url ? `<p style="margin: 10px 0 0 0;"><a href="${booking.payment_receipt_url}" style="color: #10B981;">View Receipt</a></p>` : ''}
    </div>
  `;
};

const bookingConfirmationOrganizerWithPayment = (booking) => {
  return bookingConfirmationOrganizer(booking) + `
    <div style="margin-top: 20px; padding: 20px; background: #ECFDF5; border-radius: 8px; border-left: 4px solid #10B981;">
      <p style="margin: 0;"><strong>💰 Payment Received:</strong> ${booking.payment_currency} ${booking.payment_amount}</p>
    </div>
  `;
};

// ✅ NEW: Email for additional attendees
const bookingConfirmationAdditionalAttendee = (booking, invitedBy) => {
  console.log('📧 ADDITIONAL ATTENDEE EMAIL - Booking data:', {
    id: booking.id,
    manage_token: booking.manage_token,
    invited_by: invitedBy
  });

  const date = new Date(booking.start_time).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const time = new Date(booking.start_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });
  const endTime = new Date(booking.end_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit' 
  });

  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">You're Invited! 📧</h2>
      <p>Hi there,</p>
      <p><strong>${invitedBy}</strong> has invited you to join a meeting with <strong>${booking.organizer_name}</strong>.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${date}</p>
        <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${time} - ${endTime}</p>
        <p style="margin: 5px 0;"><strong>👥 Host:</strong> ${booking.organizer_name}</p>
        <p style="margin: 5px 0;"><strong>📍 Organized by:</strong> ${invitedBy}</p>
        ${booking.meet_link ? `<p style="margin: 5px 0;"><strong>🎥 Join:</strong> <a href="${booking.meet_link}" style="color: #4F46E5;">Google Meet</a></p>` : ''}
        ${booking.notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${booking.notes}</p>` : ''}
      </div>

      <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;">
          <strong>ℹ️ Note:</strong> You were added as an additional attendee by ${invitedBy}. You'll receive a calendar invite shortly.
        </p>
      </div>

      ${manageUrl ? `
      <div style="margin: 20px 0;">
        <p>Need to manage this booking?</p>
        <a href="${manageUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Booking Details</a>
      </div>
      ` : ''}
      
      <p style="color: #999; font-size: 12px; margin-top: 30px;">Powered by ScheduleSync</p>
    </div>
  `;
};

module.exports = {
  emailVerification,
  bookingConfirmationGuest,
  bookingConfirmationOrganizer,
  bookingConfirmationAdditionalAttendee, // ✅ NEW
  bookingReminder,
  bookingCancellation,
  bookingReschedule,
  bookingConfirmationGuestWithPayment,
  bookingConfirmationOrganizerWithPayment
};