-- Migration: Add Integration Tables
-- Description: Creates/updates tables for Slack, Webhooks, CRM integrations

-- 1. Update Slack Integrations Table (add missing columns)
DO $$
BEGIN
  -- Add default_channel column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_integrations' AND column_name = 'default_channel'
  ) THEN
    ALTER TABLE slack_integrations ADD COLUMN default_channel VARCHAR(255);
  END IF;

  -- Add bot_user_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_integrations' AND column_name = 'bot_user_id'
  ) THEN
    ALTER TABLE slack_integrations ADD COLUMN bot_user_id VARCHAR(255);
  END IF;

  -- Add notify_on_booking column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_integrations' AND column_name = 'notify_on_booking'
  ) THEN
    ALTER TABLE slack_integrations ADD COLUMN notify_on_booking BOOLEAN DEFAULT TRUE;
  END IF;

  -- Add notify_on_summary column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_integrations' AND column_name = 'notify_on_summary'
  ) THEN
    ALTER TABLE slack_integrations ADD COLUMN notify_on_summary BOOLEAN DEFAULT TRUE;
  END IF;

  -- Add notify_on_action_items column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_integrations' AND column_name = 'notify_on_action_items'
  ) THEN
    ALTER TABLE slack_integrations ADD COLUMN notify_on_action_items BOOLEAN DEFAULT TRUE;
  END IF;

  -- Add is_active column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_integrations' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE slack_integrations ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Migrate channel_id to default_channel if needed
UPDATE slack_integrations
SET default_channel = channel_id
WHERE default_channel IS NULL AND channel_id IS NOT NULL;

COMMENT ON TABLE slack_integrations IS 'Slack workspace integrations for notifications';
COMMENT ON COLUMN slack_integrations.default_channel IS 'Default Slack channel for notifications';
COMMENT ON COLUMN slack_integrations.notify_on_booking IS 'Send notification when booking is created';

-- 2. User Webhooks Table (for Zapier/Make integrations)
CREATE TABLE IF NOT EXISTS user_webhooks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255), -- For HMAC signature verification
  events TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of event types to listen to
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMP,
  failure_count INTEGER DEFAULT 0, -- Track failed deliveries
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON user_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_webhooks_active ON user_webhooks(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE user_webhooks IS 'User-configured webhooks for Zapier/Make integrations';
COMMENT ON COLUMN user_webhooks.secret IS 'Secret key for HMAC-SHA256 signature verification';
COMMENT ON COLUMN user_webhooks.events IS 'Array of event types this webhook listens to';
COMMENT ON COLUMN user_webhooks.failure_count IS 'Number of consecutive failed deliveries (webhook disabled after 10)';

-- 3. Webhook Deliveries Table (audit log)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER NOT NULL REFERENCES user_webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMP DEFAULT NOW(),
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_timestamp ON webhook_deliveries(delivered_at DESC);

COMMENT ON TABLE webhook_deliveries IS 'Audit log of webhook delivery attempts';
COMMENT ON COLUMN webhook_deliveries.response_status IS 'HTTP status code from webhook endpoint';
COMMENT ON COLUMN webhook_deliveries.retry_count IS 'Number of retry attempts for this delivery';

-- 4. CRM Integrations Table (HubSpot, Salesforce, etc.)
CREATE TABLE IF NOT EXISTS crm_integrations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'hubspot', 'salesforce', 'pipedrive'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  portal_id VARCHAR(255), -- HubSpot portal ID or equivalent
  sync_contacts BOOLEAN DEFAULT TRUE,
  sync_deals BOOLEAN DEFAULT TRUE,
  sync_activities BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_integrations_user ON crm_integrations(user_id);

COMMENT ON TABLE crm_integrations IS 'CRM platform integrations (HubSpot, Salesforce, etc.)';
COMMENT ON COLUMN crm_integrations.provider IS 'CRM provider: hubspot, salesforce, pipedrive';
COMMENT ON COLUMN crm_integrations.portal_id IS 'CRM account identifier';

-- 5. CRM Mappings Table (links attendees to CRM contacts)
CREATE TABLE IF NOT EXISTS crm_mappings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendee_email VARCHAR(255) NOT NULL,
  crm_provider VARCHAR(50) NOT NULL,
  crm_contact_id VARCHAR(255),
  crm_deal_id VARCHAR(255),
  last_synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, attendee_email, crm_provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_mappings_user ON crm_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_mappings_email ON crm_mappings(attendee_email);

COMMENT ON TABLE crm_mappings IS 'Maps TruCal attendees to CRM contacts and deals';
COMMENT ON COLUMN crm_mappings.crm_contact_id IS 'ID of the contact in the CRM system';
COMMENT ON COLUMN crm_mappings.crm_deal_id IS 'ID of the associated deal in the CRM system';

-- 6. Add recording fields to bookings table if not exists
DO $$
BEGIN
  -- Add recording_url column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE bookings ADD COLUMN recording_url TEXT;
  END IF;

  -- Add meet_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'meet_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN meet_id VARCHAR(255);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_meet_id ON bookings(meet_id) WHERE meet_id IS NOT NULL;

COMMENT ON COLUMN bookings.recording_url IS 'URL to meeting recording (Zoom cloud recording)';
COMMENT ON COLUMN bookings.meet_id IS 'Zoom meeting ID or equivalent for tracking';

-- 7. Integration Settings Table (general integration preferences)
CREATE TABLE IF NOT EXISTS integration_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  auto_sync_enabled BOOLEAN DEFAULT TRUE,
  sync_frequency VARCHAR(20) DEFAULT 'realtime', -- 'realtime', 'hourly', 'daily'
  default_crm_provider VARCHAR(50),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_settings_user ON integration_settings(user_id);

COMMENT ON TABLE integration_settings IS 'General integration preferences per user';
COMMENT ON COLUMN integration_settings.sync_frequency IS 'How often to sync data: realtime, hourly, daily';
COMMENT ON COLUMN integration_settings.preferences IS 'Additional integration preferences as JSONB';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Integrations migration completed successfully';
  RAISE NOTICE '   - slack_integrations table updated';
  RAISE NOTICE '   - user_webhooks table created';
  RAISE NOTICE '   - webhook_deliveries table created';
  RAISE NOTICE '   - crm_integrations table created';
  RAISE NOTICE '   - crm_mappings table created';
  RAISE NOTICE '   - bookings table updated (recording_url, meet_id)';
  RAISE NOTICE '   - integration_settings table created';
END $$;
