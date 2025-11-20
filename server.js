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
    console.log('📤 Attempting to send email to:', to);
    console.log('🔑 Resend API key exists?', !!process.env.RESEND_API_KEY);
    console.log('🔑 Resend API key starts with:', process.env.RESEND_API_KEY?.substring(0, 10));
    
    const emailOptions = {
      from: 'ScheduleSync <onboarding@resend.dev>',
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

    console.log('📨 Calling resend.emails.send...');
    const result = await resend.emails.send(emailOptions);
    console.log('✅ Email sent - FULL RESULT:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Email error - FULL ERROR:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
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
      prompt: 'select_account',
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
// ============ PRICING SETTINGS ENDPOINT ============
// ============ PRICING SETTINGS ENDPOINT ============

// Update team member pricing settings
app.put('/api/teams/:teamId/members/:memberId/pricing', authenticateToken, async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const { booking_price, currency, payment_required } = req.body;
    const userId = req.user.id;

    console.log('💰 Updating pricing for member:', memberId);
    console.log('📥 Received data:', { booking_price, currency, payment_required });

    // Verify ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update member pricing
    const result = await pool.query(
      `UPDATE team_members 
       SET booking_price = $1, 
           currency = $2, 
           payment_required = $3
       WHERE id = $4 AND team_id = $5
       RETURNING *`,
      [parseFloat(booking_price) || 0, currency || 'USD', payment_required === true, memberId, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log('✅ Pricing updated:', result.rows[0]);

    res.json({ 
      success: true, 
      member: result.rows[0],
      message: 'Pricing settings updated successfully' 
    });
  } catch (error) {
    console.error('Update pricing error:', error);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});
// ============ AVAILABILITY SETTINGS ENDPOINTS ============

// Get team member availability settings
app.get('/api/team-members/:id/availability', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;

    console.log('📋 Getting availability for member:', memberId);

    // Get team member and verify ownership
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id 
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       WHERE tm.id = $1`,
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const member = memberResult.rows[0];

    // Verify ownership
    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get blocked times
    const blockedResult = await pool.query(
      `SELECT * FROM blocked_times 
       WHERE team_member_id = $1 
       ORDER BY start_time ASC`,
      [memberId]
    );

    res.json({
      member: {
        id: member.id,
        name: member.name,
        buffer_time: member.buffer_time || 0,
        working_hours: member.working_hours || {
          monday: { enabled: true, start: '09:00', end: '17:00' },
          tuesday: { enabled: true, start: '09:00', end: '17:00' },
          wednesday: { enabled: true, start: '09:00', end: '17:00' },
          thursday: { enabled: true, start: '09:00', end: '17:00' },
          friday: { enabled: true, start: '09:00', end: '17:00' },
          saturday: { enabled: false, start: '09:00', end: '17:00' },
          sunday: { enabled: false, start: '09:00', end: '17:00' },
        },
      },
      blocked_times: blockedResult.rows,
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed to get availability settings' });
  }
});

// Update team member availability settings
app.put('/api/team-members/:id/availability', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;
   const { 
  buffer_time, 
  lead_time_hours,       
  booking_horizon_days,  
  daily_booking_cap,      
  working_hours, 
  blocked_times 
} = req.body;

    console.log('⚙️ Updating availability for member:', memberId);

    // Verify ownership
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id 
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       WHERE tm.id = $1`,
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const member = memberResult.rows[0];

    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update team member settings
    await pool.query(
  `UPDATE team_members 
   SET buffer_time = $1, 
       lead_time_hours = $2,        
       booking_horizon_days = $3,   
       daily_booking_cap = $4,  
       working_hours = $5
   WHERE id = $6`,
  [buffer_time || 0, lead_time_hours || 0, booking_horizon_days || 30, 
   daily_booking_cap, JSON.stringify(working_hours), memberId]
);

    // Update blocked times
    await pool.query('DELETE FROM blocked_times WHERE team_member_id = $1', [memberId]);

    // Handle blocked times
console.log('🔧 Processing blocked times:', blocked_times);

if (blocked_times && blocked_times.length > 0) {
  console.log(`📝 Saving ${blocked_times.length} blocked time(s)`);
  
  for (const block of blocked_times) {
    console.log('Processing block:', block);
    
    // Skip blocks with temp IDs and no dates
    if (!block.start_time || !block.end_time) {
      console.log('⚠️ Skipping block - missing dates');
      continue;
    }
    
    // Convert datetime-local format to ISO timestamp
    const startTime = new Date(block.start_time).toISOString();
    const endTime = new Date(block.end_time).toISOString();
    
    console.log('📅 Inserting blocked time:', {
      memberId,
      startTime,
      endTime,
      reason: block.reason
    });
    
    try {
      await pool.query(
        `INSERT INTO blocked_times (team_member_id, start_time, end_time, reason) 
         VALUES ($1, $2, $3, $4)`,
        [memberId, startTime, endTime, block.reason || null]
      );
      console.log('✅ Blocked time inserted');
    } catch (blockError) {
      console.error('❌ Failed to insert blocked time:', blockError);
    }
  }
} else {
  console.log('ℹ️ No blocked times to save');
}

    console.log('✅ Availability settings updated');
    res.json({ success: true, message: 'Availability settings updated' });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Failed to update availability settings' });
  }
});

// ============ ENHANCED SLOT GENERATION WITH ALL AVAILABILITY RULES ============

app.post('/api/book/:token/slots-with-status', async (req, res) => {
  try {
    const { token } = req.params;
    const { 
      guestAccessToken, 
      guestRefreshToken,
      duration = 30,
      timezone = 'America/New_York'
    } = req.body;

    console.log('📅 Generating slots with FULL availability rules for:', token);

    // ========== 1. GET MEMBER & SETTINGS ==========
    const memberResult = await pool.query(
      `SELECT tm.*, 
              tm.buffer_time,
              tm.working_hours,
              tm.lead_time_hours,
              tm.booking_horizon_days,
              tm.daily_booking_cap,
              u.google_access_token, 
              u.google_refresh_token, 
              u.name as organizer_name,
              t.id as team_id
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       LEFT JOIN teams t ON tm.team_id = t.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    
    // Default settings
    const bufferTime = member.buffer_time || 0; // minutes
    const leadTimeHours = member.lead_time_hours || 0; // minimum notice
    const horizonDays = member.booking_horizon_days || 30; // max days ahead
    const dailyCap = member.daily_booking_cap || null; // max bookings per day
    
    const workingHours = member.working_hours || {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' },
    };

    console.log('⚙️ Settings:', {
      bufferTime,
      leadTimeHours,
      horizonDays,
      dailyCap
    });

    // ========== 2. GET BLOCKED TIMES ==========
    const blockedResult = await pool.query(
      `SELECT * FROM blocked_times 
       WHERE team_member_id = $1 
       AND end_time > NOW()
       ORDER BY start_time ASC`,
      [member.id]
    );
    const blockedTimes = blockedResult.rows;

    // ========== 3. GET EXISTING BOOKINGS (for buffer & daily cap) ==========
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + horizonDays);

    const bookingsResult = await pool.query(
      `SELECT start_time, end_time 
       FROM bookings 
       WHERE member_id = $1 
       AND status = 'confirmed'
       AND start_time >= $2 
       AND start_time <= $3
       ORDER BY start_time ASC`,
      [member.id, now.toISOString(), endDate.toISOString()]
    );
    const existingBookings = bookingsResult.rows;

    // ========== 4. GET ORGANIZER CALENDAR BUSY TIMES ==========
    let organizerBusy = [];
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
        console.log('✅ Organizer calendar loaded:', organizerBusy.length, 'busy blocks');
      } catch (error) {
        console.error('⚠️ Failed to fetch organizer calendar:', error.message);
      }
    }

    // ========== 5. GET GUEST CALENDAR BUSY TIMES ==========
    let guestBusy = [];
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
        console.log('✅ Guest calendar loaded:', guestBusy.length, 'busy blocks');
      } catch (error) {
        console.error('⚠️ Failed to fetch guest calendar:', error.message);
      }
    }

    // ========== 6. HELPER FUNCTIONS ==========
    const tzOffsetHours = getTimezoneOffset(timezone);

    const dayNameMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };

    const isWithinWorkingHours = (slotStart, dayOfWeek) => {
      const dayName = dayNameMap[dayOfWeek];
      const daySettings = workingHours[dayName];
      
      if (!daySettings || !daySettings.enabled) {
        return false;
      }

      const slotHour = slotStart.getHours();
      const slotMinute = slotStart.getMinutes();
      const slotTime = slotHour * 60 + slotMinute;

      const [startHour, startMinute] = daySettings.start.split(':').map(Number);
      const [endHour, endMinute] = daySettings.end.split(':').map(Number);
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;

      return slotTime >= startTime && slotTime < endTime;
    };

    const hasConflict = (slotStart, slotEnd, busyTimes) => {
      return busyTimes.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return (
          (slotStart >= busyStart && slotStart < busyEnd) ||
          (slotEnd > busyStart && slotEnd <= busyEnd) ||
          (slotStart <= busyStart && slotEnd >= busyEnd)
        );
      });
    };

    const isBlocked = (slotStart, slotEnd) => {
      return blockedTimes.some(block => {
        const blockStart = new Date(block.start_time);
        const blockEnd = new Date(block.end_time);
        return (
          (slotStart >= blockStart && slotStart < blockEnd) ||
          (slotEnd > blockStart && slotEnd <= blockEnd) ||
          (slotStart <= blockStart && slotEnd >= blockEnd)
        );
      });
    };

    const hasBufferViolation = (slotStart, slotEnd) => {
      if (bufferTime === 0) return false;

      return existingBookings.some(booking => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);

        // Check if slot is too close before booking
        const beforeBuffer = new Date(bookingStart);
        beforeBuffer.setMinutes(beforeBuffer.getMinutes() - bufferTime);
        if (slotEnd > beforeBuffer && slotStart < bookingStart) {
          return true;
        }

        // Check if slot is too close after booking
        const afterBuffer = new Date(bookingEnd);
        afterBuffer.setMinutes(afterBuffer.getMinutes() + bufferTime);
        if (slotStart < afterBuffer && slotEnd > bookingEnd) {
          return true;
        }

        return false;
      });
    };

    // ========== 7. GENERATE SLOTS WITH ALL RULES ==========
    const slots = [];
    const dailyBookingCounts = {}; // Track bookings per day for daily cap

    // Calculate earliest bookable time (now + lead time)
    const earliestBookable = new Date(now);
    earliestBookable.setHours(earliestBookable.getHours() + leadTimeHours);

    // Calculate latest bookable time (now + horizon)
    const latestBookable = new Date(now);
    latestBookable.setDate(latestBookable.getDate() + horizonDays);

    console.log('⏰ Time window:', {
      earliestBookable: earliestBookable.toISOString(),
      latestBookable: latestBookable.toISOString()
    });

    // Generate slots for each day
    for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      checkDate.setHours(0, 0, 0, 0);

      const dayOfWeek = checkDate.getDay();
      const dayName = dayNameMap[dayOfWeek];
      const daySettings = workingHours[dayName];

      // Skip if day is not enabled
      if (!daySettings || !daySettings.enabled) {
        continue;
      }

      // Parse working hours for this day
      const [startHour, startMinute] = daySettings.start.split(':').map(Number);
      const [endHour, endMinute] = daySettings.end.split(':').map(Number);

      // Initialize daily booking count
      const dateKey = checkDate.toISOString().split('T')[0];
      if (!dailyBookingCounts[dateKey]) {
        dailyBookingCounts[dateKey] = existingBookings.filter(b => {
          const bookingDate = new Date(b.start_time).toISOString().split('T')[0];
          return bookingDate === dateKey;
        }).length;
      }

      // Generate 30-minute slots within working hours
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          // Skip if this time is past the end of working hours
          if (hour === endHour - 1 && minute + duration > 60) break;
          if (hour >= endHour) break;

          const slotStart = new Date(checkDate);
          slotStart.setHours(hour, minute, 0, 0);
          
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          let status = 'available';
          let reason = null;
          let details = null;

          // ========== APPLY ALL RULES ==========

          // Rule 1: Lead time
          if (slotStart < earliestBookable) {
            status = 'unavailable';
            reason = 'lead_time';
            details = `Minimum ${leadTimeHours}h notice required`;
          }
          // Rule 2: Horizon limit
          else if (slotStart > latestBookable) {
            status = 'unavailable';
            reason = 'horizon';
            details = `Only ${horizonDays} days ahead available`;
          }
          // Rule 3: Working hours (double-check)
          else if (!isWithinWorkingHours(slotStart, dayOfWeek)) {
            status = 'unavailable';
            reason = 'outside_hours';
            details = 'Outside working hours';
          }
          // Rule 4: Blocked times
          else if (isBlocked(slotStart, slotEnd)) {
            status = 'unavailable';
            reason = 'blocked';
            details = 'Time blocked by organizer';
          }
          // Rule 5: Buffer time violations
          else if (hasBufferViolation(slotStart, slotEnd)) {
            status = 'unavailable';
            reason = 'buffer';
            details = `${bufferTime}min buffer required`;
          }
          // Rule 6: Daily cap
          else if (dailyCap && dailyBookingCounts[dateKey] >= dailyCap) {
            status = 'unavailable';
            reason = 'daily_cap';
            details = `Daily limit (${dailyCap}) reached`;
          }
          // Rule 7: Organizer calendar conflicts
          else if (hasConflict(slotStart, slotEnd, organizerBusy)) {
            status = 'unavailable';
            reason = 'organizer_busy';
            details = `${member.organizer_name || 'Organizer'} has another meeting`;
          }
          // Rule 8: Guest calendar conflicts
          else if (hasConflict(slotStart, slotEnd, guestBusy)) {
            status = 'unavailable';
            reason = 'guest_busy';
            details = "You have another meeting";
          }

          // Format time for display
          const time = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
          }).format(slotStart);

          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            status,
            reason,
            details,
            time,
            timestamp: slotStart.getTime()
          });
        }
      }
    }

    // ========== 8. GROUP BY DATE ==========
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
      
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      
      slotsByDate[dateKey].push({
        ...slot,
        date: dateKey,
        dayOfWeek: dayOfWeek
      });
    });

    console.log(`✅ Generated ${slots.length} slots across ${Object.keys(slotsByDate).length} days`);
    console.log(`✅ Available: ${slots.filter(s => s.status === 'available').length}`);

    res.json({
      slots: slotsByDate,
      summary: {
        totalSlots: slots.length,
        availableSlots: slots.filter(s => s.status === 'available').length,
        hasGuestCalendar: guestBusy.length > 0,
        hasOrganizerCalendar: organizerBusy.length > 0,
        settings: {
          bufferTime,
          leadTimeHours,
          horizonDays,
          dailyCap,
          workingDays: Object.keys(workingHours).filter(day => workingHours[day].enabled)
        }
      }
    });

  } catch (error) {
    console.error('❌ Enhanced slot generation error:', error);
    res.status(500).json({ error: 'Failed to generate slots' });
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

// REPLACE your entire app.post('/api/bookings', ...) endpoint with this:
app.post('/api/bookings', async (req, res) => {
  try {
    const { token, slot, attendee_name, attendee_email, notes } = req.body;

    console.log('📝 Creating booking:', { token, attendee_name, attendee_email });

    if (!token || !slot || !attendee_name || !attendee_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const memberResult = await pool.query(
      `SELECT tm.*, t.name as team_name, t.booking_mode, t.owner_id, 
              u.google_access_token, u.google_refresh_token, 
              u.email as member_email, u.name as member_name
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       LEFT JOIN users u ON tm.user_id = u.id 
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    const bookingMode = member.booking_mode || 'individual';

    console.log('🎯 Booking mode:', bookingMode);

    let assignedMembers = [];

    // Determine which team member(s) to assign based on booking mode
    switch (bookingMode) {
      case 'individual':
        assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
        console.log('👤 Individual mode: Assigning to', member.name);
        break;

      case 'round_robin':
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
          console.log('🔄 Round-robin: Assigning to', rrResult.rows[0].name);
        } else {
          assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
        }
        break;

      case 'first_available':
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

    // Create booking(s) FIRST (without meet link yet)
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

    console.log(`✅ Created ${createdBookings.length} booking(s)`);

    // ========== RESPOND IMMEDIATELY ==========
    res.json({ 
      success: true,
      booking: createdBookings[0],
      bookings: createdBookings,
      mode: bookingMode,
      meet_link: null, // Will be updated in background
      message: bookingMode === 'collective' 
        ? `Booking confirmed with all ${createdBookings.length} team members!`
        : 'Booking confirmed! Calendar invite with Google Meet link will arrive shortly.'
    });

    // ========== ASYNC: CREATE CALENDAR EVENT & SEND EMAILS ==========
    // Don't await this - let it run in background
    (async () => {
      try {
        let meetLink = null;
        let calendarEventId = null;

        // Create calendar event with Meet link
        if (member.google_access_token && member.google_refresh_token) {
          try {
            console.log('📅 Creating calendar event with Meet link (async)...');

            const oauth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
              process.env.GOOGLE_REDIRECT_URI
            );

            oauth2Client.setCredentials({
              access_token: member.google_access_token,
              refresh_token: member.google_refresh_token
            });

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const event = {
              summary: `Meeting with ${attendee_name}`,
              description: notes || 'Scheduled via ScheduleSync',
              start: {
                dateTime: slot.start,
                timeZone: 'UTC',
              },
              end: {
                dateTime: slot.end,
                timeZone: 'UTC',
              },
              attendees: [
                { email: attendee_email, displayName: attendee_name },
                { email: member.member_email, displayName: member.member_name }
              ],
              conferenceData: {
                createRequest: {
                  requestId: `schedulesync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  conferenceSolutionKey: {
                    type: 'hangoutsMeet'
                  }
                }
              },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'email', minutes: 24 * 60 },
                  { method: 'popup', minutes: 30 }
                ]
              }
            };

            const calendarResponse = await calendar.events.insert({
              calendarId: 'primary',
              resource: event,
              conferenceDataVersion: 1,
              sendUpdates: 'all'
            });

            meetLink = calendarResponse.data.hangoutLink || null;
            calendarEventId = calendarResponse.data.id;

            // Update bookings with meet link
            for (const booking of createdBookings) {
              await pool.query(
                `UPDATE bookings SET meet_link = $1, calendar_event_id = $2 WHERE id = $3`,
                [meetLink, calendarEventId, booking.id]
              );
            }

            console.log('✅ Calendar event created with Meet link:', meetLink);
          } catch (calendarError) {
            console.error('⚠️ Calendar event creation failed:', calendarError.message);
          }
        }

        // Send confirmation emails
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

          // Update booking object with meet_link for email
          const bookingWithMeetLink = {
            ...createdBookings[0],
            attendee_name,
            attendee_email,
            organizer_name: member.member_name || member.name,
            team_name: member.team_name,
            notes,
            meet_link: meetLink,
          };

          await sendBookingEmail({
            to: attendee_email,
            subject: '✅ Booking Confirmed - ScheduleSync',
            html: emailTemplates.bookingConfirmationGuest(bookingWithMeetLink),
            icsAttachment: icsFile,
          });

          if (member.member_email || member.email) {
            await sendBookingEmail({
              to: member.member_email || member.email,
              subject: '📅 New Booking Received - ScheduleSync',
              html: emailTemplates.bookingConfirmationOrganizer(bookingWithMeetLink),
              icsAttachment: icsFile,
            });
          }
          
          console.log('✅ Confirmation emails sent with Meet link');
        } catch (emailError) {
          console.error('⚠️ Failed to send emails:', emailError);
        }
      } catch (error) {
        console.error('❌ Background processing error:', error);
      }
    })();

  } catch (error) {
    console.error('❌ Create booking error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
});

// ============ BOOKING MANAGEMENT BY TOKEN (NO AUTH REQUIRED) ============

// Get booking by token (for guest management page)
app.get('/api/bookings/manage/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('📋 Getting booking for management:', token);
    
    const result = await pool.query(
      `SELECT b.*, 
      b.meet_link,
      b.calendar_event_id,
              t.name as team_name,
              tm.name as organizer_name,
              tm.email as organizer_email,
              tm.booking_token as member_booking_token
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.booking_token = $1`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const booking = result.rows[0];
    
    // Check if booking is in the past
    const now = new Date();
    const bookingTime = new Date(booking.start_time);
    const canModify = bookingTime > now && booking.status === 'confirmed';
    
    res.json({
      booking: {
        id: booking.id,
        attendee_name: booking.attendee_name,
        attendee_email: booking.attendee_email,
        start_time: booking.start_time,
        end_time: booking.end_time,
        notes: booking.notes,
        status: booking.status,
        team_name: booking.team_name,
        organizer_name: booking.organizer_name,
        organizer_email: booking.organizer_email,
        member_booking_token: booking.member_booking_token,
        meet_link: booking.meet_link,              
    calendar_event_id: booking.calendar_event_id,
        can_modify: canModify,
        is_past: bookingTime < now
      }
    });
  } catch (error) {
    console.error('❌ Get booking by token error:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// Reschedule booking by token
app.post('/api/bookings/manage/:token/reschedule', async (req, res) => {
  try {
    const { token } = req.params;
    const { newStartTime, newEndTime } = req.body;

    console.log('🔄 Rescheduling booking via token:', token);

    if (!newStartTime || !newEndTime) {
      return res.status(400).json({ error: 'New start and end times are required' });
    }

    // Get booking by token
    const bookingCheck = await pool.query(
      `SELECT b.*, b.meet_link, b.calendar_event_id,  t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.booking_token = $1 AND b.status = 'confirmed'`,
      [token]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }

    const booking = bookingCheck.rows[0];

    // Don't allow rescheduling past bookings
    const now = new Date();
    const bookingTime = new Date(booking.start_time);
    if (bookingTime < now) {
      return res.status(400).json({ error: 'Cannot reschedule past bookings' });
    }

    // Store old time for email
    const oldStartTime = booking.start_time;

    // Update booking times
    const updateResult = await pool.query(
      `UPDATE bookings 
       SET start_time = $1, 
           end_time = $2,
           updated_at = NOW()
       WHERE booking_token = $3
       RETURNING *`,
      [newStartTime, newEndTime, token]
    );
    
    const updatedBooking = updateResult.rows[0];

    console.log('✅ Booking rescheduled successfully');

    // Send reschedule emails
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

      // Email to guest
      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '🔄 Booking Rescheduled - ScheduleSync',
        html: emailTemplates.bookingReschedule(
          {
            ...updatedBooking,
            organizer_name: booking.member_name,
            team_name: booking.team_name,
            booking_token: token,
            meet_link: booking.meet_link, 
          },
          oldStartTime
        ),
        icsAttachment: icsFile,
      });

      // Email to organizer
      if (booking.member_email) {
        await sendBookingEmail({
          to: booking.member_email,
          subject: '🔄 Booking Rescheduled by Guest - ScheduleSync',
          html: emailTemplates.bookingReschedule(
            {
              ...updatedBooking,
              organizer_name: booking.member_name,
              team_name: booking.team_name,
              booking_token: token,
            },
            oldStartTime
          ),
          icsAttachment: icsFile,
        });
      }

      console.log('✅ Reschedule emails sent');
    } catch (emailError) {
      console.error('⚠️ Failed to send reschedule email:', emailError);
    }

    res.json({ 
      success: true, 
      booking: {
        ...updatedBooking,
        team_name: booking.team_name,
        organizer_name: booking.member_name,
      },
      message: 'Booking rescheduled successfully' 
    });

  } catch (error) {
    console.error('❌ Reschedule booking error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// Cancel booking by token
app.post('/api/bookings/manage/:token/cancel', async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    console.log('❌ Canceling booking via token:', token);

    // Get booking by token
    const bookingCheck = await pool.query(
      `SELECT b.*, b.meet_link, b.calendar_event_id, t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name, tm.booking_token as member_booking_token
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.booking_token = $1 AND b.status = 'confirmed'`,
      [token]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }

    const booking = bookingCheck.rows[0];

    // Update booking status
    await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled',
           notes = COALESCE(notes, '') || E'\n\nCancellation reason: ' || COALESCE($1, 'No reason provided'),
           updated_at = NOW()
       WHERE booking_token = $2`,
      [reason, token]
    );

    console.log('✅ Booking cancelled successfully');

    // Send cancellation emails
    try {
      // Email to guest
      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '❌ Booking Cancelled - ScheduleSync',
        html: emailTemplates.bookingCancellation(
          {
            ...booking,
            booking_token: booking.member_booking_token, // For rebooking
            meet_link: booking.meet_link,
          },
          reason
        ),
      });

      // Email to organizer
      if (booking.member_email) {
        await sendBookingEmail({
          to: booking.member_email,
          subject: '❌ Booking Cancelled by Guest - ScheduleSync',
          html: emailTemplates.bookingCancellation(
            {
              ...booking,
              booking_token: booking.member_booking_token,
            },
            reason
          ),
        });
      }

      console.log('✅ Cancellation emails sent');
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


// ============ REMINDER ENDPOINTS ============

app.get('/api/reminders/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + (23 * 60 * 60 * 1000));
    const reminderWindowEnd = new Date(now.getTime() + (72 * 60 * 60 * 1000));
    
    // Pending reminders
    const pendingResult = await pool.query(
      `SELECT b.*, tm.name as organizer_name, t.name as team_name
       FROM bookings b
       LEFT JOIN team_members tm ON b.member_id = tm.id
       LEFT JOIN teams t ON b.team_id = t.id
       WHERE (t.owner_id = $1 OR tm.user_id = $1)
         AND b.status = 'confirmed'
         AND b.reminder_sent = false
         AND b.start_time >= $2
         AND b.start_time <= $3
       ORDER BY b.start_time ASC`,
      [userId, reminderWindowStart, reminderWindowEnd]
    );
    
    // Recently sent reminders
    const sentResult = await pool.query(
      `SELECT b.*, tm.name as organizer_name, t.name as team_name
       FROM bookings b
       LEFT JOIN team_members tm ON b.member_id = tm.id
       LEFT JOIN teams t ON b.team_id = t.id
       WHERE (t.owner_id = $1 OR tm.user_id = $1)
         AND b.reminder_sent = true
         AND b.reminder_sent_at >= NOW() - INTERVAL '7 days'
       ORDER BY b.reminder_sent_at DESC
       LIMIT 10`,
      [userId]
    );
    
    // Failed reminders
    const failedResult = await pool.query(
  `SELECT b.*, tm.name as organizer_name, t.name as team_name, 
          br.error_message, br.sent_at as reminder_failed_at
   FROM bookings b
   LEFT JOIN team_members tm ON b.member_id = tm.id
   LEFT JOIN teams t ON b.team_id = t.id
   INNER JOIN booking_reminders br ON b.id = br.booking_id
   WHERE (t.owner_id = $1 OR tm.user_id = $1)
     AND br.status = 'failed'
     AND br.sent_at >= NOW() - INTERVAL '7 days'
   ORDER BY br.sent_at DESC
   LIMIT 10`,
  [userId]
);
    
    res.json({
      pending: pendingResult.rows,
      sent: sentResult.rows,
      failed: failedResult.rows,
    });
  } catch (error) {
    console.error('Get reminder status error:', error);
    res.status(500).json({ error: 'Failed to get reminder status' });
  }
});

app.get('/api/teams/:teamId/reminder-settings', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );
    
    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const team = teamCheck.rows[0];
    
    res.json({
      reminder_enabled: team.reminder_enabled !== false,
      reminder_hours_before: team.reminder_hours_before || 24,
      reminder_template: team.reminder_template || 'default',
    });
  } catch (error) {
    console.error('Get reminder settings error:', error);
    res.status(500).json({ error: 'Failed to get reminder settings' });
  }
});

app.put('/api/teams/:teamId/reminder-settings', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    const { reminder_enabled, reminder_hours_before } = req.body;
    
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );
    
    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query(
      `UPDATE teams 
       SET reminder_enabled = $1, 
           reminder_hours_before = $2
       WHERE id = $3`,
      [reminder_enabled, reminder_hours_before, teamId]
    );
    
    console.log(`✅ Updated reminder settings for team ${teamId}`);
    
    res.json({ 
      success: true,
      reminder_enabled,
      reminder_hours_before,
    });
  } catch (error) {
    console.error('Update reminder settings error:', error);
    res.status(500).json({ error: 'Failed to update reminder settings' });
  }
});

// ============ MANUAL REMINDER ENDPOINT (FOR TESTING) ============

app.post('/api/admin/send-reminders', authenticateToken, async (req, res) => {
  try {
    console.log('🔔 Manual reminder check triggered by user:', req.user.email);
    await checkAndSendReminders();
    res.json({ success: true, message: 'Reminder check completed' });
  } catch (error) {
    console.error('Manual reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});
// ============ PAYMENT ENDPOINTS ============

const stripeService = require('./utils/stripe');

// Get Stripe publishable key
app.get('/api/payments/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// Get pricing for a booking token
app.get('/api/book/:token/pricing', async (req, res) => {
  try {
    const { token } = req.params;
    
    const memberResult = await pool.query(
      `SELECT tm.booking_price, tm.currency, tm.payment_required, tm.name,
              t.name as team_name
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    // DEBUG: Log what we get from database
    console.log('💰 Pricing endpoint - Raw DB value:', {
      payment_required: member.payment_required,
      type: typeof member.payment_required,
      value: member.payment_required,
      boolean_conversion: Boolean(member.payment_required),
      strict_true: member.payment_required === true,
      truthy: !!member.payment_required
    });

    res.json({
      price: parseFloat(member.booking_price) || 0,
      currency: member.currency || 'USD',
      paymentRequired: !!member.payment_required,  // ← Double negation for truthy check
      memberName: member.name,
      teamName: member.team_name,
    });
  } catch (error) {
    console.error('❌ Get pricing error:', error);
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

// Create payment intent
app.post('/api/payments/create-intent', async (req, res) => {
  try {
    const { bookingToken, attendeeName, attendeeEmail } = req.body;

    if (!bookingToken) {
      return res.status(400).json({ error: 'Booking token required' });
    }

    // Get member pricing
    const memberResult = await pool.query(
      `SELECT tm.booking_price, tm.currency, tm.payment_required, tm.name,
              t.name as team_name
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.booking_token = $1`,
      [bookingToken]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    if (!member.payment_required || member.booking_price <= 0) {
      return res.status(400).json({ error: 'Payment not required for this booking' });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: member.booking_price,
      currency: member.currency || 'USD',
      metadata: {
        booking_token: bookingToken,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail,
        member_name: member.name,
        team_name: member.team_name,
      },
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: member.booking_price,
      currency: member.currency || 'USD',
    });
  } catch (error) {
    console.error('❌ Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Confirm payment and create booking
app.post('/api/payments/confirm-booking', async (req, res) => {
  try {
    const { paymentIntentId, bookingToken, slot, attendeeName, attendeeEmail, notes } = req.body;

    console.log('💳 Confirming payment and creating booking:', paymentIntentId);

    // Verify payment was successful
    const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Get member details
    const memberResult = await pool.query(
      `SELECT tm.*, t.name as team_name, t.booking_mode, t.owner_id, 
              u.google_access_token, u.google_refresh_token, 
              u.email as member_email, u.name as member_name
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       LEFT JOIN users u ON tm.user_id = u.id 
       WHERE tm.booking_token = $1`,
      [bookingToken]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    // Create booking with payment info
    const bookingResult = await pool.query(
      `INSERT INTO bookings (
        team_id, member_id, user_id, attendee_name, attendee_email, 
        start_time, end_time, notes, booking_token, status,
        payment_status, payment_amount, payment_currency, 
        stripe_payment_intent_id, payment_receipt_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
      RETURNING *`,
      [
        member.team_id, member.id, member.user_id, attendeeName, attendeeEmail,
        slot.start, slot.end, notes || '', bookingToken, 'confirmed',
        'paid', paymentIntent.amount / 100, paymentIntent.currency,
        paymentIntentId, paymentIntent.charges?.data[0]?.receipt_url
      ]
    );

    const booking = bookingResult.rows[0];

    // Record payment in payments table
    await pool.query(
      `INSERT INTO payments (
        booking_id, stripe_payment_intent_id, amount, currency, 
        status, payment_method_id, receipt_url, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        booking.id, paymentIntentId, paymentIntent.amount / 100, paymentIntent.currency,
        'succeeded', paymentIntent.payment_method, 
        paymentIntent.charges?.data[0]?.receipt_url,
        JSON.stringify(paymentIntent.metadata)
      ]
    );

    console.log('✅ Booking created with payment:', booking.id);

    // Send confirmation emails (async)
    (async () => {
      try {
        const icsFile = generateICS({
          id: booking.id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          attendee_name: attendeeName,
          attendee_email: attendeeEmail,
          organizer_name: member.member_name || member.name,
          organizer_email: member.member_email || member.email,
          team_name: member.team_name,
          notes: notes,
        });

        const bookingWithPayment = {
          ...booking,
          attendee_name: attendeeName,
          attendee_email: attendeeEmail,
          organizer_name: member.member_name || member.name,
          team_name: member.team_name,
          notes,
          payment_amount: booking.payment_amount,
          payment_currency: booking.payment_currency,
          payment_receipt_url: booking.payment_receipt_url,
        };

        await sendBookingEmail({
          to: attendeeEmail,
          subject: '✅ Payment Confirmed & Booking Complete - ScheduleSync',
          html: emailTemplates.bookingConfirmationGuestWithPayment(bookingWithPayment),
          icsAttachment: icsFile,
        });

        if (member.member_email || member.email) {
          await sendBookingEmail({
            to: member.member_email || member.email,
            subject: '💰 New Paid Booking Received - ScheduleSync',
            html: emailTemplates.bookingConfirmationOrganizerWithPayment(bookingWithPayment),
            icsAttachment: icsFile,
          });
        }

        console.log('✅ Payment confirmation emails sent');
      } catch (emailError) {
        console.error('⚠️ Failed to send emails:', emailError);
      }
    })();

    res.json({
      success: true,
      booking: {
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        payment_amount: booking.payment_amount,
        payment_currency: booking.payment_currency,
        payment_receipt_url: booking.payment_receipt_url,
      },
    });
  } catch (error) {
    console.error('❌ Confirm booking error:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// Process refund on cancellation
app.post('/api/payments/refund', authenticateToken, async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    const userId = req.user.id;

    console.log('💸 Processing refund for booking:', bookingId);

    // Get booking with payment info
    const bookingResult = await pool.query(
      `SELECT b.*, t.owner_id, tm.user_id as member_user_id
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Check permission
    const hasPermission = booking.owner_id === userId || booking.member_user_id === userId;
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if payment exists
    if (!booking.stripe_payment_intent_id || booking.payment_status !== 'paid') {
      return res.status(400).json({ error: 'No payment to refund' });
    }

    // Process refund via Stripe
    const refund = await stripeService.createRefund({
      paymentIntentId: booking.stripe_payment_intent_id,
      reason: reason || 'requested_by_customer',
    });

    // Update booking
    await pool.query(
      `UPDATE bookings 
       SET payment_status = 'refunded',
           refund_id = $1,
           refund_amount = $2,
           refund_status = $3
       WHERE id = $4`,
      [refund.id, refund.amount / 100, refund.status, bookingId]
    );

    // Record refund
    await pool.query(
      `INSERT INTO refunds (booking_id, stripe_refund_id, amount, currency, status, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bookingId, refund.id, refund.amount / 100, refund.currency, refund.status, reason]
    );

    console.log('✅ Refund processed:', refund.id);

    res.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
      },
    });
  } catch (error) {
    console.error('❌ Refund error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Get Stripe publishable key
app.get('/api/payments/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// Webhook endpoint for Stripe events
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    const event = stripeService.constructWebhookEvent(req.body, signature);

    console.log('🔔 Stripe webhook event:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        // Payment was successful
        const paymentIntent = event.data.object;
        console.log('✅ Payment succeeded:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        // Payment failed
        const failedPayment = event.data.object;
        console.log('❌ Payment failed:', failedPayment.id);
        break;

      case 'charge.refunded':
        // Refund processed
        const refund = event.data.object;
        console.log('💸 Refund processed:', refund.id);
        break;

      default:
        console.log('ℹ️ Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
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


const cron = require('node-cron');

// ============ REMINDER EMAIL TEMPLATES ============

const reminderEmailTemplate = (booking, hoursUntil) => {
  const meetingDate = new Date(booking.start_time).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const meetingTime = new Date(booking.start_time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .meeting-details { background: white; border: 2px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; align-items: center; margin: 15px 0; }
        .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .meet-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0; }
        .meet-button { display: inline-block; background: white; color: #667eea; padding: 15px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; margin: 10px 0; }
        .action-buttons { margin: 25px 0; padding: 20px; background: #f3f4f6; border-radius: 10px; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .btn-reschedule { background: #3b82f6; color: white; }
        .btn-cancel { background: #ef4444; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">⏰ Meeting Reminder</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Your meeting is coming up soon!</p>
        </div>
        <div class="content">
          <div class="alert">
            <strong style="font-size: 16px;">⏰ Reminder:</strong> Your meeting is in <strong>${hoursUntil} hours</strong>
          </div>
          
          ${booking.meet_link ? `
          <div class="meet-box">
            <p style="color: white; font-size: 20px; font-weight: bold; margin: 0 0 15px 0;">🎥 Ready to Join?</p>
            <a href="${booking.meet_link}" class="meet-button">
              Join Google Meet
            </a>
            <p style="color: rgba(255,255,255,0.9); font-size: 13px; margin: 15px 0 5px 0;">
              Meeting Link:
            </p>
            <p style="color: rgba(255,255,255,0.7); font-size: 11px; margin: 0; word-break: break-all;">
              ${booking.meet_link}
            </p>
            <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 15px 0 0 0;">
              💡 Join a few minutes early to test your setup
            </p>
          </div>
          ` : ''}
          
          <div class="meeting-details">
            <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">Meeting Details</h2>
            
            <div class="detail-row">
              <span style="font-size: 24px; margin-right: 10px;">📅</span>
              <div>
                <strong>Date:</strong><br>
                ${meetingDate}
              </div>
            </div>
            
            <div class="detail-row">
              <span style="font-size: 24px; margin-right: 10px;">🕐</span>
              <div>
                <strong>Time:</strong><br>
                ${meetingTime}
              </div>
            </div>
            
            <div class="detail-row">
              <span style="font-size: 24px; margin-right: 10px;">👤</span>
              <div>
                <strong>${booking.is_organizer ? 'With' : 'Organizer'}:</strong><br>
                ${booking.is_organizer ? booking.attendee_name : booking.organizer_name}
              </div>
            </div>
            
            ${booking.notes ? `
            <div class="detail-row">
              <span style="font-size: 24px; margin-right: 10px;">📝</span>
              <div>
                <strong>Notes:</strong><br>
                ${booking.notes}
              </div>
            </div>
            ` : ''}
          </div>

          ${booking.booking_token ? `
          <div class="action-buttons">
            <p style="font-weight: bold; color: #374151; margin: 0 0 15px 0; font-size: 15px;">Need to make changes?</p>
            <a href="${process.env.FRONTEND_URL}/manage/${booking.booking_token}?action=reschedule" class="btn btn-reschedule">
              🔄 Reschedule
            </a>
            <a href="${process.env.FRONTEND_URL}/manage/${booking.booking_token}?action=cancel" class="btn btn-cancel">
              ❌ Cancel Meeting
            </a>
          </div>
          ` : ''}
          
          <p style="margin: 20px 0; color: #4b5563; font-size: 14px;">
            📌 <strong>Quick Checklist:</strong><br>
            • Test your camera and microphone<br>
            • Have any materials ready<br>
            • Find a quiet space<br>
            • Join a few minutes early
          </p>
          
          <p style="color: #6b7280; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            This is an automated reminder from ScheduleSync. Meeting scheduled on ${new Date(booking.created_at).toLocaleDateString()}.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ============ REMINDER SENDING FUNCTION ============

async function sendBookingReminder(booking, recipientEmail, recipientName, isOrganizer) {
  try {
    // Calculate hours until meeting
    const now = new Date();
    const meetingTime = new Date(booking.start_time);
    const hoursUntil = Math.round((meetingTime - now) / (1000 * 60 * 60));
    
    // Prepare email data
    const bookingWithRecipient = {
      ...booking,
      is_organizer: isOrganizer,
      attendee_name: isOrganizer ? booking.attendee_name : recipientName,
      organizer_name: isOrganizer ? recipientName : booking.organizer_name,
    };
    
    // Generate ICS attachment
    const icsFile = generateICS({
      id: booking.id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      attendee_name: booking.attendee_name,
      attendee_email: booking.attendee_email,
      organizer_name: booking.organizer_name || 'ScheduleSync',
      organizer_email: booking.organizer_email || 'noreply@schedulesync.com',
      team_name: booking.team_name || 'Meeting',
      notes: booking.notes,
    });
    
    // Send email
    await sendBookingEmail({
      to: recipientEmail,
      subject: `⏰ Reminder: Meeting in ${hoursUntil} hours`,
      html: reminderEmailTemplate(bookingWithRecipient, hoursUntil),
      icsAttachment: icsFile,
    });
    
    console.log(`✅ Reminder sent to ${recipientEmail} for booking ${booking.id}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send reminder to ${recipientEmail}:`, error);
    return false;
  }
}

// ============ REMINDER CHECKER (RUNS EVERY HOUR) ============

async function checkAndSendReminders() {
  try {
    console.log('🔔 Checking for bookings that need reminders...');
    
    // Get bookings that:
    // 1. Are confirmed
    // 2. Start in 24-26 hours (to catch all bookings in hourly check)
    // 3. Haven't had reminder sent yet
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now
    const reminderWindowEnd = new Date(now.getTime() + (26 * 60 * 60 * 1000)); // 26 hours from now
    
    const bookingsResult = await pool.query(
      `SELECT b.*, 
       b.meet_link,   
        b.calendar_event_id,   
        b.booking_token,
              tm.name as organizer_name,
              tm.email as organizer_email,
              t.name as team_name
       FROM bookings b
       LEFT JOIN team_members tm ON b.member_id = tm.id
       LEFT JOIN teams t ON b.team_id = t.id
       WHERE b.status = 'confirmed'
         AND b.reminder_sent = false
         AND b.start_time >= $1
         AND b.start_time <= $2
       ORDER BY b.start_time ASC`,
      [reminderWindowStart, reminderWindowEnd]
    );
    
    const bookings = bookingsResult.rows;
    console.log(`📋 Found ${bookings.length} booking(s) needing reminders`);
    
    for (const booking of bookings) {
      try {
        // Send reminder to attendee
        const attendeeSuccess = await sendBookingReminder(
          booking,
          booking.attendee_email,
          booking.attendee_name,
          false // attendee
        );
        
        // Send reminder to organizer (if email exists)
        let organizerSuccess = true;
        if (booking.organizer_email) {
          organizerSuccess = await sendBookingReminder(
            booking,
            booking.organizer_email,
            booking.organizer_name,
            true // organizer
          );
        }
        
        // Update booking if at least one reminder was sent
        if (attendeeSuccess || organizerSuccess) {
          await pool.query(
            `UPDATE bookings 
             SET reminder_sent = true, reminder_sent_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [booking.id]
          );
          
          // Log to reminder tracking table
          if (attendeeSuccess) {
            await pool.query(
              `INSERT INTO booking_reminders (booking_id, reminder_type, recipient_email, status)
               VALUES ($1, $2, $3, $4)`,
              [booking.id, '24h', booking.attendee_email, 'sent']
            );
          }
          
          if (organizerSuccess && booking.organizer_email) {
            await pool.query(
              `INSERT INTO booking_reminders (booking_id, reminder_type, recipient_email, status)
               VALUES ($1, $2, $3, $4)`,
              [booking.id, '24h', booking.organizer_email, 'sent']
            );
          }
          
          console.log(`✅ Reminders processed for booking ${booking.id}`);
        }
      } catch (bookingError) {
        console.error(`❌ Error processing booking ${booking.id}:`, bookingError);
        
        // Log failed reminder
        await pool.query(
          `INSERT INTO booking_reminders (booking_id, reminder_type, recipient_email, status, error_message)
           VALUES ($1, $2, $3, $4, $5)`,
          [booking.id, '24h', booking.attendee_email, 'failed', bookingError.message]
        );
      }
    }
    
    console.log('✅ Reminder check completed');
  } catch (error) {
    console.error('❌ Error in reminder checker:', error);
  }
}

// ============ SCHEDULE REMINDER CHECKER ============

// Run every hour at :00 minutes
cron.schedule('0 * * * *', () => {
  console.log('⏰ Running scheduled reminder check...');
  checkAndSendReminders();
});

// Also run on server startup (after 1 minute to let everything initialize)
setTimeout(() => {
  console.log('🚀 Running initial reminder check...');
  checkAndSendReminders();
}, 60000);

console.log('✅ Booking reminder scheduler initialized');

// ============ TIMEZONE ENDPOINTS ============

// Get user's timezone
app.get('/api/user/timezone', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT timezone FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      timezone: result.rows[0].timezone || 'America/New_York' 
    });
  } catch (error) {
    console.error('Get timezone error:', error);
    res.status(500).json({ error: 'Failed to get timezone' });
  }
});

// Update user's timezone
app.put('/api/user/timezone', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { timezone } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ error: 'Timezone is required' });
    }
    
    await pool.query(
      'UPDATE users SET timezone = $1 WHERE id = $2',
      [timezone, userId]
    );
    
    console.log(`✅ Updated timezone for user ${userId}: ${timezone}`);
    
    res.json({ success: true, timezone });
  } catch (error) {
    console.error('Update timezone error:', error);
    res.status(500).json({ error: 'Failed to update timezone' });
  }
});

// Get team member's timezone
app.get('/api/team-members/:id/timezone', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;
    
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id 
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       WHERE tm.id = $1`,
      [memberId]
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    const member = memberResult.rows[0];
    
    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    res.json({ timezone: member.timezone || 'America/New_York' });
  } catch (error) {
    console.error('Get member timezone error:', error);
    res.status(500).json({ error: 'Failed to get timezone' });
  }
});

// Update team member's timezone
app.put('/api/team-members/:id/timezone', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;
    const { timezone } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ error: 'Timezone is required' });
    }
    
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id 
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       WHERE tm.id = $1`,
      [memberId]
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    const member = memberResult.rows[0];
    
    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query(
      'UPDATE team_members SET timezone = $1 WHERE id = $2',
      [timezone, memberId]
    );
    
    console.log(`✅ Updated timezone for member ${memberId}: ${timezone}`);
    
    res.json({ success: true, timezone });
  } catch (error) {
    console.error('Update member timezone error:', error);
    res.status(500).json({ error: 'Failed to update timezone' });
  }
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
