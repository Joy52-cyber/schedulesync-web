-- Migration: Add Public Booking Features
-- Run this migration to add all required columns for enhanced booking features

-- User profile enhancements
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Event type enhancements
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS custom_questions JSONB DEFAULT '[]';
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS pre_meeting_instructions TEXT;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS confirmation_message TEXT;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS buffer_before INTEGER DEFAULT 0;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS buffer_after INTEGER DEFAULT 0;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS min_notice_hours INTEGER DEFAULT 1;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS max_days_ahead INTEGER DEFAULT 60;

-- Booking enhancements
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS additional_guests JSONB DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_timezone TEXT;

-- Booking cancellation tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT; -- 'guest' or 'host'

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_additional_guests ON bookings USING gin(additional_guests);
CREATE INDEX IF NOT EXISTS idx_event_types_custom_questions ON event_types USING gin(custom_questions);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_manage_token ON bookings(manage_token);
