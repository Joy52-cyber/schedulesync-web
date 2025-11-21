const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Google OAuth configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.FRONTEND_URL}/oauth/callback`
);

// GET /api/auth/google/url - Get Google OAuth URL
router.get('/google/url', (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar'
      ],
      prompt: 'consent'
    });
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// POST /api/auth/google - Handle Google OAuth login
router.post('/google', async (req, res) => {
  const client = await pool.connect();
  try {
    const { code } = req.body;

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Check if user exists
    let userResult = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [data.email]
    );

    let user;
    if (userResult.rows.length === 0) {
      // Create new user
      const insertResult = await client.query(
        `INSERT INTO users (email, name, google_id, google_access_token, google_refresh_token, profile_picture)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [data.email, data.name, data.id, tokens.access_token, tokens.refresh_token, data.picture]
      );
      user = insertResult.rows[0];
      console.log('✅ New user created:', user.email);
    } else {
      // Update existing user tokens
      await client.query(
        `UPDATE users 
         SET google_access_token = $1, google_refresh_token = $2, profile_picture = $3, name = $4
         WHERE id = $5`,
        [tokens.access_token, tokens.refresh_token, data.picture, data.name, userResult.rows[0].id]
      );
      user = userResult.rows[0];
      console.log('✅ Existing user logged in:', user.email);
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || data.name,
        picture: user.profile_picture || data.picture
      }
    });

  } catch (error) {
    console.error('❌ Google auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  } finally {
    client.release();
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, email, name, profile_picture FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  } finally {
    client.release();
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;