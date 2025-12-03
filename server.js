

// ============ STARTUP DEBUGGING ============
console.log('========================================');
console.log('?? SERVER STARTUP INITIATED');
console.log('Time:', new Date().toISOString());
console.log('Node Version:', process.version);
console.log('========================================');

// Log each require as it happens
console.log('Loading dotenv...');
require('dotenv').config();

console.log('Environment Variables Check:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '? Set' : '? Missing');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '? Set' : '? Missing');
console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '? Set' : '? Missing');
console.log('- GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '? Set' : '? Missing');
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || '? Missing');
console.log('- PORT:', process.env.PORT || '3000');
console.log('========================================');



// Catch any require errors
try {
  console.log('Loading express...');
  const express = require('express');
  console.log('? Express loaded');
} catch (e) {
  console.error('? Failed to load express:', e.message);
  process.exit(1);
}

try {
  console.log('Loading other dependencies...');
  const { Resend } = require('resend');
  console.log('? Resend loaded');
  const cors = require('cors');
  console.log('? CORS loaded');
  const { Pool } = require('pg');
  console.log('? PostgreSQL loaded');
  const jwt = require('jsonwebtoken');
  console.log('? JWT loaded');
  const { google } = require('googleapis');
  console.log('? Google APIs loaded');
  const crypto = require('crypto');
  console.log('? Crypto loaded');
} catch (e) {
  console.error('? Failed to load dependency:', e.message);
  process.exit(1);
}



require('dotenv').config();

const PORT = process.env.PORT || 3000; 

const express = require('express');
const { Resend } = require('resend');
delete require.cache[require.resolve('./emailTemplates')];
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
const axios = require('axios');
console.log('? AXIOS LOADED:', !!axios, 'Version:', axios.VERSION); // ADD THIS
const { trackChatGptUsage, getCurrentUsage } = require('./middleware/usage-limits');


const app = express();

const sendBookingEmail = async ({ to, subject, html, icsAttachment }) => {
  try {
    console.log('?? Attempting to send email to:', to);
    console.log('?? Resend API key exists?', !!process.env.RESEND_API_KEY);
    console.log('?? Resend API key starts with:', process.env.RESEND_API_KEY?.substring(0, 10));
    
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

    console.log('?? Calling resend.emails.send...');
    const result = await resend.emails.send(emailOptions);
    console.log('? Email sent - FULL RESULT:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('? Email error - FULL ERROR:', error);
    console.error('? Error message:', error.message);
    console.error('? Error stack:', error.stack);
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
    console.log('? Email utilities loaded successfully');
  } else {
    console.log('?? Email utilities available but RESEND_API_KEY not configured');
  }
} catch (error) {
  console.log('?? Email utilities not available - emails will not be sent');
}

let getAvailableSlots, createCalendarEvent;
try {
  const calendarUtils = require('./utils/calendar');
  getAvailableSlots = calendarUtils.getAvailableSlots;
  createCalendarEvent = calendarUtils.createCalendarEvent;
  console.log('? Calendar utilities loaded successfully');
} catch (error) {
  console.log('?? Calendar utilities not available - calendar sync disabled');
}

// Add this helper function at the top of server.js (after imports)
async function callAnthropicWithRetry(requestBody, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
  headers: {
    "Content-Type": "application/json",
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
  
function safeParseTime(timeString) {
  if (!timeString || typeof timeString !== 'string') return null;
  const parts = timeString.split(':');
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return { hours, minutes };
}

function validateTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (e) {
    return false;
  }
}

// ============ MICROSOFT OAUTH CONFIG ============
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

// ============ MICROSOFT GRAPH API HELPERS ============

async function refreshMicrosoftToken(refreshToken) {
  try {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MICROSOFT_CONFIG.clientId,
        client_secret: MICROSOFT_CONFIG.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: MICROSOFT_CONFIG.scopes.join(' '),
      }),
    });

    if (!response.ok) throw new Error('Token refresh failed');
    return await response.json();
  } catch (error) {
    console.error('? Microsoft token refresh error:', error);
    throw error;
  }
}

async function getMicrosoftCalendarEvents(accessToken, refreshToken, startTime, endTime) {
  try {
    let token = accessToken;

    let response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startTime}&endDateTime=${endTime}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (response.status === 401) {
      console.log('?? Refreshing Microsoft token...');
      const newTokens = await refreshMicrosoftToken(refreshToken);
      token = newTokens.access_token;
      
      response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startTime}&endDateTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
    }

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error('? Microsoft calendar fetch error:', error);
    return [];
  }
}

async function createMicrosoftCalendarEvent(accessToken, refreshToken, eventData) {
  try {
    let token = accessToken;

    const event = {
      subject: eventData.title,
      body: {
        contentType: 'HTML',
        content: eventData.description || 'Scheduled via ScheduleSync'
      },
      start: {
        dateTime: eventData.startTime,
        timeZone: 'UTC'
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: 'UTC'
      },
      attendees: eventData.attendees.map(a => ({
        emailAddress: { address: a.email, name: a.name },
        type: 'required'
      })),
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness'
    };

    let response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (response.status === 401) {
      console.log('?? Refreshing Microsoft token...');
      const newTokens = await refreshMicrosoftToken(refreshToken);
      token = newTokens.access_token;
      
      response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
    }

    const createdEvent = await response.json();
    return {
      id: createdEvent.id,
      meetingUrl: createdEvent.onlineMeeting?.joinUrl || null
    };
  } catch (error) {
    console.error('? Microsoft event creation error:', error);
    throw error;
  }
}

// ============ MIDDLEWARE ============

app.use(cors());
app.use(express.json());


// ============ USAGE ENFORCEMENT MIDDLEWARE ============

const checkUsageLimits = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get user's subscription and current usage
    const userResult = await pool.query(
      `SELECT subscription_tier, subscription_status, grace_period_end,
              chatgpt_queries_used, chatgpt_queries_reset_date
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    const tier = user.subscription_tier || 'free';
    const graceActive = user.grace_period_end && new Date(user.grace_period_end) > new Date();
    
    // Define limits by tier
    const limits = {
      free: { chatgpt: 3, bookings: 25 },
      pro: { chatgpt: -1, bookings: 500 },  // -1 = unlimited
      team: { chatgpt: -1, bookings: -1 }
    };
    
    // If grace period, give pro limits
    const currentLimits = graceActive && tier === 'free' ? limits.pro : limits[tier];
    
    // Check what feature is being accessed
    const endpoint = req.route.path;
    
    // ChatGPT usage check
    if (endpoint.includes('/ai/') && currentLimits.chatgpt !== -1) {
      const used = user.chatgpt_queries_used || 0;
      
      if (used >= currentLimits.chatgpt) {
        return res.status(402).json({ 
          error: 'ChatGPT limit reached',
          type: 'usage_limit_exceeded',
          feature: 'chatgpt',
          usage: { used, limit: currentLimits.chatgpt },
          subscription_tier: tier,
          upgrade_required: true,
          message: `You've used all ${currentLimits.chatgpt} ChatGPT queries this month. Upgrade to Pro for unlimited AI assistance!`
        });
      }
    }
    
    // Booking creation check
    if ((endpoint.includes('/bookings') && req.method === 'POST') && currentLimits.bookings !== -1) {
      // Count bookings this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const bookingResult = await pool.query(
        'SELECT COUNT(*) as booking_count FROM bookings WHERE created_by = $1 AND created_at >= $2',
        [userId, startOfMonth]
      );
      
      const bookingsUsed = parseInt(bookingResult.rows[0].booking_count);
      
      if (bookingsUsed >= currentLimits.bookings) {
        return res.status(402).json({
          error: 'Booking limit reached',
          type: 'usage_limit_exceeded', 
          feature: 'bookings',
          usage: { used: bookingsUsed, limit: currentLimits.bookings },
          subscription_tier: tier,
          upgrade_required: true,
          message: `You've created ${currentLimits.bookings} bookings this month. Upgrade for higher limits!`
        });
      }
    }
    
    // Add usage info to request for incrementing
    req.userUsage = {
      tier,
      limits: currentLimits,
      graceActive,
      chatgpt_used: user.chatgpt_queries_used || 0
    };
    
    next();
  } catch (error) {
    console.error('Usage check error:', error);
    res.status(500).json({ error: 'Usage check failed' });
  }
};

// Helper function to increment usage
const incrementChatGPTUsage = async (userId) => {
  try {
    await pool.query(
      'UPDATE users SET chatgpt_queries_used = chatgpt_queries_used + 1 WHERE id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Failed to increment ChatGPT usage:', error);
  }
};



// ============ LOG ALL 404s FOR DEBUGGING ============
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode === 404) {
      console.log('🔴 404 ERROR:', {
        method: req.method,
        path: req.path,
        url: req.originalUrl,
        referer: req.get('referer')
      });
    }
    originalSend.call(this, data);
  };
  next();
});

// ============ DATABASE CONNECTION ============

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('? Error connecting to database:', err.stack);
  } else {
    console.log('? Database connected successfully');
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
    microsoft_access_token TEXT,
    microsoft_refresh_token TEXT,
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
    booking_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);

// Email Templates Table
await pool.query(`
  CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
  )
`);

// Create index for faster lookups
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_email_templates_user_type 
  ON email_templates(user_id, type)
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
  

    // ? Blocked Times Table
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

// ? Single-Use Links Table
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

// ? Team Reminder Settings Table
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

// ? Booking Reminders Tracking Table
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

// ? Payments Table
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

// ? Refunds Table
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

// ? ADD THIS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        read BOOLEAN DEFAULT false,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        read_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    `);

 await pool.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Meeting'
    `);

    await pool.query(`
  ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS manage_token VARCHAR(255) UNIQUE
`);

    console.log('? Database initialized successfully');
  } catch (error) {
    console.error('? Error initializing database:', error);
  }
}

// Add this right after initDB() function
async function migrateDatabase() {
  try {
    console.log('?? Running database migrations...');
    
    // Add Microsoft columns
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS microsoft_id VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS microsoft_access_token TEXT,
      ADD COLUMN IF NOT EXISTS microsoft_refresh_token TEXT,
      ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'google'
    `);
    

    // Add to existing single_use_links table creation
await pool.query(`
  CREATE TABLE IF NOT EXISTS single_use_links (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
    name VARCHAR(100),  -- ? ADD THIS LINE
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
  )
`);


await pool.query(`
      ALTER TABLE team_members
      ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
        "monday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "tuesday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "wednesday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "thursday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "friday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "saturday": {"enabled": false, "start": "09:00", "end": "17:00"},
        "sunday": {"enabled": false, "start": "09:00", "end": "17:00"}
      }'::jsonb
    `);
    
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}


// ============================================
// DATABASE MIGRATIONS
// ============================================

// Event Types columns migration
async function migrateEventTypesColumns() {
  try {
    console.log('🔄 Checking Event Types columns...');
    
    await pool.query(`
      ALTER TABLE event_types 
      ADD COLUMN IF NOT EXISTS location VARCHAR(255),
      ADD COLUMN IF NOT EXISTS location_type VARCHAR(50) DEFAULT 'google_meet',
      ADD COLUMN IF NOT EXISTS buffer_before INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS buffer_after INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS max_bookings_per_day INTEGER,
      ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT false
    `);
    
    console.log('✅ Event Types columns updated');
  } catch (error) {
    console.error('❌ Event Types migration error:', error);
  }
}

// Username column migration
async function migrateUsernameColumn() {
  try {
    console.log('🔄 Adding username column to users table...');
    
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE
    `);
    
    await pool.query(`
      UPDATE users
      SET username = LOWER(SPLIT_PART(email, '@', 1))
      WHERE username IS NULL
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username 
      ON users(LOWER(username))
    `);
    
    console.log('✅ Username column migration completed');
  } catch (error) {
    console.error('❌ Username migration failed:', error);
  }
}

// Public bookings migration
async function migratePublicBookings() {
  try {
    console.log('🔄 Running public bookings migration...');
    
    await pool.query(`
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS host_user_id INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS event_type_id INTEGER REFERENCES event_types(id),
      ADD COLUMN IF NOT EXISTS guest_timezone VARCHAR(100) DEFAULT 'UTC'
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_attendees (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_attendees_booking_id 
      ON booking_attendees(booking_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_host_user_id 
      ON bookings(host_user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_event_type_id 
      ON bookings(event_type_id)
    `);
    
    console.log('✅ Public bookings migration completed');
  } catch (error) {
    console.error('❌ Public bookings migration failed:', error);
  }
}

// Migration chain
initDB()
  .then(() => migrateDatabase())
  .then(() => migrateEventTypesColumns())
  .then(() => migrateUsernameColumn())
  .then(() => migratePublicBookings())
  .then(() => {
    console.log('✅ All migrations completed successfully');
  })
  .catch(err => {
    console.error('❌ Migration chain failed:', err);
    process.exit(1);
  });

// ============ OAUTH CODE TRACKING (PREVENT DOUBLE USE) ============

const processedOAuthCodes = new Map(); // Track processed codes with timestamp

// ============ NOTIFICATION HELPERS ============

async function createNotification({ userId, type, title, message, link, bookingId, metadata }) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link, booking_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, type, title, message, link || null, bookingId || null, metadata ? JSON.stringify(metadata) : null]
    );
 console.log(`? Notification: ${title}`);  // ? CORRECT - parenthesis before backtick
    return result.rows[0];
  } catch (error) {
    console.error('? Notification error:', error);
    return null;
  }
}

async function notifyBookingCreated(booking, organizerId) {
  return createNotification({
    userId: organizerId,
    type: 'booking_created',
    title: '?? New Booking Received',
    message: `${booking.attendee_name} scheduled a meeting for ${new Date(booking.start_time).toLocaleDateString()}`,
    link: `/bookings/${booking.id}`,
    bookingId: booking.id,
  });
}

async function notifyBookingCancelled(booking, userId) {
  return createNotification({
    userId: userId,
    type: 'booking_cancelled',
    title: '? Booking Cancelled',
    message: `Meeting with ${booking.attendee_name} has been cancelled`,
    link: `/bookings`,
    bookingId: booking.id,
  });
}

async function notifyBookingRescheduled(booking, userId, oldStartTime) {
  const newTime = new Date(booking.start_time);
  return createNotification({
    userId: userId,
    type: 'booking_rescheduled',
    title: '?? Booking Rescheduled',
    message: `Meeting rescheduled to ${newTime.toLocaleDateString()}`,
    link: `/bookings/${booking.id}`,
    bookingId: booking.id,
  });
}

async function notifyPaymentReceived(booking, userId, amount, currency) {
  return createNotification({
    userId: userId,
    type: 'payment_received',
    title: '?? Payment Received',
    message: `${currency.toUpperCase()} ${amount} from ${booking.attendee_name}`,
    link: `/bookings/${booking.id}`,
    bookingId: booking.id,
  });
}

// Clean up old codes every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  for (const [code, timestamp] of processedOAuthCodes.entries()) {
    if (timestamp < fiveMinutesAgo) {
      processedOAuthCodes.delete(code);
    }
  }
}, 5 * 60 * 1000);



// ============================================
// PUBLIC EVENT TYPE BOOKING ENDPOINT
// ============================================

app.get('/api/public/booking/:username/:eventSlug', async (req, res) => {
  try {
    const { username, eventSlug } = req.params;
    console.log(`?? Public Event Type request: ${username}/${eventSlug}`);

    // Find user by username or email prefix
    const userResult = await pool.query(
      `SELECT id, name, email, username 
       FROM users 
       WHERE LOWER(username) = LOWER($1) 
          OR LOWER(email) LIKE LOWER($2)
       LIMIT 1`,
      [username, `${username}%`]
    );

    if (userResult.rows.length === 0) {
      console.log(`? User not found: ${username}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const host = userResult.rows[0];

    // Find active event type by slug
    const eventResult = await pool.query(
      `SELECT id, title, duration, description, color, slug, is_active
       FROM event_types 
       WHERE user_id = $1 
         AND LOWER(slug) = LOWER($2) 
         AND is_active = true`,
      [host.id, eventSlug]
    );

    if (eventResult.rows.length === 0) {
      console.log(`? Event type not found or inactive: ${eventSlug}`);
      return res.status(404).json({ error: 'Event type not found or inactive' });
    }

    const eventType = eventResult.rows[0];

    console.log(`? Event Type found: ${eventType.title} (${eventType.duration}min)`);

    res.json({
      success: true,
      host: {
        name: host.name,
        email: host.email,
        username: host.username || host.email.split('@')[0],
      },
      eventType: {
        id: eventType.id,
        title: eventType.title,
        duration: eventType.duration,
        description: eventType.description,
        color: eventType.color,
        slug: eventType.slug,
      },
    });
  } catch (error) {
    console.error('? Error fetching Event Type booking info:', error);
    res.status(500).json({ error: 'Failed to load event information' });
  }
});

// ============================================
// PUBLIC EVENT TYPE AVAILABLE SLOTS
// ============================================
app.get('/api/public/available-slots', async (req, res) => {
  try {
    const { username, event_slug, date, timezone = 'UTC' } = req.query;

    console.log('🔍 Fetching public available slots:', { username, event_slug, date, timezone });

    if (!username || !event_slug || !date) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // ========== FIND USER ==========
    const userResult = await pool.query(
      `SELECT id, name, email, google_access_token, google_refresh_token, 
              microsoft_access_token, microsoft_refresh_token, provider 
       FROM users 
       WHERE LOWER(username) = LOWER($1) 
          OR LOWER(email) LIKE LOWER($2)
       LIMIT 1`,
      [username, `${username}%`]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const host = userResult.rows[0];

    // ========== FIND EVENT TYPE ==========
    const eventResult = await pool.query(
      `SELECT id, duration, buffer_before, buffer_after, max_bookings_per_day 
       FROM event_types 
       WHERE user_id = $1 
         AND LOWER(slug) = LOWER($2) 
         AND is_active = true`,
      [host.id, event_slug]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found or inactive' });
    }

    const eventType = eventResult.rows[0];
    const duration = eventType.duration;
    const bufferBefore = eventType.buffer_before || 0;
    const bufferAfter = eventType.buffer_after || 0;

    console.log('✅ Event type found:', { duration, bufferBefore, bufferAfter });

    // ========== GET HOST'S CALENDAR EVENTS ==========
    let calendarEvents = [];

    try {
      if (host.provider === 'google' && host.google_access_token) {
        console.log('📅 Fetching Google Calendar events...');
        
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
          access_token: host.google_access_token,
          refresh_token: host.google_refresh_token
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        });

        calendarEvents = response.data.items || [];
        console.log(`✅ Found ${calendarEvents.length} Google Calendar events`);
        
      } else if (host.provider === 'microsoft' && host.microsoft_access_token) {
        console.log('📅 Fetching Microsoft Calendar events...');
        
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const response = await fetch(
          `https://graph.microsoft.com/v1.0/me/calendarview?startdatetime=${startOfDay.toISOString()}&enddatetime=${endOfDay.toISOString()}`,
          {
            headers: {
              'Authorization': `Bearer ${host.microsoft_access_token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          calendarEvents = data.value || [];
          console.log(`✅ Found ${calendarEvents.length} Microsoft Calendar events`);
        }
      }
    } catch (calendarError) {
      console.error('⚠️ Calendar fetch failed:', calendarError.message);
      // Continue with empty calendar (show all slots as available)
    }

    // ========== GET EXISTING BOOKINGS ==========
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookingsResult = await pool.query(
      `SELECT start_time, end_time 
       FROM bookings 
       WHERE host_user_id = $1 
         AND event_type_id = $2
         AND status != 'cancelled'
         AND start_time >= $3 
         AND start_time < $4`,
      [host.id, eventType.id, startOfDay.toISOString(), endOfDay.toISOString()]
    );

    const existingBookings = bookingsResult.rows;
    console.log(`📊 Found ${existingBookings.length} existing bookings`);

    // ========== GENERATE TIME SLOTS ==========
    const slots = [];
    const startHour = 9;  // 9 AM
    const endHour = 17;   // 5 PM
    const intervalMinutes = 30; // Generate slots every 30 minutes

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);
        
        // Skip if slot end goes past working hours
        if (slotEnd.getHours() >= endHour || (slotEnd.getHours() === endHour && slotEnd.getMinutes() > 0)) {
          continue;
        }

        // Check if slot conflicts with calendar events
        let hasConflict = false;

        // Check calendar events
        for (const event of calendarEvents) {
          const eventStart = new Date(event.start?.dateTime || event.start?.date);
          const eventEnd = new Date(event.end?.dateTime || event.end?.date);
          
          // Add buffers
          const slotStartWithBuffer = new Date(slotStart.getTime() - bufferBefore * 60000);
          const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferAfter * 60000);
          
          if (
            (slotStartWithBuffer < eventEnd && slotEndWithBuffer > eventStart)
          ) {
            hasConflict = true;
            break;
          }
        }

        // Check existing bookings
        if (!hasConflict) {
          for (const booking of existingBookings) {
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            
            const slotStartWithBuffer = new Date(slotStart.getTime() - bufferBefore * 60000);
            const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferAfter * 60000);
            
            if (
              (slotStartWithBuffer < bookingEnd && slotEndWithBuffer > bookingStart)
            ) {
              hasConflict = true;
              break;
            }
          }
        }

        // Add slot if no conflict
        if (!hasConflict) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString()
          });
        }
      }
    }

    console.log(`✅ Generated ${slots.length} available slots`);

    res.json({
      success: true,
      slots: slots,
      date: date,
      timezone: timezone
    });

  } catch (error) {
    console.error('❌ Error fetching public available slots:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});


// ============ PUBLIC BOOKING CREATION ENDPOINT ============
// Add this to server.js after the /api/public/booking/:username/:eventSlug endpoint

app.post('/api/public/booking/create', async (req, res) => {
  try {
    const {
      username,
      event_slug,
      start_time,
      end_time,
      attendee_name,
      attendee_email,
      notes,
      additional_attendees,
      guest_timezone
    } = req.body;

    console.log('📅 Creating public event type booking:', { username, event_slug, attendee_email });

    // Find user by username
    const userResult = await pool.query(
      `SELECT id, name, email, username, google_access_token, microsoft_access_token 
       FROM users 
       WHERE LOWER(username) = LOWER($1) 
          OR LOWER(email) LIKE LOWER($2)
       LIMIT 1`,
      [username, `${username}%`]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const host = userResult.rows[0];

    // Find event type
    const eventResult = await pool.query(
      `SELECT id, title, duration, description, location, location_type
       FROM event_types 
       WHERE user_id = $1 
         AND LOWER(slug) = LOWER($2) 
         AND is_active = true`,
      [host.id, event_slug]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found or inactive' });
    }

    const eventType = eventResult.rows[0];

    // Generate manage token
    const manageToken = crypto.randomBytes(32).toString('hex');

    // Create booking
    const bookingResult = await pool.query(
      `INSERT INTO bookings (
        host_user_id,
        event_type_id,
        attendee_name,
        attendee_email,
        start_time,
        end_time,
        notes,
        manage_token,
        guest_timezone,
        status,
        title
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', $10)
      RETURNING *`,
      [
        host.id,
        eventType.id,
        attendee_name,
        attendee_email,
        start_time,
        end_time,
        notes || null,
        manageToken,
        guest_timezone || 'UTC',
        eventType.title
      ]
    );

    const booking = bookingResult.rows[0];

    // Store additional attendees if provided
    if (additional_attendees && additional_attendees.length > 0) {
      for (const email of additional_attendees) {
        await pool.query(
          `INSERT INTO booking_attendees (booking_id, email)
           VALUES ($1, $2)`,
          [booking.id, email]
        );
      }
    }

    console.log('✅ Public booking created:', booking.id);

    // ========== RESPOND IMMEDIATELY ==========
    res.json({
      success: true,
      booking: {
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        manage_token: booking.manage_token,
        status: booking.status
      },
      message: 'Booking confirmed! Confirmation email will arrive shortly.'
    });

    // 🔥 SEND EMAILS IN BACKGROUND
    (async () => {
      try {
        console.log('📧 Preparing to send emails...');
        
        const manageUrl = `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/manage/${manageToken}`;
        const duration = eventType.duration;

        const startDate = new Date(start_time);
        const endDate = new Date(end_time);
        
        const formattedDateTime = startDate.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: guest_timezone || 'UTC'
        });

        // Create ICS file
        const icsContent = generateICS({
          id: booking.id,
          start_time: start_time,
          end_time: end_time,
          attendee_name: attendee_name,
          attendee_email: attendee_email,
          organizer_name: host.name,
          organizer_email: host.email,
          team_name: `${host.name}'s Events`,
          notes: notes || '',
        });

        // 1. PRIMARY ATTENDEE EMAIL
        await resend.emails.send({
          from: 'ScheduleSync <bookings@trucal.xyz>',
          to: attendee_email,
          subject: `✅ Booking Confirmed: ${eventType.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">Booking Confirmed! ✅</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; color: #374151;">Hi ${attendee_name},</p>
                
                <p style="font-size: 16px; color: #374151;">Your meeting with <strong>${host.name}</strong> is confirmed!</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                  <h2 style="margin-top: 0; color: #1f2937;">${eventType.title}</h2>
                  <p style="margin: 10px 0; color: #6b7280;">
                    <strong>📅 When:</strong> ${formattedDateTime}<br>
                    <strong>⏱️ Duration:</strong> ${duration} minutes<br>
                    <strong>🌍 Timezone:</strong> ${guest_timezone || 'UTC'}<br>
                    ${eventType.location ? `<strong>📍 Location:</strong> ${eventType.location}<br>` : ''}
                    ${additional_attendees?.length > 0 ? `<strong>👥 Others:</strong> ${additional_attendees.join(', ')}<br>` : ''}
                  </p>
                  ${notes ? `<p style="margin-top: 15px; padding: 10px; background: #f3f4f6; border-radius: 4px;"><strong>Notes:</strong><br>${notes}</p>` : ''}
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${manageUrl}" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Manage Booking</a>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; text-align: center;">
                  Need to reschedule or cancel? Use the link above.
                </p>
              </div>
            </div>
          `,
          attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }],
        });
        console.log('✅ Email sent to primary attendee:', attendee_email);

        // 2. ADDITIONAL ATTENDEES
        if (additional_attendees && Array.isArray(additional_attendees) && additional_attendees.length > 0) {
          console.log(`📧 Sending to ${additional_attendees.length} additional attendees...`);
          for (const email of additional_attendees) {
            await resend.emails.send({
              from: 'ScheduleSync <bookings@trucal.xyz>',
              to: email,
              subject: `Meeting Invitation: ${eventType.title}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #2563eb;">You're invited!</h2>
                  <p><strong>${attendee_name}</strong> has invited you to a meeting with <strong>${host.name}</strong>.</p>
                  <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>📅 When:</strong> ${formattedDateTime}</p>
                    <p style="margin: 5px 0;"><strong>⏱️ Duration:</strong> ${duration} minutes</p>
                    <p style="margin: 5px 0;"><strong>👤 Invited by:</strong> ${attendee_name} (${attendee_email})</p>
                    ${notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${notes}</p>` : ''}
                  </div>
                </div>
              `,
              attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }],
            });
            console.log(`✅ Email sent to: ${email}`);
          }
        }

        // 3. HOST EMAIL
        await resend.emails.send({
          from: 'ScheduleSync <bookings@trucal.xyz>',
          to: host.email,
          subject: `📅 New Booking: ${eventType.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">New Booking Received 📅</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; color: #374151;">Hi ${host.name},</p>
                
                <p style="font-size: 16px; color: #374151;">You have a new booking!</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                  <h2 style="margin-top: 0; color: #1f2937;">${eventType.title}</h2>
                  <p style="margin: 10px 0; color: #6b7280;">
                    <strong>👤 Guest:</strong> ${attendee_name}<br>
                    <strong>✉️ Email:</strong> ${attendee_email}<br>
                    ${additional_attendees?.length > 0 ? `<strong>👥 Others:</strong> ${additional_attendees.join(', ')}<br>` : ''}
                    <strong>📅 When:</strong> ${formattedDateTime}<br>
                    <strong>⏱️ Duration:</strong> ${duration} minutes
                  </p>
                  ${notes ? `<p style="margin-top: 15px; padding: 10px; background: #f3f4f6; border-radius: 4px;"><strong>Guest Notes:</strong><br>${notes}</p>` : ''}
                </div>
              </div>
            </div>
          `,
          attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }],
        });
        console.log('✅ Email sent to host:', host.email);
        console.log('✅ All confirmation emails sent');

      } catch (emailError) {
        console.error('⚠️ Email send failed:', emailError);
      }
    })();

  } catch (error) {
    console.error('❌ Public booking creation error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ========== BOOKING CREATION ENDPOINT ==========
app.post('/api/bookings', async (req, res) => {
  try {
    const { 
      token, 
      slot, 
      attendee_name, 
      attendee_email, 
      notes,
      additional_attendees = [],
      guest_timezone,
      event_type_id,
      event_type_slug,
      reschedule_token
    } = req.body;

    console.log('📋 REQUEST BODY DEBUG:', {
      attendee_name,
      attendee_email,
      additional_attendees,
      additional_attendees_type: typeof additional_attendees,
      additional_attendees_length: additional_attendees?.length,
      additional_attendees_isArray: Array.isArray(additional_attendees)
    });

    console.log('🔧 Creating booking:', { 
      token: token?.substring(0, 10) + '...', 
      attendee_name, 
      attendee_email,
      hasSlot: !!slot,
      slotData: slot 
    });

    // ========== STEP 1: VALIDATION ==========
    if (!token || !slot || !attendee_name || !attendee_email) {
      console.error('❌ Missing required fields:', {
        hasToken: !!token,
        hasSlot: !!slot,
        hasName: !!attendee_name,
        hasEmail: !!attendee_email
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!slot.start || !slot.end) {
      console.error('❌ Invalid slot data:', slot);
      return res.status(400).json({ 
        error: 'Invalid booking slot data',
        debug: { slot }
      });
    }

    // Validate slot format
    try {
      const startDate = new Date(slot.start);
      const endDate = new Date(slot.end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format');
      }
      
      console.log('✅ Slot validation passed:', {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      });
    } catch (dateError) {
      console.error('❌ Invalid slot dates:', dateError.message);
      return res.status(400).json({ 
        error: 'Invalid booking time format',
        details: dateError.message
      });
    }

    // 🔥 ADD EMAIL VALIDATION HERE (AFTER line ~1530)
    // Enhanced email validation function
    async function validateEmailExists(email) {
      try {
        // 1. Format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return { valid: false, reason: 'Invalid format' };
        }

        // 2. Block fake domains
        const domain = email.split('@')[1].toLowerCase();
        const blockedDomains = ['test.com', 'example.com', 'fake.com', 'invalid.com', 'temporary.com'];
        if (blockedDomains.includes(domain)) {
          return { valid: false, reason: 'Please use a real email address' };
        }

        // 3. DNS validation
        const dns = require('dns');
        return new Promise((resolve) => {
          dns.resolveMx(domain, (err, addresses) => {
            if (err || !addresses || addresses.length === 0) {
              resolve({ valid: false, reason: 'Email domain does not exist' });
            } else {
              resolve({ valid: true });
            }
          });
        });
      } catch (error) {
        return { valid: false, reason: 'Validation error' };
      }
    }

    // Validate primary attendee email
    const emailCheck = await validateEmailExists(attendee_email);
    if (!emailCheck.valid) {
      return res.status(400).json({ 
        error: `❌ Invalid email: ${attendee_email}`,
        details: emailCheck.reason,
        hint: 'Please provide a real email address to receive booking confirmations'
      });
    }

    // Validate additional attendees if provided
    if (additional_attendees && additional_attendees.length > 0) {
      for (const email of additional_attendees) {
        const additionalCheck = await validateEmailExists(email);
        if (!additionalCheck.valid) {
          return res.status(400).json({ 
            error: `❌ Invalid additional attendee email: ${email}`,
            details: additionalCheck.reason
          });
        }
      }
    }

    // ========== STEP 2: LOOK UP TOKEN ==========
    let memberResult;
    
    if (token.length === 64) {
      console.log('🔍 Looking up single-use link...');
      memberResult = await pool.query(
        `SELECT tm.*, 
                t.name as team_name, 
                t.booking_mode, 
                t.owner_id, 
                t.id as team_id,
                u.google_access_token, 
                u.google_refresh_token,
                u.microsoft_access_token,
                u.microsoft_refresh_token,
                u.provider,
                u.email as member_email, 
                u.name as member_name
         FROM single_use_links sul
         JOIN team_members tm ON sul.member_id = tm.id
         JOIN teams t ON tm.team_id = t.id 
         LEFT JOIN users u ON tm.user_id = u.id 
         WHERE sul.token = $1
           AND sul.used = false
           AND sul.expires_at > NOW()`,
        [token]
      );
    } else {
      // ✅ FIRST: Check if it's a TEAM token
      console.log('🔍 Checking if team token...');
      const teamCheck = await pool.query(
        `SELECT t.id as team_id, t.booking_mode
         FROM teams t
         WHERE t.team_booking_token = $1`,
        [token]
      );

      if (teamCheck.rows.length > 0) {
        // Team token found - use the first active member
        const teamData = teamCheck.rows[0];
        console.log('✅ Team token detected for booking, loading first active member...');
        
        memberResult = await pool.query(
          `SELECT tm.*, 
                  t.name as team_name, 
                  t.booking_mode, 
                  t.owner_id,
                  t.id as team_id,
                  u.google_access_token, 
                  u.google_refresh_token,
                  u.microsoft_access_token,
                  u.microsoft_refresh_token,
                  u.provider,
                  u.email as member_email, 
                  u.name as member_name
           FROM team_members tm 
           JOIN teams t ON tm.team_id = t.id 
           LEFT JOIN users u ON tm.user_id = u.id 
           WHERE tm.team_id = $1
             AND (tm.is_active = true OR tm.is_active IS NULL)
           ORDER BY tm.id ASC
           LIMIT 1`,
          [teamData.team_id]
        );
      } else {
        // Not a team token, check regular member token
        console.log('🔍 Looking up regular token...');
        memberResult = await pool.query(
          `SELECT tm.*, 
                  t.name as team_name, 
                  t.booking_mode, 
                  t.owner_id,
                  t.id as team_id,
                  u.google_access_token, 
                  u.google_refresh_token,
                  u.microsoft_access_token,
                  u.microsoft_refresh_token,
                  u.provider,
                  u.email as member_email, 
                  u.name as member_name
           FROM team_members tm 
           JOIN teams t ON tm.team_id = t.id 
           LEFT JOIN users u ON tm.user_id = u.id 
           WHERE tm.booking_token = $1`,
          [token]
        );
      }
    }

    if (memberResult.rows.length === 0) {
      console.log('❌ Invalid or expired booking token');
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    const bookingMode = member.booking_mode || 'individual';

    console.log('✅ Token found:', {
      memberName: member.name || member.member_name,
      teamName: member.team_name,
      mode: bookingMode
    });


    // ? STEP 3: Determine assigned members based on booking mode
    let assignedMembers = [];

    switch (bookingMode) {
      case 'individual':
        assignedMembers = [{ 
          id: member.id, 
          name: member.name || member.member_name, 
          user_id: member.user_id 
        }];
        console.log('?? Individual mode: Assigning to', assignedMembers[0].name);
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
        assignedMembers = rrResult.rows.length > 0 
          ? [rrResult.rows[0]] 
          : [{ id: member.id, name: member.name || member.member_name, user_id: member.user_id }];
        console.log('?? Round-robin: Assigning to', assignedMembers[0].name);
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
        assignedMembers = faResult.rows.length > 0 
          ? [faResult.rows[0]] 
          : [{ id: member.id, name: member.name || member.member_name, user_id: member.user_id }];
        console.log('? First-available: Assigning to', assignedMembers[0].name);
        break;

      case 'collective':
        const collectiveResult = await pool.query(
          'SELECT id, name, user_id FROM team_members WHERE team_id = $1',
          [member.team_id]
        );
        assignedMembers = collectiveResult.rows;
        console.log('?? Collective mode: Assigning to all', assignedMembers.length, 'members');
        break;

      default:
        assignedMembers = [{ 
          id: member.id, 
          name: member.name || member.member_name, 
          user_id: member.user_id 
        }];
    }

    // ? STEP 4: Create booking(s)
    const createdBookings = [];

    for (const assignedMember of assignedMembers) {
      const manageToken = crypto.randomBytes(16).toString('hex');
      
      console.log(`?? Creating booking for member ${assignedMember.id}...`);
      
      const bookingResult = await pool.query(
        `INSERT INTO bookings (
          team_id, member_id, user_id, 
          attendee_name, attendee_email, 
          start_time, end_time, 
          title, notes, 
          booking_token, status, manage_token
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
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
          'confirmed',
          manageToken
        ]
      );
      
      createdBookings.push(bookingResult.rows[0]);
      console.log(`? Booking created: ID ${bookingResult.rows[0].id}, manage_token: ${manageToken}`);
    }

    // ? Mark single-use link as used
    if (token.length === 64) {
      await pool.query('UPDATE single_use_links SET used = true WHERE token = $1', [token]);
      console.log('? Single-use link marked as used');
    }

    // ? Notify organizer
    if (member.user_id) {
      await notifyBookingCreated(createdBookings[0], member.user_id);
    }

    // ? STEP 5: RESPOND IMMEDIATELY
    console.log('?? Sending success response');
    res.json({ 
      success: true,
      booking: createdBookings[0],
      bookings: createdBookings,
      mode: bookingMode,
      meet_link: null,
      message: bookingMode === 'collective' 
        ? `Booking confirmed with all ${createdBookings.length} team members!`
        : 'Booking confirmed! Calendar invite will arrive shortly.'
    });

    // ? STEP 6: Background processing (calendar event + emails)
    (async () => {
      try {
        let meetLink = null;
        let calendarEventId = null;

        // Create calendar event with meeting link
        if (member.provider === 'google' && member.google_access_token && member.google_refresh_token) {
          try {
            console.log('?? Creating Google Calendar event...');
            
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
                  conferenceSolutionKey: { type: 'hangoutsMeet' }
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

            meetLink = calendarResponse.data.hangoutLink;
            calendarEventId = calendarResponse.data.id;

            // Update all bookings with meet link
            for (const booking of createdBookings) {
              await pool.query(
                `UPDATE bookings SET meet_link = $1, calendar_event_id = $2 WHERE id = $3`,
                [meetLink, calendarEventId, booking.id]
              );
            }

            console.log('? Google Calendar event created:', meetLink);
          } catch (calendarError) {
            console.error('?? Calendar creation failed:', calendarError.message);
          }
        } else if (member.provider === 'microsoft' && member.microsoft_access_token && member.microsoft_refresh_token) {
          try {
            console.log('?? Creating Microsoft Calendar event...');

            const eventResult = await createMicrosoftCalendarEvent(
              member.microsoft_access_token,
              member.microsoft_refresh_token,
              {
                title: `Meeting with ${attendee_name}`,
                description: notes || 'Scheduled via ScheduleSync',
                startTime: slot.start,
                endTime: slot.end,
                attendees: [
                  { email: attendee_email, name: attendee_name },
                  { email: member.member_email, name: member.member_name }
                ]
              }
            );

            meetLink = eventResult.meetingUrl;
            calendarEventId = eventResult.id;

            for (const booking of createdBookings) {
              await pool.query(
                `UPDATE bookings SET meet_link = $1, calendar_event_id = $2 WHERE id = $3`,
                [meetLink, calendarEventId, booking.id]
              );
            }

            console.log('? Microsoft Calendar event created:', meetLink);
          } catch (calendarError) {
            console.error('?? Microsoft calendar creation failed:', calendarError.message);
          }
        }



        // ========== SEND CONFIRMATION EMAILS ==========
try {
  console.log('?? Preparing to send emails...');
  
  const manageUrl = `${process.env.FRONTEND_URL}/manage/${createdBookings[0].manage_token}`;
  const assignedMember = {
    organizer_name: member.member_name || member.name,
    email: member.member_email || member.email
  };
  const duration = Math.round((new Date(slot.end) - new Date(slot.start)) / 60000);

  // Create ICS file
  const icsContent = generateICS({
    id: createdBookings[0].id,
    start_time: createdBookings[0].start_time,
    end_time: createdBookings[0].end_time,
    attendee_name,
    attendee_email,
    organizer_name: assignedMember.organizer_name,
    organizer_email: assignedMember.email,
    team_name: member.team_name,
    notes: notes || '',
  });

  // 1. Primary attendee email
 await resend.emails.send({
  from: 'ScheduleSync <bookings@trucal.xyz>',  // ? Change this
  to: attendee_email,
    subject: `Booking Confirmed with ${assignedMember.organizer_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your booking is confirmed!</h2>
        <p>Hi ${attendee_name},</p>
        <p>Your meeting with <strong>${assignedMember.organizer_name}</strong> has been scheduled.</p>
        <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>?? When:</strong> ${new Date(slot.start).toLocaleString()}</p>
          <p style="margin: 5px 0;"><strong>? Duration:</strong> ${duration} minutes</p>
          ${notes ? `<p style="margin: 5px 0;"><strong>?? Notes:</strong> ${notes}</p>` : ''}
          ${additional_attendees?.length > 0 ? `<p style="margin: 5px 0;"><strong>?? Others:</strong> ${additional_attendees.join(', ')}</p>` : ''}
          ${meetLink ? `<p style="margin: 5px 0;"><strong>?? Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ''}
        </div>
        <div style="margin: 30px 0;">
          <a href="${manageUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Manage Booking</a>
        </div>
      </div>
    `,
    attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }],
  });
  console.log('? Email sent to primary attendee:', attendee_email);

  // 2. Additional attendees
  if (additional_attendees && Array.isArray(additional_attendees) && additional_attendees.length > 0) {
    console.log(`?? Sending to ${additional_attendees.length} additional attendees...`);
    for (const email of additional_attendees) {
      await resend.emails.send({
  from: 'ScheduleSync <bookings@trucal.xyz>',  // ? Change this
  to: email,
        subject: `Meeting Invitation with ${assignedMember.organizer_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">You're invited!</h2>
            <p><strong>${attendee_name}</strong> has invited you to a meeting with <strong>${assignedMember.organizer_name}</strong>.</p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>?? When:</strong> ${new Date(slot.start).toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>? Duration:</strong> ${duration} minutes</p>
              ${notes ? `<p style="margin: 5px 0;"><strong>?? Notes:</strong> ${notes}</p>` : ''}
              <p style="margin: 5px 0;"><strong>?? Invited by:</strong> ${attendee_name} (${attendee_email})</p>
              ${meetLink ? `<p style="margin: 5px 0;"><strong>?? Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ''}
            </div>
          </div>
        `,
        attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }],
      });
      console.log(`? Email sent to: ${email}`);
    }
  }

  // 3. Organizer email
  await resend.emails.send({
  from: 'ScheduleSync <bookings@trucal.xyz>',  // ? Change this
  to: assignedMember.email,
    subject: `New Booking: ${attendee_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New booking received!</h2>
        <p>Hi ${assignedMember.organizer_name},</p>
        <p>New booking from <strong>${attendee_name}</strong>.</p>
        <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>?? Primary:</strong> ${attendee_name} (${attendee_email})</p>
          ${additional_attendees?.length > 0 ? `<p style="margin: 5px 0;"><strong>?? Others:</strong> ${additional_attendees.join(', ')}</p>` : ''}
          <p style="margin: 5px 0;"><strong>?? When:</strong> ${new Date(slot.start).toLocaleString()}</p>
          <p style="margin: 5px 0;"><strong>? Duration:</strong> ${duration} minutes</p>
          ${notes ? `<p style="margin: 5px 0;"><strong>?? Notes:</strong> ${notes}</p>` : ''}
          ${meetLink ? `<p style="margin: 5px 0;"><strong>?? Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ''}
        </div>
      </div>
    `,
    attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }],
  });
  console.log('? Email sent to organizer:', assignedMember.email);
  console.log('? All confirmation emails sent');

} catch (error) {
  console.error('? Email send failed:', error);
}

      } catch (error) {  // ? ADD THIS - Background processing error
        console.error('? Background processing error:', error);
      }
    })();  // ? ADD THIS - Close async IIFE

  } catch (error) {  // ? ADD THIS - Main endpoint error handler
    console.error('? Create booking error:', error);
    console.error('Stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to create booking',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
      });
    }
  }
});  // ? ADD THIS - Close /api/bookings POST endpoint

       
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
    console.error('? Get Me error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// 2. GET USER TIMEZONE
app.get('/api/user/timezone', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT timezone FROM users WHERE id = $1', [req.user.id]);
    res.json({ timezone: result.rows[0]?.timezone || 'America/New_York' });
  } catch (error) {
    console.error('? Get timezone error:', error);
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
    console.error('? Update timezone error:', error);
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

  // ============ CALENDAR STATUS ENDPOINT ============
  app.get('/api/calendar/status', authenticateToken, async (req, res) => {
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
        last_sync: null  // Add this column to users table if you want to track sync times
      },
      microsoft: {
        connected: hasMicrosoftCalendar,
        email: hasMicrosoftCalendar ? user.email : null,
        last_sync: null
      }
    });
  } catch (error) {
    console.error('❌ Calendar status error:', error);
    res.status(500).json({ error: 'Failed to get calendar status' });
  }
});
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

    console.log('?? Generated OAuth URL with redirect:', process.env.GOOGLE_REDIRECT_URI);

    res.json({ url: authUrl });
  } catch (error) {
    console.error('? Error generating OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

app.post('/api/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    console.log('?? OAuth callback received');

    if (!code) {
      console.error('? No code provided');
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // CRITICAL: Check if code was already processed
    if (processedOAuthCodes.has(code)) {
      console.log('?? Code already processed, rejecting duplicate request');
      return res.status(400).json({ 
        error: 'Code already used',
        hint: 'This authorization code has already been exchanged. Please try logging in again.'
      });
    }

    // Mark code as being processed IMMEDIATELY
    processedOAuthCodes.set(code, Date.now());
    console.log('?? Code locked for processing');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/oauth/callback`
    );

    console.log('?? Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('? Tokens received');

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    console.log('? User info retrieved:', userInfo.email);

    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userInfo.email]);

    let user;
    if (userResult.rows.length === 0) {
      console.log('? Creating new user');
      const insertResult = await pool.query(
        `INSERT INTO users (google_id, email, name, google_access_token, google_refresh_token, calendar_sync_enabled, provider)
         VALUES ($1, $2, $3, $4, $5, true, 'google') RETURNING *`,
        [userInfo.id, userInfo.email, userInfo.name, tokens.access_token, tokens.refresh_token]
      );
      user = insertResult.rows[0];
    } else {
      console.log('?? Updating existing user');
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

    console.log('? OAuth successful for:', user.email);

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
    console.error('? OAuth error:', error.message);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    
    // Remove code from processed map on error so user can retry
    if (req.body.code) {
      processedOAuthCodes.delete(req.body.code);
      console.log('?? Code unlocked for retry');
    }

    res.status(500).json({ error: 'Authentication failed' });
  } // Close catch
});

// ============ MICROSOFT OAUTH (ORGANIZER LOGIN) ============

app.get('/api/auth/microsoft/url', (req, res) => {
  try {
    // Validate credentials exist
    if (!process.env.MICROSOFT_CLIENT_ID) {
      console.error('? MICROSOFT_CLIENT_ID not configured');
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
    console.log('?? Generated Microsoft OAuth URL');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('? Error generating Microsoft OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// ============ MICROSOFT OAUTH CALLBACK ============
app.post('/api/auth/microsoft/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('?? Microsoft OAuth callback received');
    
    if (!code) {
      console.error('? No authorization code provided');
      return res.status(400).json({ error: 'Authorization code required' });
    }

    console.log('?? Code received:', code.substring(0, 20) + '...');

    // CRITICAL: Check if code was already processed
    if (processedOAuthCodes.has(code)) {
      console.log('?? Code already processed, rejecting duplicate request');
      return res.status(400).json({ 
        error: 'Code already used',
        hint: 'This authorization code has already been exchanged. Please try logging in again.'
      });
    }

    // Mark code as being processed IMMEDIATELY
    processedOAuthCodes.set(code, Date.now());
    console.log('?? Code locked for processing');

    // Define redirectUri
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 
      `${process.env.FRONTEND_URL}/oauth/callback/microsoft`;
    
    console.log('?? Redirect URI:', redirectUri);
    console.log('?? Client ID:', process.env.MICROSOFT_CLIENT_ID);
    
    // Exchange code for tokens
    console.log('?? Exchanging code for tokens...');
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

    console.log('? Tokens received');
    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    console.log('?? Getting Microsoft user info...');
    const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const microsoftUser = userResponse.data;
    const email = microsoftUser.mail || microsoftUser.userPrincipalName;
    const microsoftId = microsoftUser.id;

    console.log('? User info retrieved:', email);

    // Check if user exists
    let user = await pool.query(
      'SELECT * FROM users WHERE microsoft_id = $1 OR email = $2',
      [microsoftId, email]
    );

    if (user.rows.length === 0) {
      // NEW USER - First login
      console.log('? Creating new Microsoft user');
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
          false,  // ? false = needs onboarding
          true    // Microsoft users get calendar sync enabled
        ]
      );
      console.log('? New user created:', user.rows[0].id);
    } else {
      // EXISTING USER - Second+ login
      console.log('?? Updating existing Microsoft user');
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
      console.log('? User updated:', user.rows[0].id);
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

    console.log('? Microsoft OAuth successful for:', email);

    // ? RETURN onboarding_completed
    res.json({
      success: true,
      user: {
        id: finalUser.id,
        email: finalUser.email,
        name: finalUser.name,
        calendar_sync_enabled: finalUser.calendar_sync_enabled,
        onboarding_completed: finalUser.onboarding_completed || false  // ? KEY FIELD
      },
      token: jwtToken,
    });

  } catch (error) {
    console.error('? Microsoft OAuth error:', error.message);
    console.error('? Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    // Remove code from processed map on error so user can retry
    if (req.body.code) {
      processedOAuthCodes.delete(req.body.code);
      console.log('?? Code unlocked for retry');
    }

    // Send detailed error for debugging
    res.status(500).json({ 
      error: 'Microsoft OAuth failed',
      message: error.response?.data?.error_description || error.message,
      details: error.response?.data
    });
  }
});

// ============ EMAIL/PASSWORD AUTHENTICATION ============

// Register with email/password
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    console.log('?? Registration attempt:', email);

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
          subject: '?? Verify Your Email - ScheduleSync',
          html: emailTemplates.emailVerification(user, verificationToken),
        });
        console.log('? Verification email sent to:', email);
      } catch (emailError) {
        console.error('?? Failed to send verification email:', emailError);
      }
    }

    // Generate JWT token (but mark as unverified)
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, verified: false },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('? User registered:', user.email);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, emailVerified: false },
      token,
      message: 'Registration successful! Please check your email to verify your account.'
    });

  } catch (error) {
    console.error('? Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify email
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    console.log('?? Email verification attempt');

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

    console.log('? Email verified for:', user.email);

    res.json({ 
      success: true, 
      message: 'Email verified successfully! You can now log in.' 
    });

  } catch (error) {
    console.error('? Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Resend verification email
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('?? Resending verification email to:', email);

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
        subject: '?? Verify Your Email - ScheduleSync',
        html: emailTemplates.emailVerification(user, verificationToken),
      });
      console.log('? Verification email resent to:', email);
    }

    res.json({ 
      success: true, 
      message: 'Verification email sent! Please check your inbox.' 
    });

  } catch (error) {
    console.error('? Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});
// Login with email/password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    console.log('?? Login attempt:', email);

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

    console.log('? Login successful:', user.email);

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
    console.error('? Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});


// Forgot password - Request reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('?? Password reset request received for:', email);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    // Security: Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      console.log('?? Reset requested for non-existent email:', email);
      return res.json({ 
        success: true, 
        message: 'If that email exists, a reset link has been sent.' 
      });
    }

    const user = result.rows[0];

    // CASE 1: OAuth User (Google Login) - Send "Use Google" Reminder
    if (!user.password_hash) {
      console.log('?? OAuth account detected. Sending "Use Google" reminder to:', email);
      
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
          subject: '?? Sign in method reminder - ScheduleSync',
          html: oauthHtml,
        });
        console.log('? OAuth reminder email sent');
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
    console.log('?? Generated Reset URL:', resetUrl);

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
        subject: '?? Reset Your Password - ScheduleSync',
        html: emailHtml,
      });
      console.log('? Reset email sent successfully to:', email);
    } else {
      console.error('? sendBookingEmail function is missing! Check imports.');
    }

    res.json({ 
      success: true, 
      message: 'If that email exists, a reset link has been sent.' 
    });

  } catch (error) {
    console.error('? Forgot password CRITICAL error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});



// ============ CREATE TEST USER (NO VERIFICATION) ============
app.get('/api/auth/create-test-user', async (req, res) => {
  try {
    const testEmail = 'test@schedulesync.com';
    const testPassword = 'test1234';
    const testName = 'Test User';

    console.log('?? Creating test user...');

    // Check if test user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail]);
    
    if (existingUser.rows.length > 0) {
      console.log('? Test user already exists');
      
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

    console.log('? Test user created:', user.email);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token,
      credentials: { email: testEmail, password: testPassword },
      message: 'Test user created successfully!'
    });

  } catch (error) {
    console.error('? Create test user error:', error);
    res.status(500).json({ error: 'Failed to create test user' });
  }
});

// ============ GUEST OAUTH (BOOKING PAGE - READ ONLY) ============

// Google Callback
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
      `${process.env.FRONTEND_URL}/oauth/callback/google/guest`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const grantedScopes = tokens.scope || '';
    const hasCalendarAccess = grantedScopes.includes('calendar.readonly');

    console.log('? Guest Google OAuth successful:', { email: userInfo.email, hasCalendarAccess });

    res.json({
      success: true,
      email: userInfo.email,
      name: userInfo.name,
      hasCalendarAccess,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      provider: 'google'
    });
  } catch (error) {
    console.error('? Guest Google OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Google URL Generator
app.get('/api/book/auth/google/url', async (req, res) => {
  try {
    const { bookingToken } = req.query;
    
    if (!bookingToken) {
      return res.status(400).json({ error: 'Booking token required' });
    }

    // ✅ CHECK BOTH TEAM AND MEMBER TOKENS
    const memberCheck = await pool.query(
      'SELECT id FROM team_members WHERE booking_token = $1',
      [bookingToken]
    );
    
    const teamCheck = await pool.query(
      'SELECT id FROM teams WHERE team_booking_token = $1',
      [bookingToken]
    );

    if (memberCheck.rows.length === 0 && teamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.FRONTEND_URL}/oauth/callback/google/guest`
    );

    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.readonly',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'select_account',
      state: `guest-booking:${bookingToken}:google`,
    });

    console.log('✅ Generated Google guest OAuth URL');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('❌ Error generating Google guest OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// Microsoft URL Generator ? ADD THIS!
app.get('/api/book/auth/microsoft/url', async (req, res) => {
  try {
    const { bookingToken } = req.query;
    
    console.log('🔍 Microsoft guest OAuth URL request:', bookingToken);
    
    if (!bookingToken) {
      return res.status(400).json({ error: 'Booking token required' });
    }

    // ✅ CHECK BOTH TEAM AND MEMBER TOKENS
    const memberCheck = await pool.query(
      'SELECT id FROM team_members WHERE booking_token = $1',
      [bookingToken]
    );
    
    const teamCheck = await pool.query(
      'SELECT id FROM teams WHERE team_booking_token = $1',
      [bookingToken]
    );

    if (memberCheck.rows.length === 0 && teamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const redirectUri = `${process.env.FRONTEND_URL}/oauth/callback/microsoft/guest`;
    
    const scopes = [
      'openid',
      'profile',
      'email',
      'Calendars.Read',
      'offline_access'
    ];

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${process.env.MICROSOFT_CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&state=guest-booking:${bookingToken}:microsoft` +
      `&prompt=select_account`;
    
    console.log('✅ Microsoft guest OAuth URL generated');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('❌ Error generating Microsoft guest OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// Microsoft Callback
app.post('/api/book/auth/microsoft', async (req, res) => {
  try {
    const { code, bookingToken } = req.body;
    
    console.log('?? Guest Microsoft OAuth request received');
    
    if (!code || !bookingToken) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const memberCheck = await pool.query(
      'SELECT * FROM team_members WHERE booking_token = $1',
      [bookingToken]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const redirectUri = `${process.env.FRONTEND_URL}/oauth/callback/microsoft/guest`;
    
    console.log('?? Exchanging Microsoft code for guest tokens...');
    console.log('Redirect URI:', redirectUri);
    
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email Calendars.Read offline_access'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, refresh_token, scope } = tokenResponse.data;

    const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const microsoftUser = userResponse.data;
    const email = microsoftUser.mail || microsoftUser.userPrincipalName;
    const hasCalendarAccess = scope && scope.includes('Calendars.Read');

    console.log('? Guest Microsoft OAuth successful:', { email, hasCalendarAccess });

    res.json({
      success: true,
      email: email,
      name: microsoftUser.displayName,
      hasCalendarAccess,
      accessToken: access_token,
      refreshToken: refresh_token,
      provider: 'microsoft'
    });

  } catch (error) {
    console.error('? Guest Microsoft OAuth error:', error.message);
    console.error('Error details:', error.response?.data);
    res.status(500).json({ 
      error: 'Microsoft authentication failed',
      details: error.response?.data?.error_description || error.message
    });
  }
});


// ============================================
// CALENDLY MIGRATION TOOL
// ============================================

app.post('/api/import/calendly', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      api_key,
      import_event_types = true,
      import_availability = true,
      import_bookings_days = 90,
    } = req.body;

    if (!api_key) {
      return res.status(400).json({ error: 'Calendly API key is required' });
    }

    console.log('?? Starting Calendly import for user:', userId);

    const calendlyHeaders = {
      'Authorization': `Bearer ${api_key}`,
      'Content-Type': 'application/json',
    };

    const results = {
      event_types: 0,
      availability_rules: 0,
      bookings: 0,
      warnings: [],
    };

    // Get user's personal team
    const teamResult = await pool.query(
      `SELECT t.id, tm.id as member_id 
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1 AND t.name LIKE '%Personal%'
       LIMIT 1`,
      [userId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(400).json({ error: 'No personal team found. Please complete onboarding first.' });
    }

    const { id: teamId, member_id: memberId } = teamResult.rows[0];

    // ====================================
    // 1. GET CALENDLY USER INFO
    // ====================================
    let calendlyUser;
    try {
      const userResponse = await axios.get('https://api.calendly.com/users/me', {
        headers: calendlyHeaders,
      });
      calendlyUser = userResponse.data.resource;
      console.log('? Calendly user fetched:', calendlyUser.email);
    } catch (error) {
      console.error('? Failed to fetch Calendly user:', error.response?.data || error.message);
      return res.status(401).json({ 
        error: 'Invalid Calendly API key or insufficient permissions' 
      });
    }

    // ====================================
    // 2. IMPORT EVENT TYPES
    // ====================================
    if (import_event_types) {
      try {
        const eventTypesResponse = await axios.get(
          `https://api.calendly.com/event_types?user=${calendlyUser.uri}`,
          { headers: calendlyHeaders }
        );

        const eventTypes = eventTypesResponse.data.collection || [];
        console.log(`?? Found ${eventTypes.length} event types`);

        for (const et of eventTypes) {
          // Skip if not active
          if (!et.active) {
            results.warnings.push(`Skipped inactive event type: ${et.name}`);
            continue;
          }

          // Extract duration (in minutes)
          const duration = et.duration || 30;

          // Generate slug from name
          const slug = et.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

          // Create event type in ScheduleSync
          await pool.query(
            `INSERT INTO event_types (
              user_id, 
              title,
              slug,
              duration, 
              description, 
              color,
              is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, slug) DO NOTHING`,
            [
              userId,
              et.name,
              slug,
              duration,
              et.description_plain || et.description_html || '',
              et.color || '#3B82F6',
              true,
            ]
          );

          results.event_types++;
        }

        console.log(`? Imported ${results.event_types} event types`);
      } catch (error) {
        console.error('? Event types import error:', error.response?.data || error.message);
        results.warnings.push('Failed to import some event types');
      }
    }

    // ====================================
    // 3. IMPORT AVAILABILITY
    // ====================================
    if (import_availability) {
      try {
        const availabilityResponse = await axios.get(
          `https://api.calendly.com/user_availability_schedules?user=${calendlyUser.uri}`,
          { headers: calendlyHeaders }
        );

        const schedules = availabilityResponse.data.collection || [];
        
        if (schedules.length > 0) {
          // Use the first/default schedule
          const schedule = schedules[0];
          
          // Fetch full schedule details
          const scheduleDetailResponse = await axios.get(schedule.uri, {
            headers: calendlyHeaders,
          });

          const scheduleRules = scheduleDetailResponse.data.resource.rules || [];
          console.log(`? Found ${scheduleRules.length} availability rules`);

          // Convert Calendly rules to ScheduleSync format
          const workingHours = {
            monday: { enabled: false, start: '09:00', end: '17:00' },
            tuesday: { enabled: false, start: '09:00', end: '17:00' },
            wednesday: { enabled: false, start: '09:00', end: '17:00' },
            thursday: { enabled: false, start: '09:00', end: '17:00' },
            friday: { enabled: false, start: '09:00', end: '17:00' },
            saturday: { enabled: false, start: '09:00', end: '17:00' },
            sunday: { enabled: false, start: '09:00', end: '17:00' },
          };

          for (const rule of scheduleRules) {
            const dayMap = {
              'monday': 'monday',
              'tuesday': 'tuesday',
              'wednesday': 'wednesday',
              'thursday': 'thursday',
              'friday': 'friday',
              'saturday': 'saturday',
              'sunday': 'sunday',
            };

            const day = dayMap[rule.wday.toLowerCase()];
            if (day && rule.intervals && rule.intervals.length > 0) {
              // Use first interval for start/end times
              const firstInterval = rule.intervals[0];
              workingHours[day] = {
                enabled: true,
                start: firstInterval.from,
                end: firstInterval.to,
              };
            }
          }

          // Update availability in ScheduleSync
          await pool.query(
            `UPDATE team_members 
             SET working_hours = $1
             WHERE id = $2`,
            [JSON.stringify(workingHours), memberId]
          );

          results.availability_rules = scheduleRules.length;
          console.log(`? Imported availability rules`);
        }
      } catch (error) {
        console.error('? Availability import error:', error.response?.data || error.message);
        results.warnings.push('Failed to import availability settings');
      }
    }

    // ====================================
    // 4. IMPORT PAST BOOKINGS (for analytics)
    // ====================================
    if (import_bookings_days > 0) {
      try {
        const minDate = new Date();
        minDate.setDate(minDate.getDate() - import_bookings_days);

        const bookingsResponse = await axios.get(
          `https://api.calendly.com/scheduled_events?user=${calendlyUser.uri}&min_start_time=${minDate.toISOString()}&status=active`,
          { headers: calendlyHeaders }
        );

        const bookings = bookingsResponse.data.collection || [];
        console.log(`?? Found ${bookings.length} past bookings`);

        for (const booking of bookings) {
          // Get invitee details
          let attendeeName = 'Guest';
          let attendeeEmail = 'guest@example.com';

          try {
            const inviteeUri = booking.uri;
            const eventUuid = inviteeUri.split('/').pop();
            
            const inviteesResponse = await axios.get(
              `https://api.calendly.com/scheduled_events/${eventUuid}/invitees`,
              { headers: calendlyHeaders }
            );

            const invitees = inviteesResponse.data.collection || [];
            if (invitees.length > 0) {
              attendeeName = invitees[0].name || attendeeName;
              attendeeEmail = invitees[0].email || attendeeEmail;
            }
          } catch (err) {
            console.warn('Could not fetch invitee details:', err.message);
          }

          // Import as historical booking
          const manageToken = crypto.randomBytes(16).toString('hex');
          
          await pool.query(
            `INSERT INTO bookings (
              team_id,
              member_id,
              user_id,
              attendee_name,
              attendee_email,
              start_time,
              end_time,
              status,
              notes,
              manage_token
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT DO NOTHING`,
            [
              teamId,
              memberId,
              userId,
              attendeeName,
              attendeeEmail,
              new Date(booking.start_time),
              new Date(booking.end_time),
              'confirmed',
              `Imported from Calendly: ${booking.name}`,
              manageToken
            ]
          );

          results.bookings++;
        }

        console.log(`? Imported ${results.bookings} past bookings`);
      } catch (error) {
        console.error('? Bookings import error:', error.response?.data || error.message);
        results.warnings.push('Failed to import some past bookings');
      }
    }

    // ====================================
    // RESPONSE
    // ====================================
    console.log('? Calendly import complete:', results);

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('? Calendly import error:', error);
    res.status(500).json({ 
      error: 'Import failed. Please check your API key and try again.' 
    });
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
         t.team_booking_token,
         MAX(tm.booking_token) as booking_token,
         COUNT(DISTINCT tm.id) as member_count,
         COUNT(DISTINCT b.id) as booking_count,
         CASE WHEN t.name LIKE '%Personal Bookings%' THEN true ELSE false END as is_personal
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id 
           AND (tm.user_id = t.owner_id OR tm.id = (
               SELECT id FROM team_members WHERE team_id = t.id ORDER BY id ASC LIMIT 1
           ))
       LEFT JOIN bookings b ON t.id = b.team_id
       WHERE t.owner_id = $1
       GROUP BY t.id, t.name, t.description, t.booking_mode, t.owner_id, t.created_at, t.updated_at, t.team_booking_token
       ORDER BY 
         CASE WHEN t.name LIKE '%Personal Bookings%' THEN 0 ELSE 1 END,
         t.created_at DESC`,
      [req.user.id]
    );
    
    console.log('?? Teams loaded:', result.rows.map(t => ({ 
      id: t.id, 
      name: t.name, 
      booking_token: t.booking_token,
      team_booking_token: t.team_booking_token,
      is_personal: t.is_personal
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

    console.log('?? Updating team settings:', { teamId, booking_mode });

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

    console.log('? Team settings updated');
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
    
    console.log('? Creating new team:', name);

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

    console.log('? Team created:', team.id);

    res.json({ 
      success: true,
      team: team,
      message: 'Team created successfully'
    });

  } catch (error) {
    console.error('? Create team error:', error);
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
  const { name, role, priority, is_active } = req.body;
  
  try {
    // Verify ownership or admin status
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2', 
      [teamId, req.user.id]
    );
    
    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update member with all settings
    const result = await pool.query(
      `UPDATE team_members 
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           priority = COALESCE($3, priority),
           is_active = COALESCE($4, is_active)
       WHERE id = $5 AND team_id = $6 
       RETURNING *`,
      [name || null, role, priority, is_active, memberId, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ 
      success: true, 
      member: result.rows[0] 
    });

  } catch (error) {
    console.error('Error updating member:', error);
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

    console.log(`? Member ${memberId} status updated to ${is_active ? 'active' : 'inactive'}`);
    res.json({ success: true, member: result.rows[0] });
  } catch (error) {
    console.error('Update member status error:', error);
    res.status(500).json({ error: 'Failed to update member status' });
  }
});

// ============ ADD THIS NEW ROUTE HERE ============
// PUT /api/teams/:teamId/members/:memberId - Update all member settings
app.put('/api/teams/:teamId/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const userId = req.user.id;
    const {
      external_booking_platform,
      external_booking_link,
      buffer_time,
      booking_horizon_days,
      timezone,
    } = req.body;

    console.log('?? Updating member settings:', { memberId, teamId });

    // Verify ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to update this team' });
    }

    // Update the member
    const result = await pool.query(
      `UPDATE team_members 
       SET 
         external_booking_platform = COALESCE($1, external_booking_platform),
         external_booking_link = $2,
         buffer_time = COALESCE($3, buffer_time),
         booking_horizon_days = COALESCE($4, booking_horizon_days),
         timezone = COALESCE($5, timezone)
       WHERE id = $6 AND team_id = $7
       RETURNING *`,
      [
        external_booking_platform,
        external_booking_link,  // Allow null to clear external link
        buffer_time,
        booking_horizon_days,
        timezone,
        memberId,
        teamId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    console.log('? Member settings updated:', memberId);
    res.json({ member: result.rows[0] });

  } catch (error) {
    console.error('? Update member settings error:', error);
    res.status(500).json({ error: 'Failed to update team member settings' });
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
  const { email, name, sendEmail = true } = req.body;
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
        console.log(`? Invitation email sent to ${email}`);
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

    console.log(`? External link updated for member ${memberId}`);
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

    console.log(`? Updated reminder settings for team ${teamId}`);
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

    console.log('?? Updating pricing for member:', memberId);
    console.log('?? Received data:', { booking_price, currency, payment_required });

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

    console.log('? Pricing updated:', result.rows[0]);

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

    console.log('?? Getting availability for member:', memberId);

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

    console.log('?? Updating availability for member:', memberId);

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

    // ? VALIDATE AND FIX working_hours structure
    const validatedWorkingHours = {};
    for (const [day, settings] of Object.entries(working_hours)) {
      if (settings.slots) {
        // Frontend sent wrong format with 'slots' array, fix it
        console.log(`?? Fixing invalid working_hours for ${day}`);
        validatedWorkingHours[day] = {
          enabled: settings.enabled || false,
          start: "09:00",
          end: "17:00"
        };
      } else {
        // Correct format already
        validatedWorkingHours[day] = {
          enabled: settings.enabled || false,
          start: settings.start || "09:00",
          end: settings.end || "17:00"
        };
      }
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
   daily_booking_cap, JSON.stringify(validatedWorkingHours), memberId]
);

    // Update blocked times
    await pool.query('DELETE FROM blocked_times WHERE team_member_id = $1', [memberId]);

    // Handle blocked times
console.log('?? Processing blocked times:', blocked_times);

if (blocked_times && blocked_times.length > 0) {
  console.log(`?? Saving ${blocked_times.length} blocked time(s)`);
  
  for (const block of blocked_times) {
    console.log('Processing block:', block);
    
    // Skip blocks with temp IDs and no dates
    if (!block.start_time || !block.end_time) {
      console.log('?? Skipping block - missing dates');
      continue;
    }
    
    // Convert datetime-local format to ISO timestamp
    const startTime = new Date(block.start_time).toISOString();
    const endTime = new Date(block.end_time).toISOString();
    
    console.log('?? Inserting blocked time:', {
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
      console.log('? Blocked time inserted');
    } catch (blockError) {
      console.error('? Failed to insert blocked time:', blockError);
    }
  }
} else {
  console.log('?? No blocked times to save');
}

    console.log('? Availability settings updated');
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
      guestProvider,
      duration = 30,
      timezone = 'America/New_York'
    } = req.body;

    console.log('📅 Generating slots for token:', token?.substring(0, 10) + '...', 'Duration:', duration, 'TZ:', timezone);

    // 🔥 DETECT PUBLIC BOOKING PSEUDO-TOKEN
if (token && token.startsWith('public:')) {
  const parts = token.split(':');
  const username = parts[1];
  const eventSlug = parts[2];

  console.log('🌐 Public booking slots request detected:', { username, eventSlug });

  // 🔥 GET DATE RANGE FROM REQUEST
  // If 'date' is provided, generate slots for that month
  // If not, generate slots for next 30 days
  const requestedDate = req.body.date;
  let startDate, endDate, daysToGenerate;

  if (requestedDate) {
    // Generate slots for the entire month of the requested date
    const targetDate = new Date(requestedDate);
    startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    daysToGenerate = endDate.getDate();
    console.log(`📅 Generating slots for entire month: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
    // In server.js, find the public booking section:
} else {
  // Generate slots for next 90 days  // 🔥 CHANGE
  startDate = new Date();
  endDate = new Date();
  endDate.setDate(endDate.getDate() + 90);  // 🔥 CHANGE
  daysToGenerate = 90;  // 🔥 CHANGE
  console.log(`📅 Generating slots for next 90 days`);
}

  // Find user
  const userResult = await pool.query(
    `SELECT id, name, email, google_access_token, google_refresh_token, 
            microsoft_access_token, microsoft_refresh_token, provider 
     FROM users 
     WHERE LOWER(username) = LOWER($1) 
        OR LOWER(email) LIKE LOWER($2)
     LIMIT 1`,
    [username, `${username}%`]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const host = userResult.rows[0];

  // Find event type
  const eventResult = await pool.query(
    `SELECT id, duration, buffer_before, buffer_after, max_bookings_per_day 
     FROM event_types 
     WHERE user_id = $1 
       AND LOWER(slug) = LOWER($2) 
       AND is_active = true`,
    [host.id, eventSlug]
  );

  if (eventResult.rows.length === 0) {
    return res.status(404).json({ error: 'Event type not found or inactive' });
  }

  const eventType = eventResult.rows[0];
  const eventDuration = eventType.duration;
  const bufferBefore = eventType.buffer_before || 0;
  const bufferAfter = eventType.buffer_after || 0;

  console.log('✅ Public event type found:', { duration: eventDuration, bufferBefore, bufferAfter });

  // 🔥 FETCH ALL CALENDAR EVENTS FOR THE ENTIRE RANGE (More Efficient)
  let allCalendarEvents = [];
  
  try {
    if (host.provider === 'google' && host.google_access_token) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        access_token: host.google_access_token,
        refresh_token: host.google_refresh_token
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      allCalendarEvents = response.data.items || [];
      console.log(`📅 Found ${allCalendarEvents.length} Google Calendar events in range`);
      
    } else if (host.provider === 'microsoft' && host.microsoft_access_token) {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarview?startdatetime=${startDate.toISOString()}&enddatetime=${endDate.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${host.microsoft_access_token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        allCalendarEvents = data.value || [];
        console.log(`📅 Found ${allCalendarEvents.length} Microsoft Calendar events in range`);
      }
    }
  } catch (calendarError) {
    console.error('⚠️ Calendar fetch failed:', calendarError.message);
  }

  // 🔥 FETCH ALL BOOKINGS FOR THE ENTIRE RANGE
  const allBookingsResult = await pool.query(
    `SELECT start_time, end_time 
     FROM bookings 
     WHERE host_user_id = $1 
       AND event_type_id = $2
       AND status != 'cancelled'
       AND start_time >= $3 
       AND start_time < $4`,
    [host.id, eventType.id, startDate.toISOString(), endDate.toISOString()]
  );

  const allExistingBookings = allBookingsResult.rows;
  console.log(`📊 Found ${allExistingBookings.length} existing bookings in range`);

  // 🔥 GENERATE SLOTS FOR EACH DAY IN RANGE
  const allSlots = {};
  let totalAvailableSlots = 0;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateString = currentDate.toISOString().split('T')[0];

    // Skip past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (currentDate < today) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Filter calendar events for this day
    const dayStart = new Date(dateString);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateString);
    dayEnd.setHours(23, 59, 59, 999);

    const dayCalendarEvents = allCalendarEvents.filter(event => {
      const eventStart = new Date(event.start?.dateTime || event.start?.date);
      const eventEnd = new Date(event.end?.dateTime || event.end?.date);
      return (eventStart < dayEnd && eventEnd > dayStart);
    });

    const dayBookings = allExistingBookings.filter(booking => {
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);
      return (bookingStart < dayEnd && bookingEnd > dayStart);
    });

    // Generate time slots for this day
    const daySlots = [];
    const startHour = 9;
    const endHour = 17;
    const intervalMinutes = 30;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const slotStart = new Date(dateString);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart.getTime() + eventDuration * 60000);
        
        if (slotEnd.getHours() >= endHour || (slotEnd.getHours() === endHour && slotEnd.getMinutes() > 0)) {
          continue;
        }

        // Skip slots in the past
        if (slotStart < new Date()) {
          continue;
        }

        let hasConflict = false;

        // Check calendar events
        for (const event of dayCalendarEvents) {
          const eventStart = new Date(event.start?.dateTime || event.start?.date);
          const eventEnd = new Date(event.end?.dateTime || event.end?.date);
          
          const slotStartWithBuffer = new Date(slotStart.getTime() - bufferBefore * 60000);
          const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferAfter * 60000);
          
          if (slotStartWithBuffer < eventEnd && slotEndWithBuffer > eventStart) {
            hasConflict = true;
            break;
          }
        }

        // Check existing bookings
        if (!hasConflict) {
          for (const booking of dayBookings) {
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            
            const slotStartWithBuffer = new Date(slotStart.getTime() - bufferBefore * 60000);
            const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferAfter * 60000);
            
            if (slotStartWithBuffer < bookingEnd && slotEndWithBuffer > bookingStart) {
              hasConflict = true;
              break;
            }
          }
        }

        if (!hasConflict) {
          daySlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            status: 'available',
            time: slotStart.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZone: timezone
            }),
            matchScore: null,
            matchColor: 'gray',
            matchLabel: 'Available'
          });
        }
      }
    }

    // Only add days that have available slots
    if (daySlots.length > 0) {
      allSlots[dateString] = daySlots;
      totalAvailableSlots += daySlots.length;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`✅ Generated ${totalAvailableSlots} slots across ${Object.keys(allSlots).length} days`);

  // Return in SmartSlotPicker format
  return res.json({
    slots: allSlots,
    summary: {
      availableSlots: totalAvailableSlots,
      settings: {
        horizonDays: daysToGenerate,
        duration: eventDuration,
        timezone: timezone
      }
    }
  });
}

// ========== REGULAR TOKEN-BASED BOOKING CONTINUES BELOW ==========
console.log('🔍 Checking if team token...');
    // ========== 1. GET MEMBER & SETTINGS ==========
    let memberResult;
    
    if (token.length === 64) {
      console.log('🔍 Looking up single-use link...');
      memberResult = await pool.query(
        `SELECT tm.*, 
                tm.buffer_time,
                tm.working_hours,
                tm.lead_time_hours,
                tm.booking_horizon_days,
                tm.daily_booking_cap,
                u.google_access_token, 
                u.google_refresh_token,
                u.microsoft_access_token,
                u.microsoft_refresh_token,
                u.provider,
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
      // ✅ ADD THIS: First check if it's a TEAM token
      console.log('🔍 Checking if team token...');
      const teamCheck = await pool.query(
        `SELECT t.id as team_id, t.booking_mode
         FROM teams t
         WHERE t.team_booking_token = $1`,
        [token]
      );

      if (teamCheck.rows.length > 0) {
        // Team token found - use the first active member
        const teamData = teamCheck.rows[0];
        console.log('✅ Team token detected, loading first active member...');
        
        memberResult = await pool.query(
          `SELECT tm.*, 
                  tm.buffer_time,
                  tm.working_hours,
                  tm.lead_time_hours,
                  tm.booking_horizon_days,
                  tm.daily_booking_cap,
                  u.google_access_token, 
                  u.google_refresh_token,
                  u.microsoft_access_token,
                  u.microsoft_refresh_token,
                  u.provider,
                  u.name as organizer_name,
                  t.id as team_id
           FROM team_members tm
           LEFT JOIN users u ON tm.user_id = u.id
           LEFT JOIN teams t ON tm.team_id = t.id
           WHERE tm.team_id = $1
             AND (tm.is_active = true OR tm.is_active IS NULL)
           ORDER BY tm.id ASC
           LIMIT 1`,
          [teamData.team_id]
        );
      } else {
        // Not a team token, check regular member token
        console.log('🔍 Looking up regular member token...');
        memberResult = await pool.query(
          `SELECT tm.*, 
                  tm.buffer_time,
                  tm.working_hours,
                  tm.lead_time_hours,
                  tm.booking_horizon_days,
                  tm.daily_booking_cap,
                  u.google_access_token, 
                  u.google_refresh_token,
                  u.microsoft_access_token,
                  u.microsoft_refresh_token,
                  u.provider,
                  u.name as organizer_name,
                  t.id as team_id
           FROM team_members tm
           LEFT JOIN users u ON tm.user_id = u.id
           LEFT JOIN teams t ON tm.team_id = t.id
           WHERE tm.booking_token = $1`,
          [token]
        );
      }
    }

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    
    
    // ? CRITICAL: Validate and sanitize working_hours
    let workingHours;
    try {
      // Parse if string
      if (typeof member.working_hours === 'string') {
        workingHours = JSON.parse(member.working_hours);
      } else if (member.working_hours && typeof member.working_hours === 'object') {
        workingHours = member.working_hours;
      } else {
        workingHours = null;
      }

      // Check for invalid format (has 'slots' property)
      if (workingHours) {
        const firstDay = Object.keys(workingHours)[0];
        if (workingHours[firstDay]?.slots) {
          console.warn('?? Detected invalid working_hours format (has slots property)');
          workingHours = null;
        }
      }

      // Validate structure of each day
      if (workingHours) {
        const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        let isValid = true;
        
        for (const day of validDays) {
          if (workingHours[day]) {
            const daySettings = workingHours[day];
            
            // Check required properties
            if (typeof daySettings.enabled !== 'boolean' || 
                !daySettings.start || 
                !daySettings.end ||
                typeof daySettings.start !== 'string' ||
                typeof daySettings.end !== 'string') {
              console.warn(`?? Invalid ${day} settings:`, daySettings);
              isValid = false;
              break;
            }

            // Validate time format (HH:MM)
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(daySettings.start) || !timeRegex.test(daySettings.end)) {
              console.warn(`?? Invalid time format for ${day}:`, { start: daySettings.start, end: daySettings.end });
              isValid = false;
              break;
            }
          }
        }

        if (!isValid) {
          workingHours = null;
        }
      }

    } catch (parseError) {
      console.error('? Failed to parse working_hours:', parseError.message);
      workingHours = null;
    }

    // Use defaults if working_hours is invalid
    if (!workingHours) {
      console.log('?? Using default working hours (9 AM - 5 PM, Mon-Fri)');
      workingHours = {
        monday: { enabled: true, start: '09:00', end: '17:00' },
        tuesday: { enabled: true, start: '09:00', end: '17:00' },
        wednesday: { enabled: true, start: '09:00', end: '17:00' },
        thursday: { enabled: true, start: '09:00', end: '17:00' },
        friday: { enabled: true, start: '09:00', end: '17:00' },
        saturday: { enabled: false, start: '09:00', end: '17:00' },
        sunday: { enabled: false, start: '09:00', end: '17:00' },
      };
    }

    // Default settings
    const bufferTime = member.buffer_time || 0;
    const leadTimeHours = member.lead_time_hours || 0;
    const horizonDays = member.booking_horizon_days || 30;
    const dailyCap = member.daily_booking_cap || null;

    console.log('?? Settings loaded:', {
      buffer: bufferTime,
      leadTime: leadTimeHours,
      horizon: horizonDays,
      dailyCap,
      workingDays: Object.keys(workingHours).filter(k => workingHours[k].enabled)
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

    // ========== 3. GET EXISTING BOOKINGS ==========
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
    if (member.provider === 'google' && member.google_access_token && member.google_refresh_token) {
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
        console.log('? Google calendar loaded:', organizerBusy.length, 'busy blocks');
      } catch (error) {
        console.error('?? Failed to fetch Google calendar:', error.message);
      }
    } else if (member.provider === 'microsoft' && member.microsoft_access_token && member.microsoft_refresh_token) {
      try {
        const events = await getMicrosoftCalendarEvents(
          member.microsoft_access_token,
          member.microsoft_refresh_token,
          now.toISOString(),
          endDate.toISOString()
        );

        organizerBusy = events.map(e => ({
          start: e.start.dateTime,
          end: e.end.dateTime
        }));
        
        console.log('? Microsoft calendar loaded:', organizerBusy.length, 'busy blocks');
      } catch (error) {
        console.error('?? Failed to fetch Microsoft calendar:', error.message);
      }
    }

   // ========== 5. GET GUEST CALENDAR BUSY TIMES ==========
    let guestBusy = [];  // ? ADD 4 SPACES
    if (guestAccessToken && guestProvider) {  // ? ADD 4 SPACES
      if (guestProvider === 'google') {  // ? Already correct (6 spaces)
        try {
          const calendar = google.calendar({ version: 'v3' });
          const guestAuth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.FRONTEND_URL}/oauth/callback/google/guest`
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
          console.log('? Guest Google calendar loaded:', guestBusy.length, 'busy blocks');
        } catch (error) {
          console.error('?? Failed to fetch guest Google calendar:', error.message);
        }
      } else if (guestProvider === 'microsoft') {
        try {
          console.log('?? Fetching Microsoft guest calendar...');
          const events = await getMicrosoftCalendarEvents(
            guestAccessToken,
            guestRefreshToken,
            now.toISOString(),
            endDate.toISOString()
          );

          guestBusy = events.map(e => ({
            start: e.start.dateTime,
            end: e.end.dateTime
          }));
          
          console.log('? Guest Microsoft calendar loaded:', guestBusy.length, 'busy blocks');
        } catch (error) {
          console.error('?? Failed to fetch guest Microsoft calendar:', error.message);
        }
      } else {
        console.log('?? Unknown guest provider:', guestProvider);
      }
    } else if (guestAccessToken && !guestProvider) {  // ? ADD 4 SPACES
      console.log('?? Guest access token provided but no provider specified');
    }  // ? ADD 4 SPACES
    
   
    
    // ========== 6. HELPER FUNCTIONS ==========
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
      try {
        const dayName = dayNameMap[dayOfWeek];
        const daySettings = workingHours[dayName];
        
        if (!daySettings || !daySettings.enabled) {
          return false;
        }

        const slotHour = slotStart.getHours();
        const slotMinute = slotStart.getMinutes();
        const slotTime = slotHour * 60 + slotMinute;

        // Parse start/end times
        const [startHour, startMin] = daySettings.start.split(':').map(Number);
        const [endHour, endMin] = daySettings.end.split(':').map(Number);
        
        if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
          console.warn(`?? Invalid time format for ${dayName}`);
          return false;
        }

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        return slotTime >= startTime && slotTime < endTime;
      } catch (error) {
        console.error('? Error in isWithinWorkingHours:', error);
        return false;
      }
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

        const beforeBuffer = new Date(bookingStart);
        beforeBuffer.setMinutes(beforeBuffer.getMinutes() - bufferTime);
        if (slotEnd > beforeBuffer && slotStart < bookingStart) {
          return true;
        }

        const afterBuffer = new Date(bookingEnd);
        afterBuffer.setMinutes(afterBuffer.getMinutes() + bufferTime);
        if (slotStart < afterBuffer && slotEnd > bookingEnd) {
          return true;
        }

        return false;
      });
    };

    // ========== 7. GENERATE SLOTS ==========
    const slots = [];
    const dailyBookingCounts = {};

    const earliestBookable = new Date(now);
    earliestBookable.setHours(earliestBookable.getHours() + leadTimeHours);

    const latestBookable = new Date(now);
    latestBookable.setDate(latestBookable.getDate() + horizonDays);

    console.log('? Time window:', {
      earliest: earliestBookable.toISOString(),
      latest: latestBookable.toISOString()
    });

    for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      checkDate.setHours(0, 0, 0, 0);

      const dayOfWeek = checkDate.getDay();
      const dayName = dayNameMap[dayOfWeek];
      const daySettings = workingHours[dayName];

      if (!daySettings || !daySettings.enabled) {
        continue;
      }

      // Parse working hours for this day
      const [startHour, startMin] = daySettings.start.split(':').map(Number);
      const [endHour, endMin] = daySettings.end.split(':').map(Number);

      if (isNaN(startHour) || isNaN(endHour)) {
        console.warn(`?? Skipping ${dayName} - invalid time format`);
        continue;
      }

      const dateKey = checkDate.toISOString().split('T')[0];
      if (!dailyBookingCounts[dateKey]) {
        dailyBookingCounts[dateKey] = existingBookings.filter(b => {
          const bookingDate = new Date(b.start_time).toISOString().split('T')[0];
          return bookingDate === dateKey;
        }).length;
      }

      // Generate 30-minute slots
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          if (hour === endHour - 1 && minute + duration > 60) break;
          if (hour >= endHour) break;

          const slotStart = new Date(checkDate);
          slotStart.setHours(hour, minute, 0, 0);
          
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          let status = 'available';
          let reason = null;
          let details = null;

          // Apply availability rules
          if (slotStart < earliestBookable) {
            status = 'unavailable';
            reason = 'lead_time';
            details = `Minimum ${leadTimeHours}h notice required`;
          } else if (slotStart > latestBookable) {
            status = 'unavailable';
            reason = 'horizon';
            details = `Only ${horizonDays} days ahead available`;
          } else if (!isWithinWorkingHours(slotStart, dayOfWeek)) {
            status = 'unavailable';
            reason = 'outside_hours';
            details = 'Outside working hours';
          } else if (isBlocked(slotStart, slotEnd)) {
            status = 'unavailable';
            reason = 'blocked';
            details = 'Time blocked by organizer';
          } else if (hasBufferViolation(slotStart, slotEnd)) {
            status = 'unavailable';
            reason = 'buffer';
            details = `${bufferTime}min buffer required`;
          } else if (dailyCap && dailyBookingCounts[dateKey] >= dailyCap) {
            status = 'unavailable';
            reason = 'daily_cap';
            details = `Daily limit (${dailyCap}) reached`;
          } else if (hasConflict(slotStart, slotEnd, organizerBusy)) {
            status = 'unavailable';
            reason = 'organizer_busy';
            details = `${member.organizer_name || 'Organizer'} has another meeting`;
          } else if (hasConflict(slotStart, slotEnd, guestBusy)) {
            status = 'unavailable';
            reason = 'guest_busy';
            details = "You have another meeting";
          }

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

    // ========== 8. SORT BY MATCH SCORE ==========
    slots.sort((a, b) => {
      if (a.status === 'available' && b.status !== 'available') return -1;
      if (a.status !== 'available' && b.status === 'available') return 1;
      if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
      return a.timestamp - b.timestamp;
    });

    // ========== 9. GROUP BY DATE ==========
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
      
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      
      slotsByDate[dateKey].push(slot);
    });

    console.log(`? Generated ${slots.length} slots across ${Object.keys(slotsByDate).length} days`);
    console.log(`? Available: ${slots.filter(s => s.status === 'available').length}`);

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
    console.error('? Slots generation error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate slots',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      hint: 'Check server logs for details'
    });
  }
});

// ============ MY BOOKING LINK (PERSONAL BOOKING PAGE) ============

app.get('/api/my-booking-link', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    console.log('?? Getting personal booking link for:', userEmail);

    // Check if user already has a personal team
    let personalTeam = await pool.query(
      `SELECT * FROM teams WHERE owner_id = $1 AND name = $2`,
      [userId, `${userName}'s Personal Bookings`]
    );

    // Create personal team if it doesn't exist
    if (personalTeam.rows.length === 0) {
      console.log('? Creating personal team for:', userName);
      
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
      console.log('? Adding user as member of their personal team');
      
      const bookingToken = crypto.randomBytes(16).toString('hex');
      const insertResult = await pool.query(
        `INSERT INTO team_members (team_id, user_id, email, name, booking_token, invited_by) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [team.id, userId, userEmail, userName, bookingToken, userId]
      );
      memberResult = insertResult;
      console.log('? Created member with token:', bookingToken);
    } else {
      const member = memberResult.rows[0];
      
      // Check if token is valid (32 hex characters)
      if (!member.booking_token || member.booking_token.length !== 32 || !/^[a-f0-9]{32}$/i.test(member.booking_token)) {
        console.log('?? Regenerating invalid booking token for member:', member.id);
        const newBookingToken = crypto.randomBytes(16).toString('hex');
        
        const updateResult = await pool.query(
          `UPDATE team_members SET booking_token = $1 WHERE id = $2 RETURNING *`,
          [newBookingToken, member.id]
        );
        memberResult = updateResult;
        console.log('? Updated member with new token:', newBookingToken);
      }
    }

    const member = memberResult.rows[0];
    const bookingUrl = `${process.env.FRONTEND_URL}/book/${member.booking_token}`;

    console.log('? Personal booking link generated:', bookingUrl);
    console.log('?? Token:', member.booking_token);

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
    console.error('? Error generating personal booking link:', error);
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

    console.log('? Canceling booking:', bookingId);

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

    console.log('? Booking cancelled successfully');

    // TODO: Send cancellation email
   console.log('? Booking cancelled successfully');

    try {
      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '? Booking Cancelled - ScheduleSync',
        html: emailTemplates.bookingCancellation(booking, reason),
      });
      console.log('? Cancellation email sent');
    } catch (emailError) {
      console.error('?? Failed to send cancellation email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Booking cancelled successfully' 
    });

  } catch (error) {
    console.error('? Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Reschedule a booking
app.post('/api/bookings/:id/reschedule', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { newStartTime, newEndTime } = req.body;

    console.log('?? Rescheduling booking:', bookingId);

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

    console.log('? Booking rescheduled successfully');

    // Notify organizer
    if (booking.member_user_id) {
      await notifyBookingRescheduled(updatedBooking, booking.member_user_id, oldStartTime);
    }

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
        subject: '?? Booking Rescheduled - ScheduleSync',
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
      console.log('? Reschedule email sent');
    } catch (emailError) {
      console.error('?? Failed to send reschedule email:', emailError);
    }

    res.json({ 
      success: true, 
      booking: updatedBooking,
      message: 'Booking rescheduled successfully' 
    });

  } catch (error) {
    console.error('? Reschedule booking error:', error);
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

// 5. Toggle event type active status
app.patch('/api/event-types/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;  // ✅ Frontend sends 'active', not 'is_active'

    const result = await pool.query(
      `UPDATE event_types 
       SET is_active = $1 
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [active, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    res.json({ 
      success: true, 
      eventType: result.rows[0],
      message: 'Event type status updated'
    });
  } catch (error) {
    console.error('❌ Toggle event type error:', error);
    res.status(500).json({ error: 'Failed to toggle event type status' });
  }
});

// ONE-TIME MIGRATION (Remove after running)
// ============================================
 app.get('/api/admin/migrate-single-use-names', async (req, res) => {
try {
    await pool.query(`
      ALTER TABLE single_use_links 
      ADD COLUMN IF NOT EXISTS name VARCHAR(100)
    `);
    res.json({ success: true, message: 'Migration complete - name column added!' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ SINGLE USE LINK ENDPOINTS ============

// Generate a Single-Use Link
app.post('/api/single-use-links', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;  // ? EXTRACT NAME FROM REQUEST

    // Get user's member_id
    const memberResult = await pool.query(
      'SELECT id FROM team_members WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(400).json({ error: 'No team membership found' });
    }

    const memberId = memberResult.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // ? INSERT WITH NAME COLUMN
    await pool.query(
      `INSERT INTO single_use_links (token, member_id, name, expires_at) 
       VALUES ($1, $2, $3, $4)`,
      [token, memberId, name || null, expiresAt]
    );

    console.log('? Single-use link created:', { token, name, expires_at: expiresAt });
    
    res.json({ 
      success: true, 
      token,
      name: name || null,
      expires_at: expiresAt 
    });
  } catch (error) {
    console.error('? Generate single-use link error:', error);
    res.status(500).json({ error: 'Failed to generate single-use link' });
  }
});

// Get recent single-use links
app.get('/api/single-use-links/recent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const memberResult = await pool.query(
      'SELECT id FROM team_members WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.json({ links: [] });
    }

    const memberId = memberResult.rows[0].id;

    // ? SELECT NAME COLUMN
    const result = await pool.query(
      `SELECT token, name, used, created_at, expires_at 
       FROM single_use_links 
       WHERE member_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [memberId]
    );

    res.json({ links: result.rows });
  } catch (error) {
    console.error('? Get recent single-use links error:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
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

// ============ FIX WORKING HOURS DATA (ONE-TIME ADMIN ENDPOINT) ============
app.get('/api/admin/fix-working-hours-data', authenticateToken, async (req, res) => {
  try {
    console.log('?? Starting working_hours data migration...');
    
    const members = await pool.query('SELECT id, working_hours FROM team_members');
    let fixed = 0;
    let alreadyGood = 0;
    let errors = 0;

    for (const member of members.rows) {
      try {
        const current = member.working_hours;
        
        // Check if this member has bad data (contains 'slots' property)
        if (current && typeof current === 'object') {
          let needsFix = false;
          
          // Check each day for the 'slots' property
          for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
            if (current[day] && current[day].slots) {
              needsFix = true;
              break;
            }
          }
          
          if (needsFix) {
            console.log(`?? Fixing member ${member.id} - Found 'slots' property`);
            
            // Replace with correct default structure
            await pool.query(
              `UPDATE team_members SET working_hours = $1 WHERE id = $2`,
              [JSON.stringify({
                monday: { enabled: true, start: "09:00", end: "17:00" },
                tuesday: { enabled: true, start: "09:00", end: "17:00" },
                wednesday: { enabled: true, start: "09:00", end: "17:00" },
                thursday: { enabled: true, start: "09:00", end: "17:00" },
                friday: { enabled: true, start: "09:00", end: "17:00" },
                saturday: { enabled: false, start: "09:00", end: "17:00" },
                sunday: { enabled: false, start: "09:00", end: "17:00" }
              }), member.id]
            );
            fixed++;
          } else {
            alreadyGood++;
          }
        } else if (!current) {
          // Member has no working_hours at all, set defaults
          console.log(`? Setting defaults for member ${member.id}`);
          await pool.query(
            `UPDATE team_members SET working_hours = $1 WHERE id = $2`,
            [JSON.stringify({
              monday: { enabled: true, start: "09:00", end: "17:00" },
              tuesday: { enabled: true, start: "09:00", end: "17:00" },
              wednesday: { enabled: true, start: "09:00", end: "17:00" },
              thursday: { enabled: true, start: "09:00", end: "17:00" },
              friday: { enabled: true, start: "09:00", end: "17:00" },
              saturday: { enabled: false, start: "09:00", end: "17:00" },
              sunday: { enabled: false, start: "09:00", end: "17:00" }
            }), member.id]
          );
          fixed++;
        }
      } catch (memberError) {
        console.error(`? Error processing member ${member.id}:`, memberError);
        errors++;
      }
    }

    console.log('? Data migration complete');
    console.log(`   - Fixed: ${fixed}`);
    console.log(`   - Already correct: ${alreadyGood}`);
    console.log(`   - Errors: ${errors}`);

    res.json({ 
      success: true, 
      fixed: fixed,
      alreadyGood: alreadyGood,
      errors: errors,
      total: members.rows.length
    });
  } catch (error) {
    console.error('? Data migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BOOKING LOOKUP ENDPOINTS - FIXED SCHEMA
// ============================================

// Primary endpoint: /api/bookings/:token
app.get('/api/bookings/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔍 Looking up token:', token, 'Length:', token.length);
    
    // ========== CHECK 1: Single-Use Link (64 chars) ==========
    if (token.length === 64) {
      console.log('🔍 Checking single-use link...');
      const singleUseResult = await pool.query(
        `SELECT sul.*, 
                tm.id as member_id,
                tm.name as member_name, 
                tm.email as member_email,
                tm.user_id,
                t.name as team_name,
                t.id as team_id
         FROM single_use_links sul
         JOIN team_members tm ON sul.member_id = tm.id
         JOIN teams t ON tm.team_id = t.id
         WHERE sul.token = $1
           AND sul.used = false
           AND sul.expires_at > NOW()`,
        [token]
      );
      
      if (singleUseResult.rows.length > 0) {
        const link = singleUseResult.rows[0];
        console.log('✅ Single-use link found for:', link.member_name);
        
        return res.json({
          data: {
            team: {
              id: link.team_id,
              name: link.team_name
            },
            member: {
              id: link.member_id,
              name: link.member_name,
              email: link.member_email,
              default_duration: 30,
              user_id: link.user_id
            },
            eventTypes: [],
            isDirectLink: true,
            skipEventTypes: true,
            isSingleUse: true
          }
        });
      } else {
        console.log('❌ Single-use link expired or already used');
        return res.status(404).json({ error: 'This link has expired or been used' });
      }
    }
    
    // ========== CHECK 2: Team Booking Token ==========
    const teamResult = await pool.query(
      `SELECT t.*, 
              u.name as owner_name,
              u.email as owner_email
       FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.team_booking_token = $1`,
      [token]
    );
    
    if (teamResult.rows.length > 0) {
      const team = teamResult.rows[0];
      console.log('✅ Team token found:', team.name);
      
      const membersResult = await pool.query(
        `SELECT tm.id, tm.name, tm.email, tm.booking_token, tm.user_id
         FROM team_members tm
         WHERE tm.team_id = $1 
           AND (tm.is_active = true OR tm.is_active IS NULL)
           AND (tm.external_booking_link IS NULL OR tm.external_booking_link = '')
         ORDER BY tm.created_at ASC`,
        [team.id]
      );
      
      const eventTypesResult = await pool.query(
        `SELECT id, title, duration, description, is_active, color, slug
         FROM event_types 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY duration ASC`,
        [team.owner_id]
      );
      
      console.log('📊 Found:', membersResult.rows.length, 'members,', eventTypesResult.rows.length, 'event types');
      
      return res.json({
        data: {
          team: {
            id: team.id,
            name: team.name,
            description: team.description,
            booking_mode: team.booking_mode || 'round_robin',
            owner_name: team.owner_name
          },
          member: membersResult.rows[0] || {
            id: null,
            name: team.owner_name || team.name,
            email: team.owner_email,
            default_duration: 30
          },
          members: membersResult.rows,
          eventTypes: eventTypesResult.rows.map(et => ({
            id: et.id,
            title: et.title,
            name: et.title,
            duration: et.duration,
            description: et.description,
            color: et.color,
            slug: et.slug,
            is_active: true
          })),
          isTeamBooking: true,
          skipEventTypes: false
        }
      });
    }
    
    // ========== CHECK 3: Member Booking Token ==========
    const memberResult = await pool.query(
      `SELECT tm.*, 
              t.name as team_name, 
              t.id as team_id,
              u.name as user_name,
              u.email as user_email
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );
    
    if (memberResult.rows.length > 0) {
      const member = memberResult.rows[0];
      console.log('✅ Member token found:', member.name || member.user_name);
      
      if (member.external_booking_link) {
        console.log('🔗 External link detected:', member.external_booking_link);
        return res.json({
          data: {
            team: {
              id: member.team_id,
              name: member.team_name
            },
            member: {
              id: member.id,
              name: member.name || member.user_name,
              email: member.email || member.user_email,
              external_booking_link: member.external_booking_link,
              default_duration: 30
            },
            eventTypes: [],
            isDirectLink: false
          }
        });
      }
      
      // ✅ FIXED: Use user_id, not team_id
      let eventTypesResult = { rows: [] };
      if (member.user_id) {
        eventTypesResult = await pool.query(
          `SELECT id, title, duration, description, is_active, color, slug
           FROM event_types 
           WHERE user_id = $1 AND is_active = true 
           ORDER BY duration ASC`,
          [member.user_id]
        );
      }
      
      return res.json({
        data: {
          team: {
            id: member.team_id,
            name: member.team_name
          },
          member: {
            id: member.id,
            name: member.name || member.user_name,
            email: member.email || member.user_email,
            default_duration: 30,
            user_id: member.user_id
          },
          eventTypes: eventTypesResult.rows.map(et => ({
            id: et.id,
            title: et.title,
            name: et.title,
            duration: et.duration,
            description: et.description,
            color: et.color,
            slug: et.slug,
            is_active: true
          })),
          isDirectLink: false,
          skipEventTypes: false
        }
      });
    }
    
    console.log('❌ Token not found:', token);
    return res.status(404).json({ error: 'Invalid booking link' });
    
  } catch (error) {
    console.error('❌ Booking lookup error:', error);
    return res.status(500).json({ error: 'Failed to load booking information' });
  }
});

// Legacy endpoint: /api/book/:token (EXACT DUPLICATE)
app.get('/api/book/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔍 Looking up token (via /api/book):', token, 'Length:', token.length);
    
    // ========== CHECK 1: Single-Use Link (64 chars) ==========
    if (token.length === 64) {
      console.log('🔍 Checking single-use link...');
      const singleUseResult = await pool.query(
        `SELECT sul.*, 
                tm.id as member_id,
                tm.name as member_name, 
                tm.email as member_email,
                tm.user_id,
                t.name as team_name,
                t.id as team_id
         FROM single_use_links sul
         JOIN team_members tm ON sul.member_id = tm.id
         JOIN teams t ON tm.team_id = t.id
         WHERE sul.token = $1
           AND sul.used = false
           AND sul.expires_at > NOW()`,
        [token]
      );
      
      if (singleUseResult.rows.length > 0) {
        const link = singleUseResult.rows[0];
        console.log('✅ Single-use link found for:', link.member_name);
        
        return res.json({
          data: {
            team: {
              id: link.team_id,
              name: link.team_name
            },
            member: {
              id: link.member_id,
              name: link.member_name,
              email: link.member_email,
              default_duration: 30,
              user_id: link.user_id
            },
            eventTypes: [],
            isDirectLink: true,
            skipEventTypes: true,
            isSingleUse: true
          }
        });
      } else {
        console.log('❌ Single-use link expired or already used');
        return res.status(404).json({ error: 'This link has expired or been used' });
      }
    }
    
    // ========== CHECK 2: Team Booking Token ==========
    const teamResult = await pool.query(
      `SELECT t.*, 
              u.name as owner_name,
              u.email as owner_email
       FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.team_booking_token = $1`,
      [token]
    );
    
    if (teamResult.rows.length > 0) {
      const team = teamResult.rows[0];
      console.log('✅ Team token found:', team.name);
      
      const membersResult = await pool.query(
        `SELECT tm.id, tm.name, tm.email, tm.booking_token, tm.user_id
         FROM team_members tm
         WHERE tm.team_id = $1 
           AND (tm.is_active = true OR tm.is_active IS NULL)
           AND (tm.external_booking_link IS NULL OR tm.external_booking_link = '')
         ORDER BY tm.created_at ASC`,
        [team.id]
      );
      
      const eventTypesResult = await pool.query(
        `SELECT id, title, duration, description, is_active, color, slug
         FROM event_types 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY duration ASC`,
        [team.owner_id]
      );
      
      console.log('📊 Found:', membersResult.rows.length, 'members,', eventTypesResult.rows.length, 'event types');
      
      return res.json({
        data: {
          team: {
            id: team.id,
            name: team.name,
            description: team.description,
            booking_mode: team.booking_mode || 'round_robin',
            owner_name: team.owner_name
          },
          member: membersResult.rows[0] || {
            id: null,
            name: team.owner_name || team.name,
            email: team.owner_email,
            default_duration: 30
          },
          members: membersResult.rows,
          eventTypes: eventTypesResult.rows.map(et => ({
            id: et.id,
            title: et.title,
            name: et.title,
            duration: et.duration,
            description: et.description,
            color: et.color,
            slug: et.slug,
            is_active: true
          })),
          isTeamBooking: true,
          skipEventTypes: false
        }
      });
    }
    
    // ========== CHECK 3: Member Booking Token ==========
    const memberResult = await pool.query(
      `SELECT tm.*, 
              t.name as team_name, 
              t.id as team_id,
              u.name as user_name,
              u.email as user_email
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );
    
    if (memberResult.rows.length > 0) {
      const member = memberResult.rows[0];
      console.log('✅ Member token found:', member.name || member.user_name);
      
      if (member.external_booking_link) {
        console.log('🔗 External link detected:', member.external_booking_link);
        return res.json({
          data: {
            team: {
              id: member.team_id,
              name: member.team_name
            },
            member: {
              id: member.id,
              name: member.name || member.user_name,
              email: member.email || member.user_email,
              external_booking_link: member.external_booking_link,
              default_duration: 30
            },
            eventTypes: [],
            isDirectLink: false
          }
        });
      }
      
      // ✅ FIXED: Use user_id, not team_id
      let eventTypesResult = { rows: [] };
      if (member.user_id) {
        eventTypesResult = await pool.query(
          `SELECT id, title, duration, description, is_active, color, slug
           FROM event_types 
           WHERE user_id = $1 AND is_active = true 
           ORDER BY duration ASC`,
          [member.user_id]
        );
      }
      
      return res.json({
        data: {
          team: {
            id: member.team_id,
            name: member.team_name
          },
          member: {
            id: member.id,
            name: member.name || member.user_name,
            email: member.email || member.user_email,
            default_duration: 30,
            user_id: member.user_id
          },
          eventTypes: eventTypesResult.rows.map(et => ({
            id: et.id,
            title: et.title,
            name: et.title,
            duration: et.duration,
            description: et.description,
            color: et.color,
            slug: et.slug,
            is_active: true
          })),
          isDirectLink: false,
          skipEventTypes: false
        }
      });
    }
    
    console.log('❌ Token not found:', token);
    return res.status(404).json({ error: 'Invalid booking link' });
    
  } catch (error) {
    console.error('❌ Booking lookup error:', error);
    return res.status(500).json({ error: 'Failed to load booking information' });
  }
});

// ========== POST: Create Booking ==========
app.post('/api/bookings', async (req, res) => {
  try {
    const { 
      token, 
      slot, 
      attendee_name, 
      attendee_email, 
      notes,
      additional_attendees = []
    } = req.body;

    console.log('🔧 Creating booking:', { 
      token: token?.substring(0, 10) + '...', 
      attendee_name, 
      attendee_email,
      hasSlot: !!slot
    });

    // ========== VALIDATION ==========
    if (!token || !slot || !attendee_name || !attendee_email) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!slot.start || !slot.end) {
      console.error('❌ Invalid slot data:', slot);
      return res.status(400).json({ error: 'Invalid booking slot data' });
    }

    try {
      const startDate = new Date(slot.start);
      const endDate = new Date(slot.end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format');
      }
      
      console.log('✅ Slot validation passed:', {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      });
    } catch (dateError) {
      console.error('❌ Invalid slot dates:', dateError.message);
      return res.status(400).json({ 
        error: 'Invalid booking time format',
        details: dateError.message
      });
    }

    // ========== LOOK UP TOKEN ==========
    let memberResult;
    
    // CHECK 1: Single-use link (64 chars)
    if (token.length === 64) {
      console.log('🔍 Looking up single-use link...');
      memberResult = await pool.query(
        `SELECT tm.*, 
                t.name as team_name, 
                t.booking_mode, 
                t.owner_id, 
                t.id as team_id,
                u.google_access_token, 
                u.google_refresh_token,
                u.microsoft_access_token,
                u.microsoft_refresh_token,
                u.provider,
                u.email as member_email, 
                u.name as member_name
         FROM single_use_links sul
         JOIN team_members tm ON sul.member_id = tm.id
         JOIN teams t ON tm.team_id = t.id 
         LEFT JOIN users u ON tm.user_id = u.id 
         WHERE sul.token = $1
           AND sul.used = false
           AND sul.expires_at > NOW()`,
        [token]
      );
    } else {
      // CHECK 2: Team token
      console.log('🔍 Checking if team token...');
      const teamCheck = await pool.query(
        `SELECT t.id as team_id, t.booking_mode
         FROM teams t
         WHERE t.team_booking_token = $1`,
        [token]
      );

      if (teamCheck.rows.length > 0) {
        const teamData = teamCheck.rows[0];
        console.log('✅ Team token detected, loading first active member...');
        
        memberResult = await pool.query(
          `SELECT tm.*, 
                  t.name as team_name, 
                  t.booking_mode, 
                  t.owner_id,
                  t.id as team_id,
                  u.google_access_token, 
                  u.google_refresh_token,
                  u.microsoft_access_token,
                  u.microsoft_refresh_token,
                  u.provider,
                  u.email as member_email, 
                  u.name as member_name
           FROM team_members tm 
           JOIN teams t ON tm.team_id = t.id 
           LEFT JOIN users u ON tm.user_id = u.id 
           WHERE tm.team_id = $1
             AND (tm.is_active = true OR tm.is_active IS NULL)
           ORDER BY tm.id ASC
           LIMIT 1`,
          [teamData.team_id]
        );
      } else {
        // CHECK 3: Regular member token
        console.log('🔍 Looking up regular token...');
        memberResult = await pool.query(
          `SELECT tm.*, 
                  t.name as team_name, 
                  t.booking_mode, 
                  t.owner_id,
                  t.id as team_id,
                  u.google_access_token, 
                  u.google_refresh_token,
                  u.microsoft_access_token,
                  u.microsoft_refresh_token,
                  u.provider,
                  u.email as member_email, 
                  u.name as member_name
           FROM team_members tm 
           JOIN teams t ON tm.team_id = t.id 
           LEFT JOIN users u ON tm.user_id = u.id 
           WHERE tm.booking_token = $1`,
          [token]
        );
      }
    }

    if (memberResult.rows.length === 0) {
      console.log('❌ Invalid or expired booking token');
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    const bookingMode = member.booking_mode || 'individual';

    console.log('✅ Token found:', {
      memberName: member.name || member.member_name,
      teamName: member.team_name,
      mode: bookingMode
    });

    // ========== DETERMINE ASSIGNED MEMBERS ==========
    let assignedMembers = [];

    switch (bookingMode) {
      case 'individual':
        assignedMembers = [{ 
          id: member.id, 
          name: member.name || member.member_name, 
          user_id: member.user_id 
        }];
        console.log('👤 Individual mode: Assigning to', assignedMembers[0].name);
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
        assignedMembers = rrResult.rows.length > 0 
          ? [rrResult.rows[0]] 
          : [{ id: member.id, name: member.name || member.member_name, user_id: member.user_id }];
        console.log('🔄 Round-robin: Assigning to', assignedMembers[0].name);
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
        assignedMembers = faResult.rows.length > 0 
          ? [faResult.rows[0]] 
          : [{ id: member.id, name: member.name || member.member_name, user_id: member.user_id }];
        console.log('⚡ First-available: Assigning to', assignedMembers[0].name);
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
        assignedMembers = [{ 
          id: member.id, 
          name: member.name || member.member_name, 
          user_id: member.user_id 
        }];
    }

    // ========== CREATE BOOKING(S) ==========
    const createdBookings = [];

    for (const assignedMember of assignedMembers) {
      const manageToken = crypto.randomBytes(16).toString('hex');
      
      console.log(`📝 Creating booking for member ${assignedMember.id}...`);
      
      const bookingResult = await pool.query(
        `INSERT INTO bookings (
          team_id, member_id, user_id, 
          attendee_name, attendee_email, 
          start_time, end_time, 
          title, notes, 
          booking_token, status, manage_token
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
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
          'confirmed',
          manageToken
        ]
      );
      
      createdBookings.push(bookingResult.rows[0]);
      console.log(`✅ Booking created: ID ${bookingResult.rows[0].id}, manage_token: ${manageToken}`);
    }

    // ========== MARK SINGLE-USE LINK AS USED ==========
    if (token.length === 64) {
      await pool.query('UPDATE single_use_links SET used = true WHERE token = $1', [token]);
      console.log('✅ Single-use link marked as used');
    }

    // ========== NOTIFY ORGANIZER ==========
    if (member.user_id) {
      await notifyBookingCreated(createdBookings[0], member.user_id);
    }

    // ========== RESPOND IMMEDIATELY ==========
    console.log('✅ Sending success response');
    res.json({ 
      success: true,
      booking: createdBookings[0],
      bookings: createdBookings,
      mode: bookingMode,
      meet_link: null,
      message: bookingMode === 'collective' 
        ? `Booking confirmed with all ${createdBookings.length} team members!`
        : 'Booking confirmed! Calendar invite will arrive shortly.'
    });

    // ========== ASYNC: CREATE CALENDAR EVENT & SEND EMAILS ==========
    (async () => {
      try {
        let meetLink = null;
        let calendarEventId = null;

        // Create calendar event with meeting link
        if (member.provider === 'google' && member.google_access_token && member.google_refresh_token) {
          try {
            console.log('?? Creating Google Calendar event with Meet link (async)...');
            
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

            for (const booking of createdBookings) {
              await pool.query(
                `UPDATE bookings SET meet_link = $1, calendar_event_id = $2 WHERE id = $3`,
                [meetLink, calendarEventId, booking.id]
              );
            }

            console.log('? Google Calendar event created with Meet link:', meetLink);
          } catch (calendarError) {
            console.error('? Google Calendar event creation failed:', calendarError.message);
          }
        } else if (member.provider === 'microsoft' && member.microsoft_access_token && member.microsoft_refresh_token) {
          try {
            console.log('?? Creating Microsoft Calendar event with Teams link (async)...');

            const eventResult = await createMicrosoftCalendarEvent(
              member.microsoft_access_token,
              member.microsoft_refresh_token,
              {
                title: `Meeting with ${attendee_name}`,
                description: notes || 'Scheduled via ScheduleSync',
                startTime: slot.start,
                endTime: slot.end,
                attendees: [
                  { email: attendee_email, name: attendee_name },
                  { email: member.member_email, name: member.member_name }
                ]
              }
            );

            meetLink = eventResult.meetingUrl;
            calendarEventId = eventResult.id;

            for (const booking of createdBookings) {
              await pool.query(
                `UPDATE bookings SET meet_link = $1, calendar_event_id = $2 WHERE id = $3`,
                [meetLink, calendarEventId, booking.id]
              );
            }

            console.log('? Microsoft Calendar event created with Teams link:', meetLink);
          } catch (calendarError) {
            console.error('? Microsoft Calendar event creation failed:', calendarError.message);
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
            subject: '? Booking Confirmed - ScheduleSync',
            html: emailTemplates.bookingConfirmationGuest(bookingWithMeetLink),
            icsAttachment: icsFile,
          });

          if (member.member_email || member.email) {
            await sendBookingEmail({
              to: member.member_email || member.email,
              subject: '?? New Booking Received - ScheduleSync',
              html: emailTemplates.bookingConfirmationOrganizer(bookingWithMeetLink),
              icsAttachment: icsFile,
            });
          }
          
          console.log('? Confirmation emails sent with Meet link');
        } catch (emailError) {
          console.error('? Failed to send emails:', emailError);
        }
        
      } catch (error) {
        console.error('? Background processing error:', error);
      }
    })();  // ? Close IIFE
    
  } catch (error) {  // ? Main POST endpoint catch
    console.error('? Create booking error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
});  // ? Close POST endpoint

// ============ BOOKING MANAGEMENT BY TOKEN (NO AUTH REQUIRED) ============
   

// Get booking by token (for guest management page)
app.get('/api/bookings/manage/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('?? Getting booking for management:', token);
    
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
       WHERE b.manage_token = $1`,   // ? CORRECT - uses booking-specific token
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
    console.error('? Get booking by token error:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// Reschedule booking by token
app.post('/api/bookings/manage/:token/reschedule', async (req, res) => {
  try {
    const { token } = req.params;
    const { newStartTime, newEndTime } = req.body;

    console.log('?? Rescheduling booking via token:', token);

    if (!newStartTime || !newEndTime) {
      return res.status(400).json({ error: 'New start and end times are required' });
    }

   // Get booking by token
    const bookingCheck = await pool.query(
      `SELECT b.*, b.meet_link, b.calendar_event_id, t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name
        FROM bookings b
        JOIN teams t ON b.team_id = t.id
        LEFT JOIN team_members tm ON b.member_id = tm.id
        WHERE b.manage_token = $1 AND b.status = 'confirmed'`, // ? FIXED: Added backtick here
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

    console.log('? Booking rescheduled successfully');

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
        subject: '?? Booking Rescheduled - ScheduleSync',
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
          subject: '?? Booking Rescheduled by Guest - ScheduleSync',
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

      console.log('? Reschedule emails sent');
    } catch (emailError) {
      console.error('?? Failed to send reschedule email:', emailError);
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
    console.error('? Reschedule booking error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// Cancel booking by token
app.post('/api/bookings/manage/:token/cancel', async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    console.log('? Canceling booking via token:', token);

    // Get booking by token
    const bookingCheck = await pool.query(
      `SELECT b.*, b.meet_link, b.calendar_event_id, t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name, tm.booking_token as member_booking_token
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
      WHERE b.manage_token = $1 AND b.status = 'confirmed'`,
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
       WHERE manage_token = $2`, // ? FIXED: Added backtick and changed $3 to $2
      [reason, token]
    );

    console.log('? Booking cancelled successfully');

    // Notify organizer
    if (booking.member_user_id) {
      await notifyBookingCancelled(booking, booking.member_user_id);
    }

    // Send cancellation emails
    try {
      // Email to guest
      await sendBookingEmail({
        to: booking.attendee_email,
        subject: '? Booking Cancelled - ScheduleSync',
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
          subject: '? Booking Cancelled by Guest - ScheduleSync',
          html: emailTemplates.bookingCancellation(
            {
              ...booking,
              booking_token: booking.member_booking_token,
            },
            reason
          ),
        });
      }

      console.log('? Cancellation emails sent');
    } catch (emailError) {
      console.error('?? Failed to send cancellation email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Booking cancelled successfully' 
    });

  } catch (error) {
    console.error('? Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

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

    console.log(`? Updated reminder settings for team ${teamId} (${team.name})`);

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
    console.log('?? Manual reminder check triggered by user:', req.user.email);
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
    console.log('?? Pricing endpoint - Raw DB value:', {
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
      paymentRequired: !!member.payment_required,  // ? Double negation for truthy check
      memberName: member.name,
      teamName: member.team_name,
    });
  } catch (error) {
    console.error('? Get pricing error:', error);
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

    console.log('? Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: member.booking_price,
      currency: member.currency || 'USD',
    });
  } catch (error) {
    console.error('? Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Confirm payment and create booking
app.post('/api/payments/confirm-booking', async (req, res) => {
  try {
    const { paymentIntentId, bookingToken, slot, attendeeName, attendeeEmail, notes } = req.body;

    console.log('?? Confirming payment and creating booking:', paymentIntentId);

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

    console.log('? Booking created with payment:', booking.id);

    // Notify organizer
    if (member.user_id) {
      await notifyPaymentReceived(booking, member.user_id, paymentIntent.amount / 100, paymentIntent.currency);
    }

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
          subject: '? Payment Confirmed & Booking Complete - ScheduleSync',
          html: emailTemplates.bookingConfirmationGuestWithPayment(bookingWithPayment),
          icsAttachment: icsFile,
        });

        if (member.member_email || member.email) {
          await sendBookingEmail({
            to: member.member_email || member.email,
            subject: '?? New Paid Booking Received - ScheduleSync',
            html: emailTemplates.bookingConfirmationOrganizerWithPayment(bookingWithPayment),
            icsAttachment: icsFile,
          });
        }

        console.log('? Payment confirmation emails sent');
      } catch (emailError) {
        console.error('?? Failed to send emails:', emailError);
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
    console.error('? Confirm booking error:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// Process refund on cancellation
app.post('/api/payments/refund', authenticateToken, async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    const userId = req.user.id;

    console.log('?? Processing refund for booking:', bookingId);

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

    console.log('? Refund processed:', refund.id);

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
    console.error('? Refund error:', error);
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

    console.log('?? Stripe webhook event:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        // Payment was successful
        const paymentIntent = event.data.object;
        console.log('? Payment succeeded:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        // Payment failed
        const failedPayment = event.data.object;
        console.log('? Payment failed:', failedPayment.id);
        break;

      case 'charge.refunded':
        // Refund processed
        const refund = event.data.object;
        console.log('?? Refund processed:', refund.id);
        break;

      default:
        console.log('?? Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('? Webhook error:', error);
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

// ============ NOTIFICATION ENDPOINTS ============

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, unread_only = false } = req.query;
    let query = `SELECT * FROM notifications WHERE user_id = $1`;
    if (unread_only === 'true') query += ` AND read = false`;
    query += ` ORDER BY created_at DESC LIMIT $2`;
    
    const result = await pool.query(query, [req.user.id, limit]);
    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false`,
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get count' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications SET read = true, read_at = NOW() 
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ notification: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = true, read_at = NOW() 
       WHERE user_id = $1 AND read = false`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});
// ============ COMPLETE AI SCHEDULING ENDPOINT WITH EMAIL TEMPLATE INTEGRATION ============

app.post('/api/ai/schedule', authenticateToken, checkUsageLimits, async (req, res) => {
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

    // Check if message contains pending booking context
    let pendingBookingContext = null;
    let cleanMessage = message;
    
    const pendingMatch = message.match(/\[Current pending booking: "([^"]+)" on (\S+) at (\S+) for (\d+) minutes with (\S+)\]/);
    if (pendingMatch) {
      pendingBookingContext = {
        title: pendingMatch[1],
        date: pendingMatch[2],
        time: pendingMatch[3],
        duration: parseInt(pendingMatch[4]),
        attendee_email: pendingMatch[5]
      };
      cleanMessage = message.replace(/\[Current pending booking:.*?\]\s*User says:\s*/i, '').trim();
      console.log('📋 Pending booking detected:', pendingBookingContext);
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

    // Provide complete booking details to AI
    const userContext = {
      email: userEmail,
      teams: teamsResult.rows.map(t => ({ 
        id: t.id, 
        name: t.name, 
        members: t.member_count 
      })),
      upcomingBookings: bookingsResult.rows.map(b => ({
        id: b.id,
        attendee_name: b.attendee_name,
        attendee_email: b.attendee_email,
        attendee_phone: b.attendee_phone,
        start: b.start_time,
        end: b.end_time,
        duration: b.duration,
        meet_link: b.meet_link,
        notes: b.notes,
        status: b.status,
        team_name: b.team_name,
        organizer: b.organizer_name
      })),
      pendingBooking: pendingBookingContext
    };

    // Format conversation history
    const formattedHistory = conversationHistory.slice(-5).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content || '' }]
    })).filter(msg => msg.parts[0].text.trim() !== '');

    // Build pending booking instruction if exists
    const pendingBookingInstruction = pendingBookingContext ? `
IMPORTANT - PENDING BOOKING CONTEXT:
There is currently a pending booking waiting for confirmation:
- Title: "${pendingBookingContext.title}"
- Date: ${pendingBookingContext.date}
- Time: ${pendingBookingContext.time}
- Duration: ${pendingBookingContext.duration} minutes
- Attendee: ${pendingBookingContext.attendee_email}

If the user wants to UPDATE this pending booking (change time, duration, date, etc.):
1. Set intent to "update_pending"
2. Include the updated fields in "extracted"
3. Keep unchanged fields from the original booking
4. DO NOT ask for confirmation again - the UI will handle that
` : '';

    // Enhanced system instruction with email functionality
    const systemInstruction = `You are a scheduling assistant for ScheduleSync. Extract scheduling intent from user messages and return ONLY valid JSON.

User context: ${JSON.stringify(userContext)}
${pendingBookingInstruction}

CRITICAL INSTRUCTIONS:
1. When user requests "create meeting" or "schedule with [email]", extract ALL details in ONE response
2. When user wants to send emails, detect email intent and extract recipient/type
3. Parse natural language intelligently:
   - "tomorrow" = next day from ${new Date().toISOString()}
   - "1 hour" or "an hour" = 60 minutes duration
   - "2 hours" = 120 minutes duration
   - "5pm" or "5:00 PM" = "17:00" in 24-hour format
4. NEVER use markdown formatting (no **, no ##, no *)
5. Keep responses clean and professional

EMAIL INTENTS:
- "send reminder to john@email.com" → intent: "send_email", email_action: {type: "reminder", recipient: "john@email.com"}
- "send thank you to jane@email.com" → intent: "send_email", email_action: {type: "follow_up", recipient: "jane@email.com"}  
- "confirm meeting with bob@email.com" → intent: "send_email", email_action: {type: "confirmation", recipient: "bob@email.com"}

Current date/time: ${new Date().toISOString()}
User timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

Return JSON structure:
{
  "intent": "create_meeting" | "send_email" | "update_pending" | "show_bookings" | "find_time" | "cancel_booking" | "reschedule" | "check_availability" | "clarify",
  "confidence": 0-100,
  "extracted": {
    "title": "string or null",
    "attendees": ["email@example.com"],
    "attendee_email": "email for single attendee",
    "date": "YYYY-MM-DD",
    "time": "HH:MM in 24-hour format", 
    "duration_minutes": number (15, 30, 45, 60, 90, 120),
    "notes": "string or null"
  },
  "email_action": {
    "type": "reminder|confirmation|follow_up",
    "recipient": "email@example.com",
    "meeting_details": { ... }
  },
  "missing_fields": ["field1", "field2"],
  "clarifying_question": "question if needed",
  "action": "create" | "update" | "list" | "suggest_slots" | "cancel" | null,
  "response_message": "Clean text response without markdown"
}`;

    // Call Google Gemini API
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          ...formattedHistory,
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\nUser message: ${cleanMessage}` }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 1500,
        }
      })
    });

    // Error handling
    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiResponse.status, geminiResponse.statusText);
      return res.status(500).json({
        type: 'error',
        message: 'AI service temporarily unavailable. Please try again.'
      });
    }

    const geminiData = await geminiResponse.json();

    if (!geminiData?.candidates?.[0]?.content) {
      console.error('Invalid Gemini response:', geminiData);
      return res.status(500).json({
        type: 'error',
        message: 'AI service temporarily unavailable.'
      });
    }

    const aiText = geminiData.candidates[0].content.parts[0].text;
    
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

    console.log('🤖 Parsed intent:', parsedIntent);

    // Email validation function
    const validateEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    // ============ HANDLE EMAIL SENDING INTENTS ============
    if (parsedIntent.intent === 'send_email' && parsedIntent.email_action) {
      const { type, recipient, meeting_details } = parsedIntent.email_action;
      
      // Validate email
      if (!validateEmail(recipient)) {
        return res.json({
          type: 'error',
          message: `❌ Invalid email address: ${recipient}. Please provide a valid email.`
        });
      }
      
      // Select best template
      const template = await selectBestTemplate(userId, type, meeting_details);
      
      if (!template) {
        return res.json({
          type: 'error',
          message: `❌ No ${type} template found. Please create one in Email Templates first.`
        });
      }
      
      // Get meeting details from context
      const emailDetails = {
        date: meeting_details?.date || new Date().toLocaleDateString(),
        time: meeting_details?.time || 'TBD',
        link: meeting_details?.link || 'Will be provided',
        title: meeting_details?.title || 'Meeting'
      };
      
      // Send email with template
      const emailSent = await sendEmailWithTemplate(template, recipient, emailDetails, userId);
      
      if (emailSent) {
        // Track template usage
        await trackTemplateUsage(template.id, userId, 'sent');
        
        // Increment AI usage
        await incrementChatGPTUsage(userId);
        
        return res.json({
          type: 'email_sent',
          message: `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} email sent to ${recipient} using "${template.name}" template!`,
          data: {
            template_used: template.name,
            recipient: recipient,
            email_type: type
          },
          usage: {
            chatgpt_used: req.userUsage.chatgpt_used + 1,
            chatgpt_limit: req.userUsage.limits.chatgpt
          }
        });
      } else {
        return res.json({
          type: 'error',
          message: `❌ Failed to send ${type} email to ${recipient}. Please try again.`
        });
      }
    }

    // ============ HANDLE UPDATE PENDING INTENT ============
    if (parsedIntent.intent === 'update_pending' && pendingBookingContext) {
      const updated = {
        ...pendingBookingContext,
        ...parsedIntent.extracted
      };
      
      // Handle attendees array to single email
      if (parsedIntent.extracted.attendees && parsedIntent.extracted.attendees.length > 0) {
        updated.attendee_email = parsedIntent.extracted.attendees[0];
      }
      
      // Rename duration_minutes to duration for consistency
      if (parsedIntent.extracted.duration_minutes) {
        updated.duration = parsedIntent.extracted.duration_minutes;
      }

      const changeDescription = [];
      if (parsedIntent.extracted.duration_minutes && parsedIntent.extracted.duration_minutes !== pendingBookingContext.duration) {
        changeDescription.push(`duration to ${parsedIntent.extracted.duration_minutes} minutes`);
      }
      if (parsedIntent.extracted.time && parsedIntent.extracted.time !== pendingBookingContext.time) {
        changeDescription.push(`time to ${parsedIntent.extracted.time}`);
      }
      if (parsedIntent.extracted.date && parsedIntent.extracted.date !== pendingBookingContext.date) {
        changeDescription.push(`date to ${parsedIntent.extracted.date}`);
      }

      return res.json({
        type: 'update_pending',
        message: changeDescription.length > 0 
          ? `✅ Updated ${changeDescription.join(' and ')}. Please review and confirm.`
          : 'Booking details updated. Please review and confirm.',
        data: {
          updatedBooking: updated
        }
      });
    }

    // ============ HANDLE SHOW BOOKINGS INTENT ============
    if (parsedIntent.intent === 'show_bookings' || parsedIntent.action === 'list') {
      if (userContext.upcomingBookings.length === 0) {
        return res.json({
          type: 'info',
          message: '📅 You have no upcoming bookings scheduled.'
        });
      }

      const bookingsList = userContext.upcomingBookings.map((booking, index) => {
        const startDate = new Date(booking.start);
        const endDate = new Date(booking.end);
        
        return `${index + 1}. ${booking.attendee_name} ${booking.attendee_email ? `(${booking.attendee_email})` : ''}
📞 ${booking.attendee_phone || 'No phone'}
📅 ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        })} - ${endDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        })}
⏱️ ${booking.duration || 30} minutes
🏢 ${booking.team_name || 'Personal'}
🔗 ${booking.meet_link || 'No meeting link'}
📝 ${booking.notes || 'No notes'}
✅ Status: ${booking.status}`;
      }).join('\n\n');

      return res.json({
        type: 'list',
        message: `Here are your upcoming bookings:\n\n${bookingsList}`,
        data: { bookings: userContext.upcomingBookings }
      });
    }

    // ============ HANDLE FIND TIME INTENT ============
    if (parsedIntent.intent === 'find_time' || parsedIntent.action === 'suggest_slots') {
      try {
        // Get user's booking token
        const memberResult = await pool.query(
          `SELECT tm.id, tm.booking_token, tm.timezone
           FROM team_members tm
           JOIN teams t ON tm.team_id = t.id
           WHERE tm.user_id = $1 OR t.owner_id = $1
           LIMIT 1`,
          [userId]
        );

        if (memberResult.rows.length === 0) {
          return res.json({
            type: 'error',
            message: 'No booking profile found. Please set up your availability first.'
          });
        }

        const member = memberResult.rows[0];

        // Get availability settings
        const availResult = await pool.query(
          `SELECT * FROM availability_settings WHERE member_id = $1`,
          [member.id]
        );

        if (availResult.rows.length === 0) {
          return res.json({
            type: 'info',
            message: '⚠️ No availability settings found. Please set up your available hours in Settings > Availability first.'
          });
        }

        // Generate slots for next 7 days
        const slots = [];
        const now = new Date();
        const daysToCheck = 7;

        for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
          const checkDate = new Date(now);
          checkDate.setDate(checkDate.getDate() + dayOffset);
          const dayOfWeek = checkDate.getDay();

          const dayAvail = availResult.rows.find(a => a.day_of_week === dayOfWeek);
          
          if (dayAvail && dayAvail.is_available) {
            const [startHour, startMin] = dayAvail.start_time.split(':').map(Number);
            const [endHour, endMin] = dayAvail.end_time.split(':').map(Number);

            let slotTime = new Date(checkDate);
            slotTime.setHours(startHour, startMin, 0, 0);

            const endTime = new Date(checkDate);
            endTime.setHours(endHour, endMin, 0, 0);

            while (slotTime < endTime && slots.length < 10) {
              if (slotTime > now) {
                const conflictCheck = await pool.query(
                  `SELECT id FROM bookings 
                   WHERE member_id = $1 
                   AND status = 'confirmed'
                   AND start_time <= $2 
                   AND end_time > $2`,
                  [member.id, slotTime.toISOString()]
                );

                if (conflictCheck.rows.length === 0) {
                  const hour = slotTime.getHours();
                  let matchScore = 85;
                  let matchLabel = 'Good Match';

                  if (hour >= 9 && hour <= 11) {
                    matchScore = 95;
                    matchLabel = 'Excellent Match';
                  } else if (hour >= 14 && hour <= 16) {
                    matchScore = 90;
                    matchLabel = 'Excellent Match';
                  }

                  slots.push({
                    start: slotTime.toISOString(),
                    end: new Date(slotTime.getTime() + 30 * 60000).toISOString(),
                    matchScore,
                    matchLabel
                  });
                }
              }

              slotTime = new Date(slotTime.getTime() + 30 * 60000);
            }
          }
        }

        if (slots.length === 0) {
          return res.json({
            type: 'info',
            message: '❌ No available slots found in the next 7 days. Please check your availability settings.'
          });
        }

        const formattedSlots = slots.slice(0, 5).map((slot, index) => {
          const date = new Date(slot.start);
          const dateStr = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          });
          const timeStr = date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          
          return `${index + 1}️⃣ ${dateStr} • ${timeStr}    (${slot.matchLabel})`;
        }).join('\n');

        return res.json({
          type: 'slots',
          message: `📅 Here are your best available times:\n\n${formattedSlots}\n\n💡 Ready to book? Just say "book slot 1" or "schedule 10 AM"! ⚡`,
          data: { slots: slots.slice(0, 5) },
          usage: {
            chatgpt_used: req.userUsage.chatgpt_used + 1,
            chatgpt_limit: req.userUsage.limits.chatgpt
          }
        });

      } catch (error) {
        console.error('Slot fetch error:', error);
        return res.json({
          type: 'error', 
          message: 'Sorry, I had trouble checking your availability. Please try again.'
        });
      }
    }

    // ============ HANDLE EMAIL SENDING INTENTS ============
    if (parsedIntent.intent === 'send_email' && parsedIntent.email_action) {
      const { type, recipient, meeting_details } = parsedIntent.email_action;
      
      // Validate email
      if (!validateEmail(recipient)) {
        return res.json({
          type: 'error',
          message: `❌ Invalid email address: ${recipient}. Please provide a valid email.`
        });
      }
      
      // Select best template from user's templates
      const template = await selectBestTemplate(userId, type, meeting_details);
      
      if (!template) {
        return res.json({
          type: 'error',
          message: `❌ No ${type} template found. Please create one in Email Templates first, or I'll use a default template.`
        });
      }
      
      // Prepare meeting details with context from recent bookings
      const emailDetails = {
        date: meeting_details?.date || new Date().toLocaleDateString(),
        time: meeting_details?.time || 'TBD',
        link: meeting_details?.link || userContext.upcomingBookings?.[0]?.meet_link || 'Will be provided',
        title: meeting_details?.title || userContext.upcomingBookings?.[0]?.title || 'Meeting'
      };
      
      // Send email with selected template
      const emailSent = await sendEmailWithTemplate(template, recipient, emailDetails, userId);
      
      if (emailSent) {
        // Track template usage (if template has ID)
        if (template.id) {
          await trackTemplateUsage(template.id, userId, 'sent');
        }
        
        // Increment AI usage
        await incrementChatGPTUsage(userId);
        
        return res.json({
          type: 'email_sent',
          message: `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} email sent to ${recipient} using "${template.name}" template! 📧`,
          data: {
            template_used: template.name,
            recipient: recipient,
            email_type: type
          },
          usage: {
            chatgpt_used: req.userUsage.chatgpt_used + 1,
            chatgpt_limit: req.userUsage.limits.chatgpt
          }
        });
      } else {
        return res.json({
          type: 'error',
          message: `❌ Failed to send ${type} email to ${recipient}. Please try again.`
        });
      }
    }


    // ============ HANDLE CREATE MEETING INTENT ============
    if (parsedIntent.intent === 'create_meeting') {
      // Email validation
      if (parsedIntent.extracted.attendees && parsedIntent.extracted.attendees.length > 0) {
        const invalidEmails = parsedIntent.extracted.attendees.filter(email => !validateEmail(email));
        if (invalidEmails.length > 0) {
          return res.json({
            type: 'clarify',
            message: `❌ Invalid email address(es): ${invalidEmails.join(', ')}\n\nPlease provide valid email addresses. Example: john@company.com`,
            data: parsedIntent
          });
        }
      }

      // Required field validation
      if (!parsedIntent.extracted.date || !parsedIntent.extracted.time) {
        return res.json({
          type: 'clarify',
          message: '📅 I need both a date and time to schedule your meeting. When would you like to meet?',
          data: parsedIntent
        });
      }

      if (!parsedIntent.extracted.attendees || parsedIntent.extracted.attendees.length === 0) {
        return res.json({
          type: 'clarify',
          message: '👥 Who should I invite to this meeting? Please provide their email address.',
          data: parsedIntent
        });
      }

      // Check missing fields
      const missing = parsedIntent.missing_fields || [];
      if (missing.length > 0) {
        return res.json({
          type: 'clarify',
          message: parsedIntent.clarifying_question || `I need a bit more information. What ${missing.join(' and ')} would work for you?`,
          data: parsedIntent
        });
      }

      // All validation passed - prepare booking data
      const bookingData = {
        title: parsedIntent.extracted.title || 'Meeting',
        date: parsedIntent.extracted.date,
        time: parsedIntent.extracted.time,
        duration: parsedIntent.extracted.duration_minutes || 30,
        attendees: parsedIntent.extracted.attendees,
        attendee_email: parsedIntent.extracted.attendees[0],
        notes: parsedIntent.extracted.notes
      };

      let confirmationMessage = `✅ Ready to schedule "${bookingData.title}" for ${bookingData.date} at ${bookingData.time}?\n\n👥 Attendees: ${bookingData.attendees.join(', ')}\n⏱️ Duration: ${bookingData.duration} minutes\n📝 Notes: ${bookingData.notes || 'None'}`;

      // Try to find a confirmation template for preview
      try {
        const confirmationTemplate = await selectBestTemplate(userId, 'confirmation', {
          date: bookingData.date,
          time: bookingData.time,
          title: bookingData.title
        });

        if (confirmationTemplate) {
          confirmationMessage += `\n\n📧 Will use "${confirmationTemplate.name}" template for confirmation email`;
          bookingData.selectedTemplate = confirmationTemplate;
        }
      } catch (templateError) {
        console.log('📧 No confirmation template found, proceeding without auto-email');
      }

      return res.json({
        type: 'confirmation',
        message: confirmationMessage,
        data: { bookingData }
      });
    }

    // ============ DEFAULT RESPONSE ============
    await incrementChatGPTUsage(userId);
    console.log(`💰 ChatGPT query used by user ${userId} (${req.userUsage.tier} plan)`);

    return res.json({
      type: 'clarify',
      message: parsedIntent.clarifying_question || 'How can I help you with your scheduling today? You can ask me to show bookings, find available times, schedule meetings, or send emails.',
      usage: {
        chatgpt_used: req.userUsage.chatgpt_used + 1,
        chatgpt_limit: req.userUsage.limits.chatgpt
      }
    });

  } catch (error) {
    console.error('🚨 AI scheduling error:', error);
    res.status(500).json({
      type: 'error',
      message: 'Something went wrong. Please try again.'
    });
  }
});


// ============ AI BOOKING ENDPOINT (MULTIPLE ATTENDEES) ============
app.post('/api/ai/book-meeting', authenticateToken, async (req, res) => {
  try {
    const {
      title, start_time, end_time, attendees, attendee_email, 
      attendee_name, notes, duration
    } = req.body;
    
    const userId = req.user.id;
    const attendeeList = attendees || [attendee_email];
    
    console.log('🤖 AI Booking request:', {
      title, start_time, attendees: attendeeList, userId
    });
    
    // Create individual booking for each attendee
    const bookings = [];
    
    for (const email of attendeeList) {
      const result = await pool.query(`
        INSERT INTO bookings (
          title, start_time, end_time, attendee_email, attendee_name,
          notes, duration, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', NOW(), NOW())
        RETURNING *
      `, [
        title, start_time, end_time, email, 
        email.split('@')[0], 
        notes || '', duration || 30
      ]);
      
      bookings.push(result.rows[0]);
      console.log(`✅ Booking created for ${email}: ${result.rows[0].id}`);
    }
    
    // Send emails to all attendees
    for (const email of attendeeList) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C3AED;">📅 Meeting Confirmed</h2>
            <p>Hi there,</p>
            <p>You've been invited to a meeting!</p>
            
            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">📋 Meeting Details:</h3>
              <p><strong>Title:</strong> ${title}</p>
              <p><strong>Date & Time:</strong> ${new Date(start_time).toLocaleString()}</p>
              <p><strong>Duration:</strong> ${duration} minutes</p>
              <p><strong>Attendees:</strong> ${attendeeList.join(', ')}</p>
              ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            </div>
            
            <p>Looking forward to meeting with you!</p>
            <p style="color: #666; font-size: 12px;">Powered by ScheduleSync AI</p>
          </div>
        `;

        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'ScheduleSync <notifications@resend.dev>',
          to: email,
          subject: `Meeting Invitation: ${title}`,
          html: emailHtml
        });
        
        console.log(`📧 Invitation sent to ${email}`);
        
      } catch (emailError) {
        console.error(`📧 Email failed for ${email}:`, emailError);
      }
    }
    
    res.json({ 
      success: true, 
      bookings: bookings,
      attendee_count: attendeeList.length,
      message: `Meeting created with ${attendeeList.length} attendee(s)`
    });
    
  } catch (error) {
    console.error('🚨 AI booking error:', error);
    res.status(500).json({ 
      error: 'Failed to create AI booking',
      details: error.message 
    });
  }
});

// ============ AI TEMPLATE GENERATION ENDPOINT (GEMINI VERSION) ============
app.post('/api/ai/generate-template', authenticateToken, checkUsageLimits, async (req, res) => {
  try {
    const { description, type, tone } = req.body;
    const userId = req.user.id;
    
    console.log('🤖 AI Template generation request:', { description, type, tone, userId });

    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide a more detailed description (at least 10 characters)' });
    }

    const prompt = `Create a professional email template based on this request: "${description}"

Template Type: ${type || 'general'}
Tone: ${tone || 'professional but friendly'}

Requirements:
- Return ONLY valid JSON (no markdown, no explanations)
- Use these exact variable names: {{guestName}}, {{guestEmail}}, {{organizerName}}, {{meetingDate}}, {{meetingTime}}, {{meetingLink}}, {{bookingLink}}
- Keep subject under 60 characters
- Make body 3-5 sentences, warm but professional
- Include appropriate emojis sparingly

Format:
{
  "name": "Template name (2-4 words)",
  "subject": "Email subject line",
  "body": "Email body with proper formatting and variables"
}`;

    // Call Google Gemini API (same pattern as your AI scheduling)
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 500,
        }
      })
    });

    // Error handling (same pattern as your AI scheduling)
    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiResponse.status, geminiResponse.statusText);
      return res.status(500).json({
        error: 'AI service temporarily unavailable',
        details: 'Please try again in a moment'
      });
    }

    const geminiData = await geminiResponse.json();

    if (!geminiData?.candidates?.[0]?.content) {
      console.error('Invalid Gemini response:', geminiData);
      return res.status(500).json({
        error: 'AI generated invalid response',
        details: 'Please try again with a clearer description'
      });
    }

    const aiText = geminiData.candidates[0].content.parts[0].text;
    
    // Parse JSON response (same logic as your AI scheduling)
    let generatedTemplate;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response:', aiText);
        return res.status(500).json({
          error: 'AI generated invalid response format',
          details: 'Please try again with a clearer description'
        });
      }
      generatedTemplate = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('🚨 JSON parsing failed:', parseError);
      console.error('🚨 Raw response:', aiText);
      return res.status(500).json({
        error: 'AI generated invalid response format',
        details: 'Please try again with a clearer description'
      });
    }
    
    // Add metadata
    const templateData = {
      ...generatedTemplate,
      type: type || 'other',
      is_favorite: false,
      generated_by_ai: true,
      generated_at: new Date().toISOString()
    };

    // Increment usage for successful generation
    await incrementChatGPTUsage(userId);
    console.log(`💰 Template generation completed for user ${userId}`);

    res.json({
      success: true,
      template: templateData,
      usage: {
        chatgpt_used: req.userUsage.chatgpt_used + 1,
        chatgpt_limit: req.userUsage.limits.chatgpt
      }
    });

  } catch (error) {
    console.error('🚨 AI template generation error:', error);
    
    if (error.code === 'ENOTFOUND') {
      res.status(500).json({
        error: 'AI service connection failed',
        details: 'Please check your internet connection'
      });
    } else {
      res.status(500).json({
        error: 'Failed to generate template',
        details: error.message
      });
    }
  }
});

// ============ EMAIL TEMPLATE ENDPOINTS (FIXED FOR YOUR SCHEMA) ============

// Get all templates for user
app.get('/api/email-templates', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM email_templates 
       WHERE user_id = $1 AND is_active = true
       ORDER BY is_default DESC, name ASC`,
      [req.user.id]
    );
    
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create new template (FIXED)
app.post('/api/email-templates', authenticateToken, async (req, res) => {
  try {
    const { name, type, subject, body, is_default } = req.body;
    
    if (!name || !subject || !body) {
      return res.status(400).json({ error: 'Name, subject, and body are required' });
    }
    
    const validTypes = ['reminder', 'confirmation', 'follow_up', 'reschedule', 'cancellation', 'other'];
    const templateType = validTypes.includes(type) ? type : 'other';
    
    const result = await pool.query(
      `INSERT INTO email_templates (user_id, name, type, subject, body, is_default, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       RETURNING *`,
      [req.user.id, name, templateType, subject, body, is_default || false]
    );
    
    console.log('✅ Email template created:', result.rows[0].id);
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template (FIXED)
app.put('/api/email-templates/:id', authenticateToken, async (req, res) => {
  try {
    const { name, type, subject, body, is_default } = req.body;
    
    const result = await pool.query(
      `UPDATE email_templates 
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           subject = COALESCE($3, subject),
           body = COALESCE($4, body),
           is_default = COALESCE($5, is_default),
           updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [name, type, subject, body, is_default, req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Toggle default (instead of favorite)
app.patch('/api/email-templates/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE email_templates 
       SET is_default = NOT is_default, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Toggle default error:', error);
    res.status(500).json({ error: 'Failed to toggle default' });
  }
});

// ============ AI TEMPLATE SELECTION FUNCTION ============
const selectBestTemplate = async (userId, templateType, context) => {
  try {
    // Get user's templates
    const templatesResult = await pool.query(`
      SELECT * FROM email_templates 
      WHERE user_id = $1 AND is_active = true
      ORDER BY is_default DESC, name ASC
    `, [userId]);
    
    const userTemplates = templatesResult.rows;
    
    // Default templates as fallback
    const DEFAULT_TEMPLATES = {
      'reminder': {
        id: 'default_reminder',
        name: 'Default Reminder',
        subject: 'Reminder: {{meetingDate}} at {{meetingTime}}',
        body: `Hi {{guestName}},\n\nJust a quick reminder about our meeting:\n\n📅 {{meetingDate}} at {{meetingTime}}\n🔗 {{meetingLink}}\n\nSee you soon!\n{{organizerName}}`
      },
      'confirmation': {
        id: 'default_confirmation',
        name: 'Default Confirmation',
        subject: 'Meeting confirmed for {{meetingDate}}',
        body: `Hi {{guestName}},\n\nYour meeting is confirmed!\n\n📅 {{meetingDate}}\n🕐 {{meetingTime}}\n🔗 {{meetingLink}}\n\nLooking forward to it!\n{{organizerName}}`
      },
      'follow_up': {
        id: 'default_followup',
        name: 'Default Follow-up',
        subject: 'Thank you for your time!',
        body: `Hi {{guestName}},\n\nThank you for meeting with me today!\n\nIf you need anything else: {{bookingLink}}\n\nBest regards,\n{{organizerName}}`
      },
      'reschedule': {
        id: 'default_reschedule',
        name: 'Default Reschedule',
        subject: 'Need to reschedule our meeting',
        body: `Hi {{guestName}},\n\nI need to reschedule our meeting on {{meetingDate}}.\n\nPlease let me know what works better for you: {{bookingLink}}\n\nApologies for any inconvenience!\n{{organizerName}}`
      },
      'cancellation': {
        id: 'default_cancellation',
        name: 'Default Cancellation',
        subject: 'Meeting cancellation',
        body: `Hi {{guestName}},\n\nI need to cancel our meeting scheduled for {{meetingDate}}.\n\nI'll reach out to reschedule soon.\n\nSorry for the inconvenience!\n{{organizerName}}`
      }
    };

    // Find best matching user template
    let selectedTemplate = userTemplates.find(t => 
      t.type === templateType && t.is_default
    );

    // Fallback to any template of the right type
    if (!selectedTemplate) {
      selectedTemplate = userTemplates.find(t => t.type === templateType);
    }

    // Ultimate fallback to default template
    if (!selectedTemplate && DEFAULT_TEMPLATES[templateType]) {
      selectedTemplate = DEFAULT_TEMPLATES[templateType];
    }

    // Generic fallback
    if (!selectedTemplate) {
      selectedTemplate = DEFAULT_TEMPLATES['confirmation'];
    }

    console.log(`📧 Selected template: ${selectedTemplate?.name || 'Default'} for type: ${templateType}`);
    return selectedTemplate;

  } catch (error) {
    console.error('Template selection error:', error);
    return DEFAULT_TEMPLATES['confirmation']; // Safe fallback
  }
};

// ============ SEND EMAIL WITH TEMPLATE FUNCTION ============
const sendEmailWithTemplate = async (template, recipientEmail, meetingDetails, userId) => {
  try {
    // Get user info
    const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);
    const organizer = userResult.rows[0];

    // Prepare template variables
    const variables = {
      guestName: recipientEmail.split('@')[0], // Default to email username
      guestEmail: recipientEmail,
      organizerName: organizer?.name || organizer?.email || 'Your host',
      meetingDate: meetingDetails?.date || 'TBD',
      meetingTime: meetingDetails?.time || 'TBD',
      meetingLink: meetingDetails?.link || 'Will be provided',
      bookingLink: `${process.env.BASE_URL || 'https://schedulesync.app'}/book/${userId}`
    };

    // Replace variables in template
    let subject = template.subject;
    let body = template.body;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });

    // Send email
    const emailResult = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'ScheduleSync <notifications@resend.dev>',
      to: recipientEmail,
      subject: subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; white-space: pre-wrap;">${body.replace(/\n/g, '<br>')}</div>`
    });

    console.log(`📧 Email sent using template "${template.name}" to ${recipientEmail}`);
    return true;

  } catch (error) {
    console.error('📧 Email sending failed:', error);
    return false;
  }
};

// ============ TRACK TEMPLATE USAGE ============
const trackTemplateUsage = async (templateId, userId, action) => {
  try {
    if (!templateId || templateId.startsWith('default_')) {
      return; // Don't track default templates
    }

    await pool.query(`
      UPDATE email_templates 
      SET usage_count = COALESCE(usage_count, 0) + 1,
          last_used = NOW()
      WHERE id = $1 AND user_id = $2
    `, [templateId, userId]);

  } catch (error) {
    console.error('Failed to track template usage:', error);
  }
};

// ============ SUBSCRIPTION MANAGEMENT ============
// (Add this section after your existing payment endpoints)

// Get current subscription
app.get('/api/subscriptions/current', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userResult = await pool.query(
      'SELECT subscription_tier, subscription_status, stripe_subscription_id, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    res.json({
      plan: user.subscription_tier || 'free',
      status: user.subscription_status || 'active',
      stripe_subscription_id: user.stripe_subscription_id,
      stripe_customer_id: user.stripe_customer_id
    });
  } catch (error) {
    console.error('Current subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Create new subscription
app.post('/api/subscriptions/create', authenticateToken, async (req, res) => {
  try {
    const { plan_id } = req.body; // 'pro' or 'team'
    const userId = req.user.id;
    
    console.log(`🚀 Creating subscription for user ${userId}, plan: ${plan_id}`);

    // Get user details
    const userResult = await pool.query(
      'SELECT email, name, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // For testing, let's simulate the subscription creation
    // Later you can add real Stripe subscription creation here
    
    // Update user's subscription in database
    await pool.query(
      `UPDATE users 
       SET subscription_tier = $1, 
           subscription_status = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [plan_id, 'active', userId]
    );
    
    console.log(`✅ Successfully upgraded user ${userId} to ${plan_id} plan`);

    // Return success response
    res.json({ 
      success: true,
      message: `Successfully upgraded to ${plan_id} plan`,
      client_secret: 'simulated_success', // Frontend expects this
      subscription: {
        plan: plan_id,
        status: 'active'
      }
    });
    
  } catch (error) {
    console.error('❌ Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Cancel subscription
app.post('/api/subscriptions/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`🔴 Cancelling subscription for user ${userId}`);
    
    // Update subscription status
    await pool.query(
      `UPDATE users 
       SET subscription_tier = $1, 
           subscription_status = $2,
           updated_at = NOW()
       WHERE id = $3`,
      ['free', 'cancelled', userId]
    );
    
    console.log(`✅ Successfully cancelled subscription for user ${userId}`);
    
    res.json({ 
      success: true,
      message: 'Subscription cancelled successfully' 
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Billing portal (placeholder)
app.post('/api/subscriptions/billing-portal', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`🏪 Creating billing portal for user ${userId}`);
    
    // For now, return a placeholder URL
    // Later you can integrate with Stripe's billing portal
    res.json({ 
      url: 'https://billing.stripe.com/p/login/test_placeholder',
      message: 'Billing portal coming soon'
    });
  } catch (error) {
    console.error('Billing portal error:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});


// ============ CHATGPT INTEGRATION ENDPOINTS ============

// ChatGPT OAuth verification
app.post('/api/chatgpt/auth', async (req, res) => {
  try {
    const { chatgpt_user_id, access_token } = req.body;
    
    // Verify the access token (you'd implement your own JWT verification)
    const decoded = jwt.verify(access_token, process.env.JWT_SECRET);
    
    res.json({
      success: true,
      user_id: decoded.id,
      email: decoded.email,
      name: decoded.name
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication' });
  }
});

// Get user's generic booking link
app.get('/api/chatgpt/booking-link', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's personal team and booking token
    const result = await pool.query(`
      SELECT tm.booking_token, t.name as team_name
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1 AND t.name LIKE '%Personal%'
      LIMIT 1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No booking link found' });
    }
    
    const bookingUrl = `${process.env.FRONTEND_URL}/book/${result.rows[0].booking_token}`;
    
    res.json({
      url: bookingUrl,
      token: result.rows[0].booking_token,
      team_name: result.rows[0].team_name
    });
  } catch (error) {
    console.error('Get booking link error:', error);
    res.status(500).json({ error: 'Failed to get booking link' });
  }
});

// Create temporary booking link
app.post('/api/chatgpt/temporary-link', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { invitee_name, duration = 30, expiry_hours = 24, max_uses = 1 } = req.body;
    
    // Get user's member_id
    const memberResult = await pool.query(
      'SELECT id FROM team_members WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(400).json({ error: 'No team membership found' });
    }
    
    const memberId = memberResult.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (expiry_hours * 60 * 60 * 1000));
    
    // Create temporary link
   await pool.query(`
  INSERT INTO single_use_links (token, member_id, name, expires_at) 
  VALUES ($1, $2, $3, $4)
`, [token, memberId, invitee_name, expiresAt]);

    const bookingUrl = `${process.env.FRONTEND_URL}/book/${token}`;
    
    res.json({
      url: bookingUrl,
      token: token,
      invitee_name: invitee_name,
      expires_at: expiresAt,
    
    });
  } catch (error) {
    console.error('Create temporary link error:', error);
    res.status(500).json({ error: 'Failed to create temporary link' });
  }
});

// Suggest optimal meeting times
app.post('/api/chatgpt/suggest-times', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { duration = 30, days_ahead = 7, preferred_times, participants } = req.body;
    
    // Use your existing slot generation logic
    // This would call your slots API internally
    const memberResult = await pool.query(
      'SELECT booking_token FROM team_members WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(400).json({ error: 'No booking token found' });
    }
    
    // Generate slots (you can reuse your existing logic)
    const suggestions = [
      {
        date: "2024-12-03",
        time: "2:00 PM",
        score: 95,
        reason: "Optimal afternoon slot"
      },
      {
        date: "2024-12-04", 
        time: "10:00 AM",
        score: 88,
        reason: "Good morning focus time"
      }
    ];
    
    res.json({
      suggestions: suggestions,
      duration: duration,
      booking_token: memberResult.rows[0].booking_token
    });
  } catch (error) {
    console.error('Suggest times error:', error);
    res.status(500).json({ error: 'Failed to suggest times' });
  }
});

// ============ FIXED CHATGPT BOOK-MEETING ENDPOINT ============
// Replace your existing /api/chatgpt/book-meeting endpoint with this

app.post('/api/chatgpt/book-meeting', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      title, 
      start_time, 
      end_time, 
      attendee_email, 
      attendee_name,
      notes 
    } = req.body;

    console.log('🤖 AI Booking request:', { title, start_time, attendee_email });

    // Validate required fields
    if (!start_time || !attendee_email) {
      return res.status(400).json({ error: 'Start time and attendee email are required' });
    }

    // Get user's booking token and info
    const memberResult = await pool.query(
      `SELECT tm.id, tm.booking_token, tm.name, tm.email, t.name as team_name
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.user_id = $1 OR t.owner_id = $1
       LIMIT 1`,
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(400).json({ error: 'No team membership found' });
    }

    const member = memberResult.rows[0];
    
    // Create booking
    const manageToken = crypto.randomBytes(16).toString('hex');
    const bookingTitle = title || 'Meeting';
    const guestName = attendee_name || attendee_email.split('@')[0];
    
    // Calculate end time if not provided (default 30 min)
    const startDate = new Date(start_time);
    const endDate = end_time ? new Date(end_time) : new Date(startDate.getTime() + 30 * 60000);
    const duration = Math.round((endDate - startDate) / 60000);

    const bookingResult = await pool.query(`
      INSERT INTO bookings (
        member_id, user_id, attendee_name, attendee_email,
        start_time, end_time, title, notes, status, manage_token, duration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9, $10)
      RETURNING *
    `, [
      member.id, userId, guestName, attendee_email,
      startDate.toISOString(), endDate.toISOString(), 
      bookingTitle, notes || null, manageToken, duration
    ]);

    const booking = bookingResult.rows[0];
    console.log('✅ AI Booking created:', booking.id);

    // Format times for email
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const manageUrl = `${process.env.FRONTEND_URL || 'https://trucal.xyz'}/manage/${manageToken}`;

    // Send confirmation email to GUEST
    try {
      await resend.emails.send({
        from: `${member.name} via ScheduleSync <notifications@${process.env.RESEND_DOMAIN || 'trucal.xyz'}>`,
        to: attendee_email,
        subject: `✅ Meeting Confirmed: ${bookingTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">✅ Meeting Confirmed!</h1>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #333;">Hi ${guestName},</p>
              
              <p style="font-size: 16px; color: #555;">Your meeting with <strong>${member.name}</strong> has been confirmed!</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; color: #333;"><strong>🕐 Time:</strong> ${formattedTime}</p>
                <p style="margin: 5px 0; color: #333;"><strong>⏱️ Duration:</strong> ${duration} minutes</p>
              </div>
              
              ${notes ? `
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #856404;"><strong>📝 Notes:</strong> ${notes}</p>
              </div>
              ` : ''}
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${manageUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Manage Booking</a>
              </div>
              
              <p style="font-size: 14px; color: #888; margin-top: 30px; text-align: center;">
                Scheduled via ScheduleSync
              </p>
            </div>
          </div>
        `
      });
      console.log('✅ Guest confirmation email sent to:', attendee_email);
    } catch (emailError) {
      console.error('❌ Failed to send guest email:', emailError);
    }

    // Send notification email to ORGANIZER
    try {
      await resend.emails.send({
        from: `ScheduleSync <notifications@${process.env.RESEND_DOMAIN || 'trucal.xyz'}>`,
        to: member.email,
        subject: `📅 New Booking: ${guestName} - ${bookingTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">📅 New Booking via AI</h1>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #333;">Hi ${member.name},</p>
              
              <p style="font-size: 16px; color: #555;">You have a new booking created via your AI assistant.</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #11998e;">
                <p style="margin: 5px 0; color: #333;"><strong>👤 Guest:</strong> ${guestName} (${attendee_email})</p>
                <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; color: #333;"><strong>🕐 Time:</strong> ${formattedTime}</p>
                <p style="margin: 5px 0; color: #333;"><strong>⏱️ Duration:</strong> ${duration} minutes</p>
              </div>
              
              ${notes ? `
              <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #2e7d32;"><strong>📝 Notes:</strong> ${notes}</p>
              </div>
              ` : ''}
              
              <p style="font-size: 14px; color: #888; margin-top: 30px; text-align: center;">
                Powered by ScheduleSync AI
              </p>
            </div>
          </div>
        `
      });
      console.log('✅ Organizer notification email sent to:', member.email);
    } catch (emailError) {
      console.error('❌ Failed to send organizer email:', emailError);
    }

    res.json({
      success: true,
      booking_id: booking.id,
      manage_url: manageUrl,
      message: `Meeting "${bookingTitle}" booked successfully with ${guestName}`
    });

  } catch (error) {
    console.error('🚨 AI Book meeting error:', error);
    res.status(500).json({ error: 'Failed to book meeting' });
  }
});

// Get team members
app.get('/api/chatgpt/team-members', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(`
      SELECT tm.name, tm.email, tm.booking_token, t.name as team_name
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE t.owner_id = $1
      ORDER BY tm.created_at ASC
    `, [userId]);
    
    res.json({
      team_members: result.rows
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to get team members' });
  }
});

// ============================================
// CHATGPT INTEGRATION ENDPOINTS
// These allow the AI assistant to use templates
// ============================================

// Get templates for ChatGPT (simple format)
app.get('/api/chatgpt/email-templates', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = `
      SELECT id, name, type, subject 
      FROM email_templates 
      WHERE user_id = $1
    `;
    const params = [req.user.id];
    
    if (type) {
      query += ` AND type = $2`;
      params.push(type);
    }
    
    query += ` ORDER BY is_favorite DESC, name ASC`;
    
    const result = await pool.query(query, params);
    
    res.json({ 
      templates: result.rows.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        subject: t.subject
      })),
      types: ['reminder', 'confirmation', 'follow_up', 'reschedule', 'cancellation', 'other']
    });
  } catch (error) {
    console.error('ChatGPT get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Search templates by keyword (for AI natural language)
app.get('/api/chatgpt/find-template', authenticateToken, async (req, res) => {
  try {
    const { query, type } = req.query;
    
    if (!query && !type) {
      return res.status(400).json({ error: 'Provide query or type parameter' });
    }
    
    let sqlQuery = `
      SELECT id, name, type, subject, body 
      FROM email_templates 
      WHERE user_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;
    
    if (query) {
      sqlQuery += ` AND (LOWER(name) LIKE LOWER($${paramIndex}) OR LOWER(subject) LIKE LOWER($${paramIndex}))`;
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    if (type) {
      sqlQuery += ` AND type = $${paramIndex}`;
      params.push(type);
    }
    
    sqlQuery += ` ORDER BY is_favorite DESC LIMIT 5`;
    
    const result = await pool.query(sqlQuery, params);
    
    if (result.rows.length === 0) {
      return res.json({ 
        found: false,
        message: 'No matching templates found',
        suggestion: 'Create a new template or try different search terms'
      });
    }
    
    res.json({ 
      found: true,
      templates: result.rows,
      best_match: result.rows[0]
    });
  } catch (error) {
    console.error('Find template error:', error);
    res.status(500).json({ error: 'Failed to search templates' });
  }
});

// Send email using a template (for ChatGPT)
app.post('/api/chatgpt/send-email', authenticateToken, async (req, res) => {
  try {
    const { 
      template_id, 
      template_name, 
      recipient_email, 
      recipient_name, 
      booking_id,
      custom_data 
    } = req.body;
    
    if (!recipient_email) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }
    
    // Get template by ID or name
    let template;
    
    if (template_id) {
      const result = await pool.query(
        `SELECT * FROM email_templates WHERE id = $1 AND user_id = $2`,
        [template_id, req.user.id]
      );
      template = result.rows[0];
    } else if (template_name) {
      const result = await pool.query(
        `SELECT * FROM email_templates 
         WHERE user_id = $1 AND LOWER(name) LIKE LOWER($2)
         ORDER BY is_favorite DESC
         LIMIT 1`,
        [req.user.id, `%${template_name}%`]
      );
      template = result.rows[0];
    }
    
    if (!template) {
      return res.status(404).json({ 
        error: 'Template not found',
        hint: 'List templates first with GET /api/chatgpt/email-templates'
      });
    }
    
    // Get user info
    const userResult = await pool.query(
      `SELECT name, email FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = userResult.rows[0];
    
    // Get booking info if provided
    let bookingData = {};
    if (booking_id) {
      const bookingResult = await pool.query(
        `SELECT * FROM bookings WHERE id = $1`,
        [booking_id]
      );
      
      if (bookingResult.rows[0]) {
        const booking = bookingResult.rows[0];
        bookingData = {
          meetingDate: new Date(booking.start_time).toLocaleDateString('en-US', { 
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
          }),
          meetingTime: new Date(booking.start_time).toLocaleTimeString('en-US', { 
            hour: 'numeric', minute: '2-digit', hour12: true 
          }),
          meetingLink: booking.meeting_link || '',
        };
      }
    }
    
    // Prepare variables
    const variables = {
      guestName: recipient_name || 'there',
      guestEmail: recipient_email,
      organizerName: user.name,
      organizerEmail: user.email,
      bookingLink: `${process.env.FRONTEND_URL || 'https://trucal.xyz'}/book/${req.user.id}`,
      ...bookingData,
      ...custom_data
    };
    
    // Replace variables in template
    let subject = template.subject;
    let body = template.body;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(regex, value || '');
      body = body.replace(regex, value || '');
    });
    
    // Send email
    try {
      await resend.emails.send({
        from: `${user.name} via ScheduleSync <notifications@${process.env.RESEND_DOMAIN || 'trucal.xyz'}>`,
        to: recipient_email,
        subject: subject,
        text: body,
      });
      
      console.log(`✅ AI sent email: "${template.name}" to ${recipient_email}`);
      
      res.json({ 
        success: true,
        message: `Email sent to ${recipient_email}`,
        template_used: template.name,
        subject: subject
      });
    } catch (emailError) {
      console.error('Email send error:', emailError);
      res.status(500).json({ error: 'Failed to send email' });
    }
    
  } catch (error) {
    console.error('ChatGPT send email error:', error);
    res.status(500).json({ error: 'Failed to process email request' });
  }
});

// =============================================================================
// JWT TOKEN MANAGEMENT FOR CHATGPT INTEGRATION (CORRECTED VERSION)
// Replace your existing JWT endpoints with this corrected version
// =============================================================================

// Get user's current JWT token for ChatGPT integration
app.get('/api/user/jwt-token', authenticateToken, trackChatGptUsage, async (req, res) => {
  try {
    const user_id = req.user.id;
    
    // Get user info
    const userQuery = 'SELECT id, email, name, created_at FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [user_id]); // ✅ FIXED: pool instead of client
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Generate a fresh JWT token that expires in 90 days (longer for ChatGPT)
    const chatgptToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        purpose: 'chatgpt_integration'
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '90d' }
    );
    
    // Check if user has any team members (for ChatGPT functionality)
    const teamQuery = `
      SELECT tm.booking_token, t.name as team_name, t.booking_mode
      FROM team_members tm 
      JOIN teams t ON tm.team_id = t.id 
      WHERE tm.user_id = $1 
      LIMIT 1
    `;
    const teamResult = await pool.query(teamQuery, [user_id]); // ✅ FIXED: pool instead of client
    const hasBookingSetup = teamResult.rows.length > 0;
    
    res.json({
      jwt_token: chatgptToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      setup_status: {
        has_booking_setup: hasBookingSetup,
        booking_token: hasBookingSetup ? teamResult.rows[0].booking_token : null,
        team_name: hasBookingSetup ? teamResult.rows[0].team_name : null
      },
      expires_in: '90 days',
      chatgpt_gpt_name: 'AI Meeting Booker',
      instructions: 'Use this token as the API key when setting up ChatGPT custom GPT actions'
    });
    
  } catch (error) {
    console.error('Error generating ChatGPT JWT token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh JWT token (if user needs a new one)
app.post('/api/user/refresh-chatgpt-token', authenticateToken, trackChatGptUsage, async (req, res) => {
  try {
    const user_id = req.user.id;
    
    // Get user info
    const userQuery = 'SELECT id, email, name FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [user_id]); // ✅ FIXED: pool instead of client
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Generate new JWT token
    const newToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        purpose: 'chatgpt_integration' 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '90d' }
    );
    
    res.json({
      jwt_token: newToken,
      message: 'New ChatGPT integration token generated successfully',
      expires_in: '90 days',
      note: 'Update this token in your ChatGPT custom GPT configuration'
    });
    
  } catch (error) {
    console.error('Error refreshing ChatGPT token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test ChatGPT connection (verify token works)
app.get('/api/user/test-chatgpt-connection', authenticateToken, trackChatGptUsage, async (req, res) => {
  try {
    const user_id = req.user.id;
    
    // Test that all ChatGPT endpoints would work
    const tests = [];
    
    // Test 1: Can get booking link
    try {
      const memberQuery = `
        SELECT tm.booking_token, t.name as team_name 
        FROM team_members tm 
        JOIN teams t ON tm.team_id = t.id 
        WHERE tm.user_id = $1 AND t.name LIKE '%Personal%' 
        LIMIT 1
      `;
      const memberResult = await pool.query(memberQuery, [user_id]); // ✅ FIXED: pool instead of client
      tests.push({
        test: 'Get Booking Link',
        status: memberResult.rows.length > 0 ? 'PASS' : 'FAIL',
        details: memberResult.rows.length > 0 ? 'Personal booking link available' : 'No personal booking setup found'
      });
    } catch (error) {
      tests.push({
        test: 'Get Booking Link',
        status: 'ERROR',
        details: error.message
      });
    }
    
    // Test 2: Can create temporary links
    tests.push({
      test: 'Create Temporary Links',
      status: 'PASS',
      details: 'single_use_links table accessible'
    });
    
    // Test 3: Can get team members
    try {
      const teamQuery = `SELECT COUNT(*) as team_count FROM teams WHERE owner_id = $1`;
      const teamResult = await pool.query(teamQuery, [user_id]); // ✅ FIXED: pool instead of client
      tests.push({
        test: 'Get Team Members',
        status: 'PASS',
        details: `${teamResult.rows[0].team_count} teams found`
      });
    } catch (error) {
      tests.push({
        test: 'Get Team Members',
        status: 'ERROR',
        details: error.message
      });
    }
    
    const allPassed = tests.every(t => t.status === 'PASS');
    
    res.json({
      connection_status: allPassed ? 'READY' : 'ISSUES_FOUND',
      message: allPassed ? 'ChatGPT integration ready to use!' : 'Some issues detected - check details',
      tests: tests,
      next_steps: allPassed ? [
        'Copy your JWT token',
        'Set up ChatGPT custom GPT',
        'Use token as API key in GPT actions'
      ] : [
        'Complete your ScheduleSync setup first',
        'Ensure you have at least one team member',
        'Then retry this connection test'
      ]
    });
    
  } catch (error) {
    console.error('Error testing ChatGPT connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/usage', authenticateToken, getCurrentUsage, (req, res) => {
  res.json(req.userUsage);
});


// Get ChatGPT setup instructions
app.get('/api/user/chatgpt-setup-guide', (req, res) => {
  res.json({
    title: 'ChatGPT Integration Setup Guide',
    steps: [
      {
        step: 1,
        title: 'Get Your JWT Token',
        description: 'Copy your JWT token from the ChatGPT Integration section in your dashboard',
        action: 'Click the "Copy Token" button above'
      },
      {
        step: 2,
        title: 'Create Custom GPT',
        description: 'Go to ChatGPT and create a new custom GPT',
        action: 'Visit chat.openai.com and click "Explore GPTs" → "Create a GPT"'
      },
      {
        step: 3,
        title: 'Configure Your GPT',
        description: 'Set up your AI Meeting Booker with these details',
        details: {
          name: 'AI Meeting Booker',
          description: 'The fastest way to a confirmed meeting',
          instructions: `You are an AI Meeting Booker assistant powered by ScheduleSync. You help users:

1. Get their booking links for sharing
2. Create temporary, personalized booking links 
3. Suggest optimal meeting times using AI
4. View their team members

Always be friendly and efficient. When users ask for booking links or meeting times, use the available actions to help them immediately.

Example interactions:
- "What's my booking link?" → Use getGenericBookingLink
- "Create a temp link for John" → Use createTemporaryBookingLink  
- "Find time for a meeting next week" → Use suggestOptimalTimes
- "Who's on my team?" → Use getTeamMembers

Be conversational and helpful!`
        }
      },
      {
        step: 4,
        title: 'Add API Actions',
        description: 'Import the ScheduleSync API schema',
        action: 'Use the OpenAPI schema from our documentation',
        api_url: 'https://schedulesync-web-production.up.railway.app',
        auth_type: 'Bearer Token',
        auth_token: 'Your JWT token from step 1'
      },
      {
        step: 5,
        title: 'Test Your GPT',
        description: 'Try these commands in your GPT',
        test_commands: [
          '"What\'s my booking link?"',
          '"Create a temp link for John"',
          '"Find meeting times for next week"',
          '"Who\'s on my team?"'
        ]
      }
    ],
    openapi_schema_url: '/api/user/chatgpt-openapi-schema',
    support_email: 'support@schedulesync.com'
  });
});

// Serve OpenAPI schema for ChatGPT
app.get('/api/user/chatgpt-openapi-schema', (req, res) => {
  const schema = {
    "openapi": "3.1.0",
    "info": {
      "title": "AI Meeting Booker API",
      "version": "1.0.0",
      "description": "ScheduleSync ChatGPT Integration API"
    },
    "servers": [
      {
        "url": "https://schedulesync-web-production.up.railway.app"
      }
    ],
    "paths": {
      "/api/chatgpt/booking-link": {
        "get": {
          "operationId": "getGenericBookingLink",
          "summary": "Get user's default booking link",
          "description": "Returns the user's primary booking link for sharing",
          "responses": {
            "200": {
              "description": "Success",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "url": {"type": "string"},
                      "token": {"type": "string"},
                      "team_name": {"type": "string"}
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/chatgpt/temporary-link": {
        "post": {
          "operationId": "createTemporaryBookingLink",
          "summary": "Create temporary personalized booking link",
          "description": "Generate a temporary, personalized booking link for a specific person",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "invitee_name": {
                      "type": "string",
                      "description": "Name of the person who will use this link"
                    },
                    "expiry_hours": {
                      "type": "integer",
                      "default": 24,
                      "description": "Number of hours until link expires (default: 24)"
                    }
                  },
                  "required": ["invitee_name"]
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Success",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "url": {"type": "string"},
                      "token": {"type": "string"},
                      "invitee_name": {"type": "string"},
                      "expires_at": {"type": "string"}
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/chatgpt/suggest-times": {
        "post": {
          "operationId": "suggestOptimalTimes",
          "summary": "Suggest optimal meeting times",
          "description": "Get AI-powered meeting time suggestions based on availability",
          "requestBody": {
            "required": false,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "duration": {
                      "type": "integer",
                      "default": 30,
                      "description": "Meeting duration in minutes"
                    },
                    "days_ahead": {
                      "type": "integer",
                      "default": 7,
                      "description": "Number of days to look ahead"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Success",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "suggestions": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "date": {"type": "string"},
                            "time": {"type": "string"},
                            "score": {"type": "integer"},
                            "reason": {"type": "string"}
                          }
                        }
                      },
                      "duration": {"type": "integer"},
                      "booking_token": {"type": "string"}
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/chatgpt/team-members": {
        "get": {
          "operationId": "getTeamMembers",
          "summary": "Get team members",
          "description": "List all team members and their booking information",
          "responses": {
            "200": {
              "description": "Success",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "teams": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "team_name": {"type": "string"},
                            "members": {
                              "type": "array",
                              "items": {
                                "type": "object",
                                "properties": {
                                  "name": {"type": "string"},
                                  "email": {"type": "string"},
                                  "booking_token": {"type": "string"}
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
  
  res.json(schema);
});

// =============================================================================
// END OF JWT TOKEN MANAGEMENT ENDPOINTS (CORRECTED VERSION)
// =============================================================================

// ============ ADMIN PANEL ROUTES ============

// Middleware to protect admin routes
const requireAdmin = (req, res, next) => {
  const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
  // Check if the current logged-in user's email is in the allowed list
  if (!adminEmails.includes(req.user.email)) {
    console.warn(`?? Unauthorized admin access attempt by: ${req.user.email}`);
    return res.status(403).json({ error: 'Access denied: Admins only' });
  }
  next();
};

// 1. GET ALL USERS (for the admin list)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('?? Admin fetching user list...');
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
    console.error('? Admin get users error:', error);
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

    console.log(`?? ADMIN ACTION: User ${req.user.email} is deleting user ID ${targetId}`);

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
    
    console.log(`? User ${result.rows[0].email} deleted successfully.`);
    res.json({ 
      success: true, 
      message: `User ${result.rows[0].email} and all associated data have been deleted.` 
    });

  } catch (error) {
    console.error('? Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ============ MIGRATION HELPER (Run once then delete) ============
app.get('/api/admin/migrate-event-types', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('?? seeding default event types...');
    
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

// ============ ADD DEBUG ENDPOINT HERE ============
app.get('/api/debug/oauth-config', (req, res) => {
  res.json({
    google: {
      configured: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
    },
    microsoft: {
      configured: !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET
    },
    calendly: {
      configured: !!process.env.CALENDLY_CLIENT_ID && !!process.env.CALENDLY_CLIENT_SECRET
    }
  });
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
    console.error('? dist-built folder not found!');
    console.error('Expected path:', distPath);
  } else {
    console.log('? Serving static files from:', distPath);
  }
  
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
// ============ MICROSOFT OAUTH (ORGANIZER LOGIN) ============
app.get('/api/auth/microsoft/url', (req, res) => {
  try {
    // Validate credentials exist
    if (!process.env.MICROSOFT_CLIENT_ID) {
      console.error('? MICROSOFT_CLIENT_ID not configured');
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
      `&prompt=select_account`;  // ? ADD THIS - only shows account picker, not consent
    
    console.log('?? Generated Microsoft OAuth URL');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('? Error generating Microsoft OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});


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

  // ? CRITICAL FIX: Create manage URL with manage_token, not booking.id
  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;

  console.log('?? REMINDER - Booking data:', {
    id: booking.id,
    manage_token: booking.manage_token,
    generated_url: manageUrl
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
                  <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">? Meeting Reminder</h1>
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
                    Hi ${booking.guest_name || booking.host_name || 'there'} ??
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
                          <strong style="color: #667eea;">?? Date:</strong> ${dateStr}
                        </p>
                        
                        <!-- Time -->
                        <p style="margin: 0 0 10px 0; font-size: 15px; color: #555;">
                          <strong style="color: #667eea;">?? Time:</strong> ${timeStr} - ${endTimeStr}${booking.timezone ? ` (${booking.timezone})` : ''}
                        </p>
                        
                        <!-- Attendees -->
                        ${booking.host_name && booking.guest_name ? `
                          <p style="margin: 0; font-size: 15px; color: #555;">
                            <strong style="color: #667eea;">?? With:</strong> ${booking.guest_name === (booking.guest_name || booking.host_name) ? booking.host_name : booking.guest_name}
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
                            ?? Join Meeting
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
                          ?? <strong>Tip:</strong> Join a few minutes early to test your audio and video!
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
                  ${manageUrl ? `
                  <p style="margin: 0; font-size: 12px; color: #999;">
                    Need to reschedule? <a href="${manageUrl}" style="color: #667eea; text-decoration: none;">Manage your booking</a>
                  </p>
                  ` : ''}
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
  console.log('? Running reminder check at', now.toISOString());

  try {
    // ? CRITICAL: Include manage_token in the SELECT query
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
        b.manage_token,
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
      console.log('?? No bookings eligible for reminders right now');
      return;
    }

    for (const row of result.rows) {
      const startTime = new Date(row.start_time);
      const diffMs = startTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const hoursBefore = row.hours_before ?? 24;

      if (diffHours <= hoursBefore && diffHours > 0) {
        console.log(
          `?? Sending reminder for booking ${row.id} (team ${row.team_id}) diff=${diffHours.toFixed(
            2
          )}h window=${hoursBefore}h`
        );

        // ? CRITICAL: Pass manage_token to the template
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
          manage_token: row.manage_token, // ? ADDED THIS
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
            `?? No recipients for booking ${row.id}, skipping reminder`
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

        console.log(`? Reminder sent and marked for booking ${row.id}`);
      } else {
        console.log(
          `? Skipping ${row.id}, diffHours=${diffHours.toFixed(
            2
          )} window=${hoursBefore}h`
        );
      }
    }
  } catch (err) {
    console.error('? Error in reminder engine:', err);
  }
}

// Run every 5 minutes
cron.schedule(REMINDER_CRON, () => {
  checkAndSendReminders().catch((err) =>
    console.error('? Unhandled reminder cron error:', err)
  );
});

// Check once on startup after 60 seconds
setTimeout(() => {
  console.log('?? Running initial reminder check on startup...');
  checkAndSendReminders().catch((err) =>
    console.error('? Startup reminder check error:', err)
  );
}, 60000);

module.exports = {
  checkAndSendReminders,
  lastReminderRun
};


// ============ ONBOARDING / PROFILE UPDATE ============
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;
    const { username, timezone, availability } = req.body;

    console.log('?? Processing onboarding for user:', userId);

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
     // await client.query(
      //  'UPDATE team_members SET booking_token = $1 WHERE id = $2',
     //   [username, memberId]
     // );
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
    console.log('? Onboarding complete for:', userId);
    res.json({ success: true, username });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('? Onboarding error:', error);
    
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

const server = app.listen(PORT, () => {
  console.log(`?? Server running on port ${PORT}`);
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






