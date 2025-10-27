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
        role VARCHAR(50) DEFAULT 'member',
        booking_token VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        attendee_name VARCHAR(255),
        attendee_email VARCHAR(255),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        booking_token VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_team ON bookings(team_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
      CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

initDB();

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
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
       access_token = $5, refresh_token = $6
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
       access_token = $5, refresh_token = $6
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

// ============ CALENDAR ROUTES ============

// Get calendar events
app.get('/api/calendar/events', authenticate, async (req, res) => {
  try {
    const events = [];

    // Fetch Google Calendar events
    if (req.user.provider === 'google' && req.user.access_token) {
      try {
        const response = await axios.get(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            headers: { Authorization: `Bearer ${req.user.access_token}` },
            params: {
              timeMin: new Date().toISOString(),
              maxResults: 10,
              singleEvents: true,
              orderBy: 'startTime'
            }
          }
        );
        events.push(...response.data.items.map(event => ({ ...event, provider: 'google' })));
      } catch (error) {
        console.error('Google Calendar error:', error.response?.data || error.message);
      }
    }

    // Fetch Microsoft Calendar events
    if (req.user.provider === 'microsoft' && req.user.access_token) {
      try {
        const response = await axios.get(
          'https://graph.microsoft.com/v1.0/me/calendar/events',
          {
            headers: { Authorization: `Bearer ${req.user.access_token}` },
            params: {
              $top: 10,
              $orderby: 'start/dateTime'
            }
          }
        );
        events.push(...response.data.value.map(event => ({ ...event, provider: 'microsoft' })));
      } catch (error) {
        console.error('Microsoft Calendar error:', error.response?.data || error.message);
      }
    }

    res.json({ events });
  } catch (error) {
    console.error('Calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// ============ TEAM ROUTES ============

// Get all teams
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

// Get team members
app.get('/api/teams/:id/members', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT tm.*, u.email as user_email, u.name as user_name
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1`,
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

    // Add member to team
   
    const { sendTeamInvitation } = require('./utils/email');

// ... other code ...

// Add team member
app.post('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { email, sendEmail = true } = req.body;

  try {
    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to manage this team' });
    }

    const team = teamCheck.rows[0];

    // Check if user exists
    let userId = null;
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
    }

    // Generate unique booking token
    const bookingToken = require('crypto').randomBytes(16).toString('hex');

    // Add team member
    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id, email, booking_token, invited_by) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [teamId, userId, email, bookingToken, req.user.id]
    );

    const member = result.rows[0];
    const bookingUrl = `${process.env.APP_URL || 'http://localhost:3000'}/book/${bookingToken}`;

    // Send invitation email
    if (sendEmail) {
      try {
        const inviterName = req.user.name || req.user.email;
        await sendTeamInvitation(email, team.name, bookingUrl, inviterName);
        console.log(`✅ Invitation email sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({ 
      member,
      bookingUrl,
      message: sendEmail ? 'Member added and invitation email sent' : 'Member added'
    });
    
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});
// ============ BOOKING ROUTES ============

// Get all bookings
app.get('/api/bookings', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, t.name as team_name
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       WHERE t.owner_id = $1 OR b.user_id = $1
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
    console.error('Get booking by token error:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

// Create booking (public)
app.post('/api/bookings', async (req, res) => {
  try {
    const { token, slot, attendee_name, attendee_email, notes } = req.body;

    // Get team member info
    const memberResult = await pool.query(
      'SELECT * FROM team_members WHERE booking_token = $1',
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    // Create booking
    const result = await pool.query(
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

    // TODO: Send confirmation email
    // TODO: Create calendar event

    res.json({ booking: result.rows[0] });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Suggest time slots (AI-powered)
app.post('/api/suggest-slots', async (req, res) => {
  try {
    const { teamId, duration = 60 } = req.body;

    // Get team members
    const membersResult = await pool.query(
      `SELECT u.* FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1`,
      [teamId]
    );

    // Simple slot generation (9 AM - 5 PM for next 7 days)
    const slots = [];
    const now = new Date();
    
    for (let day = 1; day <= 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      
      for (let hour = 9; hour < 17; hour++) {
        const start = new Date(date);
        start.setHours(hour, 0, 0, 0);
        
        const end = new Date(start);
        end.setMinutes(start.getMinutes() + duration);
        
        slots.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }

    res.json({ slots: slots.slice(0, 20) }); // Return first 20 slots
  } catch (error) {
    console.error('Suggest slots error:', error);
    res.status(500).json({ error: 'Failed to suggest time slots' });
  }
});

// ============ ANALYTICS ROUTES ============

// Get analytics
app.get('/api/analytics', authenticate, async (req, res) => {
  try {
    const bookingsResult = await pool.query(
      `SELECT COUNT(*) as total,
       COUNT(*) FILTER (WHERE start_time > NOW()) as upcoming
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       WHERE t.owner_id = $1`,
      [req.user.id]
    );

    const teamsResult = await pool.query(
      'SELECT COUNT(*) as total FROM teams WHERE owner_id = $1',
      [req.user.id]
    );

    res.json({
      totalBookings: parseInt(bookingsResult.rows[0].total),
      upcomingBookings: parseInt(bookingsResult.rows[0].upcoming),
      totalTeams: parseInt(teamsResult.rows[0].total)
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============ SERVE STATIC FILES (PRODUCTION) ============

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
  });
}


// Start server
const port = process.env.PORT || 3000;
const host = '0.0.0.0'; // IMPORTANT: Must bind to 0.0.0.0 in Railway

app.listen(port, host, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Host: ${host}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});