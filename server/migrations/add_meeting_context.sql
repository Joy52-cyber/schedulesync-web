-- Meeting Context and Attendee Profiles Migration
-- Adds tables to track meeting context and attendee relationship history

-- Create meeting_context table to store contextual data for each booking
CREATE TABLE IF NOT EXISTS meeting_context (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  email_thread_id INTEGER REFERENCES email_bot_threads(id) ON DELETE SET NULL,
  generated_agenda TEXT,
  context_summary TEXT,
  attendee_notes TEXT, -- Host's private notes about the attendee
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create attendee_profiles table to track relationship history
CREATE TABLE IF NOT EXISTS attendee_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  company VARCHAR(255),
  title VARCHAR(255),
  timezone TEXT,
  meeting_count INTEGER DEFAULT 0,
  last_meeting_date TIMESTAMP,
  total_meeting_minutes INTEGER DEFAULT 0,
  notes TEXT, -- Host's notes about this attendee
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_meeting_context_booking
ON meeting_context(booking_id);

CREATE INDEX IF NOT EXISTS idx_meeting_context_thread
ON meeting_context(email_thread_id)
WHERE email_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendee_profiles_lookup
ON attendee_profiles(user_id, email);

CREATE INDEX IF NOT EXISTS idx_attendee_profiles_last_meeting
ON attendee_profiles(user_id, last_meeting_date DESC)
WHERE last_meeting_date IS NOT NULL;

-- Add comments explaining the tables
COMMENT ON TABLE meeting_context IS 'Stores contextual information for each booking including AI-generated agendas and notes';
COMMENT ON TABLE attendee_profiles IS 'Tracks relationship history between hosts and their attendees across multiple meetings';

COMMENT ON COLUMN meeting_context.generated_agenda IS 'AI-generated meeting agenda from email thread context';
COMMENT ON COLUMN meeting_context.context_summary IS 'Summary of meeting context and background';
COMMENT ON COLUMN meeting_context.attendee_notes IS 'Host''s private notes about the attendee for this specific meeting';

COMMENT ON COLUMN attendee_profiles.meeting_count IS 'Total number of meetings between host and this attendee';
COMMENT ON COLUMN attendee_profiles.total_meeting_minutes IS 'Cumulative duration of all meetings in minutes';
COMMENT ON COLUMN attendee_profiles.notes IS 'Host''s persistent notes about this attendee across all meetings';

-- Add trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_meeting_context_updated_at
  BEFORE UPDATE ON meeting_context
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendee_profiles_updated_at
  BEFORE UPDATE ON attendee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
