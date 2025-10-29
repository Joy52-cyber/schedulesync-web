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
const PORT = process.env.PORT || 3000;

// Define the redirect URI consistently
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://schedulesync-web.onrender.com/api/auth/google/callback'
    : 'http://localhost:3000/api/auth/google/callback');

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://schedulesync-web.onrender.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database
async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Create users table with additional fields for token management
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        google_id VARCHAR(255) UNIQUE,
        refresh_token TEXT,
        access_token TEXT,
        token_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add new columns if they don't exist
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='access_token') THEN
          ALTER TABLE users ADD COLUMN access_token TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='token_expiry') THEN
          ALTER TABLE users ADD COLUMN token_expiry TIMESTAMP;
        END IF;
      END $$;
    `);

    // Create teams table with owner_id
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create team_members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id, user_id)
      )
    `);

    // Create bookings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create booking_participants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_participants (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        UNIQUE(booking_id, user_id)
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Initialize database on startup
initializeDatabase();

// Helper function to create OAuth2 client
function createOAuth2Client(tokens = null) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
  
  if (tokens) {
    oauth2Client.setCredentials(tokens);
  }
  
  return oauth2Client;
}

// Helper function to refresh access token if needed
async function refreshAccessToken(userId) {
  try {
    const user = await pool.query(
      'SELECT refresh_token, access_token, token_expiry FROM users WHERE id = $1',
      [userId]
    );

    if (!user.rows[0]?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const oauth2Client = createOAuth2Client();
    
    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: user.rows[0].refresh_token
    });

    // Get new access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update tokens in database
    const expiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
    await pool.query(
      'UPDATE users SET access_token = $1, token_expiry = $2 WHERE id = $3',
      [credentials.access_token, expiry, userId]
    );

    return credentials;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Google OAuth routes
app.post('/api/auth/google', async (req, res) => {
  const { code, redirectUri } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // Use the consistent redirect URI, but allow override from client if needed
    const effectiveRedirectUri = redirectUri || REDIRECT_URI;
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      effectiveRedirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Calculate token expiry
    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    // Store or update user in database
    let user;
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [data.email]
    );

    if (existingUser.rows.length > 0) {
      // Update existing user with all token information
      user = await pool.query(
        `UPDATE users 
         SET google_id = $1, 
             refresh_token = COALESCE($2, refresh_token), 
             access_token = $3,
             token_expiry = $4,
             name = $5 
         WHERE email = $6 
         RETURNING *`,
        [
          data.id, 
          tokens.refresh_token, // Only update if we got a new refresh token
          tokens.access_token,
          tokenExpiry,
          data.name, 
          data.email
        ]
      );
      user = user.rows[0];
    } else {
      // Create new user
      const newUser = await pool.query(
        `INSERT INTO users (email, name, google_id, refresh_token, access_token, token_expiry) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [data.email, data.name, data.id, tokens.refresh_token, tokens.access_token, tokenExpiry]
      );
      user = newUser.rows[0];
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        name: user.name 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed', 
      details: error.message,
      // Include more specific error info in development
      ...(process.env.NODE_ENV === 'development' && { 
        errorCode: error.code,
        errorDetails: error.response?.data 
      })
    });
  }
});

// User routes
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Google Calendar routes
app.get('/api/calendar/events', authenticateToken, async (req, res) => {
  try {
    // Get user tokens
    const user = await pool.query(
      'SELECT refresh_token, access_token, token_expiry FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user.rows[0]?.refresh_token) {
      return res.status(401).json({ error: 'Calendar not connected. Please reconnect your Google account.' });
    }

    // Check if access token is expired
    const now = new Date();
    const tokenExpiry = user.rows[0].token_expiry ? new Date(user.rows[0].token_expiry) : null;
    
    let credentials;
    if (!tokenExpiry || tokenExpiry <= now) {
      // Refresh the access token
      credentials = await refreshAccessToken(req.user.id);
    } else {
      // Use existing tokens
      credentials = {
        access_token: user.rows[0].access_token,
        refresh_token: user.rows[0].refresh_token
      };
    }

    // Create OAuth client with valid tokens
    const oauth2Client = createOAuth2Client(credentials);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json(response.data.items || []);
  } catch (error) {
    console.error('Calendar fetch error:', error);
    
    // If it's an auth error, suggest reconnecting
    if (error.message?.includes('invalid_grant') || error.code === 401) {
      return res.status(401).json({ 
        error: 'Calendar authentication expired. Please reconnect your Google account.',
        code: 'AUTH_EXPIRED'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch calendar events',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add a route to disconnect/reconnect Google account
app.post('/api/auth/google/disconnect', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET refresh_token = NULL, access_token = NULL, token_expiry = NULL WHERE id = $1',
      [req.user.id]
    );
    res.json({ message: 'Google account disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Google account:', error);
    res.status(500).json({ error: 'Failed to disconnect Google account' });
  }
});

// Team routes
app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const teams = await pool.query(`
      SELECT DISTINCT t.*, 
        CASE 
          WHEN t.owner_id = $1 THEN 'owner'
          ELSE tm.role 
        END as user_role
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $1
      WHERE t.owner_id = $1 OR tm.user_id = $1
      ORDER BY t.created_at DESC
    `, [req.user.id]);
    
    res.json(teams.rows);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.get('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has access to this team
    const access = await pool.query(`
      SELECT t.*, 
        CASE 
          WHEN t.owner_id = $1 THEN 'owner'
          ELSE tm.role 
        END as user_role
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $1
      WHERE t.id = $2 AND (t.owner_id = $1 OR tm.user_id = $1)
    `, [req.user.id, id]);
    
    if (access.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found or access denied' });
    }
    
    // Get team members
    const members = await pool.query(`
      SELECT u.id, u.email, u.name, 
        CASE 
          WHEN t.owner_id = u.id THEN 'owner'
          ELSE COALESCE(tm.role, 'member')
        END as role,
        COALESCE(tm.joined_at, t.created_at) as joined_at
      FROM teams t
      INNER JOIN users u ON t.owner_id = u.id
      LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = u.id
      WHERE t.id = $1
      UNION
      SELECT u.id, u.email, u.name, tm.role, tm.joined_at
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1 AND tm.user_id != (SELECT owner_id FROM teams WHERE id = $1)
      ORDER BY role DESC, joined_at ASC
    `, [id]);
    
    res.json({
      ...access.rows[0],
      members: members.rows
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

app.post('/api/teams', authenticateToken, async (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }
  
  try {
    const newTeam = await pool.query(
      'INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING *',
      [name, req.user.id]
    );
    
    res.status(201).json(newTeam.rows[0]);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

app.post('/api/teams/:id/invite', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  try {
    // Check if user is owner
    const team = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    
    if (team.rows.length === 0) {
      return res.status(403).json({ error: 'Only team owners can send invitations' });
    }
    
    // Check if user exists
    let invitedUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (invitedUser.rows.length === 0) {
      // Create placeholder user
      invitedUser = await pool.query(
        'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
        [email, email.split('@')[0]]
      );
    }
    
    // Check if already a member
    const existingMember = await pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [id, invitedUser.rows[0].id]
    );
    
    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a team member' });
    }
    
    // Add to team
    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [id, invitedUser.rows[0].id, 'member']
    );
    
    // Generate booking URL for the team
    const baseUrl = process.env.FRONTEND_URL || 'https://schedulesync-web.onrender.com';
    const bookingUrl = `${baseUrl}/book/${team.rows[0].name.toLowerCase().replace(/\s+/g, '-')}`;
    
    // Send invitation email with correct parameters
    await sendTeamInvitation(
      email, 
      team.rows[0].name, 
      bookingUrl, 
      req.user.name
    );
    
    res.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Booking routes
app.get('/api/teams/:teamId/bookings', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  
  try {
    // Check if user has access to this team
    const access = await pool.query(`
      SELECT 1 FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE t.id = $1 AND (t.owner_id = $2 OR tm.user_id = $2)
    `, [teamId, req.user.id]);
    
    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const bookings = await pool.query(`
      SELECT b.*, u.name as creator_name, u.email as creator_email
      FROM bookings b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.team_id = $1
      ORDER BY b.start_time ASC
    `, [teamId]);
    
    res.json(bookings.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

app.post('/api/teams/:teamId/bookings', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { title, description, start_time, end_time, participants } = req.body;
  
  if (!title || !start_time || !end_time) {
    return res.status(400).json({ error: 'Title, start time, and end time are required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user has access to this team
    const access = await client.query(`
      SELECT 1 FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE t.id = $1 AND (t.owner_id = $2 OR tm.user_id = $2)
    `, [teamId, req.user.id]);
    
    if (access.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get team name for the booking confirmation
    const teamData = await client.query(
      'SELECT name FROM teams WHERE id = $1',
      [teamId]
    );
    
    // Create booking
    const booking = await client.query(
      `INSERT INTO bookings (team_id, title, description, start_time, end_time, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [teamId, title, description, start_time, end_time, req.user.id]
    );
    
    // Add participants if provided
    if (participants && participants.length > 0) {
      for (const userId of participants) {
        await client.query(
          'INSERT INTO booking_participants (booking_id, user_id) VALUES ($1, $2)',
          [booking.rows[0].id, userId]
        );
      }
      
      // Send confirmation emails
      const users = await client.query(
        'SELECT email, name FROM users WHERE id = ANY($1)',
        [participants]
      );
      
      // Format date and time for the email
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);
      
      const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };
      
      const formatTime = (startDate, endDate) => {
        const startTime = startDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const endTime = endDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return `${startTime} - ${endTime}`;
      };
      
      // Send email to each participant with correct parameters
      for (const user of users.rows) {
        const bookingDetails = {
          teamName: teamData.rows[0].name,
          memberName: req.user.name,
          date: formatDate(startDate),
          time: formatTime(startDate, endDate)
        };
        
        await sendBookingConfirmation(user.email, bookingDetails);
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(booking.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

app.put('/api/bookings/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, start_time, end_time } = req.body;
  
  try {
    // Check if user created this booking
    const booking = await pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND created_by = $2',
      [id, req.user.id]
    );
    
    if (booking.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updated = await pool.query(
      `UPDATE bookings 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           start_time = COALESCE($3, start_time),
           end_time = COALESCE($4, end_time)
       WHERE id = $5
       RETURNING *`,
      [title, description, start_time, end_time, id]
    );
    
    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

app.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if user created this booking or is team owner
    const result = await pool.query(
      `DELETE FROM bookings 
       WHERE id = $1 AND (
         created_by = $2 OR 
         team_id IN (SELECT id FROM teams WHERE owner_id = $2)
       )
       RETURNING *`,
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Debug route for checking OAuth configuration (only in development)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/oauth-config', (req, res) => {
    res.json({
      clientIdSet: !!process.env.GOOGLE_CLIENT_ID,
      clientSecretSet: !!process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      environment: process.env.NODE_ENV || 'not set'
    });
  });
}

// ============ SERVE STATIC FILES (PRODUCTION) ============

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'client', 'dist');
  
  // Check if dist folder exists
  if (fs.existsSync(distPath)) {
    console.log('✅ Serving static files from:', distPath);
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('⚠️ No dist folder found - API only mode');
    app.get('*', (req, res) => {
      res.json({ 
        message: 'ScheduleSync API is running',
        status: 'ok',
        note: 'Frontend not built - deploy with build command'
      });
    });
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Redirect URI: ${REDIRECT_URI}`);
});