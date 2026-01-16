-- ============================================
-- Onboarding Migration for TruCal
-- ============================================
-- Run this in Railway Dashboard > PostgreSQL > Query tab

-- Step 1: Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_from TIME DEFAULT '09:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_to TIME DEFAULT '17:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri"]';

-- Step 2: Mark all existing users as onboarded
-- (so they don't see the onboarding wizard)
UPDATE users SET onboarded = true WHERE onboarded IS NULL;

-- Step 3: Verify migration
SELECT
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE onboarded = true) as onboarded_users,
  COUNT(*) FILTER (WHERE onboarded = false) as not_onboarded
FROM users;

-- Expected result:
-- All existing users should have onboarded = true
-- New users will automatically get onboarded = false from DEFAULT
