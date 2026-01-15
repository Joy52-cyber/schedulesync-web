-- Email Bot Tables for In-Email Scheduling
-- Migration: add_email_bot.sql

-- Store email bot settings per user
CREATE TABLE IF NOT EXISTS email_bot_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  bot_email_prefix VARCHAR(100), -- custom prefix like "schedule-john" for schedule-john@trucal.xyz
  default_duration INTEGER DEFAULT 30,
  default_event_type_id INTEGER REFERENCES event_types(id),
  intro_message TEXT DEFAULT 'I''m helping {{hostName}} find a time for your meeting.',
  signature TEXT DEFAULT 'Powered by TruCal',
  max_slots_to_show INTEGER DEFAULT 5,
  prefer_time_of_day VARCHAR(20), -- 'morning', 'afternoon', 'evening', null for any
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Store email threads we're participating in
CREATE TABLE IF NOT EXISTS email_bot_threads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  thread_id VARCHAR(255) NOT NULL, -- Message-ID or thread reference
  subject TEXT,
  participants JSONB, -- [{email, name}]
  status VARCHAR(20) DEFAULT 'active', -- active, booked, expired, cancelled
  booking_id INTEGER REFERENCES bookings(id),
  proposed_slots JSONB, -- slots we offered
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);

-- Store individual messages in threads
CREATE TABLE IF NOT EXISTS email_bot_messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES email_bot_threads(id) ON DELETE CASCADE,
  message_id VARCHAR(255), -- Email Message-ID header
  direction VARCHAR(10), -- 'inbound' or 'outbound'
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  to_emails JSONB,
  cc_emails JSONB,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  parsed_intent JSONB, -- {action: 'schedule', duration: 30, preferences: [...]}
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_bot_threads_user ON email_bot_threads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_email_bot_threads_thread ON email_bot_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_bot_messages_thread ON email_bot_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_bot_settings_user ON email_bot_settings(user_id);
