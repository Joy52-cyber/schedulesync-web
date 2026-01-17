-- Follow-up Automation Migration
-- Adds fields to support meeting summaries and no-show detection

-- Add columns for meeting summary tracking
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS meeting_summary TEXT,
ADD COLUMN IF NOT EXISTS summary_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS no_show_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS no_show_handled BOOLEAN DEFAULT FALSE;

-- Add index for efficient no-show detection queries
CREATE INDEX IF NOT EXISTS idx_bookings_no_show_check
ON bookings(status, end_time, no_show_handled)
WHERE status = 'confirmed' AND no_show_handled = FALSE;

-- Add comment explaining the fields
COMMENT ON COLUMN bookings.meeting_summary IS 'AI-generated summary of the meeting sent post-meeting';
COMMENT ON COLUMN bookings.summary_sent_at IS 'Timestamp when the meeting summary was sent';
COMMENT ON COLUMN bookings.no_show_detected IS 'Indicates if this meeting was flagged as a no-show';
COMMENT ON COLUMN bookings.no_show_handled IS 'Indicates if no-show follow-up has been sent';
