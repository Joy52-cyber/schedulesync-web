const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Track processed OAuth codes to prevent duplicate processing
const processedOAuthCodes = new Map();

// Clean up old processed codes every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [code, timestamp] of processedOAuthCodes.entries()) {
    if (timestamp < fiveMinutesAgo) {
      processedOAuthCodes.delete(code);
    }
  }
}, 5 * 60 * 1000);

// Microsoft OAuth configuration
const MICROSOFT_CONFIG = {
  clientId: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.FRONTEND_URL}/oauth/callback/microsoft`,
  scopes: [
    'openid',
    'profile',
    'email',
    'offline_access',
    'Calendars.ReadWrite',
    'OnlineMeetings.ReadWrite'
  ]
};

// GET /api/calendar/status - Check calendar connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT calendar_sync_enabled, provider, email,
              google_access_token, google_refresh_token,
              microsoft_access_token, microsoft_refresh_token
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const hasGoogleCalendar = !!(user.google_access_token && user.google_refresh_token);
    const hasMicrosoftCalendar = !!(user.microsoft_access_token && user.microsoft_refresh_token);

    res.json({
      connected: hasGoogleCalendar || hasMicrosoftCalendar,
      google: {
        connected: hasGoogleCalendar,
        email: hasGoogleCalendar ? user.email : null,
        last_sync: null
      },
      microsoft: {
        connected: hasMicrosoftCalendar,
        email: hasMicrosoftCalendar ? user.email : null,
        last_sync: null
      }
    });
  } catch (error) {
    console.error('Calendar status error:', error);
    res.status(500).json({ error: 'Failed to get calendar status' });
  }
});

// GET /api/auth/google/url - Generate Google OAuth URL
router.get('/google/url', (req, res) => {
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

    console.log('Generated Google OAuth URL');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// POST /api/auth/google/callback - Handle Google OAuth callback
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    console.log('Google OAuth callback received');

    if (!code) {
      console.error('No code provided');
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Check if code was already processed
    if (processedOAuthCodes.has(code)) {
      console.log('Code already processed, rejecting duplicate request');
      return res.status(400).json({
        error: 'Code already used',
        hint: 'This authorization code has already been exchanged. Please try logging in again.'
      });
    }

    // Mark code as being processed
    processedOAuthCodes.set(code, Date.now());
    console.log('Code locked for processing');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/oauth/callback`
    );

    console.log('Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('Tokens received');

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    console.log('User info retrieved:', userInfo.email);

    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userInfo.email]);

    let user;
    if (userResult.rows.length === 0) {
      console.log('Creating new user');
      const insertResult = await pool.query(
        `INSERT INTO users (google_id, email, name, google_access_token, google_refresh_token, calendar_sync_enabled, provider)
         VALUES ($1, $2, $3, $4, $5, true, 'google') RETURNING *`,
        [userInfo.id, userInfo.email, userInfo.name, tokens.access_token, tokens.refresh_token]
      );
      user = insertResult.rows[0];
    } else {
      console.log('Updating existing user');
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

    console.log('Google OAuth successful for:', user.email);

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
    console.error('Google OAuth error:', error.message);

    // Remove code from processed map on error so user can retry
    if (req.body.code) {
      processedOAuthCodes.delete(req.body.code);
      console.log('Code unlocked for retry');
    }

    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /api/auth/microsoft/url - Generate Microsoft OAuth URL
router.get('/microsoft/url', (req, res) => {
  try {
    if (!process.env.MICROSOFT_CLIENT_ID) {
      console.error('MICROSOFT_CLIENT_ID not configured');
      return res.status(503).json({
        error: 'Microsoft login not configured',
        message: 'Please contact support to enable Microsoft login'
      });
    }

    const redirectUri = process.env.MICROSOFT_REDIRECT_URI ||
      `${process.env.FRONTEND_URL}/oauth/callback/microsoft`;

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${process.env.MICROSOFT_CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(MICROSOFT_CONFIG.scopes.join(' '))}` +
      `&prompt=select_account`;

    console.log('Generated Microsoft OAuth URL');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating Microsoft OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// POST /api/auth/microsoft/callback - Handle Microsoft OAuth callback
router.post('/microsoft/callback', async (req, res) => {
  try {
    const { code } = req.body;

    console.log('Microsoft OAuth callback received');

    if (!code) {
      console.error('No authorization code provided');
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Check if code was already processed
    if (processedOAuthCodes.has(code)) {
      console.log('Code already processed, rejecting duplicate request');
      return res.status(400).json({
        error: 'Code already used',
        hint: 'This authorization code has already been exchanged. Please try logging in again.'
      });
    }

    // Mark code as being processed
    processedOAuthCodes.set(code, Date.now());
    console.log('Code locked for processing');

    const redirectUri = process.env.MICROSOFT_REDIRECT_URI ||
      `${process.env.FRONTEND_URL}/oauth/callback/microsoft`;

    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    console.log('Tokens received');
    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    console.log('Getting Microsoft user info...');
    const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const microsoftUser = userResponse.data;
    const email = microsoftUser.mail || microsoftUser.userPrincipalName;
    const microsoftId = microsoftUser.id;

    console.log('User info retrieved:', email);

    // Check if user exists
    let user = await pool.query(
      'SELECT * FROM users WHERE microsoft_id = $1 OR email = $2',
      [microsoftId, email]
    );

    if (user.rows.length === 0) {
      // NEW USER - First login
      console.log('Creating new Microsoft user');
      user = await pool.query(
        `INSERT INTO users (
          email, name, microsoft_id, microsoft_access_token,
          microsoft_refresh_token, provider, onboarding_completed, calendar_sync_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          email,
          microsoftUser.displayName,
          microsoftId,
          access_token,
          refresh_token,
          'microsoft',
          false,
          true
        ]
      );
      console.log('New user created:', user.rows[0].id);
    } else {
      // EXISTING USER - Second+ login
      console.log('Updating existing Microsoft user');
      user = await pool.query(
        `UPDATE users SET
          microsoft_id = $1,
          microsoft_access_token = $2,
          microsoft_refresh_token = $3,
          provider = $4,
          calendar_sync_enabled = true
        WHERE id = $5 RETURNING *`,
        [microsoftId, access_token, refresh_token, 'microsoft', user.rows[0].id]
      );
      console.log('User updated:', user.rows[0].id);
    }

    // Link any pending team memberships
    await pool.query(
      'UPDATE team_members SET user_id = $1 WHERE email = $2 AND user_id IS NULL',
      [user.rows[0].id, email]
    );

    const finalUser = user.rows[0];

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: finalUser.id, email: finalUser.email, name: finalUser.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('Microsoft OAuth successful for:', email);

    res.json({
      success: true,
      user: {
        id: finalUser.id,
        email: finalUser.email,
        name: finalUser.name,
        calendar_sync_enabled: finalUser.calendar_sync_enabled,
        onboarding_completed: finalUser.onboarding_completed || false
      },
      token: jwtToken,
    });

  } catch (error) {
    console.error('Microsoft OAuth error:', error.message);

    // Remove code from processed map on error so user can retry
    if (req.body.code) {
      processedOAuthCodes.delete(req.body.code);
      console.log('Code unlocked for retry');
    }

    res.status(500).json({
      error: 'Microsoft OAuth failed',
      message: error.response?.data?.error_description || error.message,
      details: error.response?.data
    });
  }
});

module.exports = router;
