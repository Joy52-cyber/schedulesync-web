-- Email Bounces Tracking Table
-- Tracks email delivery failures to prevent repeated sends to invalid addresses

CREATE TABLE IF NOT EXISTS email_bounces (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    bounce_type VARCHAR(20) NOT NULL DEFAULT 'soft', -- 'soft' or 'hard'
    bounce_count INTEGER NOT NULL DEFAULT 1,
    first_bounce_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_bounce_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick email lookups
CREATE INDEX IF NOT EXISTS idx_email_bounces_email ON email_bounces(email);

-- Index for cleanup queries (find old bounces)
CREATE INDEX IF NOT EXISTS idx_email_bounces_last_bounce ON email_bounces(last_bounce_at);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_email_bounces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_bounces_updated_at ON email_bounces;
CREATE TRIGGER trigger_email_bounces_updated_at
    BEFORE UPDATE ON email_bounces
    FOR EACH ROW
    EXECUTE FUNCTION update_email_bounces_updated_at();

-- Optional: Add email validation status to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS email_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_validation_warning TEXT;

-- Optional: Add to team_members table
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS email_validated BOOLEAN DEFAULT FALSE;

COMMENT ON TABLE email_bounces IS 'Tracks email addresses that have bounced to prevent repeated delivery attempts';
COMMENT ON COLUMN email_bounces.bounce_type IS 'soft = temporary failure, hard = permanent failure (mailbox does not exist)';
COMMENT ON COLUMN email_bounces.bounce_count IS 'Number of times this email has bounced';