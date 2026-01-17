/**
 * Calendar Service
 * Handles calendar event creation for Google Calendar and Microsoft Outlook
 */

const { google } = require('googleapis');
const axios = require('axios');
const pool = require('../config/database');

/**
 * Create a calendar event for a booking
 * Supports both Google Calendar and Microsoft Outlook
 */
async function createCalendarEvent(userId, bookingData) {
  try {
    // Get user's calendar credentials
    const userResult = await pool.query(
      `SELECT google_access_token, google_refresh_token,
              microsoft_access_token, microsoft_refresh_token,
              provider, email, name, timezone
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.log('User not found for calendar event creation');
      return null;
    }

    const user = userResult.rows[0];

    // Try Google Calendar first
    if (user.google_access_token && user.google_refresh_token) {
      return await createGoogleCalendarEvent(user, bookingData);
    }

    // Fall back to Microsoft Calendar
    if (user.microsoft_access_token && user.microsoft_refresh_token) {
      return await createMicrosoftCalendarEvent(user, bookingData);
    }

    console.log('No calendar credentials found for user');
    return null;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

/**
 * Create Google Calendar event with Meet link
 */
async function createGoogleCalendarEvent(user, bookingData) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Build attendees list
    const attendees = [
      { email: bookingData.attendee_email, displayName: bookingData.attendee_name }
    ];

    // Add additional guests
    if (bookingData.additional_guests && Array.isArray(bookingData.additional_guests)) {
      bookingData.additional_guests.forEach(email => {
        attendees.push({ email });
      });
    }

    // Build event object
    const event = {
      summary: bookingData.title,
      description: bookingData.notes || 'Meeting scheduled via TruCal',
      start: {
        dateTime: new Date(bookingData.start_time).toISOString(),
        timeZone: user.timezone || 'America/New_York'
      },
      end: {
        dateTime: new Date(bookingData.end_time).toISOString(),
        timeZone: user.timezone || 'America/New_York'
      },
      attendees: attendees,
      conferenceData: {
        createRequest: {
          requestId: `trucal-${bookingData.id || Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }       // 30 min before
        ]
      }
    };

    // Add recurrence if this is a recurring event
    if (bookingData.recurrence_rule) {
      event.recurrence = [`RRULE:${bookingData.recurrence_rule}`];
      console.log(`🔄 Creating recurring Google Calendar event: ${bookingData.recurrence_rule}`);
    }

    console.log('Creating Google Calendar event...');
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all' // Send invites to all attendees
    });

    console.log('✅ Google Calendar event created:', response.data.id);

    // Extract Meet link
    const meetLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri;

    return {
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      meetLink: meetLink,
      provider: 'google'
    };
  } catch (error) {
    console.error('Google Calendar event creation failed:', error.message);

    // Try to refresh token if expired
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      console.log('Access token expired, attempting to refresh...');
      const refreshed = await refreshGoogleToken(user);
      if (refreshed) {
        // Retry once with new token
        return await createGoogleCalendarEvent({ ...user, ...refreshed }, bookingData);
      }
    }

    return null;
  }
}

/**
 * Create Microsoft Outlook calendar event with Teams link
 */
async function createMicrosoftCalendarEvent(user, bookingData) {
  try {
    // Build attendees list
    const attendees = [
      {
        emailAddress: {
          address: bookingData.attendee_email,
          name: bookingData.attendee_name
        },
        type: 'required'
      }
    ];

    // Add additional guests
    if (bookingData.additional_guests && Array.isArray(bookingData.additional_guests)) {
      bookingData.additional_guests.forEach(email => {
        attendees.push({
          emailAddress: { address: email },
          type: 'required'
        });
      });
    }

    const event = {
      subject: bookingData.title,
      body: {
        contentType: 'HTML',
        content: bookingData.notes || 'Meeting scheduled via TruCal'
      },
      start: {
        dateTime: new Date(bookingData.start_time).toISOString(),
        timeZone: user.timezone || 'America/New_York'
      },
      end: {
        dateTime: new Date(bookingData.end_time).toISOString(),
        timeZone: user.timezone || 'America/New_York'
      },
      attendees: attendees,
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness'
    };

    // Add recurrence if this is a recurring event
    if (bookingData.recurrence_rule) {
      event.recurrence = {
        pattern: parseRRuleForMicrosoft(bookingData.recurrence_rule),
        range: {
          type: bookingData.recurrence_end_date ? 'endDate' : 'noEnd',
          startDate: new Date(bookingData.start_time).toISOString().split('T')[0],
          endDate: bookingData.recurrence_end_date ? new Date(bookingData.recurrence_end_date).toISOString().split('T')[0] : undefined
        }
      };
      console.log(`🔄 Creating recurring Microsoft Calendar event: ${bookingData.recurrence_rule}`);
    }

    console.log('Creating Microsoft Calendar event...');
    const response = await axios.post(
      'https://graph.microsoft.com/v1.0/me/events',
      event,
      {
        headers: {
          'Authorization': `Bearer ${user.microsoft_access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Microsoft Calendar event created:', response.data.id);

    return {
      eventId: response.data.id,
      eventLink: response.data.webLink,
      meetLink: response.data.onlineMeeting?.joinUrl,
      provider: 'microsoft'
    };
  } catch (error) {
    console.error('Microsoft Calendar event creation failed:', error.message);

    // Try to refresh token if expired
    if (error.response?.status === 401) {
      console.log('Access token expired, attempting to refresh...');
      const refreshed = await refreshMicrosoftToken(user);
      if (refreshed) {
        // Retry once with new token
        return await createMicrosoftCalendarEvent({ ...user, ...refreshed }, bookingData);
      }
    }

    return null;
  }
}

/**
 * Refresh Google OAuth token
 */
async function refreshGoogleToken(user) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: user.google_refresh_token
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update database
    await pool.query(
      'UPDATE users SET google_access_token = $1 WHERE id = $2',
      [credentials.access_token, user.id]
    );

    console.log('✅ Google token refreshed');

    return {
      google_access_token: credentials.access_token
    };
  } catch (error) {
    console.error('Failed to refresh Google token:', error.message);
    return null;
  }
}

/**
 * Refresh Microsoft OAuth token
 */
async function refreshMicrosoftToken(user) {
  try {
    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: user.microsoft_refresh_token,
        grant_type: 'refresh_token',
        scope: 'Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, refresh_token } = response.data;

    // Update database
    await pool.query(
      'UPDATE users SET microsoft_access_token = $1, microsoft_refresh_token = $2 WHERE id = $3',
      [access_token, refresh_token || user.microsoft_refresh_token, user.id]
    );

    console.log('✅ Microsoft token refreshed');

    return {
      microsoft_access_token: access_token,
      microsoft_refresh_token: refresh_token || user.microsoft_refresh_token
    };
  } catch (error) {
    console.error('Failed to refresh Microsoft token:', error.message);
    return null;
  }
}

/**
 * Convert RRULE string to Microsoft Graph API recurrence pattern
 * Example: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE" → {type: 'weekly', interval: 2, daysOfWeek: ['monday', 'wednesday']}
 */
function parseRRuleForMicrosoft(rrule) {
  const parts = rrule.split(';');
  const pattern = {
    type: 'daily',
    interval: 1
  };

  parts.forEach(part => {
    const [key, value] = part.split('=');

    switch (key) {
      case 'FREQ':
        pattern.type = value.toLowerCase();
        break;
      case 'INTERVAL':
        pattern.interval = parseInt(value);
        break;
      case 'BYDAY':
        pattern.daysOfWeek = value.split(',').map(day => {
          const dayMap = { 'MO': 'monday', 'TU': 'tuesday', 'WE': 'wednesday', 'TH': 'thursday', 'FR': 'friday', 'SA': 'saturday', 'SU': 'sunday' };
          return dayMap[day] || day.toLowerCase();
        });
        break;
      case 'BYMONTHDAY':
        pattern.dayOfMonth = parseInt(value);
        break;
    }
  });

  return pattern;
}

module.exports = {
  createCalendarEvent,
  createGoogleCalendarEvent,
  createMicrosoftCalendarEvent,
  refreshGoogleToken,
  refreshMicrosoftToken,
  parseRRuleForMicrosoft
};
