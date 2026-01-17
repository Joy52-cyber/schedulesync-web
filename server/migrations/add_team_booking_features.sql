-- Team Booking Features Migration
-- Adds round-robin assignment and booking mode configuration

-- Add booking_mode to teams table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'teams' AND column_name = 'booking_mode') THEN
    ALTER TABLE teams
    ADD COLUMN booking_mode VARCHAR(20) DEFAULT 'round_robin'
    CHECK (booking_mode IN ('round_robin', 'first_available'));
  END IF;
END $$;

-- Add assigned_member_id to bookings table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'bookings' AND column_name = 'assigned_member_id') THEN
    ALTER TABLE bookings
    ADD COLUMN assigned_member_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for efficient team member lookups
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_member
ON bookings(assigned_member_id)
WHERE assigned_member_id IS NOT NULL;

-- Add index for team booking queries
CREATE INDEX IF NOT EXISTS idx_bookings_team_status
ON bookings(team_id, status, start_time)
WHERE team_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN teams.booking_mode IS 'Team booking assignment mode: round_robin (fair distribution) or first_available (calendar-based)';
COMMENT ON COLUMN bookings.assigned_member_id IS 'Team member assigned to this booking (auto-assigned based on team booking mode)';

-- Performance notes:
-- - Round-robin mode balances bookings across team members
-- - First-available mode assigns based on calendar conflicts
-- - assigned_member_id allows tracking which member handled each booking
