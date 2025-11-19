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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .content { 
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #111827;
          }
          .meeting-details { 
            background: #f9fafb; 
            padding: 24px; 
            border-radius: 12px; 
            margin: 24px 0;
            border: 1px solid #e5e7eb;
          }
          .detail-row { 
            display: flex;
            align-items: flex-start;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-icon {
            font-size: 20px;
            margin-right: 12px;
          }
          .detail-label { 
            font-weight: 600;
            color: #6b7280;
            min-width: 100px;
          }
          .detail-value { 
            flex: 1; 
            color: #111827;
            font-weight: 500;
          }
          .meet-section {
            text-align: center;
            margin: 32px 0;
            padding: 24px;
            background: linear-gradient(135deg, #f3e8ff 0%, #dbeafe 100%);
            border-radius: 12px;
            border: 2px solid #a78bfa;
          }
          .meet-link { 
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            padding: 16px 40px;
            text-align: center; 
            border-radius: 10px;
            text-decoration: none;
            font-weight: 700;
            font-size: 16px;
            margin: 12px 0;
            box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);
            transition: transform 0.2s;
          }
          .meet-link:hover {
            transform: translateY(-2px);
          }
          .meet-note {
            color: #6b7280;
            font-size: 14px;
            margin-top: 12px;
          }
          .actions { 
            margin-top: 32px; 
            text-align: center;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
          }
          .btn { 
            display: inline-block; 
            padding: 14px 28px; 
            margin: 8px 4px; 
            border-radius: 8px; 
            text-decoration: none; 
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s;
          }
          .btn-primary { 
            background: #3b82f6; 
            color: white !important;
            box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
          }
          .btn-primary:hover {
            background: #2563eb;
          }
          .btn-secondary { 
            background: #e5e7eb; 
            color: #374151 !important;
          }
          .btn-secondary:hover {
            background: #d1d5db;
          }
          .footer {
            padding: 24px 30px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 0;
            color: #6b7280;
            font-size: 13px;
            line-height: 1.5;
          }
          @media only screen and (max-width: 600px) {
            .container {
              margin: 20px;
            }
            .header, .content, .footer {
              padding: 24px 20px;
            }
            .btn {
              display: block;
              margin: 8px 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Booking Confirmed!</h1>
            <p>Your meeting has been successfully scheduled</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hi ${booking.attendee_name},</p>
            <p>Your meeting with <strong>${booking.organizer_name || booking.team_name}</strong> has been confirmed.</p>
            
            <div class="meeting-details">
              <div class="detail-row">
                <span class="detail-icon">📅</span>
                <div style="flex: 1;">
                  <div class="detail-label">Date</div>
                  <div class="detail-value">${formatDate(booking.start_time)}</div>
                </div>
              </div>
              
              <div class="detail-row">
                <span class="detail-icon">🕐</span>
                <div style="flex: 1;">
                  <div class="detail-label">Time</div>
                  <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
                </div>
              </div>
              
              <div class="detail-row">
                <span class="detail-icon">⏱️</span>
                <div style="flex: 1;">
                  <div class="detail-label">Duration</div>
                  <div class="detail-value">30 minutes</div>
                </div>
              </div>
              
              ${booking.notes ? `
              <div class="detail-row">
                <span class="detail-icon">📝</span>
                <div style="flex: 1;">
                  <div class="detail-label">Notes</div>
                  <div class="detail-value">${booking.notes}</div>
                </div>
              </div>
              ` : ''}
            </div>

            ${booking.meet_link ? `
            <div class="meet-section">
              <div style="font-size: 24px; margin-bottom: 8px;">🎥</div>
              <h3 style="margin: 0 0 12px 0; color: #7c3aed; font-size: 18px;">Video Conference Ready</h3>
              <a href="${booking.meet_link}" class="meet-link">
                Join Google Meet
              </a>
              <p class="meet-note">
                💡 Click this link at the scheduled time to join the video call
              </p>
            </div>
            ` : ''}

            <div class="actions">
              <a href="${managementUrl}" class="btn btn-primary">
                Manage Booking
              </a>
              <a href="${managementUrl}?action=reschedule" class="btn btn-secondary">
                Reschedule
              </a>
            </div>
          </div>

          <div class="footer">
            <p>
              📧 A calendar invitation has been sent to your email with all the details.
              ${booking.meet_link ? ' The meeting link is also included in the calendar invite.' : ''}
            </p>
            <p style="margin-top: 12px;">
              This is an automated message from ScheduleSync. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // Organizer notification email
  bookingConfirmationOrganizer: (booking) => {
    const managementUrl = `${process.env.FRONTEND_URL}/manage/${booking.booking_token}`;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .content { 
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #111827;
          }
          .meeting-details { 
            background: #f0fdf4; 
            padding: 24px; 
            border-radius: 12px; 
            margin: 24px 0;
            border: 1px solid #bbf7d0;
          }
          .detail-row { 
            display: flex;
            align-items: flex-start;
            padding: 12px 0;
            border-bottom: 1px solid #d1fae5;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-icon {
            font-size: 20px;
            margin-right: 12px;
          }
          .detail-label { 
            font-weight: 600;
            color: #059669;
            min-width: 100px;
          }
          .detail-value { 
            flex: 1; 
            color: #111827;
            font-weight: 500;
          }
          .meet-section {
            text-align: center;
            margin: 32px 0;
            padding: 24px;
            background: linear-gradient(135deg, #f3e8ff 0%, #dbeafe 100%);
            border-radius: 12px;
            border: 2px solid #a78bfa;
          }
          .meet-link { 
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            padding: 16px 40px;
            text-align: center; 
            border-radius: 10px;
            text-decoration: none;
            font-weight: 700;
            font-size: 16px;
            margin: 12px 0;
            box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);
          }
          .footer {
            padding: 24px 30px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 0;
            color: #6b7280;
            font-size: 13px;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 New Booking Received</h1>
            <p>Someone just scheduled a meeting with you</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hi ${booking.organizer_name},</p>
            <p>You have a new booking from <strong>${booking.attendee_name}</strong>.</p>
            
            <div class="meeting-details">
              <div class="detail-row">
                <span class="detail-icon">👤</span>
                <div style="flex: 1;">
                  <div class="detail-label">Guest</div>
                  <div class="detail-value">${booking.attendee_name}<br><small>${booking.attendee_email}</small></div>
                </div>
              </div>
              
              <div class="detail-row">
                <span class="detail-icon">📅</span>
                <div style="flex: 1;">
                  <div class="detail-label">Date</div>
                  <div class="detail-value">${formatDate(booking.start_time)}</div>
                </div>
              </div>
              
              <div class="detail-row">
                <span class="detail-icon">🕐</span>
                <div style="flex: 1;">
                  <div class="detail-label">Time</div>
                  <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
                </div>
              </div>
              
              ${booking.notes ? `
              <div class="detail-row">
                <span class="detail-icon">📝</span>
                <div style="flex: 1;">
                  <div class="detail-label">Notes</div>
                  <div class="detail-value">${booking.notes}</div>
                </div>
              </div>
              ` : ''}
            </div>

            ${booking.meet_link ? `
            <div class="meet-section">
              <div style="font-size: 24px; margin-bottom: 8px;">🎥</div>
              <h3 style="margin: 0 0 12px 0; color: #7c3aed; font-size: 18px;">Video Conference Link</h3>
              <a href="${booking.meet_link}" class="meet-link">
                Join Google Meet
              </a>
              <p style="color: #6b7280; font-size: 14px; margin-top: 12px;">
                💡 Share this link with your guest or use it to join the meeting
              </p>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>
              📧 A calendar invitation has been added to your Google Calendar with all the details.
            </p>
            <p style="margin-top: 12px;">
              This is an automated message from ScheduleSync.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // Booking reschedule email
  bookingReschedule: (booking, oldStartTime) => {
    const managementUrl = `${process.env.FRONTEND_URL}/manage/${booking.booking_token}`;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
          }
          .content { padding: 40px 30px; }
          .old-time {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .new-time {
            background: #d1fae5;
            border-left: 4px solid #10b981;
            padding: 16px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .meet-link { 
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            padding: 16px 40px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 700;
            margin: 20px 0;
          }
          .footer {
            padding: 24px 30px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Booking Rescheduled</h1>
            <p>Your meeting time has been updated</p>
          </div>
          
          <div class="content">
            <p>Hi there,</p>
            <p>Your meeting has been rescheduled to a new time.</p>
            
            <div class="old-time">
              <strong>❌ Previous Time:</strong><br>
              ${formatDate(oldStartTime)} at ${formatTime(oldStartTime)}
            </div>
            
            <div class="new-time">
              <strong>✅ New Time:</strong><br>
              ${formatDate(booking.start_time)} at ${formatTime(booking.start_time)}
            </div>

            ${booking.meet_link ? `
            <div style="text-align: center; margin: 32px 0;">
              <p><strong>🎥 Video Conference Link:</strong></p>
              <a href="${booking.meet_link}" class="meet-link">
                Join Google Meet
              </a>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>Your calendar has been updated with the new time.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // Booking cancellation email
  bookingCancellation: (booking, reason) => {
    const rebookUrl = booking.booking_token ? `${process.env.FRONTEND_URL}/book/${booking.booking_token}` : null;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
          }
          .content { padding: 40px 30px; }
          .cancelled-details {
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 16px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .btn-rebook {
            display: inline-block;
            background: #3b82f6;
            color: white !important;
            padding: 14px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            padding: 24px 30px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Booking Cancelled</h1>
            <p>This meeting has been cancelled</p>
          </div>
          
          <div class="content">
            <p>The following meeting has been cancelled:</p>
            
            <div class="cancelled-details">
              <strong>Meeting Details:</strong><br>
              📅 ${formatDate(booking.start_time)}<br>
              🕐 ${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}<br>
              ${reason ? `<br><strong>Reason:</strong> ${reason}` : ''}
            </div>

            ${rebookUrl ? `
            <div style="text-align: center; margin: 32px 0;">
              <p><strong>Need to reschedule?</strong></p>
              <a href="${rebookUrl}" class="btn-rebook">
                📅 Book Another Time
              </a>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>The calendar event has been removed from your calendar.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};

module.exports = emailTemplates;