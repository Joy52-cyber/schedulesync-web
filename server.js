require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const path = require('path');
const { google } = require('googleapis');
const crypto = require('crypto');

// Conditional imports for optional features
let sendTeamInvitation, sendBookingConfirmation;
try {
  const emailUtils = require('./utils/email');
  sendTeamInvitation = emailUtils.sendTeamInvitation;
  sendBookingConfirmation = emailUtils.sendBookingConfirmation;
  console.log('✅ Email utilities loaded successfully');
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

const app = express();

// ============ MIDDLEWARE ============

app.use(cors());
app.use(express.json());

// ============ DATABASE CONNECTION ============

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
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

    // Create users table
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

    // Create teams table with owner_id
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create team_members table with created_at
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        booking_token VARCHAR(255) UNIQUE NOT NULL,
        invited_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create bookings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        attendee_name VARCHAR(255) NOT NULL,
        attendee_email VARCHAR(255) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        notes TEXT,
        booking_token VARCHAR(255),
        status VARCHAR(50) DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Database initialized successfully');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Initialize database
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

// ============ AUTH ROUTES ============

// Google OAuth callback
// Google OAuth callback (CLEAN)
app.post('/api/auth/google', async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    // Determine redirect URI used during the auth request
    // Priority: explicit env override → client-provided redirectUri
    const configuredRedirect = process.env.GOOGLE_REDIRECT_URI || null;
    const finalRedirectUri = configuredRedirect || redirectUri;

    if (!finalRedirectUri) {
      return res.status(400).json({ error: 'Missing redirectUri (server env or client payload)' });
    }

    // Optional: basic allowlist to prevent abuse (recommended)
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.APP_URL
    ].filter(Boolean);

    try {
      const u = new URL(finalRedirectUri);
      const isAllowed =
        allowedOrigins.length === 0 ||
        allowedOrigins.some(a => {
          try {
            const au = new URL(a);
            return au.origin === u.origin; // same origin check
          } catch {
            return false;
          }
        });

      if (!isAllowed) {
        return res.status(400).json({ error: 'redirectUri not allowed' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid redirectUri' });
    }

    // Create OAuth2 client with the SAME redirect URI used to obtain the code
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      finalRedirectUri
    );

    // Exchange code for tokens (fails if redirect_uri mismatches)
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Upsert user
    let userResult = await pool.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [data.id, data.email]
    );

    let user;
    if (userResult.rows.length === 0) {
      const result = await pool.query(
        `INSERT INTO users (google_id, email, name, google_access_token, google_refresh_token, calendar_sync_enabled)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.id,
          data.email,
          data.name || '',
          tokens.access_token || null,
          tokens.refresh_token || null,
          Boolean(tokens.refresh_token)
        ]
      );
      user = result.rows[0];
    } else {
      user = userResult.rows[0];
      const hasRefresh = Boolean(tokens.refresh_token || user.google_refresh_token);
      const update = await pool.query(
        `UPDATE users 
           SET google_id = COALESCE(google_id, $1),
               google_access_token = $2,
               google_refresh_token = COALESCE($3, google_refresh_token),
               calendar_sync_enabled = $4,
               name = COALESCE($5, name)
         WHERE id = $6
         RETURNING *`,
        [
          data.id,
          tokens.access_token || null,
          tokens.refresh_token || null,
          hasRefresh,
          data.name || '',
          user.id
        ]
      );
      user = update.rows[0];
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET missing' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        calendarSyncEnabled: user.calendar_sync_enabled
      }
    });
  } catch (error) {
    console.error('❌ Google OAuth error:', error?.response?.data || error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// ============ TEAM ROUTES ============

// Get all teams for user
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

// Create team
app.post('/api/teams', authenticateToken, async (req, res) => {
  const { name, description } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO teams (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || '', req.user.id]
    );
    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update team
app.put('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const result = await pool.query(
      'UPDATE teams SET name = $1, description = $2 WHERE id = $3 AND owner_id = $4 RETURNING *',
      [name, description, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete team
app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM teams WHERE id = $1 AND owner_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ============ TEAM MEMBER ROUTES ============

// Get team members
app.get('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;

  try {
    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, req.user.id]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await pool.query(
      `SELECT 
        tm.id,
        tm.team_id,
        tm.user_id,
        tm.email,
        tm.booking_token,
        tm.invited_by,
        tm.created_at,
        u.name as user_name,
        u.email as user_email
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

// Add team member
app.post('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { email, sendEmail = true } = req.body;

  try {
    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, req.user.id]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to manage this team' });
    }

    const team = teamCheck.rows[0];

    // Check if member already exists
    const existingMember = await pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND email = $2',
      [teamId, email]
    );

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'Member already exists in this team' });
    }

    // Check if user exists
    let userId = null;
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
    }

    // Generate unique booking token
    const bookingToken = crypto.randomBytes(16).toString('hex');

    // Add team member
    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id, email, booking_token, invited_by) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [teamId, userId, email, bookingToken, req.user.id]
    );

    const member = result.rows[0];
    const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const bookingUrl = `${baseUrl}/book/${bookingToken}`;

    // Send invitation email if available
    if (sendEmail && sendTeamInvitation) {
      try {
        const inviterName = req.user.name || req.user.email;
        await sendTeamInvitation(email, team.name, bookingUrl, inviterName);
        console.log(`✅ Invitation email sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
      }
    } else if (sendEmail && !sendTeamInvitation) {
      console.log(`Would send invitation email to ${email} with booking URL: ${bookingUrl}`);
    }

    res.json({ 
      member,
      bookingUrl,
      message: 'Member added successfully'
    });
    
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove team member
app.delete('/api/teams/:teamId/members/:memberId', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;

  try {
    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, req.user.id]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query(
      'DELETE FROM team_members WHERE id = $1 AND team_id = $2',
      [memberId, teamId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ============ BOOKING ROUTES ============

// Get all bookings
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, t.name as team_name
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.team_id = tm.team_id
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

// Get booking by token (public)
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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking link not found' });
    }

    const member = result.rows[0];
    res.json({
      team: {
        id: member.team_id,
        name: member.team_name,
        description: member.team_description
      },
      member: {
        name: member.member_name || member.email,
        email: member.email
      }
    });
  } catch (error) {
    console.error('Get booking by token error:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

// Get availability (public)
app.get('/api/book/:token/availability', async (req, res) => {
  try {
    const { token } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    // Get team member info
    const memberResult = await pool.query(
      `SELECT tm.*, u.google_access_token, u.google_refresh_token, u.calendar_sync_enabled, u.name as member_name
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    // Check if calendar sync is available and enabled
    if (getAvailableSlots && member.calendar_sync_enabled && member.google_refresh_token) {
      try {
        const slots = await getAvailableSlots(
          member.google_access_token,
          member.google_refresh_token,
          date,
          60
        );
        return res.json({ 
          slots, 
          calendarSyncEnabled: true,
          memberName: member.member_name || member.email
        });
      } catch (calError) {
        console.error('Calendar fetch failed, using generic slots:', calError);
      }
    }

    // Return generic time slots
    const genericSlots = [];
    const requestedDate = new Date(date);
    
    // Generate slots from 9 AM to 5 PM
    for (let hour = 9; hour < 17; hour++) {
      const start = new Date(requestedDate);
      start.setHours(hour, 0, 0, 0);
      
      const end = new Date(start);
      end.setHours(hour + 1, 0, 0, 0);
      
      // Only include future slots
      if (start > new Date()) {
        genericSlots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          startTime: start.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
        });
      }
    }
    
    res.json({ 
      slots: genericSlots, 
      calendarSyncEnabled: false,
      memberName: member.member_name || member.email
    });

  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Create booking (public)
app.post('/api/bookings', async (req, res) => {
  try {
    const { token, slot, attendee_name, attendee_email, notes } = req.body;

    if (!token || !slot || !attendee_name || !attendee_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get team member info
    const memberResult = await pool.query(
      `SELECT tm.*, t.name as team_name, u.google_access_token, u.google_refresh_token, 
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

    // Create booking
    const bookingResult = await pool.query(
      `INSERT INTO bookings (team_id, user_id, attendee_name, attendee_email, start_time, end_time, notes, booking_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        member.team_id,
        member.user_id,
        attendee_name,
        attendee_email,
        slot.start,
        slot.end,
        notes || '',
        token,
        'confirmed'
      ]
    );

    const booking = bookingResult.rows[0];

    // Create calendar event if available
    if (createCalendarEvent && member.google_refresh_token) {
      try {
        await createCalendarEvent(
          member.google_access_token,
          member.google_refresh_token,
          {
            summary: `Meeting with ${attendee_name}`,
            description: `Booked via ScheduleSync\n\nClient: ${attendee_name}\nEmail: ${attendee_email}\n\nNotes: ${notes || 'No notes'}`,
            start: slot.start,
            end: slot.end,
            attendees: [{ email: attendee_email, displayName: attendee_name }],
          }
        );
        console.log('✅ Calendar event created');
      } catch (calError) {
        console.error('Failed to create calendar event:', calError);
      }
    }

    // Send confirmation email if available
    if (sendBookingConfirmation) {
      try {
        await sendBookingConfirmation(attendee_email, {
          teamName: member.team_name,
          memberName: member.member_name || member.member_email,
          date: new Date(slot.start).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          time: new Date(slot.start).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        });
        console.log('✅ Confirmation email sent');
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }

    res.json({ 
      booking,
      message: 'Booking confirmed successfully!'
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ============ SERVE STATIC FILES (PRODUCTION) ============

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
  });
}

// ============ ERROR HANDLING ============

app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============ START SERVER ============

const port = process.env.PORT || 3000;
const host = '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Host: ${host}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});

// ============ GRACEFUL SHUTDOWN ============

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV === 'production') {
    server.close(() => {
      process.exit(1);
    });
  }
});

module.exports = app;