

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
console.log('✅ AXIOS LOADED:', !!axios, 'Version:', axios.VERSION); // ADD THIS

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
    console.error('❌ Microsoft token refresh error:', error);
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
      console.log('🔄 Refreshing Microsoft token...');
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
    console.error('❌ Microsoft calendar fetch error:', error);
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
      console.log('🔄 Refreshing Microsoft token...');
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
    console.error('❌ Microsoft event creation error:', error);
    throw error;
  }
}

// ============ MIDDLEWARE ============

app.use(cors());
app.use(express.json());

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

// ✅ ADD THIS
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

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Add this right after initDB() function
async function migrateDatabase() {
  try {
    console.log('🔄 Running database migrations...');
    
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
    name VARCHAR(100),  -- ← ADD THIS LINE
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

// Call it after initDB()
initDB().then(() => migrateDatabase());

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
 console.log(`✅ Notification: ${title}`);  // ✅ CORRECT - parenthesis before backtick
    return result.rows[0];
  } catch (error) {
    console.error('❌ Notification error:', error);
    return null;
  }
}

async function notifyBookingCreated(booking, organizerId) {
  return createNotification({
    userId: organizerId,
    type: 'booking_created',
    title: '📅 New Booking Received',
    message: `${booking.attendee_name} scheduled a meeting for ${new Date(booking.start_time).toLocaleDateString()}`,
    link: `/bookings/${booking.id}`,
    bookingId: booking.id,
  });
}

async function notifyBookingCancelled(booking, userId) {
  return createNotification({
    userId: userId,
    type: 'booking_cancelled',
    title: '❌ Booking Cancelled',
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
    title: '🔄 Booking Rescheduled',
    message: `Meeting rescheduled to ${newTime.toLocaleDateString()}`,
    link: `/bookings/${booking.id}`,
    bookingId: booking.id,
  });
}

async function notifyPaymentReceived(booking, userId, amount, currency) {
  return createNotification({
    userId: userId,
    type: 'payment_received',
    title: '💰 Payment Received',
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
// Add this to server.js BEFORE authentication middleware
// Place it around line 500-600 with other PUBLIC routes
// ============================================

app.get('/api/public/booking/:username/:eventSlug', async (req, res) => {
  try {
    const { username, eventSlug } = req.params;
    console.log(`📅 Public Event Type request: ${username}/${eventSlug}`);

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
      console.log(`❌ User not found: ${username}`);
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
      console.log(`❌ Event type not found or inactive: ${eventSlug}`);
      return res.status(404).json({ error: 'Event type not found or inactive' });
    }

    const eventType = eventResult.rows[0];

    console.log(`✅ Event Type found: ${eventType.title} (${eventType.duration}min)`);

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
    console.error('❌ Error fetching Event Type booking info:', error);
    res.status(500).json({ error: 'Failed to load event information' });
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

     console.log('🔍 REQUEST BODY DEBUG:', {
      attendee_name,
      attendee_email,
      additional_attendees,
      additional_attendees_type: typeof additional_attendees,
      additional_attendees_length: additional_attendees?.length,
      additional_attendees_isArray: Array.isArray(additional_attendees)
    });

    console.log('📝 Creating booking:', { 
      token: token?.substring(0, 10) + '...', 
      attendee_name, 
      attendee_email,
      hasSlot: !!slot,
      slotData: slot 
    });

    // ✅ STEP 1: VALIDATION
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

    // ✅ STEP 2: Look up token (check single-use vs regular)
    let memberResult;
    
    if (token.length === 64) {
      console.log('🔑 Looking up single-use link...');
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
      console.log('🔑 Looking up regular token...');
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

    // ✅ STEP 3: Determine assigned members based on booking mode
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

    // ✅ STEP 4: Create booking(s)
    const createdBookings = [];

    for (const assignedMember of assignedMembers) {
      const manageToken = crypto.randomBytes(16).toString('hex');
      
      console.log(`💾 Creating booking for member ${assignedMember.id}...`);
      
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

    // ✅ Mark single-use link as used
    if (token.length === 64) {
      await pool.query('UPDATE single_use_links SET used = true WHERE token = $1', [token]);
      console.log('✅ Single-use link marked as used');
    }

    // ✅ Notify organizer
    if (member.user_id) {
      await notifyBookingCreated(createdBookings[0], member.user_id);
    }

    // ✅ STEP 5: RESPOND IMMEDIATELY
    console.log('📤 Sending success response');
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

    // ✅ STEP 6: Background processing (calendar event + emails)
    (async () => {
      try {
        let meetLink = null;
        let calendarEventId = null;

        // Create calendar event with meeting link
        if (member.provider === 'google' && member.google_access_token && member.google_refresh_token) {
          try {
            console.log('📅 Creating Google Calendar event...');
            
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

            console.log('✅ Google Calendar event created:', meetLink);
          } catch (calendarError) {
            console.error('⚠️ Calendar creation failed:', calendarError.message);
          }
        } else if (member.provider === 'microsoft' && member.microsoft_access_token && member.microsoft_refresh_token) {
          try {
            console.log('📅 Creating Microsoft Calendar event...');

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

            console.log('✅ Microsoft Calendar event created:', meetLink);
          } catch (calendarError) {
            console.error('⚠️ Microsoft calendar creation failed:', calendarError.message);
          }
        }
        // ========== SEND CONFIRMATION EMAILS ==========
try {
  console.log('📧 Preparing to send emails...');
  
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
  from: 'ScheduleSync <bookings@trucal.xyz>',  // ← Change this
  to: attendee_email,
    subject: `Booking Confirmed with ${assignedMember.organizer_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your booking is confirmed!</h2>
        <p>Hi ${attendee_name},</p>
        <p>Your meeting with <strong>${assignedMember.organizer_name}</strong> has been scheduled.</p>
        <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>📅 When:</strong> ${new Date(slot.start).toLocaleString()}</p>
          <p style="margin: 5px 0;"><strong>⏰ Duration:</strong> ${duration} minutes</p>
          ${notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${notes}</p>` : ''}
          ${additional_attendees?.length > 0 ? `<p style="margin: 5px 0;"><strong>👥 Others:</strong> ${additional_attendees.join(', ')}</p>` : ''}
          ${meetLink ? `<p style="margin: 5px 0;"><strong>🔗 Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ''}
        </div>
        <div style="margin: 30px 0;">
          <a href="${manageUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Manage Booking</a>
        </div>
      </div>
    `,
    attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }],
  });
  console.log('✅ Email sent to primary attendee:', attendee_email);

  // 2. Additional attendees
  if (additional_attendees && Array.isArray(additional_attendees) && additional_attendees.length > 0) {
    console.log(`📤 Sending to ${additional_attendees.length} additional attendees...`);
    for (const email of additional_attendees) {
      await resend.emails.send({
  from: 'ScheduleSync <bookings@trucal.xyz>',  // ← Change this
  to: email,
        subject: `Meeting Invitation with ${assignedMember.organizer_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">You're invited!</h2>
            <p><strong>${attendee_name}</strong> has invited you to a meeting with <strong>${assignedMember.organizer_name}</strong>.</p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>📅 When:</strong> ${new Date(slot.start).toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>⏰ Duration:</strong> ${duration} minutes</p>
              ${notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${notes}</p>` : ''}
              <p style="margin: 5px 0;"><strong>👤 Invited by:</strong> ${attendee_name} (${attendee_email})</p>
              ${meetLink ? `<p style="margin: 5px 0;"><strong>🔗 Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ''}
            </div>
          </div>
        `,
        attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }],
      });
      console.log(`✅ Email sent to: ${email}`);
    }
  }

  // 3. Organizer email
  await resend.emails.send({
  from: 'ScheduleSync <bookings@trucal.xyz>',  // ← Change this
  to: assignedMember.email,
    subject: `New Booking: ${attendee_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New booking received!</h2>
        <p>Hi ${assignedMember.organizer_name},</p>
        <p>New booking from <strong>${attendee_name}</strong>.</p>
        <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>👤 Primary:</strong> ${attendee_name} (${attendee_email})</p>
          ${additional_attendees?.length > 0 ? `<p style="margin: 5px 0;"><strong>👥 Others:</strong> ${additional_attendees.join(', ')}</p>` : ''}
          <p style="margin: 5px 0;"><strong>📅 When:</strong> ${new Date(slot.start).toLocaleString()}</p>
          <p style="margin: 5px 0;"><strong>⏰ Duration:</strong> ${duration} minutes</p>
          ${notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${notes}</p>` : ''}
          ${meetLink ? `<p style="margin: 5px 0;"><strong>🔗 Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ''}
        </div>
      </div>
    `,
    attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }],
  });
  console.log('✅ Email sent to organizer:', assignedMember.email);
  console.log('✅ All confirmation emails sent');

} catch (error) {
  console.error('❌ Email send failed:', error);
}

      } catch (error) {  // ← ADD THIS - Background processing error
        console.error('❌ Background processing error:', error);
      }
    })();  // ← ADD THIS - Close async IIFE

  } catch (error) {  // ← ADD THIS - Main endpoint error handler
    console.error('❌ Create booking error:', error);
    console.error('Stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to create booking',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
      });
    }
  }
});  // ← ADD THIS - Close /api/bookings POST endpoint

       
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

    res.status(500).json({ error: 'Authentication failed' });
  } // Close catch
});

// ============ MICROSOFT OAUTH (ORGANIZER LOGIN) ============

app.get('/api/auth/microsoft/url', (req, res) => {
  try {
    // Validate credentials exist
    if (!process.env.MICROSOFT_CLIENT_ID) {
      console.error('❌ MICROSOFT_CLIENT_ID not configured');
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
    console.log('🔗 Generated Microsoft OAuth URL');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('❌ Error generating Microsoft OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// ============ MICROSOFT OAUTH CALLBACK ============
app.post('/api/auth/microsoft/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('🔵 Microsoft OAuth callback received');
    
    if (!code) {
      console.error('❌ No authorization code provided');
      return res.status(400).json({ error: 'Authorization code required' });
    }

    console.log('🔵 Code received:', code.substring(0, 20) + '...');

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

    // Define redirectUri
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 
      `${process.env.FRONTEND_URL}/oauth/callback/microsoft`;
    
    console.log('🔵 Redirect URI:', redirectUri);
    console.log('🔵 Client ID:', process.env.MICROSOFT_CLIENT_ID);
    
    // Exchange code for tokens
    console.log('📡 Exchanging code for tokens...');
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

    console.log('✅ Tokens received');
    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    console.log('📡 Getting Microsoft user info...');
    const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const microsoftUser = userResponse.data;
    const email = microsoftUser.mail || microsoftUser.userPrincipalName;
    const microsoftId = microsoftUser.id;

    console.log('✅ User info retrieved:', email);

    // Check if user exists
    let user = await pool.query(
      'SELECT * FROM users WHERE microsoft_id = $1 OR email = $2',
      [microsoftId, email]
    );

    if (user.rows.length === 0) {
      // NEW USER - First login
      console.log('➕ Creating new Microsoft user');
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
          false,  // ✅ false = needs onboarding
          true    // Microsoft users get calendar sync enabled
        ]
      );
      console.log('✅ New user created:', user.rows[0].id);
    } else {
      // EXISTING USER - Second+ login
      console.log('🔄 Updating existing Microsoft user');
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
      console.log('✅ User updated:', user.rows[0].id);
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

    console.log('✅ Microsoft OAuth successful for:', email);

    // ✅ RETURN onboarding_completed
    res.json({
      success: true,
      user: {
        id: finalUser.id,
        email: finalUser.email,
        name: finalUser.name,
        calendar_sync_enabled: finalUser.calendar_sync_enabled,
        onboarding_completed: finalUser.onboarding_completed || false  // ✅ KEY FIELD
      },
      token: jwtToken,
    });

  } catch (error) {
    console.error('❌ Microsoft OAuth error:', error.message);
    console.error('❌ Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    // Remove code from processed map on error so user can retry
    if (req.body.code) {
      processedOAuthCodes.delete(req.body.code);
      console.log('🔓 Code unlocked for retry');
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

    console.log('✅ Guest Google OAuth successful:', { email: userInfo.email, hasCalendarAccess });

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
    console.error('❌ Guest Google OAuth error:', error);
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

    const memberCheck = await pool.query(
      'SELECT id FROM team_members WHERE booking_token = $1',
      [bookingToken]
    );

    if (memberCheck.rows.length === 0) {
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
      state: bookingToken,
    });

    console.log('🔗 Generated Google guest OAuth URL');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('❌ Error generating Google guest OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// Microsoft URL Generator ← ADD THIS!
app.get('/api/book/auth/microsoft/url', async (req, res) => {
  try {
    const { bookingToken } = req.query;
    
    console.log('🔗 Microsoft guest OAuth URL request:', bookingToken);
    
    if (!bookingToken) {
      return res.status(400).json({ error: 'Booking token required' });
    }

    const memberCheck = await pool.query(
      'SELECT id FROM team_members WHERE booking_token = $1',
      [bookingToken]
    );

    if (memberCheck.rows.length === 0) {
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
      `&state=${bookingToken}` +
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
    
    console.log('🔵 Guest Microsoft OAuth request received');
    
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
    
    console.log('📡 Exchanging Microsoft code for guest tokens...');
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

    console.log('✅ Guest Microsoft OAuth successful:', { email, hasCalendarAccess });

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
    console.error('❌ Guest Microsoft OAuth error:', error.message);
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

    console.log('🔄 Starting Calendly import for user:', userId);

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
      console.log('✅ Calendly user fetched:', calendlyUser.email);
    } catch (error) {
      console.error('❌ Failed to fetch Calendly user:', error.response?.data || error.message);
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
        console.log(`📅 Found ${eventTypes.length} event types`);

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

        console.log(`✅ Imported ${results.event_types} event types`);
      } catch (error) {
        console.error('❌ Event types import error:', error.response?.data || error.message);
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
          console.log(`⏰ Found ${scheduleRules.length} availability rules`);

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
          console.log(`✅ Imported availability rules`);
        }
      } catch (error) {
        console.error('❌ Availability import error:', error.response?.data || error.message);
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
        console.log(`📊 Found ${bookings.length} past bookings`);

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

        console.log(`✅ Imported ${results.bookings} past bookings`);
      } catch (error) {
        console.error('❌ Bookings import error:', error.response?.data || error.message);
        results.warnings.push('Failed to import some past bookings');
      }
    }

    // ====================================
    // RESPONSE
    // ====================================
    console.log('✅ Calendly import complete:', results);

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('❌ Calendly import error:', error);
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
    
    console.log('📋 Teams loaded:', result.rows.map(t => ({ 
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

    console.log(`✅ Member ${memberId} status updated to ${is_active ? 'active' : 'inactive'}`);
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

    console.log('⚙️ Updating member settings:', { memberId, teamId });

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

    console.log('✅ Member settings updated:', memberId);
    res.json({ member: result.rows[0] });

  } catch (error) {
    console.error('❌ Update member settings error:', error);
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

    // ✅ VALIDATE AND FIX working_hours structure
    const validatedWorkingHours = {};
    for (const [day, settings] of Object.entries(working_hours)) {
      if (settings.slots) {
        // Frontend sent wrong format with 'slots' array, fix it
        console.log(`⚠️ Fixing invalid working_hours for ${day}`);
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

    console.log('📅 Generating slots for token:', token?.substring(0, 10) + '...', 'Duration:', duration, 'TZ:', timezone);

    // ========== 1. GET MEMBER & SETTINGS ==========
    let memberResult;
    
    if (token.length === 64) {
      console.log('🔑 Looking up single-use link...');
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
      console.log('🔑 Looking up regular token...');
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

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    
    // ✅ CRITICAL: Validate and sanitize working_hours
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
          console.warn('⚠️ Detected invalid working_hours format (has slots property)');
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
              console.warn(`⚠️ Invalid ${day} settings:`, daySettings);
              isValid = false;
              break;
            }

            // Validate time format (HH:MM)
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(daySettings.start) || !timeRegex.test(daySettings.end)) {
              console.warn(`⚠️ Invalid time format for ${day}:`, { start: daySettings.start, end: daySettings.end });
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
      console.error('❌ Failed to parse working_hours:', parseError.message);
      workingHours = null;
    }

    // Use defaults if working_hours is invalid
    if (!workingHours) {
      console.log('⚙️ Using default working hours (9 AM - 5 PM, Mon-Fri)');
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

    console.log('⚙️ Settings loaded:', {
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
        console.log('✅ Google calendar loaded:', organizerBusy.length, 'busy blocks');
      } catch (error) {
        console.error('⚠️ Failed to fetch Google calendar:', error.message);
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
        
        console.log('✅ Microsoft calendar loaded:', organizerBusy.length, 'busy blocks');
      } catch (error) {
        console.error('⚠️ Failed to fetch Microsoft calendar:', error.message);
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
          console.warn(`⚠️ Invalid time format for ${dayName}`);
          return false;
        }

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        return slotTime >= startTime && slotTime < endTime;
      } catch (error) {
        console.error('❌ Error in isWithinWorkingHours:', error);
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

    console.log('⏰ Time window:', {
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
        console.warn(`⚠️ Skipping ${dayName} - invalid time format`);
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
    console.error('❌ Slots generation error:', error);
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
    const { name } = req.body;  // ✅ EXTRACT NAME FROM REQUEST

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

    // ✅ INSERT WITH NAME COLUMN
    await pool.query(
      `INSERT INTO single_use_links (token, member_id, name, expires_at) 
       VALUES ($1, $2, $3, $4)`,
      [token, memberId, name || null, expiresAt]
    );

    console.log('✅ Single-use link created:', { token, name, expires_at: expiresAt });
    
    res.json({ 
      success: true, 
      token,
      name: name || null,
      expires_at: expiresAt 
    });
  } catch (error) {
    console.error('❌ Generate single-use link error:', error);
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

    // ✅ SELECT NAME COLUMN
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
    console.error('❌ Get recent single-use links error:', error);
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

// Get booking by token (Public Booking Page)
app.get('/api/book/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔍 Looking up token:', token);
    
    // 1. Check single-use links (64 chars)
    if (token.length === 64) {
      const singleUseCheck = await pool.query(
        `SELECT sul.token, sul.name as link_name, sul.team_id,
                t.name as team_name, t.description, t.booking_mode
         FROM single_use_links sul
         JOIN teams t ON sul.team_id = t.id
         WHERE sul.token = $1 AND sul.used = false AND sul.expires_at > NOW()`,
        [token]
      );
      
      if (singleUseCheck.rows.length > 0) {
        const link = singleUseCheck.rows[0];
        const membersResult = await pool.query(
          `SELECT tm.*, u.name as user_name, u.email as user_email, u.id as user_id
           FROM team_members tm
           JOIN users u ON tm.user_id = u.id
           WHERE tm.team_id = $1 AND tm.is_active = true
           ORDER BY tm.id ASC`,
          [link.team_id]
        );
        
        return res.json({
          data: {
            type: 'single_use',
            team: { id: link.team_id, name: link.team_name, description: link.description, booking_mode: link.booking_mode },
            members: membersResult.rows,
            linkName: link.link_name,
            isSingleUse: true,
            singleUseToken: link.token
          }
        });
      }
    }
    
    // 2. Check TEAM tokens
    console.log('🔑 Checking teams table...');
    const teamCheck = await pool.query(
      `SELECT id, name, description, booking_mode 
       FROM teams 
       WHERE team_booking_token = $1`,
      [token]
    );
    
    if (teamCheck.rows.length > 0) {
      console.log('✅ Team found:', teamCheck.rows[0].name);
      const team = teamCheck.rows[0];
      
      const membersResult = await pool.query(
        `SELECT tm.*, u.name as user_name, u.email as user_email, u.id as user_id
         FROM team_members tm
         JOIN users u ON tm.user_id = u.id
         WHERE tm.team_id = $1 AND tm.is_active = true
         ORDER BY tm.id ASC`,
        [team.id]
      );
      
      console.log('   Found members:', membersResult.rows.length);
      
      const memberIds = membersResult.rows.map(m => m.user_id).filter(Boolean);
      let eventTypes = [];
      if (memberIds.length > 0) {
        const eventsRes = await pool.query(
          `SELECT DISTINCT et.* FROM event_types et
           WHERE et.user_id = ANY($1) AND et.is_active = true 
           ORDER BY et.duration ASC`,
          [memberIds]
        );
        eventTypes = eventsRes.rows;
      }
      
      console.log('   Found event types:', eventTypes.length);
      
      return res.json({
        data: {
          type: 'team',
          team: { 
            id: team.id, 
            name: team.name, 
            description: team.description, 
            booking_mode: team.booking_mode 
          },
          members: membersResult.rows,
          eventTypes: eventTypes
        }
      });
    }
    
    // 3. Check MEMBER tokens
    console.log('🔑 Checking team_members table...');
    const memberCheck = await pool.query(
      `SELECT tm.*, t.name as team_name, t.description as team_description, 
       u.name as member_name, u.email as member_email, u.id as user_id
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );
    
    if (memberCheck.rows.length > 0) {
      console.log('✅ Member found');
      const member = memberCheck.rows[0];
      
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
          type: 'member',
          team: { id: member.team_id, name: member.team_name, description: member.team_description },
          member: { 
            id: member.id, 
            name: member.name || member.member_name || member.email, 
            email: member.email || member.member_email, 
            user_id: member.user_id 
          },
          eventTypes: eventTypes
        }
      });
    }
    
    console.log('❌ Token not found');
    return res.status(404).json({ error: 'Booking link not found' });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});
// ============ FIX WORKING HOURS DATA (ONE-TIME ADMIN ENDPOINT) ============
app.get('/api/admin/fix-working-hours-data', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Starting working_hours data migration...');
    
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
            console.log(`⚠️ Fixing member ${member.id} - Found 'slots' property`);
            
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
          console.log(`➕ Setting defaults for member ${member.id}`);
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
        console.error(`❌ Error processing member ${member.id}:`, memberError);
        errors++;
      }
    }

    console.log('✅ Data migration complete');
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
    console.error('❌ Data migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEAM BOOKING PAGE (separate from member links)
// ============================================
app.get('/api/book/team/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('🔍 Looking up team by team_booking_token:', token);
    
    // Find team by team_booking_token
    const teamResult = await pool.query(
      `SELECT t.*, 
              u.name as owner_name,
              u.email as owner_email
       FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.team_booking_token = $1`,
      [token]
    );

    if (teamResult.rows.length === 0) {
      console.log('❌ Team not found for token:', token);
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];
    console.log('✅ Found team:', team.name, 'ID:', team.id);

    // Get all ACTIVE members (exclude those with external booking links for team scheduling)
    const membersResult = await pool.query(
      `SELECT 
        tm.id, 
        tm.name, 
        tm.email, 
        tm.booking_token, 
        tm.user_id,
        tm.is_active,
        u.name as user_name
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1 
         AND (tm.is_active = true OR tm.is_active IS NULL)
         AND (tm.external_booking_link IS NULL OR tm.external_booking_link = '')
       ORDER BY tm.created_at ASC`,
      [team.id]
    );

    console.log('👥 Available members for booking:', membersResult.rows.length);

    if (membersResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No team members available for booking',
        message: 'All team members are either inactive or use external schedulers'
      });
    }

    // Get event types from team owner
    const eventTypesResult = await pool.query(
      `SELECT id, title, name, duration, description, is_active, color
       FROM event_types 
       WHERE user_id = $1 AND is_active = true 
       ORDER BY duration ASC`,
      [team.owner_id]
    );

    console.log('📅 Event types found:', eventTypesResult.rows.length);

    res.json({
      data: {
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          booking_mode: team.booking_mode || 'round_robin',
          owner_name: team.owner_name,
        },
        members: membersResult.rows.map(m => ({
          id: m.id,
          name: m.name || m.user_name || 'Team Member',
          email: m.email,
          booking_token: m.booking_token,
          user_id: m.user_id,
        })),
        eventTypes: eventTypesResult.rows.map(et => ({
          id: et.id,
          title: et.title || et.name,
          name: et.name || et.title,
          duration: et.duration,
          description: et.description,
          color: et.color,
        })),
        isTeamBooking: true,
      }
    });

  } catch (error) {
    console.error('❌ Get team booking page error:', error);
    res.status(500).json({ error: 'Failed to load team booking page' });
  }
});


// Create booking
app.post('/api/bookings', async (req, res) => {
  try {
    const { token, slot, attendee_name, attendee_email, notes } = req.body;

    console.log('📝 Creating booking:', { token, attendee_name, attendee_email });

    if (!token || !slot || !attendee_name || !attendee_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ========== SUPPORT SINGLE-USE LINKS ==========
    let memberResult;
    
    if (token.length === 64) {
      console.log('🔑 Looking up single-use link for booking...');
      memberResult = await pool.query(
        `SELECT tm.*, t.name as team_name, t.booking_mode, t.owner_id, 
                u.google_access_token, u.google_refresh_token, 
                u.email as member_email, u.name as member_name
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
      console.log('🔑 Looking up regular token for booking...');
      memberResult = await pool.query(
        `SELECT tm.*, t.name as team_name, t.booking_mode, t.owner_id, 
                u.google_access_token, u.google_refresh_token, 
                u.email as member_email, u.name as member_name
         FROM team_members tm 
         JOIN teams t ON tm.team_id = t.id 
         LEFT JOIN users u ON tm.user_id = u.id 
         WHERE tm.booking_token = $1`,
        [token]
      );
    }

    if (memberResult.rows.length === 0) {
      console.log('❌ Invalid or expired booking token');
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];
    const bookingMode = member.booking_mode || 'individual';

    console.log('🎯 Booking mode:', bookingMode);
    console.log('👤 Member:', member.member_name);

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
  // Generate unique manage token for this booking
  const manageToken = crypto.randomBytes(16).toString('hex');
  
 // Add timeout wrapper
const bookingResult = await Promise.race([
  pool.query(
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
  ),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('⏱️ Database INSERT timeout after 10 seconds')), 10000)
  )
]).catch(error => {
  console.error('❌ Database INSERT failed:', error.message);
  console.error('📊 Parameters:', {
    team_id: member.team_id,
    member_id: assignedMember.id,
    user_id: assignedMember.user_id,
    attendee_name,
    attendee_email,
    start_time: slot.start,
    end_time: slot.end
  });
  throw error;
});
  createdBookings.push(bookingResult.rows[0]);
  console.log(`✅ Booking created for ${assignedMember.name}:`, bookingResult.rows[0].id);
}

console.log(`✅ Created ${createdBookings.length} booking(s)`);
     
// Notify organizer
if (member.user_id) {
  await notifyBookingCreated(createdBookings[0], member.user_id);
}

// Mark single-use link as used
if (token.length === 64) {
  await pool.query(
    'UPDATE single_use_links SET used = true WHERE token = $1',
    [token]
  );
  console.log('✅ Single-use link marked as used');
}

    // ========== RESPOND IMMEDIATELY ==========
    res.json({ 
      success: true,
      booking: createdBookings[0],
      bookings: createdBookings,
      mode: bookingMode,
      meet_link: null,
      message: bookingMode === 'collective' 
        ? `Booking confirmed with all ${createdBookings.length} team members!`
        : 'Booking confirmed! Calendar invite with Google Meet link will arrive shortly.'
    });

    // ========== ASYNC: CREATE CALENDAR EVENT & SEND EMAILS ==========
   // ========== ASYNC: CREATE CALENDAR EVENT & SEND EMAILS ==========
(async () => {
  try {
    let meetLink = null;
    let calendarEventId = null;

    // Create calendar event with meeting link
    if (member.provider === 'google' && member.google_access_token && member.google_refresh_token) {
      try {
        console.log('📅 Creating Google Calendar event with Meet link (async)...');
        
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

        console.log('✅ Google Calendar event created with Meet link:', meetLink);
      } catch (calendarError) {
        console.error('⚠️ Google Calendar event creation failed:', calendarError.message);
      }
    } else if (member.provider === 'microsoft' && member.microsoft_access_token && member.microsoft_refresh_token) {
      try {
        console.log('📅 Creating Microsoft Calendar event with Teams link (async)...');

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

        console.log('✅ Microsoft Calendar event created with Teams link:', meetLink);
      } catch (calendarError) {
        console.error('⚠️ Microsoft Calendar event creation failed:', calendarError.message);
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
} catch (error) {  // This properly closes the main try block
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
       WHERE b.manage_token = $1`,   // ✅ CORRECT - uses booking-specific token
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
      `SELECT b.*, b.meet_link, b.calendar_event_id, t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name
        FROM bookings b
        JOIN teams t ON b.team_id = t.id
        LEFT JOIN team_members tm ON b.member_id = tm.id
        WHERE b.manage_token = $1 AND b.status = 'confirmed'`, // ✅ FIXED: Added backtick here
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
       WHERE manage_token = $2`, // ✅ FIXED: Added backtick and changed $3 to $2
      [reason, token]
    );

    console.log('✅ Booking cancelled successfully');

    // Notify organizer
    if (booking.member_user_id) {
      await notifyBookingCancelled(booking, booking.member_user_id);
    }

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
const manageToken = crypto.randomBytes(16).toString('hex');

const bookingResult = await pool.query(
  `INSERT INTO bookings (
    team_id, member_id, user_id, 
    attendee_name, attendee_email, 
    start_time, end_time, 
    title,
    notes, 
    booking_token, status,
    manage_token
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
  RETURNING *`,
  [
    member.team_id,          // ✅
    member.id,               // ✅ FIXED (was assignedMember.id)
    member.user_id,          // ✅ FIXED (was assignedMember.user_id)
    attendeeName,            // ✅ FIXED (was attendee_name)
    email,                   // ✅ (already defined earlier)
    startTime.toISOString(), // ✅ FIXED (was slot.start)
    endTime.toISOString(),   // ✅ FIXED (was slot.end)
    bookingData.title || `Meeting with ${attendeeName}`, // ✅ FIXED
    bookingData.notes || '', // ✅ FIXED (was notes)
    member.booking_token,    // ✅ FIXED (was token)
    'confirmed',             // ✅
    manageToken              // ✅
  ]
);

const booking = bookingResult.rows[0];
console.log('✅ AI booking created:', booking.id);

// ========== RESPOND IMMEDIATELY ==========
res.json({
  type: 'success',
  message: `✅ **Meeting confirmed!**\n\n"${bookingData.title || 'Meeting'}" scheduled for **${startTime.toLocaleDateString()}** at **${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}**\n\n📧 Confirmation emails sent to:\n• **${email}** (attendee)\n• **${userEmail}** (you)\n\n📅 Calendar invite with Google Meet link will arrive shortly.`,
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
// ============ MICROSOFT OAUTH (ORGANIZER LOGIN) ============
app.get('/api/auth/microsoft/url', (req, res) => {
  try {
    // Validate credentials exist
    if (!process.env.MICROSOFT_CLIENT_ID) {
      console.error('❌ MICROSOFT_CLIENT_ID not configured');
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
      `&prompt=select_account`;  // ✅ ADD THIS - only shows account picker, not consent
    
    console.log('🔗 Generated Microsoft OAuth URL');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('❌ Error generating Microsoft OAuth URL:', error);
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

  // ✅ CRITICAL FIX: Create manage URL with manage_token, not booking.id
  const manageUrl = booking.manage_token 
    ? `${process.env.FRONTEND_URL}/manage/${booking.manage_token}`
    : null;

  console.log('📧 REMINDER - Booking data:', {
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
  console.log('⏰ Running reminder check at', now.toISOString());

  try {
    // ✅ CRITICAL: Include manage_token in the SELECT query
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

        // ✅ CRITICAL: Pass manage_token to the template
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
          manage_token: row.manage_token, // ✅ ADDED THIS
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

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
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
