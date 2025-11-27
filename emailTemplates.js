const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatTime = (dateString) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const emailTemplates = {
  // Guest confirmation email
  bookingConfirmationGuest: (booking) => {
    const managementUrl = `${process.env.FRONTEND_URL}/manage/${booking.booking_token}`;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif;
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header { 
            background: #4F46E5; 
            color: white; 
            padding: 30px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content { 
            padding: 30px;
          }
          .detail-box { 
            background: #f9fafb; 
            padding: 20px; 
            border-radius: 6px; 
            margin: 20px 0;
          }
          .detail-row { 
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label { 
            font-weight: bold;
            color: #6b7280;
          }
          .detail-value { 
            color: #111827;
            margin-top: 4px;
          }
          .meet-box {
            background: #EEF2FF;
            border: 2px solid #818CF8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .meet-button { 
            display: inline-block;
            background: #4F46E5;
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 10px 0;
          }
          .button-row {
            margin: 25px 0;
            text-align: center;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 5px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
          }
          .btn-primary { 
            background: #4F46E5; 
            color: white !important;
          }
          .btn-secondary { 
            background: #e5e7eb; 
            color: #374151 !important;
          }
          .footer {
            padding: 20px 30px;
            background: #f9fafb;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Booking Confirmed</h1>
            <p style="margin: 10px 0 0 0;">Your meeting is scheduled</p>
          </div>
          
          <div class="content">
            <p>Hi <strong>${booking.attendee_name}</strong>,</p>
            <p>Your meeting with <strong>${booking.organizer_name || booking.team_name}</strong> has been confirmed.</p>
            
            ${booking.meet_link ? `
            <div class="meet-box">
              <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">🎥 Join via Google Meet</p>
              <a href="${booking.meet_link}" class="meet-button">
                Join Meeting
              </a>
              <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">
                Click this link at the scheduled time
              </p>
            </div>
            ` : ''}
            
            <div class="detail-box">
              <div class="detail-row">
                <div class="detail-label">📅 Date</div>
                <div class="detail-value">${formatDate(booking.start_time)}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">🕐 Time</div>
                <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">👤 With</div>
                <div class="detail-value">${booking.organizer_name || booking.team_name}</div>
              </div>
              
              ${booking.notes ? `
              <div class="detail-row">
                <div class="detail-label">📝 Notes</div>
                <div class="detail-value">${booking.notes}</div>
              </div>
              ` : ''}
            </div>

            <div class="button-row">
              <a href="${managementUrl}" class="btn btn-primary">
                Manage Booking
              </a>
              <a href="${managementUrl}?action=reschedule" class="btn btn-secondary">
                Reschedule
              </a>
            </div>
          </div>

          <div class="footer">
            <p>A calendar invitation has been sent to your email.</p>
            <p style="margin-top: 8px;">This is an automated message from ScheduleSync.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // Organizer notification email
  bookingConfirmationOrganizer: (booking) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif;
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header { 
            background: #10B981; 
            color: white; 
            padding: 30px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content { 
            padding: 30px;
          }
          .detail-box { 
            background: #f0fdf4; 
            padding: 20px; 
            border-radius: 6px; 
            margin: 20px 0;
            border: 1px solid #bbf7d0;
          }
          .detail-row { 
            padding: 8px 0;
            border-bottom: 1px solid #d1fae5;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label { 
            font-weight: bold;
            color: #059669;
          }
          .detail-value { 
            color: #111827;
            margin-top: 4px;
          }
          .meet-box {
            background: #EEF2FF;
            border: 2px solid #818CF8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .meet-button { 
            display: inline-block;
            background: #4F46E5;
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 10px 0;
          }
          .footer {
            padding: 20px 30px;
            background: #f9fafb;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 New Booking</h1>
            <p style="margin: 10px 0 0 0;">You have a new meeting scheduled</p>
          </div>
          
          <div class="content">
            <p>Hi <strong>${booking.organizer_name}</strong>,</p>
            <p>You have a new booking from <strong>${booking.attendee_name}</strong>.</p>
            
            ${booking.meet_link ? `
            <div class="meet-box">
              <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">🎥 Google Meet Link</p>
              <a href="${booking.meet_link}" class="meet-button">
                Join Meeting
              </a>
              <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">
                Use this link to join the meeting
              </p>
            </div>
            ` : ''}
            
            <div class="detail-box">
              <div class="detail-row">
                <div class="detail-label">👤 Guest</div>
                <div class="detail-value">${booking.attendee_name} (${booking.attendee_email})</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">📅 Date</div>
                <div class="detail-value">${formatDate(booking.start_time)}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">🕐 Time</div>
                <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
              </div>
              
              ${booking.notes ? `
              <div class="detail-row">
                <div class="detail-label">📝 Notes</div>
                <div class="detail-value">${booking.notes}</div>
              </div>
              ` : ''}
            </div>
          </div>

          <div class="footer">
            <p>A calendar event has been added to your Google Calendar.</p>
            <p style="margin-top: 8px;">This is an automated message from ScheduleSync.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // Reschedule email
  bookingReschedule: (booking, oldStartTime) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif;
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header { 
            background: #F59E0B; 
            color: white; 
            padding: 30px; 
            text-align: center;
          }
          .content { padding: 30px; }
          .time-box {
            padding: 15px;
            margin: 15px 0;
            border-radius: 6px;
          }
          .old-time {
            background: #FEF3C7;
            border-left: 4px solid #F59E0B;
          }
          .new-time {
            background: #D1FAE5;
            border-left: 4px solid #10B981;
          }
          .meet-button { 
            display: inline-block;
            background: #4F46E5;
            color: white !important;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 15px 0;
          }
          .footer {
            padding: 20px 30px;
            background: #f9fafb;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Booking Rescheduled</h1>
          </div>
          
          <div class="content">
            <p>Your meeting has been rescheduled to a new time.</p>
            
            <div class="time-box old-time">
              <strong>❌ Previous Time:</strong><br>
              ${formatDate(oldStartTime)} at ${formatTime(oldStartTime)}
            </div>
            
            <div class="time-box new-time">
              <strong>✅ New Time:</strong><br>
              ${formatDate(booking.start_time)} at ${formatTime(booking.start_time)}
            </div>

            ${booking.meet_link ? `
            <div style="text-align: center; margin: 25px 0;">
              <p><strong>🎥 Google Meet Link</strong></p>
              <a href="${booking.meet_link}" class="meet-button">
                Join Meeting
              </a>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>Your calendar has been updated.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // Cancellation email
  bookingCancellation: (booking, reason) => {
    const rebookUrl = booking.booking_token ? `${process.env.FRONTEND_URL}/bookings/manage/${booking.manage_token}` : null;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif;
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header { 
            background: #EF4444; 
            color: white; 
            padding: 30px; 
            text-align: center;
          }
          .content { padding: 30px; }
          .cancelled-box {
            background: #FEE2E2;
            border-left: 4px solid #EF4444;
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
          }
          .btn-rebook {
            display: inline-block;
            background: #4F46E5;
            color: white !important;
            padding: 12px 28px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            margin: 15px 0;
          }
          .footer {
            padding: 20px 30px;
            background: #f9fafb;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Booking Cancelled</h1>
          </div>
          
          <div class="content">
            <p>The following meeting has been cancelled:</p>
            
            <div class="cancelled-box">
              <strong>Meeting Details:</strong><br>
              📅 ${formatDate(booking.start_time)}<br>
              🕐 ${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}<br>
              ${reason ? `<br><strong>Reason:</strong> ${reason}` : ''}
            </div>

            ${rebookUrl ? `
            <div style="text-align: center; margin: 25px 0;">
              <p><strong>Need to reschedule?</strong></p>
              <a href="${rebookUrl}" class="btn-rebook">
                📅 Book Another Time
              </a>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>The calendar event has been removed.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};

module.exports = emailTemplates;