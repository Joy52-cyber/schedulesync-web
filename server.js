// ============ STARTUP DEBUGGING ============
console.log('========================================');
console.log('🚀 SERVER STARTUP INITIATED');
console.log('Time:', new Date().toISOString());
console.log('Node Version:', process.version);
console.log('========================================');

// Log each require as it happens
console.log('Loading dotenv...');
require('dotenv').config();

console.log('Environment Variables Check:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('- GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || '❌ Missing');
console.log('- PORT:', process.env.PORT || '3000');
console.log('========================================');


// Catch any require errors
try {
  console.log('Loading express...');
  const express = require('express');
  console.log('✅ Express loaded');
} catch (e) {
  console.error('❌ Failed to load express:', e.message);
  process.exit(1);
}

try {
  console.log('Loading other dependencies...');
  const { Resend } = require('resend');
  console.log('✅ Resend loaded');
  const cors = require('cors');
  console.log('✅ CORS loaded');
  const { Pool } = require('pg');
  console.log('✅ PostgreSQL loaded');
  const jwt = require('jsonwebtoken');
  console.log('✅ JWT loaded');
  const { google } = require('googleapis');
  console.log('✅ Google APIs loaded');
  const crypto = require('crypto');
  console.log('✅ Crypto loaded');
} catch (e) {
  console.error('❌ Failed to load dependency:', e.message);
  process.exit(1);
}


require('dotenv').config();

const PORT = process.env.PORT || 3000; 

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
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const fetch = require('node-fetch');

const app = express();

const sendBookingEmail = async ({ to, subject, html, icsAttachment }) => {
  try {
    console.log('📤 Attempting to send email to:', to);
    console.log('🔑 Resend API key exists?', !!process.env.RESEND_API_KEY);
    
    const emailOptions = {
      from: 'ScheduleSync <hello@trucal.xyz>',
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

    const result = await resend.emails.send(emailOptions);
    console.log('✅ Email sent - ID:', result.id);
    return result;
  } catch (error) {
    console.error('❌ Email error:', error);
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

// Add this helper function at the top of server.js (after imports)
async function callAnthropicWithRetry(requestBody, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeout);
      return response;
    } catch (error) {
      console.error(`Anthropic API attempt ${i + 1} failed:`, error.message);
      if (i === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
    }
  }
}

// ============ MIDDLEWARE ============

app.use(cors());
app.use(express.json());


// 4. Healthcheck (AFTER app exists)
app.get('/health', (req, res) => res.send('OK'));

// finally
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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

// ============ DATABASE INITIALIZATION (Cleaned SQL) ============

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
    
    // Event Types Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_types (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        duration INTEGER NOT NULL DEFAULT 30,
        description TEXT,
        color VARCHAR(50) DEFAULT 'blue',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, slug)
      )
    `);

    // Blocked Times Table (CLEANED)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_times (
        id SERIAL PRIMARY KEY,
        team_member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        reason TEXT,
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

// ============ USER DATA & PROFILE ENDPOINTS ============

// 1. GET CURRENT USER
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.calendar_sync_enabled, u.timezone,
            (SELECT tm.booking_token FROM team_members tm
             JOIN teams t ON tm.team_id = t.id
             WHERE tm.user_id = u.id AND t.name LIKE '%Personal Bookings%'
             LIMIT 1) as booking_token
       FROM users u
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('❌ Get Me error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// 2. GET USER TIMEZONE
app.get('/api/user/timezone', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT timezone FROM users WHERE id = $1', [req.user.id]);
    res.json({ timezone: result.rows[0]?.timezone || 'America/New_York' });
  } catch (error) {
    console.error('❌ Get timezone error:', error);
    res.status(500).json({ error: 'Failed to fetch timezone' });
  }
});

// 3. UPDATE USER TIMEZONE
app.put('/api/user/timezone', authenticateToken, async (req, res) => {
  try {
    const { timezone } = req.body;
    await pool.query('UPDATE users SET timezone = $1 WHERE id = $2', [timezone, req.user.id]);
    await pool.query('UPDATE team_members SET timezone = $1 WHERE user_id = $2', [timezone, req.user.id]);
    res.json({ success: true, timezone });
  } catch (error) {
    console.error('❌ Update timezone error:', error);
    res.status(500).json({ error: 'Failed to update timezone' });
  }
});

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
// ============ EMAIL/PASSWORD AUTHENTICATION ============

// Register with email/password
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    console.log('📝 Registration attempt:', email);

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
    if (sendBookingEmail) {
      try {
        await sendBookingEmail({
          to: email,
          subject: '✉️ Verify Your Email - ScheduleSync',
          html: emailTemplates.emailVerification(user, verificationToken),
        });
        console.log('✅ Verification email sent to:', email);
      } catch (emailError) {
        console.error('⚠️ Failed to send verification email:', emailError);
      }
    }

    // Generate JWT token (but mark as unverified)
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, verified: false },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ User registered:', user.email);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, emailVerified: false },
      token,
      message: 'Registration successful! Please check your email to verify your account.'
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify email
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    console.log('📧 Email verification attempt');

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

    console.log('✅ Email verified for:', user.email);

    res.json({ 
      success: true, 
      message: 'Email verified successfully! You can now log in.' 
    });

  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Resend verification email
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('📧 Resending verification email to:', email);

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
    if (sendBookingEmail) {
      await sendBookingEmail({
        to: email,
        subject: '✉️ Verify Your Email - ScheduleSync',
        html: emailTemplates.emailVerification(user, verificationToken),
      });
      console.log('✅ Verification email resent to:', email);
    }

    res.json({ 
      success: true, 
      message: 'Verification email sent! Please check your inbox.' 
    });

  } catch (error) {
    console.error('❌ Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});
// Login with email/password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    console.log('🔐 Login attempt:', email);

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

    console.log('✅ Login successful:', user.email);

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
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});


// Forgot password - Request reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔑 Password reset request received for:', email);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    // Security: Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      console.log('⚠️ Reset requested for non-existent email:', email);
      return res.json({ 
        success: true, 
        message: 'If that email exists, a reset link has been sent.' 
      });
    }

    const user = result.rows[0];

    // CASE 1: OAuth User (Google Login) - Send "Use Google" Reminder
    if (!user.password_hash) {
      console.log('ℹ️ OAuth account detected. Sending "Use Google" reminder to:', email);
      
      const oauthHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333;">Sign in with Google</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>You requested a password reset, but your account was created using <strong>Google Login</strong>.</p>
          <p>You don't need a password! Simply click the button below to sign in:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/login" style="background: #4285F4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign in with Google</a>
          </p>
        </div>
      `;

      if (sendBookingEmail) {
        await sendBookingEmail({
          to: email,
          subject: '🔔 Sign in method reminder - ScheduleSync',
          html: oauthHtml,
        });
        console.log('✅ OAuth reminder email sent');
      }

      return res.json({ 
        success: true, 
        message: 'If that email exists, a reset link has been sent.' 
      });
    }

    // CASE 2: Standard Email/Password User - Send Reset Link
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token to DB
    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
      [resetToken, resetTokenExpires, user.id]
    );

    // Construct Link
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    console.log('🔗 Generated Reset URL:', resetUrl);

    // HTML Email Template
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>You requested a password reset. Click the button below to choose a new password:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
        </p>
        <p style="font-size: 12px; color: #666;">Or copy this link: ${resetUrl}</p>
        <p>This link expires in 1 hour.</p>
      </div>
    `;

    // Send email
    if (sendBookingEmail) {
      await sendBookingEmail({
        to: email,
        subject: '🔑 Reset Your Password - ScheduleSync',
        html: emailHtml,
      });
      console.log('✅ Reset email sent successfully to:', email);
    } else {
      console.error('❌ sendBookingEmail function is missing! Check imports.');
    }

    res.json({ 
      success: true, 
      message: 'If that email exists, a reset link has been sent.' 
    });

  } catch (error) {
    console.error('❌ Forgot password CRITICAL error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ============ CREATE TEST USER (NO VERIFICATION) ============
app.get('/api/auth/create-test-user', async (req, res) => {
  try {
    const testEmail = 'test@schedulesync.com';
    const testPassword = 'test1234';
    const testName = 'Test User';

    console.log('🧪 Creating test user...');

    // Check if test user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail]);
    
    if (existingUser.rows.length > 0) {
      console.log('✅ Test user already exists');
      
      // Generate JWT token
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

    console.log('✅ Test user created:', user.email);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token,
      credentials: { email: testEmail, password: testPassword },
      message: 'Test user created successfully!'
    });

  } catch (error) {
    console.error('❌ Create test user error:', error);
    res.status(500).json({ error: 'Failed to create test user' });
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
      `SELECT 
          t.id,
          t.name,
          t.description,
          t.booking_mode,
          t.owner_id,
          t.created_at,
          t.updated_at,
          MAX(tm.booking_token) as booking_token,
          COUNT(DISTINCT tm.id) as member_count,
          COUNT(DISTINCT b.id) as booking_count
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id 
          AND (tm.user_id = t.owner_id OR tm.id = (
              SELECT id FROM team_members WHERE team_id = t.id ORDER BY id ASC LIMIT 1
          ))
        LEFT JOIN bookings b ON t.id = b.team_id
        WHERE t.owner_id = $1
        GROUP BY t.id, t.name, t.description, t.booking_mode, t.owner_id, t.created_at, t.updated_at
        ORDER BY 
          CASE WHEN t.name LIKE '%Personal Bookings%' THEN 0 ELSE 1 END,
          t.created_at DESC`,
      [req.user.id]
    );
    
    console.log('📋 Teams loaded with tokens:', result.rows.map(t => ({ 
      id: t.id, 
      name: t.name, 
      token: t.booking_token,
      token_length: t.booking_token?.length 
    })));
    
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
  try {
    const { name, description, booking_mode } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;
    const userEmail = req.user.email;
    
    console.log('➕ Creating new team:', name);

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Validate booking mode
    const validModes = ['individual', 'round_robin', 'first_available', 'collective'];
    const mode = booking_mode || 'individual';
    
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: 'Invalid booking mode' });
    }

    // Generate team booking token
    const teamBookingToken = crypto.randomBytes(16).toString('hex');

    // Create team
    const result = await pool.query(
      `INSERT INTO teams (name, description, owner_id, booking_mode, team_booking_token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [name.trim(), description || '', userId, mode, teamBookingToken]
    );

    const team = result.rows[0];

    // Create owner as first team member
    const memberToken = crypto.randomBytes(16).toString('hex');
    
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, email, name, booking_token, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [team.id, userId, userEmail, userName, memberToken, userId]
    );

    console.log('✅ Team created:', team.id);

    res.json({ 
      success: true,
      team: team,
      message: 'Team created successfully'
    });

  } catch (error) {
    console.error('❌ Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
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


// Update team member (general info: name, email, etc.)
app.patch('/api/teams/:teamId/members/:memberId', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;
  const { email, name } = req.body;

  try {
    // Verify ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2', 
      [teamId, req.user.id]
    );
    
    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update member
    const result = await pool.query(
      `UPDATE team_members 
       SET email = COALESCE($1, email),
           name = COALESCE($2, name)
       WHERE id = $3 AND team_id = $4 
       RETURNING *`,
      [email, name, memberId, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log(`✅ Member ${memberId} updated`);
    res.json({ member: result.rows[0] });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Toggle team member active status
app.patch('/api/teams/:teamId/members/:memberId/status', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;
  const { is_active } = req.body;

  try {
    // Verify ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2', 
      [teamId, req.user.id]
    );
    
    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update member status
    const result = await pool.query(
      `UPDATE team_members 
       SET is_active = $1
       WHERE id = $2 AND team_id = $3 
       RETURNING *`,
      [is_active, memberId, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log(`✅ Member ${memberId} status updated to ${is_active ? 'active' : 'inactive'}`);
    res.json({ success: true, member: result.rows[0] });
  } catch (error) {
    console.error('Update member status error:', error);
    res.status(500).json({ error: 'Failed to update member status' });
  }
});

// ============ TEAM MEMBER ROUTES ============
app.get('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  try {
    const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1 AND owner_id = $2', [teamId, req.user.id]);
    if (teamCheck.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `SELECT tm.*, 
              tm.is_active, 
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

// NOTE: This helper function encapsulates the core GET logic
const getAvailabilitySettings = async (req, res, memberId, userId) => {
  try {
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE tm.id = $1`,
      [memberId]
    );

    if (memberResult.rows.length === 0) return res.status(404).json({ error: 'Team member not found' });
    const member = memberResult.rows[0];

    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const blockedResult = await pool.query(
      `SELECT start_time, end_time, reason FROM blocked_times WHERE team_member_id = $1 ORDER BY start_time ASC`,
      [memberId]
    );

    res.json({
      member: {
        id: member.id,
        name: member.name,
        buffer_time: member.buffer_time || 0,
        lead_time_hours: member.lead_time_hours || 0,
        booking_horizon_days: member.booking_horizon_days || 30,
        daily_booking_cap: member.daily_booking_cap || null,
        working_hours: member.working_hours || { /* default structure will be applied by frontend if null */ }, 
      },
      blocked_times: blockedResult.rows,
    });
  } catch (error) {
    console.error('Get member availability error:', error);
    res.status(500).json({ error: 'Failed to get availability settings' });
  }
};

// ** FIX 1: GET /api/availability/me (Handles the Dashboard link) **
app.get('/api/availability/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find the user's personal member ID
    const memberResult = await pool.query(
      `SELECT tm.id FROM team_members tm JOIN teams t ON tm.team_id = t.id 
       WHERE tm.user_id = $1 AND t.owner_id = $1 LIMIT 1`,
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Personal booking schedule not found. Please create a link on the Dashboard first.' });
    }

    const memberId = memberResult.rows[0].id;
    
    // Forward the request logic to the core handler
    await getAvailabilitySettings(req, res, memberId, userId);

  } catch (error) {
    console.error('❌ Get /availability/me error:', error);
    res.status(500).json({ error: 'Failed to resolve personal availability settings' });
  }
});

// GET /api/teams/:teamId/members/:memberId/availability (Detailed route)
app.get('/api/teams/:teamId/members/:memberId/availability', authenticateToken, async (req, res) => {
  const { memberId } = req.params;
  const userId = req.user.id;
  await getAvailabilitySettings(req, res, parseInt(memberId), userId);
});

// NOTE: This handler encapsulates the core PUT logic
const updateAvailabilitySettings = async (req, res, memberId, userId) => {
  try {
    const memberIdInt = parseInt(memberId);

    // 1. Verify ownership
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id, tm.user_id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE tm.id = $1`,
      [memberIdInt]
    );
    if (memberResult.rows.length === 0) return res.status(404).json({ error: 'Team member not found' });
    const member = memberResult.rows[0];
    if (member.owner_id !== userId && member.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

    const { buffer_time, lead_time_hours, booking_horizon_days, daily_booking_cap, working_hours, blocked_times } = req.body;

    // 2. Update core settings
    await pool.query(
      `UPDATE team_members 
       SET buffer_time = $1, 
           lead_time_hours = $2, 
           booking_horizon_days = $3, 
           daily_booking_cap = $4, 
           working_hours = $5
       WHERE id = $6`,
      [
        buffer_time || 0, 
        lead_time_hours || 0, 
        booking_horizon_days || 30,
        daily_booking_cap,
        JSON.stringify(working_hours), 
        memberIdInt
      ]
    );

    // 3. Update blocked times: Clear existing and insert new ones
    await pool.query('DELETE FROM blocked_times WHERE team_member_id = $1', [memberIdInt]);

    if (blocked_times && blocked_times.length > 0) {
      for (const block of blocked_times) {
        if (block.start_time && block.end_time) {
          await pool.query(
            `INSERT INTO blocked_times (team_member_id, start_time, end_time, reason) 
             VALUES ($1, $2, $3, $4)`,
            [memberIdInt, block.start_time, block.end_time, block.reason || null]
          );
        }
      }
    }

    console.log(`✅ Availability settings updated for member ${memberId}`);
    res.json({ success: true, message: 'Availability settings updated' });
  } catch (error) {
    console.error('❌ Update availability error:', error);
    res.status(500).json({ error: 'Failed to update availability settings' });
  }
};

// ** FIX 2: PUT /api/availability/me (Handles the Dashboard save) **
app.put('/api/availability/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Resolve Member ID
        const memberResult = await pool.query(
          `SELECT tm.id FROM team_members tm JOIN teams t ON tm.team_id = t.id 
           WHERE tm.user_id = $1 AND t.owner_id = $1 LIMIT 1`,
          [userId]
        );

        if (memberResult.rows.length === 0) {
          return res.status(404).json({ error: 'Personal schedule not found for update' });
        }
        
        const memberId = memberResult.rows[0].id;

        // Delegate to the core handler
        return updateAvailabilitySettings(req, res, memberId, userId);

    } catch (error) {
        console.error('❌ Put /availability/me error:', error);
        res.status(500).json({ error: 'Failed to update personal availability settings' });
    }
});


// PUT /api/teams/:teamId/members/:memberId/availability (Detailed route for saving)
app.put('/api/teams/:teamId/members/:memberId/availability', authenticateToken, async (req, res) => {
  const { memberId } = req.params;
  const userId = req.user.id;
  await updateAvailabilitySettings(req, res, memberId, userId);
});


// ============ AI SLOT RANKING ALGORITHM ============
// NOTE: I am omitting the AI and reminder logic here for brevity as it was not part of the fix,
// but the functionality remains the same as in your original file.

// ... (Rest of the file remains the same) ...