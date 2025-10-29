require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { sendTeamInvitation, sendBookingConfirmation } = require('./utils/email');
const { getAvailableSlots, createCalendarEvent } = require('./utils/calendar');

const app = express();

// ============ CONFIGURATION ============

const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRY: '30d',
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
};

// ============ MIDDLEWARE ============

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============ DATABASE CONNECTION ============

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// ============ DATABASE INITIALIZATION ============

async function initDB() {
  try {
    console.log('🔄 Initializing database schema...');

    // Users table with all necessary columns
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add columns if they don't exist (for existing databases)
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='google_access_token') THEN
          ALTER TABLE users ADD COLUMN google_access_token TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='google_refresh_token') THEN
          ALTER TABLE users ADD COLUMN google_refresh_token TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='calendar_sync_enabled') THEN
          ALTER TABLE users ADD COLUMN calendar_sync_enabled BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
          ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        END IF;
      END $$;
    `);

    // Teams table with user isolation
await pool.query(`
  CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`);

// Add missing columns to teams table
await pool.query(`
  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='user_id') THEN
      ALTER TABLE teams ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='updated_at') THEN
      ALTER TABLE teams ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
  END $$;
`);

// Create index for faster user queries
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id)
`);

    // Team members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        booking_token VARCHAR(255) UNIQUE NOT NULL,
        invited_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
      CREATE INDEX IF NOT EXISTS idx_team_members_booking_token ON team_members(booking_token);
    `);

    // Bookings table with user isolation
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
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

    // Create indexes for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_team_id ON bookings(team_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
    `);

    console.log('✅ Database schema initialized successfully');
    
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
}

// Initialize database on startup
initDB().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// ============ AUTHENTICATION MIDDLEWARE ============

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, CONFIG.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============ HELPER FUNCTIONS ============

// Create or update user (prevents duplicates)
async function upsertUser(googleData, tokens) {
  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleData.id]
    );

    if (existingUser.rows.length > 0) {
      // Update existing user
      const result = await pool.query(
        `UPDATE users 
         SET google_access_token = $1, 
             google_refresh_token = $2,
             calendar_sync_enabled = $3,
             name = $4,
             email = $5,
             updated_at = NOW()
         WHERE google_id = $6
         RETURNING *`,
        [
          tokens.access_token,
          tokens.refresh_token || existingUser.rows[0].google_refresh_token,
          true,
          googleData.name,
          googleData.email,
          googleData.id
        ]
      );
      
      console.log(`✅ Updated existing user: ${googleData.email}`);
      return { user: result.rows[0], isNew: false };
      
    } else {
      // Create new user
      const result = await pool.query(
        `INSERT INTO users (google_id, email, name, google_access_token, google_refresh_token, calendar_sync_enabled)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [googleData.id, googleData.email, googleData.name, tokens.access_token, tokens.refresh_token, true]
      );
      
      console.log(`✅ Created new user: ${googleData.email}`);
      return { user: result.rows[0], isNew: true };
    }
  } catch (error) {
    console.error('Error upserting user:', error);
    throw error;
  }
}

// Verify team ownership
async function verifyTeamOwnership(teamId, userId) {
  const result = await pool.query(
    'SELECT * FROM teams WHERE id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return result.rows.length > 0;
}

// ============ AUTH ROUTES ============

// Google OAuth callback
app.post('/api/auth/google', async (req, res) => {
  const { code } = req.body;

  try {
    console.log('🔐 Processing Google OAuth...');
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('🔑 Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token
    });

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    console.log(`👤 User: ${data.email}`);

    // Create or update user
    const { user, isNew } = await upsertUser(data, tokens);

    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        name: user.name 
      },
      CONFIG.JWT_SECRET,
      { expiresIn: CONFIG.JWT_EXPIRY }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        calendarSyncEnabled: user.calendar_sync_enabled,
        isNewUser: isNew
      },
      message: isNew ? 'Welcome to ScheduleSync!' : 'Welcome back!'
    });

  } catch (error) {
    console.error('❌ Google OAuth error:', error.message);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: CONFIG.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, calendar_sync_enabled, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  console.log(`👋 User logged out: ${req.user.email}`);
  res.json({ message: 'Logged out successfully' });
});

// ============ TEAM ROUTES (WITH USER ISOLATION) ============

// Get all teams for authenticated user ONLY
app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM teams WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ teams: result.rows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create team (automatically assigned to authenticated user)
app.post('/api/teams', authenticateToken, async (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO teams (name, description, user_id) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description?.trim() || null, req.user.id]
    );
    
    console.log(`✅ Team created: "${name}" by user ${req.user.email}`);
    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update team (only if user owns it)
app.put('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    // Verify ownership
    const isOwner = await verifyTeamOwnership(id, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized to modify this team' });
    }

    const result = await pool.query(
      'UPDATE teams SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *',
      [name, description, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    console.log(`✅ Team updated: ${name}`);
    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete team (only if user owns it)
app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Verify ownership
    const isOwner = await verifyTeamOwnership(id, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized to delete this team' });
    }

    const result = await pool.query(
      'DELETE FROM teams WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    console.log(`✅ Team deleted: ${result.rows[0].name}`);
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ============ TEAM MEMBER ROUTES (WITH OWNERSHIP CHECKS) ============

// Get team members (only if user owns the team)
app.get('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;

  try {
    // Verify ownership
    const isOwner = await verifyTeamOwnership(teamId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized to view this team' });
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

// Add team member (only if user owns the team)
app.post('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { email, sendEmail = true } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Verify ownership
    const isOwner = await verifyTeamOwnership(teamId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized to manage this team' });
    }

    // Get team info
    const teamResult = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    const team = teamResult.rows[0];

    // Check if user exists
    let userId = null;
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
    }

    // Generate unique booking token
    const crypto = require('crypto');
    const bookingToken = crypto.randomBytes(16).toString('hex');

    // Add team member
    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id, email, booking_token, invited_by) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [teamId, userId, email.trim(), bookingToken, req.user.id]
    );

    const member = result.rows[0];
    const bookingUrl = `${CONFIG.APP_URL}/book/${bookingToken}`;

    // Send invitation email
    if (sendEmail) {
      try {
        await sendTeamInvitation(email, team.name, bookingUrl, req.user.name || req.user.email);
        console.log(`✅ Invitation sent to ${email}`);
      } catch (emailError) {
        console.error('Email send failed:', emailError.message);
      }
    }

    console.log(`✅ Member added to team: ${email}`);
    res.json({ 
      member,
      bookingUrl,
      message: sendEmail ? 'Member added and invitation sent' : 'Member added'
    });
    
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove team member (only if user owns the team)
app.delete('/api/teams/:teamId/members/:memberId', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;

  try {
    // Verify ownership
    const isOwner = await verifyTeamOwnership(teamId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query(
      'DELETE FROM team_members WHERE id = $1 AND team_id = $2',
      [memberId, teamId]
    );

    console.log(`✅ Member removed from team`);
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ============ CALENDAR INTEGRATION ROUTES ============

// Get available time slots (PUBLIC - but validated by token)
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

    // Return real availability if calendar is synced
    if (member.calendar_sync_enabled && member.google_refresh_token) {
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
        console.error('Calendar fetch error:', calError.message);
        // Fall through to generic slots
      }
    }

    // Return generic time slots (9am-5pm, 30min intervals)
    const genericSlots = [];
    const requestedDate = new Date(date);
    
    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const start = new Date(requestedDate);
        start.setHours(hour, minute, 0, 0);
        
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 60);
        
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

// ============ BOOKING ROUTES ============

// Get all bookings for authenticated user's teams
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, t.name as team_name
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       WHERE t.user_id = $1 OR b.user_id = $1
       ORDER BY b.start_time DESC`,
      [req.user.id]
    );
    res.json({ bookings: result.rows });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get booking page info (PUBLIC)
app.get('/api/book/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query(
      `SELECT tm.*, t.name as team_name, t.description as team_description
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
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
      }
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

// Create booking (PUBLIC)
app.post('/api/bookings', async (req, res) => {
  try {
    const { token, slot, attendee_name, attendee_email, notes } = req.body;

    if (!token || !slot || !attendee_name || !attendee_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`📝 Creating booking for: ${attendee_email}`);

    // Get team member info
    const memberResult = await pool.query(
      `SELECT tm.*, t.name as team_name, u.google_access_token, u.google_refresh_token, u.email as member_email, u.name as member_name
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
        notes,
        token,
        'confirmed'
      ]
    );

    const booking = bookingResult.rows[0];
    console.log(`✅ Booking created: ${booking.id}`);

    // Create Google Calendar event
    if (member.google_refresh_token) {
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
        console.error('Calendar event creation failed:', calError.message);
      }
    }

    // Send confirmation email
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
      console.error('Email send failed:', emailError.message);
    }

    res.json({ 
      booking,
      message: 'Booking confirmed! Check your email for details.'
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ============ ANALYTICS ROUTES (USER ISOLATED) ============

// Get analytics for authenticated user only
app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    const bookingsResult = await pool.query(
      `SELECT COUNT(*) as total,
       COUNT(*) FILTER (WHERE start_time > NOW()) as upcoming
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       WHERE t.user_id = $1`,
      [req.user.id]
    );

    const teamsResult = await pool.query(
      'SELECT COUNT(*) as total FROM teams WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      totalBookings: parseInt(bookingsResult.rows[0].total) || 0,
      upcomingBookings: parseInt(bookingsResult.rows[0].upcoming) || 0,
      totalTeams: parseInt(teamsResult.rows[0].total) || 0
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============ SERVE STATIC FILES (PRODUCTION) ============

if (CONFIG.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'client', 'dist');
  
  if (fs.existsSync(distPath)) {
    console.log('✅ Serving static files from:', distPath);
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('⚠️ No dist folder - API only mode');
    app.get('*', (req, res) => {
      res.json({ 
        message: 'ScheduleSync API',
        status: 'running',
        version: '1.0.0'
      });
    });
  }
}

// ============ ERROR HANDLING ============

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: CONFIG.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============ START SERVER ============

const server = app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('🚀 ScheduleSync Server Started');
  console.log('='.repeat(50));
  console.log(`📍 Port: ${CONFIG.PORT}`);
  console.log(`🌍 Environment: ${CONFIG.NODE_ENV}`);
  console.log(`🔗 URL: ${CONFIG.APP_URL}`);
  console.log('='.repeat(50));
});

// Graceful shutdown
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
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});