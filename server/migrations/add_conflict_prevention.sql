-- Conflict Prevention Optimization Migration
-- Adds database index to speed up conflict detection queries

-- Add partial index for active bookings to improve conflict query performance
-- This index only includes confirmed and pending_approval bookings (not cancelled)
-- which are the only ones we check for conflicts against
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_active_times
ON bookings(user_id, start_time, end_time)
WHERE status IN ('confirmed', 'pending_approval');

-- Add comment explaining the index purpose
COMMENT ON INDEX idx_bookings_active_times IS 'Optimizes conflict detection queries by indexing only active bookings (confirmed/pending)';

-- Performance notes:
-- - This partial index will be much smaller than a full index
-- - Typical conflict check query will use this index for fast lookups
-- - CONCURRENTLY means the index is built without locking the table
