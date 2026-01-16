-- Migration: Add Email Reminders System
-- Adds reminder settings and tracking for automated booking reminders

-- User reminder preferences
CREATE TABLE IF NOT EXISTS reminder_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  send_to_host BOOLEAN DEFAULT true,
  send_to_guest BOOLEAN DEFAULT true,
  hours_before INTEGER DEFAULT 24, -- Default: 24 hours before
  custom_hours INTEGER[], -- Array of additional reminder times (e.g., [24, 1] for 24h and 1h before)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Track sent reminders to avoid duplicates
CREATE TABLE IF NOT EXISTS sent_reminders (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('host', 'guest')),
  hours_before INTEGER NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  email_status TEXT DEFAULT 'sent' CHECK (email_status IN ('sent', 'failed', 'bounced')),
  UNIQUE(booking_id, recipient_email, hours_before)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reminder_settings_user ON reminder_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_sent_reminders_booking ON sent_reminders(booking_id);
CREATE INDEX IF NOT EXISTS idx_sent_reminders_sent_at ON sent_reminders(sent_at);

-- Insert default reminder settings for existing users
INSERT INTO reminder_settings (user_id, enabled, send_to_host, send_to_guest, hours_before, custom_hours)
SELECT id, true, true, true, 24, ARRAY[24, 1]
FROM users
ON CONFLICT (user_id) DO NOTHING;
