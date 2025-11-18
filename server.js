require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const path = require('path');
const { google } = require('googleapis');
const crypto = require('crypto');

const app = express();

// ============ CONDITIONAL IMPORTS ============

let sendTeamInvitation, sendBookingConfirmation, sendOrganizerNotification, isEmailAvailable;
try {
  const emailUtils = require('./utils/email');
  sendTeamInvitation = emailUtils.sendTeamInvitation;
  sendBookingConfirmation = emailUtils.sendBookingConfirmation;
  sendOrganizerNotification = emailUtils.sendOrganizerNotification;
  isEmailAvailable = emailUtils.isEmailAvailable;
  
  if (isEmailAvailable()) {
    console.log('✅ Email utilities loaded successfully');
  } else {
    console.log('⚠️ Email utilities available but RESEND_API_KEY not configured');
  }
} catch (error) {
  console.log('⚠️ Email utilities not available - emails will not be sent');
}

let getAvailableSlots, createCalendarEvent;
try {
  const calendarUtils = require('./utils/calendar');
  getAvailableSlots = calendarUtils.getAvailableSlots;
  createCalendarEvent = calendarUtils.createCalendarEvent;
  console.log('✅ Calendar utilities loaded successfully');
} catch (error) {
  console.log('⚠️ Calendar utilities not available - calendar sync disabled');
}

// ============ MIDDLEWARE ============

app.use(cors());
app.use(express.json());

// ============ DATABASE CONNECTION ============

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// ============ DATABASE INITIALIZATION ============

async function initDB() {
  try {
    console.log('Initializing database...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE,
        microsoft_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        google_access_token TEXT,
        google_refresh_token TEXT,
        calendar_sync_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        booking_token VARCHAR(255) UNIQUE NOT NULL,
        invited_by INTEGER REFERENCES users(id),
        external_booking_link TEXT,
        external_booking_platform VARCHAR(50) DEFAULT 'calendly',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        attendee_name VARCHAR(255) NOT NULL,
        attendee_email VARCHAR(255) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        notes TEXT,
        booking_token VARCHAR(255),
        status VARCHAR(50) DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_links (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

initDB();

// ============ AUTHENTICATION MIDDLEWARE ============

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============ TIMEZONE HELPER FUNCTION ============

function getTimezoneOffset(timezone) {
  const tzOffsets = {
    'Asia/Singapore': 8,
    'Asia/Manila': 8,
    'Australia/Perth': 8,
    'Asia/Hong_Kong': 8,
    'Asia/Kuala_Lumpur': 8,
    'Asia/Shanghai': 8,
    'Asia/Taipei': 8,
    'Asia/Bangkok': 7,
    'Asia/Jakarta': 7,
    'Australia/Sydney': 11,
    'Australia/Melbourne': 11,
    'Australia/Brisbane': 10,
    'Australia/Adelaide': 10.5,
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Europe/Berlin': 1,
    'Europe/Madrid': 1,
    'Europe/Rome': 1,
  };
  
  return tzOffsets[timezone] || 0;
}

// ============ ORGANIZER OAUTH (dashboard login with calendar write access) ============

app.get('/api/auth/google/url', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/login`
  );

  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  res.json({ url: authUrl });
});

app.post('/api/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/login`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userInfo.email]);

    let user;
    if (userResult.rows.length === 0) {
      const insertResult = await pool.query(
        `INSERT INTO users (google_id, email, name, google_access_token, google_refresh_token, calendar_sync_enabled)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
        [userInfo.id, userInfo.email, userInfo.name, tokens.access_token, tokens.refresh_token]
      );
      user = insertResult.rows[0];
    } else {
      const updateResult = await pool.query(
        `UPDATE users SET google_id = $1, name = $2, google_access_token = $3, google_refresh_token = $4, calendar_sync_enabled = true
         WHERE email = $5 RETURNING *`,
        [userInfo.id, userInfo.name, tokens.access_token, tokens.refresh_token, userInfo.email]
      );
      user = updateResult.rows[0];
    }

    await pool.query('UPDATE team_members SET user_id = $1 WHERE email = $2 AND user_id IS NULL', [user.id, user.email]);

    const jwtToken = jwt.sign({ id: user.id, email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: '30d' });

    console.log('✅ Organizer OAuth successful:', user.email);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, calendar_sync_enabled: user.calendar_sync_enabled },
      token: jwtToken,
    });
  } catch (error) {
    console.error('❌ Organizer OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ============ GUEST OAUTH (booking page - read only) ============

app.post('/api/book/auth/google', async (req, res) => {
  try {
    const { code, bookingToken } = req.body;
    
    if (!code || !bookingToken) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const memberCheck = await pool.query('SELECT * FROM team_members WHERE booking_token = $1', [bookingToken]);

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.FRONTEND_URL}/oauth/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const grantedScopes = tokens.scope || '';
    const hasCalendarAccess = grantedScopes.includes('calendar.readonly');

    console.log('✅ Guest OAuth successful:', { email: userInfo.email, hasCalendarAccess });

    res.json({
      success: true,
      email: userInfo.email,
      name: userInfo.name,
      hasCalendarAccess,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });
  } catch (error) {
    console.error('❌ Guest OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ============ GUEST FREEBUSY ============

app.post('/api/book/:token/freebusy', async (req, res) => {
  try {
    const { token } = req.params;
    const { guestAccessToken, guestRefreshToken, startDate, endDate } = req.body;

    if (!guestAccessToken) {
      return res.status(400).json({ error: 'Guest access token required' });
    }

    const memberResult = await pool.query(
      `SELECT tm.*, u.google_access_token, u.google_refresh_token
       FROM team_members tm LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    const calendar = google.calendar({ version: 'v3' });

    const guestAuth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${process.env.FRONTEND_URL}/oauth/callback`);
    guestAuth.setCredentials({ access_token: guestAccessToken, refresh_token: guestRefreshToken });

    const organizerAuth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    organizerAuth.setCredentials({ access_token: member.google_access_token, refresh_token: member.google_refresh_token });

    const [guestFreeBusy, organizerFreeBusy] = await Promise.all([
      calendar.freebusy.query({ auth: guestAuth, requestBody: { timeMin: startDate, timeMax: endDate, items: [{ id: 'primary' }] } }),
      calendar.freebusy.query({ auth: organizerAuth, requestBody: { timeMin: startDate, timeMax: endDate, items: [{ id: 'primary' }] } })
    ]);

    const guestBusy = guestFreeBusy.data.calendars?.primary?.busy || [];
    const organizerBusy = organizerFreeBusy.data.calendars?.primary?.busy || [];

    console.log('📅 Guest busy:', guestBusy.length, 'Organizer busy:', organizerBusy.length);

    res.json({ guestBusy, organizerBusy, mutualAvailability: true });
  } catch (error) {
    console.error('❌ FreeBusy error:', error);
    res.status(500).json({ error: 'Failed to get calendar data' });
  }
});

// ============ ENHANCED SLOT AVAILABILITY WITH REASONS ============

app.post('/api/book/:token/slots-with-status', async (req, res) => {
  try {
    const { token } = req.params;
    const { 
      guestAccessToken, 
      guestRefreshToken,
      duration = 60,
      daysAhead = 14,
      timezone = 'America/New_York'
    } = req.body;

    // Get organizer info
    const memberResult = await pool.query(
      `SELECT tm.*, u.google_access_token, u.google_refresh_token, u.name as organizer_name
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    // Get busy times
    let guestBusy = [];
    let organizerBusy = [];

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysAhead);

    // Fetch organizer's busy times
    if (member.google_access_token && member.google_refresh_token) {
      try {
        const calendar = google.calendar({ version: 'v3' });
        const organizerAuth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        organizerAuth.setCredentials({
          access_token: member.google_access_token,
          refresh_token: member.google_refresh_token
        });

        const freeBusyResponse = await calendar.freebusy.query({
          auth: organizerAuth,
          requestBody: {
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            items: [{ id: 'primary' }],
          },
        });

        organizerBusy = freeBusyResponse.data.calendars?.primary?.busy || [];
      } catch (error) {
        console.error('⚠️ Failed to fetch organizer calendar:', error.message);
      }
    }

    // Fetch guest's busy times
    if (guestAccessToken) {
      try {
        const calendar = google.calendar({ version: 'v3' });
        const guestAuth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          `${process.env.FRONTEND_URL}/oauth/callback`
        );
        guestAuth.setCredentials({
          access_token: guestAccessToken,
          refresh_token: guestRefreshToken
        });

        const freeBusyResponse = await calendar.freebusy.query({
          auth: guestAuth,
          requestBody: {
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            items: [{ id: 'primary' }],
          },
        });

        guestBusy = freeBusyResponse.data.calendars?.primary?.busy || [];
      } catch (error) {
        console.error('⚠️ Failed to fetch guest calendar:', error.message);
      }
    }

    // Generate slots
    const slots = [];
    const TIMEZONE = timezone;
    const WORK_START_HOUR = 9;
    const WORK_END_HOUR = 17;

    console.log(`🌍 Generating slots for timezone: ${TIMEZONE}`);

    const tzOffsetHours = getTimezoneOffset(TIMEZONE);
    console.log(`⏰ Timezone offset: UTC${tzOffsetHours >= 0 ? '+' : ''}${tzOffsetHours}`);

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      
      // Get midnight UTC for this day
      const baseDateUTC = new Date(checkDate);
      baseDateUTC.setUTCHours(0, 0, 0, 0);
      
      // Calculate day of week in user's timezone
      const userTZDate = new Date(baseDateUTC.getTime() + (tzOffsetHours * 60 * 60 * 1000));
      const dayOfWeek = userTZDate.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Generate slots for work hours (9am-5pm in user's timezone)
      for (let hour = WORK_START_HOUR; hour < WORK_END_HOUR; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          // Create slot time in user's local timezone
          const slotLocalTime = new Date(baseDateUTC);
          slotLocalTime.setUTCHours(hour, minute, 0, 0);
          
          // Convert to UTC by subtracting the timezone offset
          const slotStart = new Date(slotLocalTime.getTime() - (tzOffsetHours * 60 * 60 * 1000));
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          const startTime = slotStart.toISOString();
          const endTime = slotEnd.toISOString();

          // Determine slot status
          let status = 'available';
          let reason = null;
          let details = null;

          // Check if time has passed
          if (slotStart < now) {
            status = 'unavailable';
            reason = 'past';
            details = 'Time has passed';
          }
          // Check if weekend
          else if (isWeekend) {
            status = 'unavailable';
            reason = 'weekend';
            details = 'Weekend';
          }
          // Check conflicts
          else {
            const organizerConflict = organizerBusy.some(busy => {
              const busyStart = new Date(busy.start);
              const busyEnd = new Date(busy.end);
              return (
                (slotStart >= busyStart && slotStart < busyEnd) ||
                (slotEnd > busyStart && slotEnd <= busyEnd) ||
                (slotStart <= busyStart && slotEnd >= busyEnd)
              );
            });

            const guestConflict = guestBusy.some(busy => {
              const busyStart = new Date(busy.start);
              const busyEnd = new Date(busy.end);
              return (
                (slotStart >= busyStart && slotStart < busyEnd) ||
                (slotEnd > busyStart && slotEnd <= busyEnd) ||
                (slotStart <= busyStart && slotEnd >= busyEnd)
              );
            });

            if (organizerConflict && guestConflict) {
              status = 'unavailable';
              reason = 'both_busy';
              details = 'Both calendars show conflicts';
            } else if (organizerConflict) {
              status = 'unavailable';
              reason = 'organizer_busy';
              details = `${member.organizer_name || 'Organizer'} has another meeting`;
            } else if (guestConflict) {
              status = 'unavailable';
              reason = 'guest_busy';
              details = "You have another meeting";
            }
          }

          slots.push({
            start: startTime,
            end: endTime,
            status,
            reason,
            details,
            timestamp: slotStart.getTime()
          });
        }
      }
    }

    // Group and format slots in user's timezone
    const slotsByDate = {};
    slots.forEach(slot => {
      const slotDate = new Date(slot.start);
      
      const dateKey = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: TIMEZONE
      }).format(slotDate);
      
      const dayOfWeek = new Intl.DateTimeFormat('en-US', { 
        weekday: 'short',
        timeZone: TIMEZONE 
      }).format(slotDate);
      
      const time = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: TIMEZONE
      }).format(slotDate);
      
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      
      slotsByDate[dateKey].push({
        ...slot,
        date: dateKey,
        dayOfWeek: dayOfWeek,
        time: time
      });
    });

    console.log(`✅ Generated ${slots.length} slots with status (${Object.keys(slotsByDate).length} days)`);

    res.json({
      slots: slotsByDate,
      summary: {
        totalSlots: slots.length,
        availableSlots: slots.filter(s => s.status === 'available').length,
        hasGuestCalendar: guestBusy.length > 0,
        hasOrganizerCalendar: organizerBusy.length > 0
      }
    });

  } catch (error) {
    console.error('❌ Slot status error:', error);
    res.status(500).json({ error: 'Failed to get slot availability' });
  }
});

// ============ DEBUG: CHECK WHAT BACKEND SEES ============

app.get('/api/debug-slots/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const memberResult = await pool.query(
      `SELECT tm.*, u.google_access_token, u.google_refresh_token, u.name as organizer_name, u.email as organizer_email
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid token' });
    }
    
    const member = memberResult.rows[0];
    
    const nov18Start = new Date('2025-11-18T00:00:00Z');
    const nov18End = new Date('2025-11-18T23:59:59Z');
    
    let organizerBusy = [];
    
    if (member.google_access_token && member.google_refresh_token) {
      const calendar = google.calendar({ version: 'v3' });
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      auth.setCredentials({
        access_token: member.google_access_token,
        refresh_token: member.google_refresh_token
      });
      
      const freeBusyResponse = await calendar.freebusy.query({
        auth: auth,
        requestBody: {
          timeMin: nov18Start.toISOString(),
          timeMax: nov18End.toISOString(),
          items: [{ id: 'primary' }],
        },
      });
      
      organizerBusy = freeBusyResponse.data.calendars?.primary?.busy || [];
    }
    
    const sampleSlots = [];
    for (let hour = 9; hour < 18; hour++) {
      const slotStartSingapore = new Date(`2025-11-18T${hour.toString().padStart(2, '0')}:00:00+08:00`);
      const slotStartUTC = new Date(slotStartSingapore.getTime() - (8 * 60 * 60 * 1000));
      
      sampleSlots.push({
        hour: hour,
        startLocal: `${hour}:00 Singapore Time`,
        startUTC: slotStartUTC.toISOString(),
        isOutsideWorkHours: hour < 9 || hour >= 17
      });
    }
    
    res.json({
      organizer: {
        name: member.organizer_name,
        email: member.organizer_email,
        hasTokens: !!(member.google_access_token && member.google_refresh_token)
      },
      nov18BusyTimes: organizerBusy.map(b => ({
        start: b.start,
        end: b.end,
        startLocal: new Date(b.start).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
        endLocal: new Date(b.end).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
        startUTC: b.start,
        endUTC: b.end
      })),
      sampleSlots: sampleSlots
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ AI SLOT SUGGESTIONS ============

app.post('/api/suggest-slots', async (req, res) => {
  try {
    const { bookingToken, duration = 60, guestBusy = [], organizerBusy = [] } = req.body;

    if (!bookingToken) {
      return res.status(400).json({ error: 'bookingToken is required' });
    }

    const memberResult = await pool.query(
      `SELECT tm.* FROM team_members tm WHERE tm.booking_token = $1`,
      [bookingToken]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const slots = [];
    const today = new Date();
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(9, 0, 0, 0);

      for (let hour = 9; hour < 17; hour++) {
        const start = new Date(date);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + duration);

        if (end.getHours() >= 17 || start < new Date()) continue;

        const startTime = start.toISOString();
        const endTime = end.toISOString();

        const hasConflict = [...guestBusy, ...organizerBusy].some(busy => {
          return (startTime >= busy.start && startTime < busy.end) ||
                 (endTime > busy.start && endTime <= busy.end) ||
                 (startTime <= busy.start && endTime >= busy.end);
        });

        if (hasConflict) continue;

        slots.push({
          start: startTime,
          end: endTime,
          startTime: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          endTime: end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }

    const slotsWithScores = slots.slice(0, 10).map((slot, idx) => ({ ...slot, match: 0.90 - idx * 0.05 }));

    console.log(`✅ Generated ${slotsWithScores.length} mutual slots`);
    res.json({ slots: slotsWithScores });
  } catch (error) {
    console.error('❌ AI slot suggestion error:', error);
    res.status(500).json({ error: 'Failed to suggest slots' });
  }
});

// ============ TEAM ROUTES ============

app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams WHERE owner_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ teams: result.rows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.post('/api/teams', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query('INSERT INTO teams (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *', [name, description || '', req.user.id]);
    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

app.put('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const result = await pool.query('UPDATE teams SET name = $1, description = $2 WHERE id = $3 AND owner_id = $4 RETURNING *', [name, description, id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM teams WHERE id = $1 AND owner_id = $2 RETURNING *', [id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ============ TEAM MEMBER ROUTES ============

app.get('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  try {
    const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1 AND owner_id = $2', [teamId, req.user.id]);
    if (teamCheck.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `SELECT tm.*, u.name as user_name, u.email as user_email FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1 ORDER BY tm.created_at DESC`,
      [teamId]
    );
    res.json({ members: result.rows });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

app.post('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { email, name, sendEmail = true, external_booking_link, external_booking_platform } = req.body;

  try {
    const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1 AND owner_id = $2', [teamId, req.user.id]);
    if (teamCheck.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });
    const team = teamCheck.rows[0];

    const existingMember = await pool.query('SELECT * FROM team_members WHERE team_id = $1 AND email = $2', [teamId, email]);
    if (existingMember.rows.length > 0) return res.status(400).json({ error: 'Member already exists' });

    let userId = null;
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) userId = userCheck.rows[0].id;

    const bookingToken = crypto.randomBytes(16).toString('hex');

    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id, email, name, booking_token, invited_by, external_booking_link, external_booking_platform) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [teamId, userId, email, name || null, bookingToken, req.user.id, external_booking_link || null, external_booking_platform || 'calendly']
    );

    const member = result.rows[0];
    const bookingUrl = `${process.env.FRONTEND_URL}/book/${bookingToken}`;

    if (sendEmail && sendTeamInvitation) {
      try {
        await sendTeamInvitation(email, team.name, bookingUrl, req.user.name || req.user.email);
        console.log(`✅ Invitation email sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
      }
    }

    res.json({ member, bookingUrl, message: 'Member added successfully' });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

app.delete('/api/teams/:teamId/members/:memberId', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;
  try {
    const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1 AND owner_id = $2', [teamId, req.user.id]);
    if (teamCheck.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    await pool.query('DELETE FROM team_members WHERE id = $1 AND team_id = $2', [memberId, teamId]);
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

app.put('/api/teams/:teamId/members/:memberId/external-link', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;
  const { external_booking_link, external_booking_platform } = req.body;

  try {
    const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1 AND owner_id = $2', [teamId, req.user.id]);
    if (teamCheck.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `UPDATE team_members SET external_booking_link = $1, external_booking_platform = $2 WHERE id = $3 AND team_id = $4 RETURNING *`,
      [external_booking_link || null, external_booking_platform || 'calendly', memberId, teamId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });

    console.log(`✅ External link updated for member ${memberId}`);
    res.json({ member: result.rows[0] });
  } catch (error) {
    console.error('Update external link error:', error);
    res.status(500).json({ error: 'Failed to update external link' });
  }
});

// ============ BOOKING ROUTES ============

app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, t.name as team_name, tm.name as member_name FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE t.owner_id = $1 OR tm.user_id = $1 ORDER BY b.start_time DESC`,
      [req.user.id]
    );
    res.json({ bookings: result.rows });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

app.get('/api/book/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query(
      `SELECT tm.*, t.name as team_name, t.description as team_description, u.name as member_name, u.email as member_email
       FROM team_members tm JOIN teams t ON tm.team_id = t.id LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking link not found' });

    const member = result.rows[0];
    res.json({
      data: {
        team: { id: member.team_id, name: member.team_name, description: member.team_description },
        member: { name: member.name || member.member_name || member.email, email: member.email || member.member_email, external_booking_link: member.external_booking_link, external_booking_platform: member.external_booking_platform }
      }
    });
  } catch (error) {
    console.error('Get booking by token error:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { token, slot, attendee_name, attendee_email, notes } = req.body;

    console.log('📝 Creating booking:', { token, attendee_name, attendee_email });

    if (!token || !slot || !attendee_name || !attendee_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const memberResult = await pool.query(
      `SELECT tm.*, t.name as team_name, u.google_access_token, u.google_refresh_token, u.email as member_email, u.name as member_name
       FROM team_members tm JOIN teams t ON tm.team_id = t.id LEFT JOIN users u ON tm.user_id = u.id WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) return res.status(404).json({ error: 'Invalid booking token' });

    const member = memberResult.rows[0];

    const bookingResult = await pool.query(
      `INSERT INTO bookings (team_id, member_id, user_id, attendee_name, attendee_email, start_time, end_time, notes, booking_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [member.team_id, member.id, member.user_id, attendee_name, attendee_email, slot.start, slot.end, notes || '', token, 'confirmed']
    );

    const booking = bookingResult.rows[0];
    console.log('✅ Booking created in database:', booking.id);

    const meetingDate = new Date(slot.start).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const meetingTime = new Date(slot.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    const durationMinutes = Math.round((new Date(slot.end) - new Date(slot.start)) / 60000);

    if (isEmailAvailable && isEmailAvailable()) {
      console.log('📧 Sending confirmation emails...');

      if (sendBookingConfirmation) {
        try {
          await sendBookingConfirmation({
            attendee_email, attendee_name,
            organizer_name: member.member_name || member.name,
            organizer_email: member.member_email || member.email,
            team_name: member.team_name,
            meeting_date: meetingDate, meeting_time: meetingTime,
            meeting_duration: durationMinutes, notes: notes || '',
          });
          console.log('✅ Guest confirmation email sent');
        } catch (emailError) {
          console.error('⚠️ Failed to send guest email:', emailError);
        }
      }

      if (sendOrganizerNotification && (member.member_email || member.email)) {
        try {
          await sendOrganizerNotification({
            organizer_email: member.member_email || member.email,
            organizer_name: member.member_name || member.name,
            attendee_name, attendee_email,
            meeting_date: meetingDate, meeting_time: meetingTime,
            meeting_duration: durationMinutes, notes: notes || '',
          });
          console.log('✅ Organizer notification email sent');
        } catch (emailError) {
          console.error('⚠️ Failed to send organizer email:', emailError);
        }
      }
    }

    if (createCalendarEvent && member.google_refresh_token) {
      try {
        await createCalendarEvent(member.google_access_token, member.google_refresh_token, {
          summary: `Meeting with ${attendee_name}`,
          description: `Booked via ScheduleSync\n\nClient: ${attendee_name}\nEmail: ${attendee_email}\n\nNotes: ${notes || 'No notes'}`,
          start: slot.start, end: slot.end,
          attendees: [{ email: attendee_email, displayName: attendee_name }],
        });
        console.log('✅ Calendar event created');
      } catch (calError) {
        console.error('⚠️ Failed to create calendar event:', calError);
      }
    }

    res.json({ 
      success: true,
      booking: { id: booking.id, start_time: booking.start_time, end_time: booking.end_time, attendee_name: booking.attendee_name, attendee_email: booking.attendee_email, status: booking.status },
      message: 'Booking confirmed successfully!'
    });
  } catch (error) {
    console.error('❌ Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ============ SERVE STATIC FILES ============

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'client', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============ ERROR HANDLING ============

app.use((req, res, next) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ START SERVER ============

const port = process.env.PORT || 3000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ============ GRACEFUL SHUTDOWN ============

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => pool.end(() => process.exit(0)));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => pool.end(() => process.exit(0)));
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV === 'production') server.close(() => process.exit(1));
});

module.exports = app;