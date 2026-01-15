-- Migration: Add Email Integration Tables
-- Run this migration to enable Gmail/Outlook inbox monitoring

-- Email connections table (separate from calendar connections)
CREATE TABLE IF NOT EXISTS email_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL, -- 'gmail' or 'outlook'
  email_address VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  monitoring_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  sync_from_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Detected scheduling emails table
CREATE TABLE IF NOT EXISTS detected_emails (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email_connection_id INTEGER REFERENCES email_connections(id) ON DELETE CASCADE,
  provider_email_id VARCHAR(255) NOT NULL, -- Gmail/Outlook message ID
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  subject TEXT,
  body_snippet TEXT,
  body_full TEXT,
  received_at TIMESTAMP,
  scheduling_intent JSONB, -- { detected: true, confidence: 0.95, type: 'meeting_request', suggested_duration: 30 }
  suggested_reply TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, replied, dismissed, booked
  replied_at TIMESTAMP,
  booking_id INTEGER REFERENCES bookings(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider_email_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_connections_user ON email_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_active ON email_connections(is_active, monitoring_enabled);
CREATE INDEX IF NOT EXISTS idx_detected_emails_user_status ON detected_emails(user_id, status);
CREATE INDEX IF NOT EXISTS idx_detected_emails_received ON detected_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_detected_emails_connection ON detected_emails(email_connection_id);
