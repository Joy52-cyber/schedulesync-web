const { google } = require('googleapis');

const createCalendarEvent = async (accessToken, refreshToken, eventDetails) => {
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
      start: { dateTime: eventDetails.start, timeZone: 'UTC' },
      end: { dateTime: eventDetails.end, timeZone: 'UTC' },
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

    console.log('✅ Calendar event created:', response.data.id);
    return response.data;
  } catch (error) {
    console.error('❌ Calendar event creation failed:', error.message);
    throw error;
  }
};

const getAvailableSlots = async (accessToken, refreshToken, date, duration) => {
  return [];
};

module.exports = {
  createCalendarEvent,
  getAvailableSlots,
};