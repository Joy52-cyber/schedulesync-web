-- Add onboarding fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_from TIME DEFAULT '09:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_to TIME DEFAULT '17:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri"]';

-- Update existing users to be onboarded (so they don't see onboarding flow)
UPDATE users SET onboarded = true WHERE onboarded IS NULL OR onboarded = false;
