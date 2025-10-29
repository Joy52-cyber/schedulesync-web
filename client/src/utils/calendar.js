const { google } = require('googleapis');

// Initialize OAuth2 client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// Get calendar events for a user
const getCalendarEvents = async (accessToken, refreshToken, timeMin, timeMax) => {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      singleEvents: true,
      orderBy: 'startTime',
    });

    console.log(`✅ Fetched ${response.data.items.length} calendar events`);
    return response.data.items;
  } catch (error) {
    console.error('❌ Error fetching calendar events:', error.message);
    throw error;
  }
};

// Calculate available time slots based on calendar events
const getAvailableSlots = async (accessToken, refreshToken, date, duration = 60) => {
  try {
    // Set time range for the requested date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch existing calendar events
    const events = await getCalendarEvents(
      accessToken,
      refreshToken,
      startOfDay.toISOString(),
      endOfDay.toISOString()
    );

    // Define working hours (9 AM to 5 PM)
    const workStart = 9;
    const workEnd = 17;
    
    // Generate potential time slots
    const allSlots = [];
    const slotDate = new Date(date);
    
    for (let hour = workStart; hour < workEnd; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(slotDate);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + duration);
        
        // Don't add slots that end after work hours
        if (slotEnd.getHours() > workEnd) continue;
        
        // Don't add past slots
        if (slotStart < new Date()) continue;
        
        allSlots.push({
          start: slotStart,
          end: slotEnd,
        });
      }
    }

    // Filter out slots that conflict with existing events
    const availableSlots = allSlots.filter(slot => {
      return !events.some(event => {
        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);
        
        // Check if slot overlaps with event
        return (
          (slot.start >= eventStart && slot.start < eventEnd) ||
          (slot.end > eventStart && slot.end <= eventEnd) ||
          (slot.start <= eventStart && slot.end >= eventEnd)
        );
      });
    });

    console.log(`✅ Found ${availableSlots.length} available slots for ${date}`);
    
    return availableSlots.map(slot => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      startTime: slot.start.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }),
      endTime: slot.end.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }),
    }));
    
  } catch (error) {
    console.error('❌ Error calculating available slots:', error.message);
    throw error;
  }
};

// Create a calendar event
const createCalendarEvent = async (accessToken, refreshToken, eventDetails) => {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: eventDetails.summary || 'ScheduleSync Booking',
      description: eventDetails.description || '',
      start: {
        dateTime: eventDetails.start,
        timeZone: eventDetails.timeZone || 'UTC',
      },
      end: {
        dateTime: eventDetails.end,
        timeZone: eventDetails.timeZone || 'UTC',
      },
      attendees: eventDetails.attendees || [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 },       // 30 mins before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all', // Send email to attendees
    });

    console.log('✅ Calendar event created:', response.data.htmlLink);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error creating calendar event:', error.message);
    throw error;
  }
};

// Generate .ics calendar file
const generateICSFile = (eventDetails) => {
  const { summary, description, start, end, attendeeName, attendeeEmail } = eventDetails;
  
  const formatDate = (date) => {
    return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ScheduleSync//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${Date.now()}@schedulesync.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:${summary}
DESCRIPTION:${description || ''}
ORGANIZER:mailto:${process.env.FROM_EMAIL}
ATTENDEE;RSVP=TRUE;CN=${attendeeName}:mailto:${attendeeEmail}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:Reminder: ${summary} in 30 minutes
END:VALARM
END:VEVENT
END:VCALENDAR`;

  return ics;
};

module.exports = {
  getOAuth2Client,
  getCalendarEvents,
  getAvailableSlots,
  createCalendarEvent,
  generateICSFile,
};