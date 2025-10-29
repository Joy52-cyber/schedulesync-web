const fetch = require('node-fetch');

/**
 * Get a fresh access token using refresh token
 */
async function refreshAccessToken(refreshToken) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to refresh token: ${data.error_description}`);
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Fetch calendar events for a user
 */
async function getCalendarEvents(accessToken, timeMin, timeMax) {
  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(`Calendar API error: ${data.error.message}`);
    }

    return data.items || [];
  } catch (error) {
    console.error('Get calendar events error:', error);
    throw error;
  }
}

/**
 * Create a calendar event
 */
async function createCalendarEvent(accessToken, eventDetails) {
  try {
    const { summary, description, start, end, attendees } = eventDetails;

    const event = {
      summary,
      description,
      start: {
        dateTime: start,
        timeZone: 'UTC',
      },
      end: {
        dateTime: end,
        timeZone: 'UTC',
      },
      attendees: attendees.map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ],
      },
    };

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to create event: ${data.error.message}`);
    }

    console.log('✅ Calendar event created:', data.id);
    return data;
  } catch (error) {
    console.error('Create calendar event error:', error);
    throw error;
  }
}

/**
 * Calculate available time slots
 */
function calculateAvailableSlots(busyEvents, startDate, endDate, slotDuration = 60) {
  const slots = [];
  const workingHours = { start: 9, end: 17 }; // 9 AM to 5 PM

  // Convert busy events to time ranges
  const busyRanges = busyEvents.map(event => ({
    start: new Date(event.start.dateTime || event.start.date),
    end: new Date(event.end.dateTime || event.end.date),
  }));

  // Generate slots for each day
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // Skip weekends
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Generate slots for this day
    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      const slotStart = new Date(currentDate);
      slotStart.setHours(hour, 0, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

      // Check if slot overlaps with any busy period
      const isAvailable = !busyRanges.some(busy => {
        return slotStart < busy.end && slotEnd > busy.start;
      });

      if (isAvailable) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          formatted: {
            date: slotStart.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            time: slotStart.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            }),
          },
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

/**
 * Get available slots for a user
 */
async function getAvailableSlots(pool, userId, daysAhead = 7, slotDuration = 60) {
  try {
    // Get user's tokens
    const userResult = await pool.query(
      'SELECT google_refresh_token, google_access_token, token_expiry FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    if (!user.google_refresh_token) {
      throw new Error('User has not connected Google Calendar');
    }

    // Check if token is expired
    let accessToken = user.google_access_token;
    const tokenExpiry = new Date(user.token_expiry);
    const now = new Date();

    if (!accessToken || tokenExpiry <= now) {
      console.log('Access token expired, refreshing...');
      const newTokens = await refreshAccessToken(user.google_refresh_token);
      accessToken = newTokens.access_token;

      // Update token in database
      await pool.query(
        'UPDATE users SET google_access_token = $1, token_expiry = $2 WHERE id = $3',
        [accessToken, new Date(now.getTime() + newTokens.expires_in * 1000), userId]
      );
    }

    // Calculate date range
    const timeMin = new Date();
    timeMin.setHours(0, 0, 0, 0);
    
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + daysAhead);
    timeMax.setHours(23, 59, 59, 999);

    // Fetch calendar events
    console.log(`Fetching calendar events from ${timeMin.toISOString()} to ${timeMax.toISOString()}`);
    const events = await getCalendarEvents(accessToken, timeMin, timeMax);
    console.log(`Found ${events.length} calendar events`);

    // Calculate available slots
    const slots = calculateAvailableSlots(events, timeMin, timeMax, slotDuration);
    console.log(`Generated ${slots.length} available slots`);

    return {
      slots,
      totalEvents: events.length,
      dateRange: {
        start: timeMin.toISOString(),
        end: timeMax.toISOString(),
      },
    };
  } catch (error) {
    console.error('Get available slots error:', error);
    throw error;
  }
}

module.exports = {
  refreshAccessToken,
  getCalendarEvents,
  createCalendarEvent,
  calculateAvailableSlots,
  getAvailableSlots,
};