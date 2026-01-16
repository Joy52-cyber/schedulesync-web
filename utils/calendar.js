const { google } = require('googleapis');
const axios = require('axios');

/**
 * Create Google Calendar event
 */
const createGoogleCalendarEvent = async (accessToken, refreshToken, eventDetails) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: { dateTime: eventDetails.start, timeZone: eventDetails.timeZone || 'UTC' },
      end: { dateTime: eventDetails.end, timeZone: eventDetails.timeZone || 'UTC' },
      attendees: eventDetails.attendees || [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all',
    });

    console.log('✅ Google Calendar event created:', response.data.id);
    return { provider: 'google', eventId: response.data.id, htmlLink: response.data.htmlLink };
  } catch (error) {
    console.error('❌ Google Calendar event creation failed:', error.message);
    throw error;
  }
};

/**
 * Create Microsoft Outlook calendar event
 */
const createOutlookCalendarEvent = async (accessToken, eventDetails) => {
  try {
    const event = {
      subject: eventDetails.summary,
      body: {
        contentType: 'Text',
        content: eventDetails.description || ''
      },
      start: {
        dateTime: eventDetails.start,
        timeZone: eventDetails.timeZone || 'UTC'
      },
      end: {
        dateTime: eventDetails.end,
        timeZone: eventDetails.timeZone || 'UTC'
      },
      attendees: (eventDetails.attendees || []).map(email => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0]
        },
        type: 'required'
      })),
      reminderMinutesBeforeStart: 30,
      isReminderOn: true
    };

    const response = await axios.post(
      'https://graph.microsoft.com/v1.0/me/calendar/events',
      event,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Outlook Calendar event created:', response.data.id);
    return { provider: 'outlook', eventId: response.data.id, webLink: response.data.webLink };
  } catch (error) {
    console.error('❌ Outlook Calendar event creation failed:', error.message);
    throw error;
  }
};

/**
 * Create calendar event (auto-detects provider)
 */
const createCalendarEvent = async (user, eventDetails) => {
  const hasGoogle = !!(user.google_access_token && user.google_refresh_token);
  const hasMicrosoft = !!(user.microsoft_access_token);

  // Try Google Calendar first if available
  if (hasGoogle) {
    try {
      return await createGoogleCalendarEvent(
        user.google_access_token,
        user.google_refresh_token,
        eventDetails
      );
    } catch (error) {
      console.error('Google Calendar failed, trying Microsoft if available:', error.message);
      if (!hasMicrosoft) throw error;
    }
  }

  // Try Microsoft Calendar if available
  if (hasMicrosoft) {
    return await createOutlookCalendarEvent(user.microsoft_access_token, eventDetails);
  }

  throw new Error('No calendar integration available for this user');
};

const getAvailableSlots = async (accessToken, refreshToken, date, duration) => {
  return [];
};

module.exports = {
  createCalendarEvent,
  createGoogleCalendarEvent,
  createOutlookCalendarEvent,
  getAvailableSlots,
};