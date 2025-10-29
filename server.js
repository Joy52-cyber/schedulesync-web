require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { google } = require('googleapis');
const path = require('path');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Database connected successfully');
    release();
  }
});

// Initialize database tables
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        provider VARCHAR(50) NOT NULL,
        provider_id VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        booking_token VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        guest_name VARCHAR(255) NOT NULL,
        guest_email VARCHAR(255) NOT NULL,
        event_title VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL,
        event_time TIME NOT NULL,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

initDB();

// ============ MIDDLEWARE ============

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============ HELPER FUNCTIONS ============

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '30d'
  });
};

// Generate random booking token
const generateBookingToken = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Conditional email utilities import
let sendTeamInvitation, sendBookingConfirmation;
try {
  const emailUtils = require('./utils/email');
  sendTeamInvitation = emailUtils.sendTeamInvitation;
  sendBookingConfirmation = emailUtils.sendBookingConfirmation;
  console.log('Email utilities loaded successfully');
} catch (error) {
  console.log('Email utilities not available - emails will not be sent');
}

// ============ AUTH ROUTES ============

// Google OAuth callback
const { google } = require('googleapis');

app.post('/api/auth/google', async (req, res) => {
  const { code } = req.body;

  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('🔑 Received tokens:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token
    });

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    console.log('👤 User data:', data.email);

    // Check if user exists
    let userResult = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [data.id]
    );

    let user;
    if (userResult.rows.length === 0) {
      // Create new user with calendar tokens
      const result = await pool.query(
        `INSERT INTO users (google_id, email, name, google_access_token, google_refresh_token, calendar_sync_enabled)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [data.id, data.email, data.name, tokens.access_token, tokens.refresh_token, true]
      );
      user = result.rows[0];
      console.log('✅ New user created with calendar access');
    } else {
      // Update existing user with new tokens
      const result = await pool.query(
        `UPDATE users 
         SET google_access_token = $1, 
             google_refresh_token = $2,
             calendar_sync_enabled = $3,
             name = $4
         WHERE google_id = $5
         RETURNING *`,
        [tokens.access_token, tokens.refresh_token, true, data.name, data.id]
      );
      user = result.rows[0];
      console.log('✅ Existing user updated with calendar access');
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        calendarSyncEnabled: user.calendar_sync_enabled
      }
    });

  } catch (error) {
    console.error('❌ Google OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

    const { email, name, id: provider_id } = userResponse.data;

    // Upsert user
    const result = await pool.query(
      `INSERT INTO users (email, name, provider, provider_id, access_token, refresh_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
       access_token = $5, refresh_token = $6, name = $2
       RETURNING *`,
      [email, name, 'google', provider_id, access_token, refresh_token]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Microsoft OAuth callback
app.post('/api/auth/microsoft', async (req, res) => {
  try {
    const { code } = req.body;

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { mail, displayName, id: provider_id } = userResponse.data;

    // Upsert user
    const result = await pool.query(
      `INSERT INTO users (email, name, provider, provider_id, access_token, refresh_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
       access_token = $5, refresh_token = $6, name = $2
       RETURNING *`,
      [mail, displayName, 'microsoft', provider_id, access_token, refresh_token]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Microsoft auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, name: req.user.name } });
});

// ============ TEAM ROUTES ============

// Get all teams for user
app.get('/api/teams', authenticate, async (req, res) => {
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
app.post('/api/teams', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    
    const result = await pool.query(
      'INSERT INTO teams (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, req.user.id]
    );
    
    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Get single team
app.get('/api/teams/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
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

// Update team
app.put('/api/teams/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
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
app.delete('/api/teams/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM teams WHERE id = $1 AND owner_id = $2', [id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ============ TEAM MEMBER ROUTES ============

// Get team members
app.get('/api/teams/:id/members', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    
    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Get members with correct column name: created_at
    const result = await pool.query(
      `SELECT tm.*, u.email as user_email, u.name as user_name
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.created_at DESC`,
      [id]
    );
    
    res.json({ members: result.rows });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Add team member
app.post('/api/teams/:id/members', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, sendEmail } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    
    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const team = teamCheck.rows[0];

    // Check if user exists
    let user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    // If user doesn't exist, create a placeholder
    if (user.rows.length === 0) {
      user = await pool.query(
        'INSERT INTO users (email, provider, name) VALUES ($1, $2, $3) RETURNING *',
        [email, 'pending', email.split('@')[0]]
      );
    }

    const userId = user.rows[0].id;
    const bookingToken = generateBookingToken();

    // Check if member already exists
    const existingMember = await pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'Member already exists in team' });
    }

    // Add member to team
    const result = await pool.query(
      'INSERT INTO team_members (team_id, user_id, booking_token) VALUES ($1, $2, $3) RETURNING *',
      [id, userId, bookingToken]
    );

    // Generate booking URL
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const bookingUrl = `${baseUrl}/book/${bookingToken}`;

    // Send invitation email if requested and email utilities are available
    if (sendEmail && sendTeamInvitation && process.env.RESEND_API_KEY) {
      try {
        await sendTeamInvitation(
          email,
          team.name,
          bookingUrl,
          req.user.name || req.user.email
        );
        console.log(`Invitation email sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Don't fail the whole operation if email fails
      }
    } else if (sendEmail && !process.env.RESEND_API_KEY) {
      console.log(`Would send invitation email to ${email} with booking URL: ${bookingUrl}`);
    }

    res.json({ 
      member: result.rows[0], 
      bookingUrl,
      message: 'Member added successfully'
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove team member
app.delete('/api/teams/:teamId/members/:memberId', authenticate, async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    
    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, req.user.id]
    );
    
    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query('DELETE FROM team_members WHERE id = $1 AND team_id = $2', [memberId, teamId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// ============ BOOKING ROUTES ============

// Get bookings for a team
app.get('/api/teams/:id/bookings', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    
    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const result = await pool.query(
      'SELECT * FROM bookings WHERE team_id = $1 ORDER BY event_date DESC, event_time DESC',
      [id]
    );
    
    res.json({ bookings: result.rows });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get all bookings for authenticated user's teams
app.get('/api/bookings', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, t.name as team_name
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       WHERE t.owner_id = $1
       ORDER BY b.event_date DESC, b.event_time DESC`,
      [req.user.id]
    );
    
    res.json({ bookings: result.rows });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Create booking (public endpoint for guests)
app.post('/api/bookings', async (req, res) => {
  try {
    const { bookingToken, guestName, guestEmail, eventTitle, eventDate, eventTime, notes } = req.body;
    
    if (!bookingToken || !guestName || !guestEmail || !eventTitle || !eventDate || !eventTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find team member and team info by booking token
    const memberResult = await pool.query(
      `SELECT tm.*, t.name as team_name, u.name as member_name, u.email as member_email
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [bookingToken]
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }
    
    const { team_id: teamId, team_name: teamName, member_name: memberName } = memberResult.rows[0];
    
    // Create booking
    const result = await pool.query(
      `INSERT INTO bookings (team_id, guest_name, guest_email, event_title, event_date, event_time, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [teamId, guestName, guestEmail, eventTitle, eventDate, eventTime, notes, 'confirmed']
    );
    
    // Send confirmation email if available
    if (sendBookingConfirmation && process.env.RESEND_API_KEY) {
      try {
        await sendBookingConfirmation(guestEmail, {
          teamName,
          memberName: memberName || 'Team Member',
          date: new Date(eventDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          time: eventTime
        });
        console.log(`Booking confirmation email sent to ${guestEmail}`);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the booking if email fails
      }
    }
    
    res.json({ 
      booking: result.rows[0], 
      message: 'Booking created successfully'
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Update booking status
app.put('/api/bookings/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Verify ownership through team
    const ownershipCheck = await pool.query(
      `SELECT b.* FROM bookings b
       JOIN teams t ON b.team_id = t.id
       WHERE b.id = $1 AND t.owner_id = $2`,
      [id, req.user.id]
    );
    
    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    res.json({ booking: result.rows[0] });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Delete booking
app.delete('/api/bookings/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership through team
    const ownershipCheck = await pool.query(
      `SELECT b.* FROM bookings b
       JOIN teams t ON b.team_id = t.id
       WHERE b.id = $1 AND t.owner_id = $2`,
      [id, req.user.id]
    );
    
    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// ============ PUBLIC BOOKING PAGE ROUTES ============

// Get team member info by booking token (for public booking page)
app.get('/api/booking/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const result = await pool.query(
      `SELECT tm.booking_token, u.name as member_name, u.email as member_email, t.name as team_name
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.booking_token = $1`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking link' });
    }
    
    res.json({ bookingInfo: result.rows[0] });
  } catch (error) {
    console.error('Get booking info error:', error);
    res.status(500).json({ error: 'Failed to fetch booking information' });
  }
});

// ============ CALENDAR ROUTES ============

// Get user's Google Calendar events
app.get('/api/calendar/events', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!req.user.access_token) {
      return res.status(400).json({ error: 'No calendar access token available' });
    }
    
    // Fetch events from Google Calendar
    const response = await axios.get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: { Authorization: `Bearer ${req.user.access_token}` },
      params: {
        timeMin: startDate || new Date().toISOString(),
        timeMax: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      }
    });
    
    res.json({ events: response.data.items });
  } catch (error) {
    console.error('Get calendar events error:', error);
    
    // If token is expired, suggest re-authentication
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Calendar access token expired. Please re-authenticate.' });
    }
    
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// ============ CALENDAR INTEGRATION ROUTES ============

const { getAvailableSlots, createCalendarEvent, generateICSFile } = require('./utils/calendar');

// Get available time slots for a member (PUBLIC)
app.get('/api/book/:token/availability', async (req, res) => {
  try {
    const { token } = req.params;
    const { date } = req.query; // Format: YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    console.log(`📅 Fetching availability for token: ${token}, date: ${date}`);

    // Get team member info with calendar tokens
    const memberResult = await pool.query(
      `SELECT tm.*, u.google_access_token, u.google_refresh_token, u.calendar_sync_enabled, u.name as member_name
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    // Check if calendar sync is enabled
    if (!member.calendar_sync_enabled || !member.google_refresh_token) {
      console.log('⚠️ Calendar sync not enabled, returning generic slots');
      
      // Return generic time slots if no calendar access
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
      
      return res.json({ 
        slots: genericSlots, 
        calendarSyncEnabled: false,
        memberName: member.member_name || member.email
      });
    }

    // Fetch real availability from Google Calendar
    console.log('✅ Fetching real availability from Google Calendar');
    const slots = await getAvailableSlots(
      member.google_access_token,
      member.google_refresh_token,
      date,
      60 // 1 hour duration
    );

    res.json({ 
      slots, 
      calendarSyncEnabled: true,
      memberName: member.member_name || member.email
    });

  } catch (error) {
    console.error('❌ Get availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Update the existing POST /api/bookings endpoint to create calendar events
app.post('/api/bookings', async (req, res) => {
  try {
    const { token, slot, attendee_name, attendee_email, notes } = req.body;

    console.log('📝 Creating booking:', { token, attendee_name, attendee_email });

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

    // Create booking in database
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
    console.log('✅ Booking created in database:', booking.id);

    // Create Google Calendar event
    if (member.google_refresh_token) {
      try {
        console.log('📅 Creating Google Calendar event...');
        await createCalendarEvent(
          member.google_access_token,
          member.google_refresh_token,
          {
            summary: `Meeting with ${attendee_name}`,
            description: `Booked via ScheduleSync\n\nClient: ${attendee_name}\nEmail: ${attendee_email}\n\nNotes: ${notes || 'No notes provided'}`,
            start: slot.start,
            end: slot.end,
            attendees: [
              { email: attendee_email, displayName: attendee_name }
            ],
          }
        );
        console.log('✅ Calendar event created successfully');
      } catch (calError) {
        console.error('❌ Failed to create calendar event:', calError);
        // Don't fail the booking if calendar creation fails
      }
    }

    // Send confirmation emails
    const { sendBookingConfirmation } = require('./utils/email');
    
    try {
      console.log('📧 Sending confirmation email...');
      
      // Send to client
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
      
      console.log('✅ Confirmation email sent to client');
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError);
    }

    res.json({ 
      booking,
      message: 'Booking confirmed! Check your email for details.'
    });

  } catch (error) {
    console.error('❌ Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ============ STATIC FILE SERVING (for production) ============

if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, 'client/dist')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
  });
}

// ============ ERROR HANDLING ============

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============ SERVER STARTUP ============

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Host: ${HOST}`);
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

// ============ UNHANDLED REJECTIONS ============

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // In production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    server.close(() => {
      process.exit(1);
    });
  }
});

// Export for testing
module.exports = app;