const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { google } = require('googleapis');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../services/email');

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
        `INSERT INTO users (email, name, google_id, google_access_token, google_refresh_token, provider)
         VALUES ($1, $2, $3, $4, $5, 'google')
         RETURNING *`,
        [data.email, data.name, data.id, tokens.access_token, tokens.refresh_token]
      );
      user = insertResult.rows[0];
      console.log('New user created:', user.email);
    } else {
      // Update existing user tokens
      await client.query(
        `UPDATE users
         SET google_access_token = $1, google_refresh_token = $2, name = $3
         WHERE id = $4`,
        [tokens.access_token, tokens.refresh_token, data.name, userResult.rows[0].id]
      );
      user = userResult.rows[0];
      console.log('Existing user logged in:', user.email);
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
        name: user.name || data.name
      }
    });

  } catch (error) {
    console.error('Google auth error:', error);
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
  try {
    const result = await pool.query(
      `SELECT id, email, name, subscription_tier, calendar_sync_enabled,
              onboarding_completed, is_admin
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ============ EMAIL/PASSWORD AUTHENTICATION ============

// POST /api/auth/register - Register with email/password
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    console.log('Registration attempt:', email);

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, provider, email_verified, reset_token, reset_token_expires)
       VALUES ($1, $2, $3, 'email', false, $4, $5) RETURNING id, email, name`,
      [email.toLowerCase(), name, passwordHash, verificationToken, verificationExpires]
    );

    const user = result.rows[0];

    // Send verification email
    try {
      const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      await sendEmail(email, 'Verify Your Email - ScheduleSync', `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Welcome to ScheduleSync!</h2>
          <p>Hi ${name},</p>
          <p>Please verify your email address by clicking the button below:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
          </p>
          <p style="font-size: 12px; color: #666;">Or copy this link: ${verifyUrl}</p>
          <p>This link expires in 24 hours.</p>
        </div>
      `);
      console.log('Verification email sent to:', email);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, verified: false },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('User registered:', user.email);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, emailVerified: false },
      token,
      message: 'Registration successful! Please check your email to verify your account.'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /api/auth/verify-email - Verify email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    console.log('Email verification attempt');

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    // Find user with valid token
    const result = await pool.query(
      `SELECT * FROM users
       WHERE reset_token = $1
       AND reset_token_expires > NOW()
       AND email_verified = false`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const user = result.rows[0];

    // Mark email as verified
    await pool.query(
      `UPDATE users
       SET email_verified = true,
           reset_token = NULL,
           reset_token_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    console.log('Email verified for:', user.email);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// POST /api/auth/resend-verification - Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('Resending verification email to:', email);

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND email_verified = false',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If that email exists and is unverified, we sent a new verification link.'
      });
    }

    const user = result.rows[0];

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
      [verificationToken, verificationExpires, user.id]
    );

    // Send verification email
    try {
      const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      await sendEmail(email, 'Verify Your Email - ScheduleSync', `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Verify Your Email</h2>
          <p>Hi ${user.name},</p>
          <p>Please verify your email address by clicking the button below:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
          </p>
          <p>This link expires in 24 hours.</p>
        </div>
      `);
      console.log('Verification email resent to:', email);
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
    }

    res.json({
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// POST /api/auth/login - Login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    console.log('Login attempt:', email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user has password (might be OAuth-only)
    if (!user.password_hash) {
      return res.status(401).json({
        error: 'This account uses Google login. Please sign in with Google.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token (longer expiry if "remember me")
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: rememberMe ? '90d' : '30d' }
    );

    console.log('Login successful:', user.email);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        calendar_sync_enabled: user.calendar_sync_enabled
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Password reset request for:', email);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    // Security: Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      console.log('Reset requested for non-existent email:', email);
      return res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent.'
      });
    }

    const user = result.rows[0];

    // OAuth User - Send reminder
    if (!user.password_hash) {
      console.log('OAuth account detected, sending reminder to:', email);

      try {
        await sendEmail(email, 'Sign in method reminder - ScheduleSync', `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Sign in with Google</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>You requested a password reset, but your account was created using <strong>Google Login</strong>.</p>
            <p>You don't need a password! Simply sign in with Google:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/login" style="background: #4285F4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign in with Google</a>
            </p>
          </div>
        `);
      } catch (emailError) {
        console.error('Failed to send OAuth reminder:', emailError);
      }

      return res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent.'
      });
    }

    // Standard User - Send reset link
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token to DB
    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
      [resetToken, resetTokenExpires, user.id]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
      await sendEmail(email, 'Reset Your Password - ScheduleSync', `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Reset Your Password</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>You requested a password reset. Click the button below to choose a new password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
          </p>
          <p style="font-size: 12px; color: #666;">Or copy this link: ${resetUrl}</p>
          <p>This link expires in 1 hour.</p>
        </div>
      `);
      console.log('Reset email sent to:', email);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
    }

    res.json({
      success: true,
      message: 'If that email exists, a reset link has been sent.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find user with valid token
    const result = await pool.query(
      `SELECT * FROM users
       WHERE reset_token = $1
       AND reset_token_expires > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = result.rows[0];

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Update password and clear reset token
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           reset_token = NULL,
           reset_token_expires = NULL,
           email_verified = true
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    console.log('Password reset successful for:', user.email);

    res.json({
      success: true,
      message: 'Password reset successful! You can now log in.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET /api/auth/check-username/:username - Check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Validate username format (lowercase letters, numbers, hyphens only)
    if (!/^[a-z0-9-]+$/.test(username)) {
      return res.json({
        available: false,
        message: 'Use lowercase letters, numbers, and hyphens only'
      });
    }

    // Check minimum length
    if (username.length < 3) {
      return res.json({
        available: false,
        message: 'Username must be at least 3 characters'
      });
    }

    // Check if username exists
    const result = await pool.query(
      'SELECT 1 FROM users WHERE username = $1 LIMIT 1',
      [username]
    );

    const available = result.rows.length === 0;

    // Generate suggestions if taken
    const suggestions = available ? [] : [
      `${username}-${Math.floor(Math.random() * 1000)}`,
      `${username}-cal`,
      `${username}-${new Date().getFullYear()}`
    ];

    res.json({
      available,
      message: available ? 'Available!' : 'This username is already taken',
      suggestions
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/create-test-user - Create test user (dev only)
router.get('/create-test-user', async (req, res) => {
  try {
    const testEmail = 'test@schedulesync.com';
    const testPassword = 'test1234';
    const testName = 'Test User';

    console.log('Creating test user...');

    // Check if test user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail]);

    if (existingUser.rows.length > 0) {
      console.log('Test user already exists');

      const user = existingUser.rows[0];
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        message: 'Test user already exists',
        user: { id: user.id, email: user.email, name: user.name },
        token,
        credentials: { email: testEmail, password: testPassword }
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(testPassword, salt);

    // Create test user with email already verified
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, provider, email_verified)
       VALUES ($1, $2, $3, 'email', true) RETURNING id, email, name`,
      [testEmail, testName, passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('Test user created:', user.email);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token,
      credentials: { email: testEmail, password: testPassword },
      message: 'Test user created successfully!'
    });

  } catch (error) {
    console.error('Create test user error:', error);
    res.status(500).json({ error: 'Failed to create test user' });
  }
});

module.exports = router;
