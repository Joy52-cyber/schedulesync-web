require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const axios = require('axios');
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
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

// ============ AUTH ROUTES ============

// Google OAuth callback
app.post('/api/auth/google', async (req, res) => {
  try {
    const { code } = req.body;

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
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
    
    const result = await pool.query(
      `SELECT tm.*, u.email as user_email, u.name as user_name
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.added_at DESC`,
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

    const bookingUrl = `${process.env.FRONTEND_URL}/book/${bookingToken}`;

    // Send invitation email if requested
    if (sendEmail) {
      // Here you would integrate with your email service
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
    
    // Find team member by booking token
    const memberResult = await pool.query(
      'SELECT * FROM team_members WHERE booking_token = $1',
      [bookingToken]
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }
    
    const teamId = memberResult.rows[0].team_id;
    
    // Create booking
    const result = await pool.query(
      `INSERT INTO bookings (team_id, guest_name, guest_email, event_title, event_date, event_time, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [teamId, guestName, guestEmail, eventTitle, eventDate, eventTime, notes, 'confirmed']
    );
    
    res.json({ booking: result.rows[0], message: 'Booking created successfully' });
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