

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

const app = express();

const sendBookingEmail = async ({ to, subject, html, icsAttachment }) => {
  try {
    console.log('📤 Attempting to send email to:', to);
    console.log('🔑 Resend API key exists?', !!process.env.RESEND_API_KEY);
    console.log('🔑 Resend API key starts with:', process.env.RESEND_API_KEY?.substring(0, 10));
    
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

    console.log('📨 Calling resend.emails.send...');
    const result = await resend.emails.send(emailOptions);
    console.log('✅ Email sent - FULL RESULT:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Email error - FULL ERROR:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
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

// ============ DATABASE INITIALIZATION ============

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
    // ✅ NEW: Event Types Table
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

    // ✅ Blocked Times Table
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

// ✅ Single-Use Links Table
await pool.query(`
  CREATE TABLE IF NOT EXISTS single_use_links (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
  )
`);

// ✅ Team Reminder Settings Table
await pool.query(`
  CREATE TABLE IF NOT EXISTS team_reminder_settings (
    id SERIAL PRIMARY KEY,
    team_id INTEGER UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    hours_before INTEGER DEFAULT 24,
    send_to_host BOOLEAN DEFAULT true,
    send_to_guest BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`);

// ✅ Booking Reminders Tracking Table
await pool.query(`
  CREATE TABLE IF NOT EXISTS booking_reminders (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP DEFAULT NOW(),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);

// ✅ Payments Table
await pool.query(`
  CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending',
    payment_method_id VARCHAR(255),
    receipt_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);

// ✅ Refunds Table
await pool.query(`
  CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    stripe_refund_id VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);

 await pool.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Meeting'
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
              (SELECT tm.booking_token FROM team_members tm   -- <--- CHANGED to tm.booking_token
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
              tm.is_active,  -- Add this line
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

// ========== REMINDER SETTINGS ROUTES (PER TEAM / PERSONAL USER) ==========

// GET /api/teams/:teamId/reminder-settings

app.put('/api/teams/:teamId/reminder-settings', authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.teamId, 10);
  const { enabled, hours_before, send_to_host, send_to_guest } = req.body;

  try {
    const upsertQuery = `
      INSERT INTO team_reminder_settings (team_id, enabled, hours_before, send_to_host, send_to_guest)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (team_id) DO UPDATE
      SET enabled      = EXCLUDED.enabled,
          hours_before = EXCLUDED.hours_before,
          send_to_host = EXCLUDED.send_to_host,
          send_to_guest = EXCLUDED.send_to_guest,
          updated_at   = NOW()
      RETURNING *;
    `;

    const result = await pool.query(upsertQuery, [
      teamId,
      enabled,
      hours_before,
      send_to_host,
      send_to_guest,
    ]);

    console.log(`✅ Updated reminder settings for team ${teamId}`);
    res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error('Error updating reminder settings:', err);
    res.status(500).json({ error: 'Failed to update reminder settings' });
  }
});

app.get('/api/teams/:teamId/reminder-settings', authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.teamId, 10);

  try {
    const result = await pool.query(
      `SELECT team_id, enabled, hours_before, send_to_host, send_to_guest
       FROM team_reminder_settings
       WHERE team_id = $1`,
      [teamId]
    );

    if (result.rowCount === 0) {
      // Defaults if nothing saved yet
      return res.json({
        settings: {
          team_id: teamId,
          enabled: true,
          hours_before: 24,
          send_to_host: true,
          send_to_guest: true,
        },
      });
    }

    res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error('Error loading reminder settings:', err);
    res.status(500).json({ error: 'Failed to load reminder settings' });
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

// Get team member availability settings
app.get('/api/team-members/:id/availability', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;

    console.log('📋 Getting availability for member:', memberId);

    // Get team member and verify ownership
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id 
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       WHERE tm.id = $1`,
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const member = memberResult.rows[0];

    // Verify ownership
    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get blocked times
    const blockedResult = await pool.query(
      `SELECT * FROM blocked_times 
       WHERE team_member_id = $1 
       ORDER BY start_time ASC`,
      [memberId]
    );

    res.json({
      member: {
        id: member.id,
        name: member.name,
        buffer_time: member.buffer_time || 0,
        working_hours: member.working_hours || {
          monday: { enabled: true, start: '09:00', end: '17:00' },
          tuesday: { enabled: true, start: '09:00', end: '17:00' },
          wednesday: { enabled: true, start: '09:00', end: '17:00' },
          thursday: { enabled: true, start: '09:00', end: '17:00' },
          friday: { enabled: true, start: '09:00', end: '17:00' },
          saturday: { enabled: false, start: '09:00', end: '17:00' },
          sunday: { enabled: false, start: '09:00', end: '17:00' },
        },
      },
      blocked_times: blockedResult.rows,
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed to get availability settings' });
  }
});

// Update team member availability settings
app.put('/api/team-members/:id/availability', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;
   const { 
  buffer_time, 
  lead_time_hours,       
  booking_horizon_days,  
  daily_booking_cap,      
  working_hours, 
  blocked_times 
} = req.body;

    console.log('⚙️ Updating availability for member:', memberId);

    // Verify ownership
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id 
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       WHERE tm.id = $1`,
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const member = memberResult.rows[0];

    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update team member settings
    await pool.query(
  `UPDATE team_members 
   SET buffer_time = $1, 
       lead_time_hours = $2,        
       booking_horizon_days = $3,   
       daily_booking_cap = $4,  
       working_hours = $5
   WHERE id = $6`,
  [buffer_time || 0, lead_time_hours || 0, booking_horizon_days || 30, 
   daily_booking_cap, JSON.stringify(working_hours), memberId]
);

    // Update blocked times
    await pool.query('DELETE FROM blocked_times WHERE team_member_id = $1', [memberId]);

    // Handle blocked times
console.log('🔧 Processing blocked times:', blocked_times);

if (blocked_times && blocked_times.length > 0) {
  console.log(`📝 Saving ${blocked_times.length} blocked time(s)`);
  
  for (const block of blocked_times) {
    console.log('Processing block:', block);
    
    // Skip blocks with temp IDs and no dates
    if (!block.start_time || !block.end_time) {
      console.log('⚠️ Skipping block - missing dates');
      continue;
    }
    
    // Convert datetime-local format to ISO timestamp
    const startTime = new Date(block.start_time).toISOString();
    const endTime = new Date(block.end_time).toISOString();
    
    console.log('📅 Inserting blocked time:', {
      memberId,
      startTime,
      endTime,
      reason: block.reason
    });
    
    try {
      await pool.query(
        `INSERT INTO blocked_times (team_member_id, start_time, end_time, reason) 
         VALUES ($1, $2, $3, $4)`,
        [memberId, startTime, endTime, block.reason || null]
      );
      console.log('✅ Blocked time inserted');
    } catch (blockError) {
      console.error('❌ Failed to insert blocked time:', blockError);
    }
  }
} else {
  console.log('ℹ️ No blocked times to save');
}

    console.log('✅ Availability settings updated');
    res.json({ success: true, message: 'Availability settings updated' });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Failed to update availability settings' });
  }
});

// ============ AI SLOT RANKING ALGORITHM ============

function calculateSlotScore(slot, existingBookings, timezone) {
  let score = 0;
  const slotStart = new Date(slot.start);
  const slotHour = slotStart.getHours();
  const slotMinute = slotStart.getMinutes();
  const dayOfWeek = slotStart.getDay();
  
  // 1. TIME OF DAY QUALITY (25 points)
  const timeScore = (() => {
    const totalMinutes = slotHour * 60 + slotMinute;
    if (totalMinutes >= 600 && totalMinutes < 840) { // 10 AM - 2 PM
      return 25;
    } else if ((totalMinutes >= 540 && totalMinutes < 600) || (totalMinutes >= 840 && totalMinutes < 960)) { // 9-10 AM or 2-4 PM
      return 20;
    } else if ((totalMinutes >= 480 && totalMinutes < 540) || (totalMinutes >= 960 && totalMinutes < 1020)) { // 8-9 AM or 4-5 PM
      return 15;
    } else {
      return 10;
    }
  })();
  score += timeScore;
  
  // 2. MUTUAL AVAILABILITY (30 points)
  if (slot.status === 'available') {
    if (slot.reason === null) {
      score += 30; // Both calendars free
    } else {
      score += 21; // Only organizer free
    }
  } else {
    score += 0; // Not available
  }
  
  // 3. BUFFER SPACE (20 points)
  const bufferScore = (() => {
    if (!existingBookings || existingBookings.length === 0) {
      return 20; // No other bookings, perfect buffer
    }
    
    const slotEnd = new Date(slot.end);
    let minBufferBefore = Infinity;
    let minBufferAfter = Infinity;
    
    existingBookings.forEach(booking => {
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);
      
      if (bookingEnd <= slotStart) {
        const bufferMinutes = (slotStart - bookingEnd) / (1000 * 60);
        minBufferBefore = Math.min(minBufferBefore, bufferMinutes);
      } else if (bookingStart >= slotEnd) {
        const bufferMinutes = (bookingStart - slotEnd) / (1000 * 60);
        minBufferAfter = Math.min(minBufferAfter, bufferMinutes);
      }
    });
    
    const minBuffer = Math.min(minBufferBefore, minBufferAfter);
    
    if (minBuffer >= 60) return 20;
    if (minBuffer >= 30) return 16;
    if (minBuffer >= 15) return 12;
    return 8;
  })();
  score += bufferScore;
  
  // 4. RECENCY SCORE (15 points)
  const now = new Date();
  const daysUntil = Math.ceil((slotStart - now) / (1000 * 60 * 60 * 24));
  const recencyScore = (() => {
    if (daysUntil <= 3) return 15;
    if (daysUntil <= 7) return 13;
    if (daysUntil <= 14) return 12;
    return 10;
  })();
  score += recencyScore;
  
  // 5. DAY OF WEEK (10 points)
  const dayScore = (() => {
    if (dayOfWeek >= 2 && dayOfWeek <= 4) return 10; // Tue-Thu
    if (dayOfWeek === 1 || dayOfWeek === 5) return 8; // Mon, Fri
    return 6; // Sat, Sun
  })();
  score += dayScore;
  
  return Math.round(score);
}

function getMatchLabel(score) {
  if (score >= 90) return 'Excellent Match';
  if (score >= 80) return 'Great Match';
  if (score >= 70) return 'Good Match';
  if (score >= 60) return 'Fair Match';
  return 'Available';
}

function getMatchColor(score) {
  if (score >= 90) return 'green';
  if (score >= 80) return 'blue';
  if (score >= 70) return 'purple';
  if (score >= 60) return 'yellow';
  return 'gray';
}

// ============ ENHANCED SLOT GENERATION WITH ALL AVAILABILITY RULES ============

app.post('/api/book/:token/slots-with-status', async (req, res) => {
  try {
    const { token } = req.params;
    const { 
      guestAccessToken, 
      guestRefreshToken,
      duration = 30,
      timezone = 'America/New_York'
    } = req.body;

    console.log('📅 Generating slots for token:', token, 'Length:', token.length);

    // ========== 1. GET MEMBER & SETTINGS (WITH SINGLE-USE SUPPORT) ==========
    let memberResult;
    
    // Check if it's a single-use link (64 chars)
    if (token.length === 64) {
      console.log('🔑 Looking up single-use link in slots endpoint...');
      memberResult = await pool.query(
        `SELECT tm.*, 
                tm.buffer_time,
                tm.working_hours,
                tm.lead_time_hours,
                tm.booking_horizon_days,
                tm.daily_booking_cap,
                u.google_access_token, 
                u.google_refresh_token, 
                u.name as organizer_name,
                t.id as team_id
         FROM single_use_links sul
         JOIN team_members tm ON sul.member_id = tm.id
         LEFT JOIN users u ON tm.user_id = u.id
         LEFT JOIN teams t ON tm.team_id = t.id
         WHERE sul.token = $1
           AND sul.used = false
           AND sul.expires_at > NOW()`,
        [token]
      );
    } else {
      // Regular 32-char token
      console.log('🔑 Looking up regular booking token...');
      memberResult = await pool.query(
        `SELECT tm.*, 
                tm.buffer_time,
                tm.working_hours,
                tm.lead_time_hours,
                tm.booking_horizon_days,
                tm.daily_booking_cap,
                u.google_access_token, 
                u.google_refresh_token, 
                u.name as organizer_name,
                t.id as team_id
         FROM team_members tm
         LEFT JOIN users u ON tm.user_id = u.id
         LEFT JOIN teams t ON tm.team_id = t.id
         WHERE tm.booking_token = $1`,
        [token]
      );
    }

    if (memberResult.rows.length === 0) {
      console.log('❌ Token not found or expired');
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    console.log('✅ Member found:', member.organizer_name);
    
    // ... rest of your existing code continues unchanged ...
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    
    // Default settings
    const bufferTime = member.buffer_time || 0; // minutes
    const leadTimeHours = member.lead_time_hours || 0; // minimum notice
    const horizonDays = member.booking_horizon_days || 30; // max days ahead
    const dailyCap = member.daily_booking_cap || null; // max bookings per day
    
    const workingHours = member.working_hours || {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' },
    };

    console.log('⚙️ Settings:', {
      bufferTime,
      leadTimeHours,
      horizonDays,
      dailyCap
    });

    // ========== 2. GET BLOCKED TIMES ==========
    const blockedResult = await pool.query(
      `SELECT * FROM blocked_times 
       WHERE team_member_id = $1 
       AND end_time > NOW()
       ORDER BY start_time ASC`,
      [member.id]
    );
    const blockedTimes = blockedResult.rows;

    // ========== 3. GET EXISTING BOOKINGS (for buffer & daily cap) ==========
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + horizonDays);

    const bookingsResult = await pool.query(
      `SELECT start_time, end_time 
       FROM bookings 
       WHERE member_id = $1 
       AND status = 'confirmed'
       AND start_time >= $2 
       AND start_time <= $3
       ORDER BY start_time ASC`,
      [member.id, now.toISOString(), endDate.toISOString()]
    );
    const existingBookings = bookingsResult.rows;

    // ========== 4. GET ORGANIZER CALENDAR BUSY TIMES ==========
    let organizerBusy = [];
    if (member.google_access_token && member.google_refresh_token) {
      try {
        const calendar = google.calendar({ version: 'v3' });
        const organizerAuth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        organizerAuth.setCredentials({
          access_token: member.google_access_token,
          refresh_token: member.google_refresh_token
        });

        const freeBusyResponse = await calendar.freebusy.query({
          auth: organizerAuth,
          requestBody: {
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            items: [{ id: 'primary' }],
          },
        });

        organizerBusy = freeBusyResponse.data.calendars?.primary?.busy || [];
        console.log('✅ Organizer calendar loaded:', organizerBusy.length, 'busy blocks');
      } catch (error) {
        console.error('⚠️ Failed to fetch organizer calendar:', error.message);
      }
    }

    // ========== 5. GET GUEST CALENDAR BUSY TIMES ==========
    let guestBusy = [];
    if (guestAccessToken) {
      try {
        const calendar = google.calendar({ version: 'v3' });
        const guestAuth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          `${process.env.FRONTEND_URL}/oauth/callback`
        );
        guestAuth.setCredentials({
          access_token: guestAccessToken,
          refresh_token: guestRefreshToken
        });

        const freeBusyResponse = await calendar.freebusy.query({
          auth: guestAuth,
          requestBody: {
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            items: [{ id: 'primary' }],
          },
        });

        guestBusy = freeBusyResponse.data.calendars?.primary?.busy || [];
        console.log('✅ Guest calendar loaded:', guestBusy.length, 'busy blocks');
      } catch (error) {
        console.error('⚠️ Failed to fetch guest calendar:', error.message);
      }
    }

    // ========== 6. HELPER FUNCTIONS ==========
    const tzOffsetHours = getTimezoneOffset(timezone);

    const dayNameMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };

    const isWithinWorkingHours = (slotStart, dayOfWeek) => {
      const dayName = dayNameMap[dayOfWeek];
      const daySettings = workingHours[dayName];
      
      if (!daySettings || !daySettings.enabled) {
        return false;
      }

      const slotHour = slotStart.getHours();
      const slotMinute = slotStart.getMinutes();
      const slotTime = slotHour * 60 + slotMinute;

      const [startHour, startMinute] = daySettings.start.split(':').map(Number);
      const [endHour, endMinute] = daySettings.end.split(':').map(Number);
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;

      return slotTime >= startTime && slotTime < endTime;
    };

    const hasConflict = (slotStart, slotEnd, busyTimes) => {
      return busyTimes.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return (
          (slotStart >= busyStart && slotStart < busyEnd) ||
          (slotEnd > busyStart && slotEnd <= busyEnd) ||
          (slotStart <= busyStart && slotEnd >= busyEnd)
        );
      });
    };

    const isBlocked = (slotStart, slotEnd) => {
      return blockedTimes.some(block => {
        const blockStart = new Date(block.start_time);
        const blockEnd = new Date(block.end_time);
        return (
          (slotStart >= blockStart && slotStart < blockEnd) ||
          (slotEnd > blockStart && slotEnd <= blockEnd) ||
          (slotStart <= blockStart && slotEnd >= blockEnd)
        );
      });
    };

    const hasBufferViolation = (slotStart, slotEnd) => {
      if (bufferTime === 0) return false;

      return existingBookings.some(booking => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);

        // Check if slot is too close before booking
        const beforeBuffer = new Date(bookingStart);
        beforeBuffer.setMinutes(beforeBuffer.getMinutes() - bufferTime);
        if (slotEnd > beforeBuffer && slotStart < bookingStart) {
          return true;
        }

        // Check if slot is too close after booking
        const afterBuffer = new Date(bookingEnd);
        afterBuffer.setMinutes(afterBuffer.getMinutes() + bufferTime);
        if (slotStart < afterBuffer && slotEnd > bookingEnd) {
          return true;
        }

        return false;
      });
    };

    // ========== 7. GENERATE SLOTS WITH ALL RULES ==========
    const slots = [];
    const dailyBookingCounts = {}; // Track bookings per day for daily cap

    // Calculate earliest bookable time (now + lead time)
    const earliestBookable = new Date(now);
    earliestBookable.setHours(earliestBookable.getHours() + leadTimeHours);

    // Calculate latest bookable time (now + horizon)
    const latestBookable = new Date(now);
    latestBookable.setDate(latestBookable.getDate() + horizonDays);

    console.log('⏰ Time window:', {
      earliestBookable: earliestBookable.toISOString(),
      latestBookable: latestBookable.toISOString()
    });

    // Generate slots for each day
    for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      checkDate.setHours(0, 0, 0, 0);

      const dayOfWeek = checkDate.getDay();
      const dayName = dayNameMap[dayOfWeek];
      const daySettings = workingHours[dayName];

      // Skip if day is not enabled
      if (!daySettings || !daySettings.enabled) {
        continue;
      }

      // Parse working hours for this day
      const [startHour, startMinute] = daySettings.start.split(':').map(Number);
      const [endHour, endMinute] = daySettings.end.split(':').map(Number);

      // Initialize daily booking count
      const dateKey = checkDate.toISOString().split('T')[0];
      if (!dailyBookingCounts[dateKey]) {
        dailyBookingCounts[dateKey] = existingBookings.filter(b => {
          const bookingDate = new Date(b.start_time).toISOString().split('T')[0];
          return bookingDate === dateKey;
        }).length;
      }

      // Generate 30-minute slots within working hours
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          // Skip if this time is past the end of working hours
          if (hour === endHour - 1 && minute + duration > 60) break;
          if (hour >= endHour) break;

          const slotStart = new Date(checkDate);
          slotStart.setHours(hour, minute, 0, 0);
          
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          let status = 'available';
          let reason = null;
          let details = null;

          // ========== APPLY ALL RULES ==========

          // Rule 1: Lead time
          if (slotStart < earliestBookable) {
            status = 'unavailable';
            reason = 'lead_time';
            details = `Minimum ${leadTimeHours}h notice required`;
          }
          // Rule 2: Horizon limit
          else if (slotStart > latestBookable) {
            status = 'unavailable';
            reason = 'horizon';
            details = `Only ${horizonDays} days ahead available`;
          }
          // Rule 3: Working hours (double-check)
          else if (!isWithinWorkingHours(slotStart, dayOfWeek)) {
            status = 'unavailable';
            reason = 'outside_hours';
            details = 'Outside working hours';
          }
          // Rule 4: Blocked times
          else if (isBlocked(slotStart, slotEnd)) {
            status = 'unavailable';
            reason = 'blocked';
            details = 'Time blocked by organizer';
          }
          // Rule 5: Buffer time violations
          else if (hasBufferViolation(slotStart, slotEnd)) {
            status = 'unavailable';
            reason = 'buffer';
            details = `${bufferTime}min buffer required`;
          }
          // Rule 6: Daily cap
          else if (dailyCap && dailyBookingCounts[dateKey] >= dailyCap) {
            status = 'unavailable';
            reason = 'daily_cap';
            details = `Daily limit (${dailyCap}) reached`;
          }
          // Rule 7: Organizer calendar conflicts
          else if (hasConflict(slotStart, slotEnd, organizerBusy)) {
            status = 'unavailable';
            reason = 'organizer_busy';
            details = `${member.organizer_name || 'Organizer'} has another meeting`;
          }
          // Rule 8: Guest calendar conflicts
          else if (hasConflict(slotStart, slotEnd, guestBusy)) {
            status = 'unavailable';
            reason = 'guest_busy';
            details = "You have another meeting";
          }

          // Format time for display
          const time = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
          }).format(slotStart);

          const slotData = {
  start: slotStart.toISOString(),
  end: slotEnd.toISOString(),
  status,
  reason,
  details,
  time,
  timestamp: slotStart.getTime()
};

// Calculate match score for available slots
if (status === 'available') {
  slotData.matchScore = calculateSlotScore(slotData, existingBookings, timezone);
  slotData.matchLabel = getMatchLabel(slotData.matchScore);
  slotData.matchColor = getMatchColor(slotData.matchScore);
} else {
  slotData.matchScore = 0;
  slotData.matchLabel = 'Unavailable';
  slotData.matchColor = 'gray';
}

slots.push(slotData);
        }
      }
    }

    // ========== 7.5. SORT BY MATCH SCORE ==========
console.log('🎯 Sorting slots by match score...');
slots.sort((a, b) => {
  // Available slots first
  if (a.status === 'available' && b.status !== 'available') return -1;
  if (a.status !== 'available' && b.status === 'available') return 1;
  
  // Then by match score (highest first)
  if (a.matchScore !== b.matchScore) {
    return b.matchScore - a.matchScore;
  }
  
  // Then by timestamp (earliest first)
  return a.timestamp - b.timestamp;
});
    // ========== 8. GROUP BY DATE ==========
    const slotsByDate = {};
    slots.forEach(slot => {
      const slotDate = new Date(slot.start);
      
      const dateKey = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: timezone
      }).format(slotDate);
      
      const dayOfWeek = new Intl.DateTimeFormat('en-US', { 
        weekday: 'short',
        timeZone: timezone 
      }).format(slotDate);
      
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      
      slotsByDate[dateKey].push({
        ...slot,
        date: dateKey,
        dayOfWeek: dayOfWeek
      });
    });

    console.log(`✅ Generated ${slots.length} slots across ${Object.keys(slotsByDate).length} days`);
    console.log(`✅ Available: ${slots.filter(s => s.status === 'available').length}`);

    res.json({
      slots: slotsByDate,
      summary: {
        totalSlots: slots.length,
        availableSlots: slots.filter(s => s.status === 'available').length,
        hasGuestCalendar: guestBusy.length > 0,
        hasOrganizerCalendar: organizerBusy.length > 0,
        settings: {
          bufferTime,
          leadTimeHours,
          horizonDays,
          dailyCap,
          workingDays: Object.keys(workingHours).filter(day => workingHours[day].enabled)
        }
      }
    });

  } catch (error) {
    console.error('❌ Enhanced slot generation error:', error);
    res.status(500).json({ error: 'Failed to generate slots' });
  }
});

// ============ MY BOOKING LINK (PERSONAL BOOKING PAGE) ============

app.get('/api/my-booking-link', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    console.log('📎 Getting personal booking link for:', userEmail);

    // Check if user already has a personal team
    let personalTeam = await pool.query(
      `SELECT * FROM teams WHERE owner_id = $1 AND name = $2`,
      [userId, `${userName}'s Personal Bookings`]
    );

    // Create personal team if it doesn't exist
    if (personalTeam.rows.length === 0) {
      console.log('➕ Creating personal team for:', userName);
      
      const teamBookingToken = crypto.randomBytes(16).toString('hex');
      const teamResult = await pool.query(
        `INSERT INTO teams (name, description, owner_id, team_booking_token) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          `${userName}'s Personal Bookings`,
          'Book time with me directly',
          userId,
          teamBookingToken
        ]
      );
      personalTeam = teamResult;
    }

    const team = personalTeam.rows[0];

    // Check if user is a member of their own team
    let memberResult = await pool.query(
      `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [team.id, userId]
    );

    // Add user as member if not already OR regenerate token if it's malformed
    if (memberResult.rows.length === 0) {
      console.log('➕ Adding user as member of their personal team');
      
      const bookingToken = crypto.randomBytes(16).toString('hex');
      const insertResult = await pool.query(
        `INSERT INTO team_members (team_id, user_id, email, name, booking_token, invited_by) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [team.id, userId, userEmail, userName, bookingToken, userId]
      );
      memberResult = insertResult;
      console.log('✅ Created member with token:', bookingToken);
    } else {
      const member = memberResult.rows[0];
      
      // Check if token is valid (32 hex characters)
      if (!member.booking_token || member.booking_token.length !== 32 || !/^[a-f0-9]{32}$/i.test(member.booking_token)) {
        console.log('🔄 Regenerating invalid booking token for member:', member.id);
        const newBookingToken = crypto.randomBytes(16).toString('hex');
        
        const updateResult = await pool.query(
          `UPDATE team_members SET booking_token = $1 WHERE id = $2 RETURNING *`,
          [newBookingToken, member.id]
        );
        memberResult = updateResult;
        console.log('✅ Updated member with new token:', newBookingToken);
      }
    }

    const member = memberResult.rows[0];
    const bookingUrl = `${process.env.FRONTEND_URL}/book/${member.booking_token}`;

    console.log('✅ Personal booking link generated:', bookingUrl);
    console.log('📋 Token:', member.booking_token);

    res.json({
      success: true,
      bookingUrl,
      bookingToken: member.booking_token,
      team: {
        id: team.id,
        name: team.name
      }
    });

  } catch (error) {
    console.error('❌ Error generating personal booking link:', error);
    res.status(500).json({ error: 'Failed to generate booking link' });
  }
});

// ============ BOOKING MANAGEMENT (CANCEL & RESCHEDULE) ============

// Cancel a booking
app.post('/api/bookings/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { reason } = req.body;

    console.log('❌ Canceling booking:', bookingId);

    // Verify ownership
    const bookingCheck = await pool.query(
      `SELECT b.*, t.owner_id, tm.user_id as member_user_id
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Check if user has permission (team owner or assigned member)
    const hasPermission = booking.owner_id === userId || booking.member_user_id === userId;
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }

    // Update booking status
    await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled',
           notes = COALESCE(notes, '') || E'\nCancellation reason: ' || COALESCE($1, 'No reason provided')
       WHERE id = $2`,
      [reason, bookingId]
    );

    console.log('✅ Booking cancelled successfully');

    // TODO: Send cancellation email
   console.log('✅ Booking cancelled successfully');

    try {
      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '❌ Booking Cancelled - ScheduleSync',
        html: emailTemplates.bookingCancellation(booking, reason),
      });
      console.log('✅ Cancellation email sent');
    } catch (emailError) {
      console.error('⚠️ Failed to send cancellation email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Booking cancelled successfully' 
    });

  } catch (error) {
    console.error('❌ Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Reschedule a booking
app.post('/api/bookings/:id/reschedule', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { newStartTime, newEndTime } = req.body;

    console.log('🔄 Rescheduling booking:', bookingId);

    if (!newStartTime || !newEndTime) {
      return res.status(400).json({ error: 'New start and end times are required' });
    }

    // Verify ownership
    const bookingCheck = await pool.query(
      `SELECT b.*, t.owner_id, tm.user_id as member_user_id, tm.name as member_name
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Check permission
    const hasPermission = booking.owner_id === userId || booking.member_user_id === userId;
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to reschedule this booking' });
    }

    // Update booking times
    const updateResult = await pool.query(
      `UPDATE bookings 
       SET start_time = $1, 
           end_time = $2
       WHERE id = $3
       RETURNING *`,
      [newStartTime, newEndTime, bookingId]
    );

    const updatedBooking = updateResult.rows[0];

    console.log('✅ Booking rescheduled successfully');

    // TODO: Send reschedule email
       try {
      const icsFile = generateICS({
        id: updatedBooking.id,
        start_time: updatedBooking.start_time,
        end_time: updatedBooking.end_time,
        attendee_name: booking.attendee_name,
        attendee_email: booking.attendee_email,
        organizer_name: booking.member_name,
        organizer_email: booking.member_email,
        team_name: booking.team_name,
        notes: booking.notes,
      });

      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '🔄 Booking Rescheduled - ScheduleSync',
        html: emailTemplates.bookingReschedule(
          {
            ...updatedBooking,
            organizer_name: booking.member_name,
            team_name: booking.team_name,
          },
          booking.start_time
        ),
        icsAttachment: icsFile,
      });
      console.log('✅ Reschedule email sent');
    } catch (emailError) {
      console.error('⚠️ Failed to send reschedule email:', emailError);
    }

    res.json({ 
      success: true, 
      booking: updatedBooking,
      message: 'Booking rescheduled successfully' 
    });

  } catch (error) {
    console.error('❌ Reschedule booking error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// Health check endpoint for debugging
app.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: process.env.PORT
  });
});

// ============ EVENT TYPES (MEETING CONFIGURATIONS) ============

// 1. List all event types for the logged-in user
app.get('/api/event-types', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM event_types WHERE user_id = $1 ORDER BY created_at ASC',
      [req.user.id]
    );
    res.json({ eventTypes: result.rows });
  } catch (error) {
    console.error('Get event types error:', error);
    res.status(500).json({ error: 'Failed to fetch event types' });
  }
});

// 2. Create a new event type
app.post('/api/event-types', authenticateToken, async (req, res) => {
  try {
    const { title, duration, description, color, slug } = req.body;
    
    // Auto-generate slug if not provided: "My Meeting" -> "my-meeting"
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const result = await pool.query(
      `INSERT INTO event_types (user_id, title, slug, duration, description, color)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, title, finalSlug, duration || 30, description, color || 'blue']
    );

    res.json({ eventType: result.rows[0], message: 'Event type created successfully' });
  } catch (error) {
    console.error('Create event type error:', error);
    if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'An event with this URL slug already exists.' });
    }
    res.status(500).json({ error: 'Failed to create event type' });
  }
});

// 3. Update an event type
app.put('/api/event-types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, duration, description, color, slug, is_active } = req.body;

    const result = await pool.query(
      `UPDATE event_types 
       SET title = COALESCE($1, title),
           slug = COALESCE($2, slug),
           duration = COALESCE($3, duration),
           description = COALESCE($4, description),
           color = COALESCE($5, color),
           is_active = COALESCE($6, is_active)
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [title, slug, duration, description, color, is_active, id, req.user.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event type not found' });
    }

    res.json({ eventType: result.rows[0], message: 'Updated successfully' });
  } catch (error) {
    console.error('Update event type error:', error);
    res.status(500).json({ error: 'Failed to update event type' });
  }
});

// 4. Delete an event type
app.delete('/api/event-types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM event_types WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event type not found' });
    }

    res.json({ success: true, message: 'Event type deleted' });
  } catch (error) {
    console.error('Delete event type error:', error);
    res.status(500).json({ error: 'Failed to delete event type' });
  }
});

// ============ SINGLE USE LINK ENDPOINTS ============

// Generate a Single-Use Link
app.post('/api/single-use-links', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find the user's personal member ID
    const memberResult = await pool.query(
      `SELECT tm.id FROM team_members tm JOIN teams t ON tm.team_id = t.id 
       WHERE tm.user_id = $1 AND t.owner_id = $1 LIMIT 1`,
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Personal schedule not found.' });
    }
    
    const memberId = memberResult.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');

    await pool.query(
      `INSERT INTO single_use_links (token, member_id) VALUES ($1, $2)`,
      [token, memberId]
    );

    res.json({ success: true, token: token });
  } catch (error) {
    console.error('Generate single-use link error:', error);
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

// ============ BOOKING ROUTES ============

app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, t.name as team_name, tm.name as member_name 
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id 
       LEFT JOIN team_members tm ON b.member_id = tm.id
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

// Get booking by token (Public Booking Page)
// Get booking by token (Public Booking Page)
app.get('/api/book/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('🔍 Looking up token:', token, 'Length:', token.length);
    
    // 1. First, check if it's a single-use link (64 chars)
    if (token.length === 64) {
      console.log('🔑 Checking single-use links table...');
      const singleUseCheck = await pool.query(
        `SELECT sul.token as single_use_token, tm.*, t.name as team_name, t.description as team_description,
                u.name as member_name, u.email as member_email, u.id as user_id
         FROM single_use_links sul
         JOIN team_members tm ON sul.member_id = tm.id
         JOIN teams t ON tm.team_id = t.id
         LEFT JOIN users u ON tm.user_id = u.id
         WHERE sul.token = $1 
           AND sul.used = false 
           AND sul.expires_at > NOW()`,
        [token]
      );
      
      if (singleUseCheck.rows.length > 0) {
        console.log('✅ Valid single-use link found');
        const member = singleUseCheck.rows[0];
        
        // Get event types
        let eventTypes = [];
        if (member.user_id) {
          const eventsRes = await pool.query(
            'SELECT * FROM event_types WHERE user_id = $1 AND is_active = true ORDER BY duration ASC',
            [member.user_id]
          );
          eventTypes = eventsRes.rows;
        }
        
        return res.json({
          data: {
            team: { 
              id: member.team_id, 
              name: member.team_name, 
              description: member.team_description 
            },
            member: { 
              name: member.name || member.member_name || member.email, 
              email: member.email || member.member_email, 
              external_booking_link: member.external_booking_link, 
              external_booking_platform: member.external_booking_platform 
            },
            eventTypes: eventTypes,
            isSingleUse: true,
            singleUseToken: member.single_use_token
          }
        });
      } else {
        console.log('❌ Single-use link not found, expired, or already used');
        return res.status(404).json({ error: 'This link has expired or been used' });
      }
    }
    
    // 2. Otherwise, check regular team member booking tokens (32 chars)
    console.log('🔑 Checking team_members table...');
    const result = await pool.query(
      `SELECT tm.*, t.name as team_name, t.description as team_description, 
       u.name as member_name, u.email as member_email, u.id as user_id
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      console.log('❌ Token not found in team_members');
      return res.status(404).json({ error: 'Booking link not found' });
    }

    const member = result.rows[0];

    // 2. ✅ NEW: Fetch Event Types for this user
    // This allows the frontend to switch between "15 min", "30 min", etc.
    let eventTypes = [];
    if (member.user_id) {
      const eventsRes = await pool.query(
        'SELECT * FROM event_types WHERE user_id = $1 AND is_active = true ORDER BY duration ASC',
        [member.user_id]
      );
      eventTypes = eventsRes.rows;
    }

    res.json({
      data: {
        team: { 
          id: member.team_id, 
          name: member.team_name, 
          description: member.team_description 
        },
        member: { 
          name: member.name || member.member_name || member.email, 
          email: member.email || member.member_email, 
          external_booking_link: member.external_booking_link, 
          external_booking_platform: member.external_booking_platform 
        },
        eventTypes: eventTypes // <--- Returning this list
      }
    });
  } catch (error) {
    console.error('Get booking by token error:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

// REPLACE your entire app.post('/api/bookings', ...) endpoint with this:
app.post('/api/bookings', async (req, res) => {
  try {
    const { token, slot, attendee_name, attendee_email, notes } = req.body;

    console.log('📝 Creating booking:', { token, attendee_name, attendee_email });

    if (!token || !slot || !attendee_name || !attendee_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const memberResult = await pool.query(
      `SELECT tm.*, t.name as team_name, t.booking_mode, t.owner_id, 
              u.google_access_token, u.google_refresh_token, 
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
    const bookingMode = member.booking_mode || 'individual';

    console.log('🎯 Booking mode:', bookingMode);

    let assignedMembers = [];

    // Determine which team member(s) to assign based on booking mode
    switch (bookingMode) {
      case 'individual':
        assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
        console.log('👤 Individual mode: Assigning to', member.name);
        break;

      case 'round_robin':
        const rrResult = await pool.query(
          `SELECT tm.id, tm.name, tm.user_id, COUNT(b.id) as booking_count
           FROM team_members tm
           LEFT JOIN bookings b ON tm.id = b.member_id
           WHERE tm.team_id = $1
           GROUP BY tm.id, tm.name, tm.user_id
           ORDER BY booking_count ASC, tm.id ASC
           LIMIT 1`,
          [member.team_id]
        );
        
        if (rrResult.rows.length > 0) {
          assignedMembers = [rrResult.rows[0]];
          console.log('🔄 Round-robin: Assigning to', rrResult.rows[0].name);
        } else {
          assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
        }
        break;

      case 'first_available':
        const faResult = await pool.query(
          `SELECT tm.id, tm.name, tm.user_id
           FROM team_members tm
           WHERE tm.team_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM bookings b
             WHERE b.member_id = tm.id
             AND b.status != 'cancelled'
             AND (
               (b.start_time <= $2 AND b.end_time > $2)
               OR (b.start_time < $3 AND b.end_time >= $3)
               OR (b.start_time >= $2 AND b.end_time <= $3)
             )
           )
           ORDER BY tm.id ASC
           LIMIT 1`,
          [member.team_id, slot.start, slot.end]
        );
        
        if (faResult.rows.length > 0) {
          assignedMembers = [faResult.rows[0]];
          console.log('⚡ First-available: Assigning to', faResult.rows[0].name);
        } else {
          console.log('⚠️ No available members, falling back to token member');
          assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
        }
        break;

      case 'collective':
        const collectiveResult = await pool.query(
          'SELECT id, name, user_id FROM team_members WHERE team_id = $1',
          [member.team_id]
        );
        
        assignedMembers = collectiveResult.rows;
        console.log('👥 Collective mode: Assigning to all', assignedMembers.length, 'members');
        break;

      default:
        assignedMembers = [{ id: member.id, name: member.name, user_id: member.user_id }];
    }

    // Create booking(s) FIRST (without meet link yet)
const createdBookings = [];

for (const assignedMember of assignedMembers) {
  const bookingResult = await pool.query(
    `INSERT INTO bookings (
      team_id, member_id, user_id, 
      attendee_name, attendee_email, 
      start_time, end_time, 
      title,
      notes, 
      booking_token, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
    RETURNING *`,
    [
      member.team_id,
      assignedMember.id,
      assignedMember.user_id,
      attendee_name,
      attendee_email,
      slot.start,
      slot.end,
      `Meeting with ${attendee_name}`,
      notes || '',
      token,
      'confirmed'
    ]
  );

  createdBookings.push(bookingResult.rows[0]);
  console.log(`✅ Booking created for ${assignedMember.name}:`, bookingResult.rows[0].id);
}

console.log(`✅ Created ${createdBookings.length} booking(s)`);
 
// Mark single-use link as used
if (token.length === 64) {
  await pool.query(
    'UPDATE single_use_links SET used = true WHERE token = $1',
    [token]
  );
  console.log('✅ Single-use link marked as used');
}

// ========== 🆕 ADD THIS: Mark single-use link as used ==========
    const singleUseCheck = await pool.query(
      'SELECT id FROM single_use_links WHERE token = $1 AND used = false',
      [token]
    );
    
    if (singleUseCheck.rows.length > 0) {
      await pool.query(
        'UPDATE single_use_links SET used = true WHERE token = $1',
        [token]
      );
      console.log('✅ Single-use link marked as used:', token);
    }
   app.get('/api/book/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('🔍 Looking up token:', token);
    
    // 1. First, check if it's a single-use link
    const singleUseCheck = await pool.query(
      `SELECT sul.*, tm.*, t.name as team_name, t.description as team_description,
              u.name as member_name, u.email as member_email, u.id as user_id
       FROM single_use_links sul
       JOIN team_members tm ON sul.member_id = tm.id
       JOIN teams t ON tm.team_id = t.id
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE sul.token = $1 
         AND sul.used = false 
         AND sul.expires_at > NOW()`,
      [token]
    );
    
    if (singleUseCheck.rows.length > 0) {
      console.log('✅ Valid single-use link found');
      const member = singleUseCheck.rows[0];
      
      // Get event types
      let eventTypes = [];
      if (member.user_id) {
        const eventsRes = await pool.query(
          'SELECT * FROM event_types WHERE user_id = $1 AND is_active = true ORDER BY duration ASC',
          [member.user_id]
        );
        eventTypes = eventsRes.rows;
      }
      
      return res.json({
        data: {
          team: { 
            id: member.team_id, 
            name: member.team_name, 
            description: member.team_description 
          },
          member: { 
            name: member.name || member.member_name || member.email, 
            email: member.email || member.member_email, 
            external_booking_link: member.external_booking_link, 
            external_booking_platform: member.external_booking_platform 
          },
          eventTypes: eventTypes,
          isSingleUse: true, // Flag for frontend
          singleUseToken: token
        }
      });
    }
    
    // 2. Otherwise, check regular team member booking tokens
    const result = await pool.query(
      `SELECT tm.*, t.name as team_name, t.description as team_description, 
       u.name as member_name, u.email as member_email, u.id as user_id
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      console.log('❌ Token not found in either table');
      return res.status(404).json({ error: 'Booking link not found or expired' });
    }

    const member = result.rows[0];

    // Get event types
    let eventTypes = [];
    if (member.user_id) {
      const eventsRes = await pool.query(
        'SELECT * FROM event_types WHERE user_id = $1 AND is_active = true ORDER BY duration ASC',
        [member.user_id]
      );
      eventTypes = eventsRes.rows;
    }

    res.json({
      data: {
        team: { 
          id: member.team_id, 
          name: member.team_name, 
          description: member.team_description 
        },
        member: { 
          name: member.name || member.member_name || member.email, 
          email: member.email || member.member_email, 
          external_booking_link: member.external_booking_link, 
          external_booking_platform: member.external_booking_platform 
        },
        eventTypes: eventTypes,
        isSingleUse: false
      }
    });
  } catch (error) {
    console.error('Get booking by token error:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});
    // ========== RESPOND IMMEDIATELY ==========

    res.json({ 
      success: true,
      booking: createdBookings[0],
      bookings: createdBookings,
      mode: bookingMode,
      meet_link: null, // Will be updated in background
      message: bookingMode === 'collective' 
        ? `Booking confirmed with all ${createdBookings.length} team members!`
        : 'Booking confirmed! Calendar invite with Google Meet link will arrive shortly.'
    });

    // ========== ASYNC: CREATE CALENDAR EVENT & SEND EMAILS ==========
    // Don't await this - let it run in background
    (async () => {
      try {
        let meetLink = null;
        let calendarEventId = null;

        // Create calendar event with Meet link
        if (member.google_access_token && member.google_refresh_token) {
          try {
            console.log('📅 Creating calendar event with Meet link (async)...');

            const oauth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
              process.env.GOOGLE_REDIRECT_URI
            );

            oauth2Client.setCredentials({
              access_token: member.google_access_token,
              refresh_token: member.google_refresh_token
            });

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const event = {
              summary: `Meeting with ${attendee_name}`,
              description: notes || 'Scheduled via ScheduleSync',
              start: {
                dateTime: slot.start,
                timeZone: 'UTC',
              },
              end: {
                dateTime: slot.end,
                timeZone: 'UTC',
              },
              attendees: [
                { email: attendee_email, displayName: attendee_name },
                { email: member.member_email, displayName: member.member_name }
              ],
              conferenceData: {
                createRequest: {
                  requestId: `schedulesync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  conferenceSolutionKey: {
                    type: 'hangoutsMeet'
                  }
                }
              },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'email', minutes: 24 * 60 },
                  { method: 'popup', minutes: 30 }
                ]
              }
            };

            const calendarResponse = await calendar.events.insert({
              calendarId: 'primary',
              resource: event,
              conferenceDataVersion: 1,
              sendUpdates: 'all'
            });

            meetLink = calendarResponse.data.hangoutLink || null;
            calendarEventId = calendarResponse.data.id;

            // Update bookings with meet link
            for (const booking of createdBookings) {
              await pool.query(
                `UPDATE bookings SET meet_link = $1, calendar_event_id = $2 WHERE id = $3`,
                [meetLink, calendarEventId, booking.id]
              );
            }

            console.log('✅ Calendar event created with Meet link:', meetLink);
          } catch (calendarError) {
            console.error('⚠️ Calendar event creation failed:', calendarError.message);
          }
        }

        // Send confirmation emails
        try {
          const icsFile = generateICS({
            id: createdBookings[0].id,
            start_time: createdBookings[0].start_time,
            end_time: createdBookings[0].end_time,
            attendee_name: attendee_name,
            attendee_email: attendee_email,
            organizer_name: member.member_name || member.name,
            organizer_email: member.member_email || member.email,
            team_name: member.team_name,
            notes: notes,
          });

          // Update booking object with meet_link for email
          const bookingWithMeetLink = {
            ...createdBookings[0],
            attendee_name,
            attendee_email,
            organizer_name: member.member_name || member.name,
            team_name: member.team_name,
            notes,
            meet_link: meetLink,
          };

          await sendBookingEmail({
            to: attendee_email,
            subject: '✅ Booking Confirmed - ScheduleSync',
            html: emailTemplates.bookingConfirmationGuest(bookingWithMeetLink),
            icsAttachment: icsFile,
          });

          if (member.member_email || member.email) {
            await sendBookingEmail({
              to: member.member_email || member.email,
              subject: '📅 New Booking Received - ScheduleSync',
              html: emailTemplates.bookingConfirmationOrganizer(bookingWithMeetLink),
              icsAttachment: icsFile,
            });
          }
          
          console.log('✅ Confirmation emails sent with Meet link');
        } catch (emailError) {
          console.error('⚠️ Failed to send emails:', emailError);
        }
      } catch (error) {
        console.error('❌ Background processing error:', error);
      }
    })();

  } catch (error) {
    console.error('❌ Create booking error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
});

// ============ BOOKING MANAGEMENT BY TOKEN (NO AUTH REQUIRED) ============

// Get booking by token (for guest management page)
app.get('/api/bookings/manage/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('📋 Getting booking for management:', token);
    
    const result = await pool.query(
      `SELECT b.*, 
      b.meet_link,
      b.calendar_event_id,
              t.name as team_name,
              tm.name as organizer_name,
              tm.email as organizer_email,
              tm.booking_token as member_booking_token
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.booking_token = $1`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const booking = result.rows[0];
    
    // Check if booking is in the past
    const now = new Date();
    const bookingTime = new Date(booking.start_time);
    const canModify = bookingTime > now && booking.status === 'confirmed';
    
    res.json({
      booking: {
        id: booking.id,
        attendee_name: booking.attendee_name,
        attendee_email: booking.attendee_email,
        start_time: booking.start_time,
        end_time: booking.end_time,
        notes: booking.notes,
        status: booking.status,
        team_name: booking.team_name,
        organizer_name: booking.organizer_name,
        organizer_email: booking.organizer_email,
        member_booking_token: booking.member_booking_token,
        meet_link: booking.meet_link,              
    calendar_event_id: booking.calendar_event_id,
        can_modify: canModify,
        is_past: bookingTime < now
      }
    });
  } catch (error) {
    console.error('❌ Get booking by token error:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// Reschedule booking by token
app.post('/api/bookings/manage/:token/reschedule', async (req, res) => {
  try {
    const { token } = req.params;
    const { newStartTime, newEndTime } = req.body;

    console.log('🔄 Rescheduling booking via token:', token);

    if (!newStartTime || !newEndTime) {
      return res.status(400).json({ error: 'New start and end times are required' });
    }

    // Get booking by token
    const bookingCheck = await pool.query(
      `SELECT b.*, b.meet_link, b.calendar_event_id,  t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.booking_token = $1 AND b.status = 'confirmed'`,
      [token]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }

    const booking = bookingCheck.rows[0];

    // Don't allow rescheduling past bookings
    const now = new Date();
    const bookingTime = new Date(booking.start_time);
    if (bookingTime < now) {
      return res.status(400).json({ error: 'Cannot reschedule past bookings' });
    }

    // Store old time for email
    const oldStartTime = booking.start_time;

    // Update booking times
    const updateResult = await pool.query(
      `UPDATE bookings 
       SET start_time = $1, 
           end_time = $2,
           updated_at = NOW()
       WHERE booking_token = $3
       RETURNING *`,
      [newStartTime, newEndTime, token]
    );
    
    const updatedBooking = updateResult.rows[0];

    console.log('✅ Booking rescheduled successfully');

    // Send reschedule emails
    try {
      const icsFile = generateICS({
        id: updatedBooking.id,
        start_time: updatedBooking.start_time,
        end_time: updatedBooking.end_time,
        attendee_name: booking.attendee_name,
        attendee_email: booking.attendee_email,
        organizer_name: booking.member_name,
        organizer_email: booking.member_email,
        team_name: booking.team_name,
        notes: booking.notes,
      });

      // Email to guest
      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '🔄 Booking Rescheduled - ScheduleSync',
        html: emailTemplates.bookingReschedule(
          {
            ...updatedBooking,
            organizer_name: booking.member_name,
            team_name: booking.team_name,
            booking_token: token,
            meet_link: booking.meet_link, 
          },
          oldStartTime
        ),
        icsAttachment: icsFile,
      });

      // Email to organizer
      if (booking.member_email) {
        await sendBookingEmail({
          to: booking.member_email,
          subject: '🔄 Booking Rescheduled by Guest - ScheduleSync',
          html: emailTemplates.bookingReschedule(
            {
              ...updatedBooking,
              organizer_name: booking.member_name,
              team_name: booking.team_name,
              booking_token: token,
            },
            oldStartTime
          ),
          icsAttachment: icsFile,
        });
      }

      console.log('✅ Reschedule emails sent');
    } catch (emailError) {
      console.error('⚠️ Failed to send reschedule email:', emailError);
    }

    res.json({ 
      success: true, 
      booking: {
        ...updatedBooking,
        team_name: booking.team_name,
        organizer_name: booking.member_name,
      },
      message: 'Booking rescheduled successfully' 
    });

  } catch (error) {
    console.error('❌ Reschedule booking error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// Cancel booking by token
app.post('/api/bookings/manage/:token/cancel', async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    console.log('❌ Canceling booking via token:', token);

    // Get booking by token
    const bookingCheck = await pool.query(
      `SELECT b.*, b.meet_link, b.calendar_event_id, t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name, tm.booking_token as member_booking_token
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.booking_token = $1 AND b.status = 'confirmed'`,
      [token]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }

    const booking = bookingCheck.rows[0];

    // Update booking status
    await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled',
           notes = COALESCE(notes, '') || E'\n\nCancellation reason: ' || COALESCE($1, 'No reason provided'),
           updated_at = NOW()
       WHERE booking_token = $2`,
      [reason, token]
    );

    console.log('✅ Booking cancelled successfully');

    // Send cancellation emails
    try {
      // Email to guest
      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '❌ Booking Cancelled - ScheduleSync',
        html: emailTemplates.bookingCancellation(
          {
            ...booking,
            booking_token: booking.member_booking_token, // For rebooking
            meet_link: booking.meet_link,
          },
          reason
        ),
      });

      // Email to organizer
      if (booking.member_email) {
        await sendBookingEmail({
          to: booking.member_email,
          subject: '❌ Booking Cancelled by Guest - ScheduleSync',
          html: emailTemplates.bookingCancellation(
            {
              ...booking,
              booking_token: booking.member_booking_token,
            },
            reason
          ),
        });
      }

      console.log('✅ Cancellation emails sent');
    } catch (emailError) {
      console.error('⚠️ Failed to send cancellation email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Booking cancelled successfully' 
    });

  } catch (error) {
    console.error('❌ Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});


// ============ REMINDER ENDPOINTS ============

// ============ REMINDER ENDPOINTS ============

// Get reminder status for dashboard UI
app.get('/api/reminders/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + (23 * 60 * 60 * 1000));
    const reminderWindowEnd = new Date(now.getTime() + (72 * 60 * 60 * 1000));

    // Pending reminders
    const pendingResult = await pool.query(
      `SELECT b.*, tm.name as organizer_name, t.name as team_name
       FROM bookings b
       LEFT JOIN team_members tm ON b.member_id = tm.id
       LEFT JOIN teams t ON b.team_id = t.id
       WHERE (t.owner_id = $1 OR tm.user_id = $1)
         AND b.status = 'confirmed'
         AND b.reminder_sent = false
         AND b.start_time >= $2
         AND b.start_time <= $3
       ORDER BY b.start_time ASC`,
      [userId, reminderWindowStart, reminderWindowEnd]
    );

    // Recently sent
    const sentResult = await pool.query(
      `SELECT b.*, tm.name as organizer_name, t.name as team_name
       FROM bookings b
       LEFT JOIN team_members tm ON b.member_id = tm.id
       LEFT JOIN teams t ON b.team_id = t.id
       WHERE (t.owner_id = $1 OR tm.user_id = $1)
         AND b.reminder_sent = true
         AND b.reminder_sent_at >= NOW() - INTERVAL '7 days'
       ORDER BY b.reminder_sent_at DESC
       LIMIT 10`,
      [userId]
    );

    // Failed reminders
    const failedResult = await pool.query(
      `SELECT b.*, tm.name as organizer_name, t.name as team_name,
              br.error_message, br.sent_at as reminder_failed_at
       FROM bookings b
       LEFT JOIN team_members tm ON b.member_id = tm.id
       LEFT JOIN teams t ON b.team_id = t.id
       INNER JOIN booking_reminders br ON b.id = br.booking_id
       WHERE (t.owner_id = $1 OR tm.user_id = $1)
         AND br.status = 'failed'
         AND br.sent_at >= NOW() - INTERVAL '7 days'
       ORDER BY br.sent_at DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      pending: pendingResult.rows,
      sent: sentResult.rows,
      failed: failedResult.rows,
    });

  } catch (error) {
    console.error('Get reminder status error:', error);
    res.status(500).json({ error: 'Failed to get reminder status' });
  }
});


// ========= GET TEAM REMINDER SETTINGS =========
app.get('/api/teams/:teamId/reminder-settings', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const team = teamCheck.rows[0];

    res.json({
      reminder_enabled: team.reminder_enabled !== false,
      reminder_hours_before: team.reminder_hours_before || 24,
      reminder_template: team.reminder_template || 'default',
    });

  } catch (error) {
    console.error('Get reminder settings error:', error);
    res.status(500).json({ error: 'Failed to get reminder settings' });
  }
});


// ========= UPDATE TEAM REMINDER SETTINGS =========
app.put('/api/teams/:teamId/reminder-settings', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    const { reminder_enabled, reminder_hours_before } = req.body;

    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const team = teamCheck.rows[0];

    await pool.query(
      `UPDATE teams
       SET reminder_enabled = $1,
           reminder_hours_before = $2
       WHERE id = $3`,
      [reminder_enabled, reminder_hours_before, teamId]
    );

    console.log(`✅ Updated reminder settings for team ${teamId} (${team.name})`);

    res.json({
      success: true,
      reminder_enabled,
      reminder_hours_before,
    });

  } catch (error) {
    console.error('Update reminder settings error:', error);
    res.status(500).json({ error: 'Failed to update reminder settings' });
  }
});



// ============ MANUAL REMINDER ENDPOINT (FOR TESTING) ============

app.post('/api/admin/send-reminders', authenticateToken, async (req, res) => {
  try {
    console.log('🔔 Manual reminder check triggered by user:', req.user.email);
    await checkAndSendReminders();
    res.json({ success: true, message: 'Reminder check completed' });
  } catch (error) {
    console.error('Manual reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});
// ============ PAYMENT ENDPOINTS ============

const stripeService = require('./utils/stripe');

// Get Stripe publishable key
app.get('/api/payments/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// Get pricing for a booking token
app.get('/api/book/:token/pricing', async (req, res) => {
  try {
    const { token } = req.params;
    
    const memberResult = await pool.query(
      `SELECT tm.booking_price, tm.currency, tm.payment_required, tm.name,
              t.name as team_name
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    // DEBUG: Log what we get from database
    console.log('💰 Pricing endpoint - Raw DB value:', {
      payment_required: member.payment_required,
      type: typeof member.payment_required,
      value: member.payment_required,
      boolean_conversion: Boolean(member.payment_required),
      strict_true: member.payment_required === true,
      truthy: !!member.payment_required
    });

    res.json({
      price: parseFloat(member.booking_price) || 0,
      currency: member.currency || 'USD',
      paymentRequired: !!member.payment_required,  // ← Double negation for truthy check
      memberName: member.name,
      teamName: member.team_name,
    });
  } catch (error) {
    console.error('❌ Get pricing error:', error);
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

// Create payment intent
app.post('/api/payments/create-intent', async (req, res) => {
  try {
    const { bookingToken, attendeeName, attendeeEmail } = req.body;

    if (!bookingToken) {
      return res.status(400).json({ error: 'Booking token required' });
    }

    // Get member pricing
    const memberResult = await pool.query(
      `SELECT tm.booking_price, tm.currency, tm.payment_required, tm.name,
              t.name as team_name
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.booking_token = $1`,
      [bookingToken]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    if (!member.payment_required || member.booking_price <= 0) {
      return res.status(400).json({ error: 'Payment not required for this booking' });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: member.booking_price,
      currency: member.currency || 'USD',
      metadata: {
        booking_token: bookingToken,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail,
        member_name: member.name,
        team_name: member.team_name,
      },
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: member.booking_price,
      currency: member.currency || 'USD',
    });
  } catch (error) {
    console.error('❌ Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Confirm payment and create booking
app.post('/api/payments/confirm-booking', async (req, res) => {
  try {
    const { paymentIntentId, bookingToken, slot, attendeeName, attendeeEmail, notes } = req.body;

    console.log('💳 Confirming payment and creating booking:', paymentIntentId);

    // Verify payment was successful
    const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Get member details
    const memberResult = await pool.query(
      `SELECT tm.*, t.name as team_name, t.booking_mode, t.owner_id, 
              u.google_access_token, u.google_refresh_token, 
              u.email as member_email, u.name as member_name
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       LEFT JOIN users u ON tm.user_id = u.id 
       WHERE tm.booking_token = $1`,
      [bookingToken]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    // Create booking with payment info
    const bookingResult = await pool.query(
      `INSERT INTO bookings (
        team_id, member_id, user_id, attendee_name, attendee_email, 
        start_time, end_time, notes, booking_token, status,
        payment_status, payment_amount, payment_currency, 
        stripe_payment_intent_id, payment_receipt_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
      RETURNING *`,
      [
        member.team_id, member.id, member.user_id, attendeeName, attendeeEmail,
        slot.start, slot.end, notes || '', bookingToken, 'confirmed',
        'paid', paymentIntent.amount / 100, paymentIntent.currency,
        paymentIntentId, paymentIntent.charges?.data[0]?.receipt_url
      ]
    );

    const booking = bookingResult.rows[0];

    // Record payment in payments table
    await pool.query(
      `INSERT INTO payments (
        booking_id, stripe_payment_intent_id, amount, currency, 
        status, payment_method_id, receipt_url, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        booking.id, paymentIntentId, paymentIntent.amount / 100, paymentIntent.currency,
        'succeeded', paymentIntent.payment_method, 
        paymentIntent.charges?.data[0]?.receipt_url,
        JSON.stringify(paymentIntent.metadata)
      ]
    );

    console.log('✅ Booking created with payment:', booking.id);

    // Send confirmation emails (async)
    (async () => {
      try {
        const icsFile = generateICS({
          id: booking.id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          attendee_name: attendeeName,
          attendee_email: attendeeEmail,
          organizer_name: member.member_name || member.name,
          organizer_email: member.member_email || member.email,
          team_name: member.team_name,
          notes: notes,
        });

        const bookingWithPayment = {
          ...booking,
          attendee_name: attendeeName,
          attendee_email: attendeeEmail,
          organizer_name: member.member_name || member.name,
          team_name: member.team_name,
          notes,
          payment_amount: booking.payment_amount,
          payment_currency: booking.payment_currency,
          payment_receipt_url: booking.payment_receipt_url,
        };

        await sendBookingEmail({
          to: attendeeEmail,
          subject: '✅ Payment Confirmed & Booking Complete - ScheduleSync',
          html: emailTemplates.bookingConfirmationGuestWithPayment(bookingWithPayment),
          icsAttachment: icsFile,
        });

        if (member.member_email || member.email) {
          await sendBookingEmail({
            to: member.member_email || member.email,
            subject: '💰 New Paid Booking Received - ScheduleSync',
            html: emailTemplates.bookingConfirmationOrganizerWithPayment(bookingWithPayment),
            icsAttachment: icsFile,
          });
        }

        console.log('✅ Payment confirmation emails sent');
      } catch (emailError) {
        console.error('⚠️ Failed to send emails:', emailError);
      }
    })();

    res.json({
      success: true,
      booking: {
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        payment_amount: booking.payment_amount,
        payment_currency: booking.payment_currency,
        payment_receipt_url: booking.payment_receipt_url,
      },
    });
  } catch (error) {
    console.error('❌ Confirm booking error:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// Process refund on cancellation
app.post('/api/payments/refund', authenticateToken, async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    const userId = req.user.id;

    console.log('💸 Processing refund for booking:', bookingId);

    // Get booking with payment info
    const bookingResult = await pool.query(
      `SELECT b.*, t.owner_id, tm.user_id as member_user_id
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Check permission
    const hasPermission = booking.owner_id === userId || booking.member_user_id === userId;
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if payment exists
    if (!booking.stripe_payment_intent_id || booking.payment_status !== 'paid') {
      return res.status(400).json({ error: 'No payment to refund' });
    }

    // Process refund via Stripe
    const refund = await stripeService.createRefund({
      paymentIntentId: booking.stripe_payment_intent_id,
      reason: reason || 'requested_by_customer',
    });

    // Update booking
    await pool.query(
      `UPDATE bookings 
       SET payment_status = 'refunded',
           refund_id = $1,
           refund_amount = $2,
           refund_status = $3
       WHERE id = $4`,
      [refund.id, refund.amount / 100, refund.status, bookingId]
    );

    // Record refund
    await pool.query(
      `INSERT INTO refunds (booking_id, stripe_refund_id, amount, currency, status, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bookingId, refund.id, refund.amount / 100, refund.currency, refund.status, reason]
    );

    console.log('✅ Refund processed:', refund.id);

    res.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
      },
    });
  } catch (error) {
    console.error('❌ Refund error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Get Stripe publishable key
app.get('/api/payments/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// Webhook endpoint for Stripe events
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    const event = stripeService.constructWebhookEvent(req.body, signature);

    console.log('🔔 Stripe webhook event:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        // Payment was successful
        const paymentIntent = event.data.object;
        console.log('✅ Payment succeeded:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        // Payment failed
        const failedPayment = event.data.object;
        console.log('❌ Payment failed:', failedPayment.id);
        break;

      case 'charge.refunded':
        // Refund processed
        const refund = event.data.object;
        console.log('💸 Refund processed:', refund.id);
        break;

      default:
        console.log('ℹ️ Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});


// ============ DASHBOARD STATS ENDPOINT ============

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Total bookings for user's teams
    const totalBookingsResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE t.owner_id = $1 OR tm.user_id = $1`,
      [userId]
    );
    
    // Upcoming bookings (future bookings)
    const upcomingResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE (t.owner_id = $1 OR tm.user_id = $1)
         AND b.start_time > NOW()
         AND b.status = 'confirmed'`,
      [userId]
    );
    
    // Revenue (sum of paid bookings)
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(b.payment_amount), 0) as revenue
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE (t.owner_id = $1 OR tm.user_id = $1)
         AND b.payment_status = 'paid'`,
      [userId]
    );
    
    // Active teams
    const teamsResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM teams
       WHERE owner_id = $1`,
      [userId]
    );
    
    // Recent bookings
    const recentBookingsResult = await pool.query(
      `SELECT b.*, tm.name as organizer_name, t.name as team_name
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE t.owner_id = $1 OR tm.user_id = $1
       ORDER BY b.created_at DESC
       LIMIT 5`,
      [userId]
    );
    
    res.json({
      stats: {
        totalBookings: parseInt(totalBookingsResult.rows[0].count),
        upcomingBookings: parseInt(upcomingResult.rows[0].count),
        revenue: parseFloat(revenueResult.rows[0].revenue).toFixed(2),
        activeTeams: parseInt(teamsResult.rows[0].count)
      },
      recentBookings: recentBookingsResult.rows
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

// ============ AI SCHEDULING ASSISTANT ============

app.post('/api/ai/schedule', authenticateToken, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    console.log('🤖 AI Scheduling request:', message);

    // Validate message
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        type: 'error',
        message: 'Please enter a message'
      });
    }

    // Get user's teams and bookings for context
    const teamsResult = await pool.query(
      `SELECT t.*, COUNT(tm.id) as member_count
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id
       WHERE t.owner_id = $1
       GROUP BY t.id`,
      [userId]
    );

    const bookingsResult = await pool.query(
      `SELECT b.*, tm.name as organizer_name, t.name as team_name
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE (t.owner_id = $1 OR tm.user_id = $1)
         AND b.start_time > NOW()
         AND b.status = 'confirmed'
       ORDER BY b.start_time ASC
       LIMIT 10`,
      [userId]
    );

    const userContext = {
      email: userEmail,
      teams: teamsResult.rows.map(t => ({ 
        id: t.id, 
        name: t.name, 
        members: t.member_count 
      })),
      upcomingBookings: bookingsResult.rows.map(b => ({
        title: `${b.attendee_name} - ${b.team_name}`,
        start: b.start_time,
        end: b.end_time
      }))
    };

    // Format conversation history
    const formattedHistory = conversationHistory.slice(-5).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content || ''
    })).filter(msg => msg.content.trim() !== '');

    // Call Claude API

    const aiResponse = await callAnthropicWithRetry({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1500,
  system: `You are a scheduling assistant for ScheduleSync. Extract scheduling intent from user messages and return ONLY valid JSON.

User context: ${JSON.stringify(userContext)}

**IMPORTANT: Current date/time is ${new Date().toISOString()}**
**When parsing dates:**
- "Monday December 1" means the NEXT occurrence of Monday, December 1
- Always use year 2025 or later for future dates
- "2 pm" = "14:00" in 24-hour format
- If only day/month given, assume current year or next year if date has passed

Return JSON structure:
{
  "intent": "create_meeting" | "show_bookings" | "find_time" | "cancel_booking" | "reschedule" | "check_availability" | "clarify",
  "confidence": 0-100,
  "extracted": {
    "title": "string or null",
    "attendees": ["email@example.com"],
    "date": "YYYY-MM-DD (always use 2025 or later)",
    "time": "HH:MM in 24-hour format", 
    "duration_minutes": number or null,
    "notes": "string or null",
    "time_window": "tomorrow morning" | "next week" | "this afternoon" etc
  },
  "missing_fields": ["field1", "field2"],
  "clarifying_question": "What time works best for you?",
  "action": "create" | "list" | "suggest_slots" | "cancel" | null
}

Examples:
- "2 pm monday december 1" → date: "2025-12-01", time: "14:00"
- "tomorrow at 3pm" → calculate tomorrow's date, time: "15:00"

For "show bookings" intent, set action to "list".
For "find time" or vague scheduling, set action to "suggest_slots".
For specific time/date provided, set action to "create".
If missing info, set intent to "clarify".`,
  messages: [
    ...formattedHistory,
    { role: "user", content: message.trim() }
  ]
});


   
    const aiData = await aiResponse.json();

    if (!aiData || !aiData.content || !aiData.content[0] || !aiData.content[0].text) {
      console.error('Invalid AI response:', aiData);
      if (aiData.error) {
        console.error('Anthropic API error:', aiData.error);
        return res.status(500).json({
          type: 'error',
          message: aiData.error.message || 'AI service error. Please try again.'
        });
      }
      return res.status(500).json({
        type: 'error',
        message: 'AI service temporarily unavailable.'
      });
    }

    const aiText = aiData.content[0].text;
    
    // Parse JSON response
    let parsedIntent;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.json({
          type: 'error',
          message: 'I had trouble understanding that. Could you rephrase?'
        });
      }
      parsedIntent = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse AI JSON:', e.message);
      return res.json({
        type: 'error',
        message: 'I had trouble understanding that. Could you rephrase?'
      });
    }

    console.log('🎯 Parsed intent:', parsedIntent);

    // ========== HANDLE DIFFERENT INTENTS ==========

    // INTENT: Show bookings
    if (parsedIntent.intent === 'show_bookings' || parsedIntent.action === 'list') {
      const upcomingBookings = bookingsResult.rows.slice(0, 5);
      
      if (upcomingBookings.length === 0) {
        return res.json({
          type: 'info',
          message: 'You have no upcoming bookings. Would you like to schedule a new meeting?'
        });
      }

      const bookingsList = upcomingBookings.map((b, i) => {
        const start = new Date(b.start_time);
        return `${i + 1}. **${b.attendee_name}** - ${start.toLocaleDateString()} at ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }).join('\n');

      return res.json({
        type: 'booking_list',
        message: `Here are your upcoming bookings:\n\n${bookingsList}`,
        bookings: upcomingBookings
      });
    }

    // INTENT: Clarification needed
    if (parsedIntent.intent === 'clarify') {
      return res.json({
        type: 'clarification',
        message: parsedIntent.clarifying_question || 'Could you provide more details?',
        parsedData: parsedIntent.extracted
      });
    }

    // INTENT: Create meeting with specific time
    if (parsedIntent.intent === 'create_meeting' && parsedIntent.action === 'create') {
      const { extracted } = parsedIntent;
      
      // Validate we have date and time
      if (!extracted.date || !extracted.time) {
        return res.json({
          type: 'clarification',
          message: 'What date and time would you like to schedule this meeting?',
          parsedData: extracted
        });
      }

      // Build datetime
      const startDateTime = new Date(`${extracted.date}T${extracted.time}:00`);
      const endDateTime = new Date(startDateTime.getTime() + (extracted.duration_minutes || 30) * 60000);

      // Check if time is in the past
      if (startDateTime < new Date()) {
        return res.json({
          type: 'error',
          message: 'That time is in the past. Please choose a future time.'
        });
      }

      return res.json({
        type: 'confirmation',
        message: `I'll schedule **"${extracted.title || 'Meeting'}"**${extracted.attendees?.length ? ` with ${extracted.attendees.join(', ')}` : ''} on **${startDateTime.toLocaleDateString()}** at **${startDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}** for **${extracted.duration_minutes || 30} minutes**.\n\nShall I confirm this booking?`,
        bookingData: {
          title: extracted.title || 'Meeting',
          attendees: extracted.attendees || [],
          datetime: startDateTime.toISOString(),
          duration_minutes: extracted.duration_minutes || 30,
          notes: extracted.notes || ''
        }
      });
    }

    // INTENT: Find available slots (vague time)
    if (parsedIntent.intent === 'find_time' || parsedIntent.action === 'suggest_slots') {
      return res.json({
        type: 'slot_suggestion',
        message: `Let me find the best available times${parsedIntent.extracted.time_window ? ` for ${parsedIntent.extracted.time_window}` : ''}. I'll analyze your calendar and suggest optimal slots.`,
        needsSlots: true,
        searchParams: parsedIntent.extracted
      });
    }

    // Default fallback
    return res.json({
      type: 'clarification',
      message: 'I can help you schedule meetings, check availability, or view your bookings. What would you like to do?'
    });

  } catch (error) {
    console.error('❌ AI scheduling error:', error);
    res.status(500).json({ 
      type: 'error',
      message: 'Sorry, I encountered an error. Please try again.' 
    });
  }
});

app.post('/api/ai/schedule/confirm', authenticateToken, async (req, res) => {
  try {
    const { bookingData } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;
    const userEmail = req.user.email;

    console.log('✅ Confirming AI booking:', bookingData);

    // ========== VALIDATE EMAIL ==========
    const email = bookingData.attendees?.[0] || '';
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ 
        type: 'error',
        message: '❌ Please provide a valid email address for the attendee.' 
      });
    }

    // Optional: Check if email is from a disposable/temporary email service
    const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com', 'throwaway.email'];
    const emailDomain = email.split('@')[1]?.toLowerCase();
    
    if (disposableDomains.includes(emailDomain)) {
      return res.status(400).json({ 
        type: 'error',
        message: '⚠️ Temporary email addresses are not allowed. Please use a permanent email address.' 
      });
    }

    // Get user's personal booking token
    const memberResult = await pool.query(
      `SELECT tm.booking_token, tm.id, tm.name, t.id as team_id, t.name as team_name,
              u.google_access_token, u.google_refresh_token
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       JOIN users u ON tm.user_id = u.id
       WHERE tm.user_id = $1
       AND t.name LIKE '%Personal Bookings%'
       LIMIT 1`,
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(400).json({ 
        type: 'error',
        message: 'Please set up your personal booking link first from the dashboard.' 
      });
    }

    const member = memberResult.rows[0];
    
    // Extract attendee name from email if not provided
    const attendeeName = bookingData.attendees?.[0]?.split('@')[0] || 'Guest';
    
    const startTime = new Date(bookingData.datetime);
    const endTime = new Date(startTime.getTime() + bookingData.duration_minutes * 60000);

    // Create booking
    const bookingResult = await pool.query(
      `INSERT INTO bookings (
        team_id, member_id, user_id, 
        attendee_name, attendee_email, 
        start_time, end_time, notes, 
        booking_token, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`,
      [
        member.team_id,
        member.id,
        userId,
        attendeeName,
        email.toLowerCase(),
        startTime.toISOString(),
        endTime.toISOString(),
        bookingData.notes || bookingData.title || '',
        member.booking_token,
        'confirmed'
      ]
    );

    const booking = bookingResult.rows[0];
    console.log('✅ AI booking created:', booking.id);

    // ========== SEND CONFIRMATION EMAILS (ASYNC) ==========
    (async () => {
      try {
        let meetLink = null;

        // Create Google Calendar event with Meet link
        if (member.google_access_token && member.google_refresh_token) {
          try {
            console.log('📅 Creating calendar event with Meet link...');

            const oauth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
              process.env.GOOGLE_REDIRECT_URI
            );

            oauth2Client.setCredentials({
              access_token: member.google_access_token,
              refresh_token: member.google_refresh_token
            });

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const event = {
              summary: bookingData.title || `Meeting with ${attendeeName}`,
              description: bookingData.notes || 'Scheduled via ScheduleSync AI Assistant',
              start: {
                dateTime: startTime.toISOString(),
                timeZone: 'UTC',
              },
              end: {
                dateTime: endTime.toISOString(),
                timeZone: 'UTC',
              },
              attendees: [
                { email: email, displayName: attendeeName },
                { email: userEmail, displayName: userName }
              ],
              conferenceData: {
                createRequest: {
                  requestId: `schedulesync-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  conferenceSolutionKey: {
                    type: 'hangoutsMeet'
                  }
                }
              },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'email', minutes: 24 * 60 },
                  { method: 'popup', minutes: 30 }
                ]
              }
            };

            const calendarResponse = await calendar.events.insert({
              calendarId: 'primary',
              resource: event,
              conferenceDataVersion: 1,
              sendUpdates: 'all'
            });

            meetLink = calendarResponse.data.hangoutLink || null;

            // Update booking with meet link
            await pool.query(
              `UPDATE bookings SET meet_link = $1, calendar_event_id = $2 WHERE id = $3`,
              [meetLink, calendarResponse.data.id, booking.id]
            );

            console.log('✅ Calendar event created with Meet link:', meetLink);
          } catch (calendarError) {
            console.error('⚠️ Calendar event creation failed:', calendarError.message);
          }
        }

        // Generate ICS file
        const icsFile = generateICS({
          id: booking.id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          attendee_name: attendeeName,
          attendee_email: email,
          organizer_name: userName,
          organizer_email: userEmail,
          team_name: member.team_name,
          notes: bookingData.notes || bookingData.title || '',
        });

        const bookingWithDetails = {
          ...booking,
          attendee_name: attendeeName,
          attendee_email: email,
          organizer_name: userName,
          team_name: member.team_name,
          notes: bookingData.notes || bookingData.title || '',
          meet_link: meetLink,
        };

        // Send confirmation email to attendee
        await sendBookingEmail({
          to: email,
          subject: '✅ Meeting Confirmed - ScheduleSync',
          html: emailTemplates.bookingConfirmationGuest(bookingWithDetails),
          icsAttachment: icsFile,
        });

        // Send notification to organizer
        await sendBookingEmail({
          to: userEmail,
          subject: '📅 New Meeting Scheduled via AI - ScheduleSync',
          html: emailTemplates.bookingConfirmationOrganizer(bookingWithDetails),
          icsAttachment: icsFile,
        });

        console.log('✅ Confirmation emails sent');
      } catch (emailError) {
        console.error('⚠️ Failed to send emails:', emailError);
      }
    })();

    // ========== RESPOND IMMEDIATELY ==========
    res.json({
      type: 'success',
      message: `✅ **Meeting confirmed!**\n\n"${bookingData.title}" scheduled for **${startTime.toLocaleDateString()}** at **${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}**\n\n📧 Confirmation emails sent to:\n• **${email}** (attendee)\n• **${userEmail}** (you)\n\n📅 Calendar invite with Google Meet link will arrive shortly.`,
      booking: booking
    });
  } catch (error) {
    console.error('❌ AI booking confirmation error:', error);
    res.status(500).json({ 
      type: 'error',
      message: 'Failed to create booking. Please try again.' 
    });
  }
});

app.get('/api/debug/env', authenticateToken, (req, res) => {
  res.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    keyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
    keyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10) || 'missing'
  });
});

app.get('/api/debug/env', authenticateToken, (req, res) => {
  res.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    keyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
    keyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10) || 'missing'
  });
});

// Test Anthropic API connection
app.get('/api/test/anthropic', authenticateToken, async (req, res) => {
  try {
    console.log('Testing Anthropic API...');
    console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
    console.log('API Key length:', process.env.ANTHROPIC_API_KEY?.length);
    console.log('API Key prefix:', process.env.ANTHROPIC_API_KEY?.substring(0, 15));
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          { role: "user", content: "Say 'API test successful' if you can read this." }
        ]
      })
    });

    const data = await response.json();
    console.log('Anthropic response:', data);

    res.json({
      success: response.ok,
      status: response.status,
      data: data
    });
  } catch (error) {
    console.error('Anthropic test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN PANEL ROUTES ============

// Middleware to protect admin routes
const requireAdmin = (req, res, next) => {
  const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
  // Check if the current logged-in user's email is in the allowed list
  if (!adminEmails.includes(req.user.email)) {
    console.warn(`⚠️ Unauthorized admin access attempt by: ${req.user.email}`);
    return res.status(403).json({ error: 'Access denied: Admins only' });
  }
  next();
};

// 1. GET ALL USERS (for the admin list)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('👮 Admin fetching user list...');
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.provider, 
        u.created_at,
        -- u.last_login_at,  <-- REMOVED THIS LINE because the column doesn't exist
        (SELECT COUNT(*) FROM teams WHERE owner_id = u.id) as team_count,
        (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) as booking_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('❌ Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 2. DELETE A USER (The "Ban Hammer")
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);

    // Safety: Prevent deleting yourself
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    console.log(`🚨 ADMIN ACTION: User ${req.user.email} is deleting user ID ${targetId}`);

    // Perform delete
    // Note: Because your initDB uses "ON DELETE CASCADE", this will automatically 
    // remove their teams, bookings, and membership records.
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email', 
      [targetId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`✅ User ${result.rows[0].email} deleted successfully.`);
    res.json({ 
      success: true, 
      message: `User ${result.rows[0].email} and all associated data have been deleted.` 
    });

  } catch (error) {
    console.error('❌ Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ============ MIGRATION HELPER (Run once then delete) ============
app.get('/api/admin/migrate-event-types', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔄 seeding default event types...');
    
    // Get all users
    const users = await pool.query('SELECT id FROM users');
    
    for (const user of users.rows) {
      // Check if they already have events
      const check = await pool.query('SELECT id FROM event_types WHERE user_id = $1', [user.id]);
      
      if (check.rows.length === 0) {
        await pool.query(`
          INSERT INTO event_types (user_id, title, slug, duration, description, color)
          VALUES ($1, '30 Min Meeting', '30min', 30, 'A standard 30 minute meeting.', 'blue')
        `, [user.id]);
      }
    }
    
    res.json({ success: true, message: "Default event types created for all users." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// REMINDER SETTINGS ROUTES
// ===============================

// Get current reminder settings for the user
app.get('/api/reminders/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT reminder_enabled, reminder_hours_before
       FROM users
       WHERE id = $1`,
      [userId]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error loading reminder settings:", err);
    res.status(500).json({ error: "Failed to load reminder settings" });
  }
});

// Update reminder settings for the user
app.post('/api/reminders/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { enabled, hoursBefore } = req.body;

    await pool.query(
      `UPDATE users
       SET reminder_enabled = $1,
           reminder_hours_before = $2
       WHERE id = $3`,
      [enabled, hoursBefore, userId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating reminder settings:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});


// ============ SERVE STATIC FILES ============

// DEBUG: Check dist files
app.get('/api/debug/files', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const distPath = path.join(__dirname, 'dist-built');
  const assetsPath = path.join(distPath, 'assets');
  
  try {
    const distExists = fs.existsSync(distPath);
    const distFiles = distExists ? fs.readdirSync(distPath) : [];
    const assetsExists = fs.existsSync(assetsPath);
    const assetsFiles = assetsExists ? fs.readdirSync(assetsPath) : [];
    
    res.json({
      distPath,
      distExists,
      distFiles,
      assetsPath,
      assetsExists,
      assetsFiles,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/api/debug/tmp', (req, res) => {
  const fs = require('fs');
  try {
    const tmpExists = fs.existsSync('/tmp/schedulesync');
    const publicExists = fs.existsSync('/tmp/schedulesync/public');
    const assetsExists = fs.existsSync('/tmp/schedulesync/public/assets');
    
    let files = [];
    if (assetsExists) {
      files = fs.readdirSync('/tmp/schedulesync/public/assets');
    }
    
    res.json({
      tmpExists,
      publicExists,
      assetsExists,
      files,
      currentDistPath: fs.existsSync('/tmp/schedulesync/public') 
        ? '/tmp/schedulesync/public' 
        : 'fallback to /app/public',
      message: tmpExists ? 'Temp folder exists!' : 'Temp folder was cleared!'
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const distPath = path.join(__dirname, 'dist-built');
  
  // Verify dist exists
  if (!fs.existsSync(distPath)) {
    console.error('❌ dist-built folder not found!');
    console.error('Expected path:', distPath);
  } else {
    console.log('✅ Serving static files from:', distPath);
  }
  
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const cron = require('node-cron');


// ========== REMINDER ENGINE ==========

// Run every 5 minutes
const REMINDER_CRON = '*/5 * * * *';
let lastReminderRun = null;

// ============ REMINDER EMAIL TEMPLATE ============

function reminderEmailTemplate(booking, hoursBefore) {
  const startTime = new Date(booking.start_time);
  const endTime = new Date(booking.end_time);
  
  // Format date and time
  const dateStr = startTime.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const timeStr = startTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
  
  const endTimeStr = endTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Meeting Reminder</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);" width="100%" cellspacing="0" cellpadding="0" border="0">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">⏰ Meeting Reminder</h1>
                  <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">
                    Your meeting starts in ${hoursBefore} hour${hoursBefore !== 1 ? 's' : ''}
                  </p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  
                  <!-- Greeting -->
                  <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                    Hi ${booking.guest_name || booking.host_name || 'there'} 👋
                  </p>
                  
                  <p style="margin: 0 0 30px 0; font-size: 16px; color: #555; line-height: 1.6;">
                    This is a friendly reminder about your upcoming meeting:
                  </p>

                  <!-- Meeting Details Card -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
                    <tr>
                      <td style="padding: 20px;">
                        
                        <!-- Meeting Title -->
                        <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #333; font-weight: 600;">
                          ${booking.title || 'Meeting'}
                        </h2>
                        
                        <!-- Date -->
                        <p style="margin: 0 0 10px 0; font-size: 15px; color: #555;">
                          <strong style="color: #667eea;">📅 Date:</strong> ${dateStr}
                        </p>
                        
                        <!-- Time -->
                        <p style="margin: 0 0 10px 0; font-size: 15px; color: #555;">
                          <strong style="color: #667eea;">🕐 Time:</strong> ${timeStr} - ${endTimeStr}${booking.timezone ? ` (${booking.timezone})` : ''}
                        </p>
                        
                        <!-- Attendees -->
                        ${booking.host_name && booking.guest_name ? `
                          <p style="margin: 0; font-size: 15px; color: #555;">
                            <strong style="color: #667eea;">👥 With:</strong> ${booking.guest_name === (booking.guest_name || booking.host_name) ? booking.host_name : booking.guest_name}
                          </p>
                        ` : ''}
                        
                      </td>
                    </tr>
                  </table>

                  <!-- Meeting Link Button -->
                  ${booking.meeting_url ? `
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 30px;">
                      <tr>
                        <td align="center">
                          <a href="${booking.meeting_url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                            🔗 Join Meeting
                          </a>
                        </td>
                      </tr>
                    </table>
                  ` : ''}

                  <!-- Preparation Tip -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 30px; background: #e8f5e9; border-radius: 8px;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0; font-size: 14px; color: #2e7d32; line-height: 1.5;">
                          💡 <strong>Tip:</strong> Join a few minutes early to test your audio and video!
                        </p>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background: #f8f9fa; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e0e0e0;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                    Scheduled via <strong style="color: #667eea;">ScheduleSync</strong>
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #999;">
                    Need to reschedule? <a href="${process.env.FRONTEND_URL}/manage/${booking.id}" style="color: #667eea; text-decoration: none;">Manage your booking</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ============ REMINDER CHECKER ============

async function checkAndSendReminders() {
  const now = new Date();
  lastReminderRun = now;
  console.log('⏰ Running reminder check at', now.toISOString());

  try {
    const query = `
      SELECT
        b.id,
        b.start_time,
        b.end_time,
        b.title,
        b.status,
        b.attendee_email as guest_email,
        b.attendee_name as guest_name,
        b.meet_link as meeting_url,
        tm.email as host_email,
        tm.name as host_name,
        tm.timezone,
        b.reminder_sent,
        tm.id AS team_member_id,
        t.id AS team_id,
        trs.enabled,
        trs.hours_before,
        trs.send_to_host,
        trs.send_to_guest
      FROM bookings b
      JOIN team_members tm ON b.member_id = tm.id
      JOIN teams t ON tm.team_id = t.id
      LEFT JOIN team_reminder_settings trs ON trs.team_id = t.id
      WHERE b.status = 'confirmed'
        AND b.start_time > NOW()
        AND COALESCE(b.reminder_sent, FALSE) = FALSE
        AND COALESCE(trs.enabled, TRUE) = TRUE
    `;

    const result = await pool.query(query);
    if (result.rowCount === 0) {
      console.log('ℹ️ No bookings eligible for reminders right now');
      return;
    }

    for (const row of result.rows) {
      const startTime = new Date(row.start_time);
      const diffMs = startTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const hoursBefore = row.hours_before ?? 24;

      if (diffHours <= hoursBefore && diffHours > 0) {
        console.log(
          `📧 Sending reminder for booking ${row.id} (team ${row.team_id}) diff=${diffHours.toFixed(
            2
          )}h window=${hoursBefore}h`
        );

        const bookingForTemplate = {
          id: row.id,
          start_time: row.start_time,
          end_time: row.end_time,
          title: row.title || 'Meeting',
          guest_email: row.guest_email,
          guest_name: row.guest_name,
          host_email: row.host_email,
          host_name: row.host_name,
          meeting_url: row.meeting_url,
          timezone: row.timezone,
        };

        const html = reminderEmailTemplate(bookingForTemplate, hoursBefore);

        const recipients = [];
        if (row.send_to_guest ?? true) {
          if (row.guest_email) recipients.push(row.guest_email);
        }
        if (row.send_to_host ?? true) {
          if (row.host_email) recipients.push(row.host_email);
        }

        if (recipients.length === 0) {
          console.log(
            `⚠️ No recipients for booking ${row.id}, skipping reminder`
          );
          continue;
        }

        await sendBookingEmail({
          to: recipients,
          subject: `Reminder: ${bookingForTemplate.title}`,
          html,
          icsAttachment: null,
        });

        await pool.query(
          `UPDATE bookings SET reminder_sent = TRUE WHERE id = $1`,
          [row.id]
        );

        console.log(`✅ Reminder sent and marked for booking ${row.id}`);
      } else {
        console.log(
          `⏭ Skipping ${row.id}, diffHours=${diffHours.toFixed(
            2
          )} window=${hoursBefore}h`
        );
      }
    }
  } catch (err) {
    console.error('❌ Error in reminder engine:', err);
  }
}

// Run every 5 minutes
cron.schedule(REMINDER_CRON, () => {
  checkAndSendReminders().catch((err) =>
    console.error('❌ Unhandled reminder cron error:', err)
  );
});

// Check once on startup after 60 seconds
setTimeout(() => {
  console.log('🔔 Running initial reminder check on startup...');
  checkAndSendReminders().catch((err) =>
    console.error('❌ Startup reminder check error:', err)
  );
}, 60000);

// ============ TIMEZONE ENDPOINTS ============

// Get user's timezone
app.get('/api/user/timezone', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT timezone FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      timezone: result.rows[0].timezone || 'America/New_York' 
    });
  } catch (error) {
    console.error('Get timezone error:', error);
    res.status(500).json({ error: 'Failed to get timezone' });
  }
});

// Update user's timezone
app.put('/api/user/timezone', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { timezone } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ error: 'Timezone is required' });
    }
    
    await pool.query(
      'UPDATE users SET timezone = $1 WHERE id = $2',
      [timezone, userId]
    );
    
    console.log(`✅ Updated timezone for user ${userId}: ${timezone}`);
    
    res.json({ success: true, timezone });
  } catch (error) {
    console.error('Update timezone error:', error);
    res.status(500).json({ error: 'Failed to update timezone' });
  }
});

// Get team member's timezone
app.get('/api/team-members/:id/timezone', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;
    
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id 
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       WHERE tm.id = $1`,
      [memberId]
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    const member = memberResult.rows[0];
    
    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    res.json({ timezone: member.timezone || 'America/New_York' });
  } catch (error) {
    console.error('Get member timezone error:', error);
    res.status(500).json({ error: 'Failed to get timezone' });
  }
});

// Update team member's timezone
app.put('/api/team-members/:id/timezone', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;
    const { timezone } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ error: 'Timezone is required' });
    }
    
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id 
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       WHERE tm.id = $1`,
      [memberId]
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    const member = memberResult.rows[0];
    
    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query(
      'UPDATE team_members SET timezone = $1 WHERE id = $2',
      [timezone, memberId]
    );
    
    console.log(`✅ Updated timezone for member ${memberId}: ${timezone}`);
    
    res.json({ success: true, timezone });
  } catch (error) {
    console.error('Update member timezone error:', error);
    res.status(500).json({ error: 'Failed to update timezone' });
  }
});

// ============ ONBOARDING / PROFILE UPDATE ============
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;
    const { username, timezone, availability } = req.body;

    console.log('🚀 Processing onboarding for user:', userId);

    // 1. Update User Timezone
    if (timezone) {
      await client.query(
        'UPDATE users SET timezone = $1 WHERE id = $2',
        [timezone, userId]
      );
    }

    // 2. Ensure "Personal Team" exists (Needed to attach the booking link)
    const userRes = await client.query('SELECT name, email FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    const teamName = `${user.name || 'User'}'s Personal Bookings`;

    let teamRes = await client.query(
      'SELECT id FROM teams WHERE owner_id = $1 AND name = $2',
      [userId, teamName]
    );

    let teamId;
    if (teamRes.rows.length === 0) {
      // Create personal team if missing
      const teamToken = crypto.randomBytes(16).toString('hex');
      const newTeam = await client.query(
        'INSERT INTO teams (name, description, owner_id, team_booking_token) VALUES ($1, $2, $3, $4) RETURNING id',
        [teamName, 'Book time with me directly', userId, teamToken]
      );
      teamId = newTeam.rows[0].id;
    } else {
      teamId = teamRes.rows[0].id;
    }

    // 3. Update or Create Team Member with the Custom Username
    // The "username" from onboarding becomes their unique booking_token
    let memberRes = await client.query(
      'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    let memberId;
    if (memberRes.rows.length === 0) {
      const newMember = await client.query(
        'INSERT INTO team_members (team_id, user_id, email, name, booking_token, invited_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [teamId, userId, user.email, user.name, username, userId]
      );
      memberId = newMember.rows[0].id;
    } else {
      memberId = memberRes.rows[0].id;
      // Update existing member's booking link (username)
      await client.query(
        'UPDATE team_members SET booking_token = $1 WHERE id = $2',
        [username, memberId]
      );
    }

    // 4. Update Availability (Convert simple frontend format to detailed backend JSON)
    if (availability) {
      const { start, end, days } = availability;
      
      // Map simplified ["Mon", "Wed"] array to full object
      const fullWorkingHours = {
        monday: { enabled: days.includes('Mon'), start, end },
        tuesday: { enabled: days.includes('Tue'), start, end },
        wednesday: { enabled: days.includes('Wed'), start, end },
        thursday: { enabled: days.includes('Thu'), start, end },
        friday: { enabled: days.includes('Fri'), start, end },
        saturday: { enabled: days.includes('Sat'), start, end },
        sunday: { enabled: days.includes('Sun'), start, end },
      };

      await client.query(
        'UPDATE team_members SET working_hours = $1 WHERE id = $2',
        [JSON.stringify(fullWorkingHours), memberId]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Onboarding complete for:', userId);
    res.json({ success: true, username });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Onboarding error:', error);
    
    // Handle duplicate username error (Postgres unique constraint violation code 23505)
    if (error.code === '23505') { 
        return res.status(400).json({ error: 'That link is already taken. Please try another.' });
    }
    
    res.status(500).json({ error: 'Failed to save profile settings.' });
  } finally {
    client.release();
  }
});

// ============ AVAILABILITY SETTINGS ROUTES ============

// Helper to get settings
const getAvailabilitySettings = async (req, res, memberId, userId) => {
  try {
    const memberResult = await pool.query(`SELECT tm.*, t.owner_id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE tm.id = $1`, [memberId]);
    if (memberResult.rows.length === 0) return res.status(404).json({ error: 'Team member not found' });
    
    const member = memberResult.rows[0];
    if (member.owner_id !== userId && member.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

    const blockedResult = await pool.query(`SELECT start_time, end_time, reason FROM blocked_times WHERE team_member_id = $1`, [memberId]);
    
    // Parse JSON if needed
    let workingHours = member.working_hours;
    if (typeof workingHours === 'string') {
        try { workingHours = JSON.parse(workingHours); } catch(e) {}
    }

    res.json({
      member: { ...member, working_hours: workingHours },
      blocked_times: blockedResult.rows,
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed' });
  }
};

// Helper to update settings
const updateAvailabilitySettings = async (req, res, memberId, userId) => {
  try {
    const memberIdInt = parseInt(memberId);
    const { buffer_time, lead_time_hours, booking_horizon_days, daily_booking_cap, working_hours, blocked_times } = req.body;

    await pool.query(
      `UPDATE team_members SET buffer_time=$1, lead_time_hours=$2, booking_horizon_days=$3, daily_booking_cap=$4, working_hours=$5 WHERE id=$6`,
      [buffer_time, lead_time_hours, booking_horizon_days, daily_booking_cap, JSON.stringify(working_hours), memberIdInt]
    );

    await pool.query('DELETE FROM blocked_times WHERE team_member_id = $1', [memberIdInt]);

    if (blocked_times && blocked_times.length > 0) {
      for (const block of blocked_times) {
        if (block.start_time && block.end_time) {
          await pool.query(
            `INSERT INTO blocked_times (team_member_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4)`,
            [memberIdInt, block.start_time, block.end_time, block.reason || null]
          );
        }
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Failed update' });
  }
};

// 1. GET /api/availability/me (Dashboard Link Fix)
app.get('/api/availability/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const memberResult = await pool.query(
      `SELECT tm.id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE tm.user_id = $1 AND t.owner_id = $1 LIMIT 1`,
      [userId]
    );
    if (memberResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    return getAvailabilitySettings(req, res, memberResult.rows[0].id, userId);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. PUT /api/availability/me (Save Button Fix)
app.put('/api/availability/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const memberResult = await pool.query(
          `SELECT tm.id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE tm.user_id = $1 AND t.owner_id = $1 LIMIT 1`,
          [userId]
        );
        if (memberResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        return updateAvailabilitySettings(req, res, memberResult.rows[0].id, userId);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Specific Routes for Teams
app.get('/api/teams/:teamId/members/:memberId/availability', authenticateToken, async (req, res) => {
  await getAvailabilitySettings(req, res, parseInt(req.params.memberId), req.user.id);
});
app.put('/api/teams/:teamId/members/:memberId/availability', authenticateToken, async (req, res) => {
  await updateAvailabilitySettings(req, res, parseInt(req.params.memberId), req.user.id);
});

// ============ ERROR HANDLING ============

app.use((req, res, next) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ error: 'Internal server error' });
});



// ============ GRACEFUL SHUTDOWN ============

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => pool.end(() => process.exit(0)));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => pool.end(() => process.exit(0)));
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV === 'production') server.close(() => process.exit(1));
});

module.exports = app;
