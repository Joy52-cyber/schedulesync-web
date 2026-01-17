-- Action Items Tracking Migration
-- Adds table to track action items extracted from meetings

-- Create action items table
CREATE TABLE IF NOT EXISTS booking_action_items (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assigned_to VARCHAR(255), -- email address
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(20) CHECK (created_by IN ('ai', 'host', 'guest')),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_action_items_booking
ON booking_action_items(booking_id);

CREATE INDEX IF NOT EXISTS idx_action_items_assigned
ON booking_action_items(assigned_to, completed)
WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_action_items_due_date
ON booking_action_items(due_date, completed)
WHERE due_date IS NOT NULL AND completed = FALSE;

-- Add comments
COMMENT ON TABLE booking_action_items IS 'Tracks action items from meetings, extracted by AI or added manually';
COMMENT ON COLUMN booking_action_items.created_by IS 'Source of the action item: ai (extracted), host (meeting organizer), or guest (attendee)';
COMMENT ON COLUMN booking_action_items.assigned_to IS 'Email address of the person responsible for this action item';
