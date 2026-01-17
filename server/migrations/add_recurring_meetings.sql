-- Add recurring meeting support to bookings table
-- Run this migration to add recurring meeting columns

-- Add columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
ADD COLUMN IF NOT EXISTS recurrence_parent_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20),
ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurrence_days_of_week TEXT[], -- ['monday', 'wednesday']
ADD COLUMN IF NOT EXISTS recurrence_exceptions TEXT[]; -- ISO date strings of cancelled instances

-- Add index for recurring bookings queries
CREATE INDEX IF NOT EXISTS idx_bookings_recurring ON bookings(is_recurring, recurrence_parent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_recurrence_dates ON bookings(recurrence_end_date);

-- Comments
COMMENT ON COLUMN bookings.is_recurring IS 'Whether this is a recurring meeting series';
COMMENT ON COLUMN bookings.recurrence_rule IS 'RRULE string in iCalendar format (e.g., FREQ=WEEKLY;BYDAY=MO,WE)';
COMMENT ON COLUMN bookings.recurrence_parent_id IS 'If this is an instance, points to the parent recurring booking';
COMMENT ON COLUMN bookings.recurrence_end_date IS 'When the recurring series ends (NULL = no end)';
COMMENT ON COLUMN bookings.recurrence_frequency IS 'DAILY, WEEKLY, MONTHLY, YEARLY';
COMMENT ON COLUMN bookings.recurrence_interval IS 'Repeat every N periods (e.g., 2 for bi-weekly)';
COMMENT ON COLUMN bookings.recurrence_days_of_week IS 'For WEEKLY: which days (monday, tuesday, etc.)';
COMMENT ON COLUMN bookings.recurrence_exceptions IS 'Array of ISO date strings where instances are cancelled';
