require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');
const emailTemplates = require('./emailTemplates');
const { generateICS } = require('./icsGenerator');
const resend = new Resend(process.env.RESEND_API_KEY);
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const path = require('path');
const { google } = require('googleapis');
const crypto = require('crypto');

const app = express();

const sendBookingEmail = async ({ to, subject, html, icsAttachment }) => {
  try {
    const emailOptions = {
      from: 'ScheduleSync <noreply@schedulesync.com>',
      to: to,
      subject: subject,
      html: html,
    };

    if (icsAttachment) {
      emailOptions.attachments = [
        {
          filename: 'meeting.ics',
          content: Buffer.from(icsAttachment).toString('base64'),
        },
      ];
    }

    const result = await resend.emails.send(emailOptions);
    console.log('✅ Email sent:', result.id);
    return result;
  } catch (error) {
    console.error('❌ Email error:', error);
    throw error;
  }
};
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
        provider VARCHAR(50) DEFAULT 'google',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        booking_mode VARCHAR(50) DEFAULT 'individual',
        allow_team_booking BOOLEAN DEFAULT false,
        team_booking_token VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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
        booking_count INTEGER DEFAULT 0,
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

// ============ OAUTH CODE TRACKING (PREVENT DOUBLE USE) ============

const processedOAuthCodes = new Map(); // Track processed codes with timestamp

// Clean up old codes every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  for (const [code, timestamp] of processedOAuthCodes.entries()) {
    if (timestamp < fiveMinutesAgo) {
      processedOAuthCodes.delete(code);
    }
  }
}, 5 * 60 * 1000);

// ============ AUTHENTICATION MIDDLEWARE ============

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification failed:', err.message);
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

// ============ ORGANIZER OAUTH (DASHBOARD LOGIN WITH CALENDAR ACCESS) ============

app.get('/api/auth/google/url', (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/oauth/callback`
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

    console.log('🔗 Generated OAuth URL with redirect:', process.env.GOOGLE_REDIRECT_URI);

    res.json({ url: authUrl });
  } catch (error) {
    console.error('❌ Error generating OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

app.post('/api/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    console.log('🔵 OAuth callback received');

    if (!code) {
      console.error('❌ No code provided');
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // CRITICAL: Check if code was already processed
    if (processedOAuthCodes.has(code)) {
      console.log('⚠️ Code already processed, rejecting duplicate request');
      return res.status(400).json({ 
        error: 'Code already used',
        hint: 'This authorization code has already been exchanged. Please try logging in again.'
      });
    }

    // Mark code as being processed IMMEDIATELY
    processedOAuthCodes.set(code, Date.now());
    console.log('🔒 Code locked for processing');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/oauth/callback`
    );

    console.log('📡 Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('✅ Tokens received');

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    console.log('✅ User info retrieved:', userInfo.email);

    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userInfo.email]);

    let user;
    if (userResult.rows.length === 0) {
      console.log('➕ Creating new user');
      const insertResult = await pool.query(
        `INSERT INTO users (google_id, email, name, google_access_token, google_refresh_token, calendar_sync_enabled, provider)
         VALUES ($1, $2, $3, $4, $5, true, 'google') RETURNING *`,
        [userInfo.id, userInfo.email, userInfo.name, tokens.access_token, tokens.refresh_token]
      );
      user = insertResult.rows[0];
    } else {
      console.log('🔄 Updating existing user');
      const updateResult = await pool.query(
        `UPDATE users SET google_id = $1, name = $2, google_access_token = $3, google_refresh_token = $4, calendar_sync_enabled = true, provider = 'google'
         WHERE email = $5 RETURNING *`,
        [userInfo.id, userInfo.name, tokens.access_token, tokens.refresh_token, userInfo.email]
      );
      user = updateResult.rows[0];
    }

    // Link any pending team memberships
    await pool.query('UPDATE team_members SET user_id = $1 WHERE email = $2 AND user_id IS NULL', [user.id, user.email]);

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name }, 
      process.env.JWT_SECRET, 
      { expiresIn: '30d' }
    );

    console.log('✅ OAuth successful for:', user.email);

    res.json({
      success: true,
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        calendar_sync_enabled: user.calendar_sync_enabled 
      },
      token: jwtToken,
    });
  } catch (error) {
    console.error('❌ OAuth error:', error.message);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    
    // Remove code from processed map on error so user can retry
    if (req.body.code) {
      processedOAuthCodes.delete(req.body.code);
      console.log('🔓 Code unlocked for retry');
    }
    
    res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message.includes('invalid_grant') 
        ? 'Authorization code expired or already used. Please try logging in again.'
        : error.message
    });
  }
});

// ============ GUEST OAUTH (BOOKING PAGE - READ ONLY) ============

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

// ============ TEAM ROUTES ============

// Get all teams for current user
app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM teams WHERE owner_id = $1 ORDER BY created_at DESC', 
      [req.user.id]
    );
    res.json({ teams: result.rows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get single team
app.get('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM teams WHERE id = $1 AND owner_id = $2`,
      [teamId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Update team settings
app.put('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const userId = req.user.id;
    const { name, description, booking_mode } = req.body;

    console.log('⚙️ Updating team settings:', { teamId, booking_mode });

    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to update this team' });
    }

    // Validate booking mode
    const validModes = ['individual', 'round_robin', 'first_available', 'collective'];
    if (booking_mode && !validModes.includes(booking_mode)) {
      return res.status(400).json({ error: 'Invalid booking mode' });
    }

    // Update team
    const result = await pool.query(
      `UPDATE teams 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           booking_mode = COALESCE($3, booking_mode)
       WHERE id = $4
       RETURNING *`,
      [name, description, booking_mode, teamId]
    );

    console.log('✅ Team settings updated');
    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Create new team
app.post('/api/teams', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  try {
    // Generate unique team booking token
    const teamBookingToken = crypto.randomBytes(16).toString('hex');
    
    const result = await pool.query(
      'INSERT INTO teams (name, description, owner_id, team_booking_token) VALUES ($1, $2, $3, $4) RETURNING *', 
      [name, description || '', req.user.id, teamBookingToken]
    );
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
    const result = await pool.query(
      'UPDATE teams SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND owner_id = $4 RETURNING *', 
      [name, description, id, req.user.id]
    );
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
    const result = await pool.query(
      'DELETE FROM teams WHERE id = $1 AND owner_id = $2 RETURNING *', 
      [id, req.user.id]
    );
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
      `SELECT tm.*, u.name as user_name, u.email as user_email 
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id 
       WHERE tm.team_id = $1 
       ORDER BY tm.created_at DESC`,
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
      `UPDATE team_members SET external_booking_link = $1, external_booking_platform = $2 
       WHERE id = $3 AND team_id = $4 RETURNING *`,
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

// ============ ENHANCED SLOT AVAILABILITY WITH REASONS ============

app.post('/api/book/:token/slots-with-status', async (req, res) => {
  try {
    const { token } = req.params;
    const { 
      guestAccessToken, 
      guestRefreshToken,
      duration = 30,
      daysAhead = 14,
      timezone = 'America/New_York'
    } = req.body;

    console.log('📅 Getting slots with status for token:', token);
    console.log('🔍 Guest calendar:', guestAccessToken ? 'CONNECTED' : 'NOT CONNECTED');

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

    // Fetch organizer's busy times (if connected)
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
        console.log('✅ Organizer busy times loaded:', organizerBusy.length);
      } catch (error) {
        console.error('⚠️ Failed to fetch organizer calendar:', error.message);
      }
    }

    // Fetch guest's busy times (if provided)
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
        console.log('✅ Guest busy times loaded:', guestBusy.length);
      } catch (error) {
        console.error('⚠️ Failed to fetch guest calendar:', error.message);
      }
    }

    // Generate slots
    const slots = [];
    const WORK_START_HOUR = 9;
    const WORK_END_HOUR = 17;

    const tzOffsetHours = getTimezoneOffset(timezone);

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      
      const baseDateUTC = new Date(checkDate);
      baseDateUTC.setUTCHours(0, 0, 0, 0);
      
      const userTZDate = new Date(baseDateUTC.getTime() + (tzOffsetHours * 60 * 60 * 1000));
      const dayOfWeek = userTZDate.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Generate slots for work hours
      for (let hour = WORK_START_HOUR; hour < WORK_END_HOUR; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotLocalTime = new Date(baseDateUTC);
          slotLocalTime.setUTCHours(hour, minute, 0, 0);
          
          const slotStart = new Date(slotLocalTime.getTime() - (tzOffsetHours * 60 * 60 * 1000));
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          const startTime = slotStart.toISOString();
          const endTime = slotEnd.toISOString();

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

    // Group slots by date
    const slotsByDate = {};
    slots.forEach(slot => {
      const slotDate = new Date(slot.start);
      
      const dateKey = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: timezone
      }).format(slotDate);
      
      const dayOfWeek = new Intl.DateTimeFormat('en-US', { 
        weekday: 'short',
        timeZone: timezone 
      }).format(slotDate);
      
      const time = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone
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

    console.log(`✅ Generated ${slots.length} slots (${Object.keys(slotsByDate).length} days)`);

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

// ============ MY BOOKING LINK (PERSONAL BOOKING PAGE) ============

app.get('/api/my-booking-link', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    console.log('📎 Getting personal booking link for:', userEmail);

    // Check if user already has a personal team
    let personalTeam = await pool.query(
      `SELECT * FROM teams WHERE owner_id = $1 AND name = $2`,
      [userId, `${userName}'s Personal Bookings`]
    );

    // Create personal team if it doesn't exist
    if (personalTeam.rows.length === 0) {
      console.log('➕ Creating personal team for:', userName);
      
      const teamBookingToken = crypto.randomBytes(16).toString('hex');
      const teamResult = await pool.query(
        `INSERT INTO teams (name, description, owner_id, team_booking_token) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          `${userName}'s Personal Bookings`,
          'Book time with me directly',
          userId,
          teamBookingToken
        ]
      );
      personalTeam = teamResult;
    }

    const team = personalTeam.rows[0];

    // Check if user is a member of their own team
    let memberResult = await pool.query(
      `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [team.id, userId]
    );

    // Add user as member if not already
    if (memberResult.rows.length === 0) {
      console.log('➕ Adding user as member of their personal team');
      
      const bookingToken = crypto.randomBytes(16).toString('hex');
      const insertResult = await pool.query(
        `INSERT INTO team_members (team_id, user_id, email, name, booking_token, invited_by) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [team.id, userId, userEmail, userName, bookingToken, userId]
      );
      memberResult = insertResult;
    }

    const member = memberResult.rows[0];
    const bookingUrl = `${process.env.FRONTEND_URL}/book/${member.booking_token}`;

    console.log('✅ Personal booking link generated:', bookingUrl);

    res.json({
      success: true,
      bookingUrl,
      bookingToken: member.booking_token,
      team: {
        id: team.id,
        name: team.name
      }
    });

  } catch (error) {
    console.error('❌ Error generating personal booking link:', error);
    res.status(500).json({ error: 'Failed to generate booking link' });
  }
});

// ============ BOOKING MANAGEMENT (CANCEL & RESCHEDULE) ============

// Cancel a booking
app.post('/api/bookings/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { reason } = req.body;

    console.log('❌ Canceling booking:', bookingId);

    // Verify ownership
    const bookingCheck = await pool.query(
      `SELECT b.*, t.owner_id, tm.user_id as member_user_id
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Check if user has permission (team owner or assigned member)
    const hasPermission = booking.owner_id === userId || booking.member_user_id === userId;
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }

    // Update booking status
    await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled',
           notes = COALESCE(notes, '') || E'\nCancellation reason: ' || COALESCE($1, 'No reason provided')
       WHERE id = $2`,
      [reason, bookingId]
    );

    console.log('✅ Booking cancelled successfully');

    // TODO: Send cancellation email
   console.log('✅ Booking cancelled successfully');

    try {
      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '❌ Booking Cancelled - ScheduleSync',
        html: emailTemplates.bookingCancellation(booking, reason),
      });
      console.log('✅ Cancellation email sent');
    } catch (emailError) {
      console.error('⚠️ Failed to send cancellation email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Booking cancelled successfully' 
    });

  } catch (error) {
    console.error('❌ Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Reschedule a booking
app.post('/api/bookings/:id/reschedule', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { newStartTime, newEndTime } = req.body;

    console.log('🔄 Rescheduling booking:', bookingId);

    if (!newStartTime || !newEndTime) {
      return res.status(400).json({ error: 'New start and end times are required' });
    }

    // Verify ownership
    const bookingCheck = await pool.query(
      `SELECT b.*, t.owner_id, tm.user_id as member_user_id, tm.name as member_name
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Check permission
    const hasPermission = booking.owner_id === userId || booking.member_user_id === userId;
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to reschedule this booking' });
    }

    // Update booking times
    const updateResult = await pool.query(
      `UPDATE bookings 
       SET start_time = $1, 
           end_time = $2
       WHERE id = $3
       RETURNING *`,
      [newStartTime, newEndTime, bookingId]
    );

    const updatedBooking = updateResult.rows[0];

    console.log('✅ Booking rescheduled successfully');

    // TODO: Send reschedule email
       try {
      const icsFile = generateICS({
        id: updatedBooking.id,
        start_time: updatedBooking.start_time,
        end_time: updatedBooking.end_time,
        attendee_name: booking.attendee_name,
        attendee_email: booking.attendee_email,
        organizer_name: booking.member_name,
        organizer_email: booking.member_email,
        team_name: booking.team_name,
        notes: booking.notes,
      });

      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '🔄 Booking Rescheduled - ScheduleSync',
        html: emailTemplates.bookingReschedule(
          {
            ...updatedBooking,
            organizer_name: booking.member_name,
            team_name: booking.team_name,
          },
          booking.start_time
        ),
        icsAttachment: icsFile,
      });
      console.log('✅ Reschedule email sent');
    } catch (emailError) {
      console.error('⚠️ Failed to send reschedule email:', emailError);
    }

    res.json({ 
      success: true, 
      booking: updatedBooking,
      message: 'Booking rescheduled successfully' 
    });

  } catch (error) {
    console.error('❌ Reschedule booking error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// ============ BOOKING ROUTES ============

app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, t.name as team_name, tm.name as member_name 
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id 
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE t.owner_id = $1 OR tm.user_id = $1 
       ORDER BY b.start_time DESC`,
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
      `SELECT tm.*, t.name as team_name, t.description as team_description, 
       u.name as member_name, u.email as member_email
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking link not found' });

    const member = result.rows[0];
    res.json({
      data: {
        team: { 
          id: member.team_id, 
          name: member.team_name, 
          description: member.team_description 
        },
        member: { 
          name: member.name || member.member_name || member.email, 
          email: member.email || member.member_email, 
          external_booking_link: member.external_booking_link, 
          external_booking_platform: member.external_booking_platform 
        }
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
      `SELECT tm.*, t.name as team_name, t.booking_mode, t.owner_id, u.google_access_token, u.google_refresh_token, 
       u.email as member_email, u.name as member_name
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       LEFT JOIN users u ON tm.user_id = u.id 
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) return res.status(404).json({ error: 'Invalid booking token' });

    const member = memberResult.rows[0];
    const bookingMode = member.booking_mode || 'individual';

    console.log('🎯 Booking mode:', bookingMode);

    let assignedMembers = [];

    // Determine which team member(s) to assign based on booking mode
    switch (bookingMode) {
      case 'individual':
        // Use the specific member from the booking token
        assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
        console.log('👤 Individual mode: Assigning to', member.name);
        break;

      case 'round_robin':
        // Find member with least bookings
        const rrResult = await pool.query(
          `SELECT tm.id, tm.name, tm.user_id, COUNT(b.id) as booking_count
           FROM team_members tm
           LEFT JOIN bookings b ON tm.id = b.member_id
           WHERE tm.team_id = $1
           GROUP BY tm.id, tm.name, tm.user_id
           ORDER BY booking_count ASC, tm.id ASC
           LIMIT 1`,
          [member.team_id]
        );
        
        if (rrResult.rows.length > 0) {
          assignedMembers = [rrResult.rows[0]];
          console.log('🔄 Round-robin: Assigning to', rrResult.rows[0].name, 'with', rrResult.rows[0].booking_count, 'bookings');
        } else {
          assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
        }
        break;

      case 'first_available':
        // Find first member who doesn't have a conflict at this time
        const faResult = await pool.query(
          `SELECT tm.id, tm.name, tm.user_id
           FROM team_members tm
           WHERE tm.team_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM bookings b
             WHERE b.member_id = tm.id
             AND b.status != 'cancelled'
             AND (
               (b.start_time <= $2 AND b.end_time > $2)
               OR (b.start_time < $3 AND b.end_time >= $3)
               OR (b.start_time >= $2 AND b.end_time <= $3)
             )
           )
           ORDER BY tm.id ASC
           LIMIT 1`,
          [member.team_id, slot.start, slot.end]
        );
        
        if (faResult.rows.length > 0) {
          assignedMembers = [faResult.rows[0]];
          console.log('⚡ First-available: Assigning to', faResult.rows[0].name);
        } else {
          console.log('⚠️ No available members, falling back to token member');
          assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
        }
        break;

      case 'collective':
        // Book with ALL team members
        const collectiveResult = await pool.query(
          'SELECT id, name, user_id FROM team_members WHERE team_id = $1',
          [member.team_id]
        );
        
        assignedMembers = collectiveResult.rows;
        console.log('👥 Collective mode: Assigning to all', assignedMembers.length, 'members');
        break;

      default:
        assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
    }

    // Create booking(s)
    const createdBookings = [];

    for (const assignedMember of assignedMembers) {
      const bookingResult = await pool.query(
        `INSERT INTO bookings (team_id, member_id, user_id, attendee_name, attendee_email, 
         start_time, end_time, notes, booking_token, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [member.team_id, assignedMember.id, assignedMember.user_id, attendee_name, attendee_email, 
         slot.start, slot.end, notes || '', token, 'confirmed']
      );

      createdBookings.push(bookingResult.rows[0]);
      console.log(`✅ Booking created for ${assignedMember.name}:`, bookingResult.rows[0].id);
    }

    // ... booking creation loop ends here ...
    
    console.log(`✅ Created ${createdBookings.length} booking(s)`);

    // ⬇️ ADD EMAIL CODE HERE ⬇️
    try {
      const icsFile = generateICS({
        id: createdBookings[0].id,
        start_time: createdBookings[0].start_time,
        end_time: createdBookings[0].end_time,
        attendee_name: attendee_name,
        attendee_email: attendee_email,
        organizer_name: member.member_name || member.name,
        organizer_email: member.member_email || member.email,
        team_name: member.team_name,
        notes: notes,
      });

      await sendBookingEmail({
        to: attendee_email,
        subject: '✅ Booking Confirmed - ScheduleSync',
        html: emailTemplates.bookingConfirmationGuest({
          ...createdBookings[0],
          attendee_name,
          attendee_email,
          organizer_name: member.member_name || member.name,
          team_name: member.team_name,
          notes,
        }),
        icsAttachment: icsFile,
      });

      if (member.member_email || member.email) {
        await sendBookingEmail({
          to: member.member_email || member.email,
          subject: '📅 New Booking Received - ScheduleSync',
          html: emailTemplates.bookingConfirmationOrganizer({
            ...createdBookings[0],
            attendee_name,
            attendee_email,
            organizer_name: member.member_name || member.name,
            team_name: member.team_name,
            notes,
          }),
          icsAttachment: icsFile,
        });
      }

      console.log('✅ Confirmation emails sent');
    } catch (emailError) {
      console.error('⚠️ Failed to send emails:', emailError);
    }
    });
    // Send emails and create calendar events (existing code)...

    res.json({ 
      success: true,
      booking: createdBookings[0], // Return first booking for compatibility
      bookings: createdBookings,
      mode: bookingMode,
      message: bookingMode === 'collective' 
        ? `Booking confirmed with all ${createdBookings.length} team members!`
        : 'Booking confirmed successfully!'
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