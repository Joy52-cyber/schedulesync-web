-- Integrations Migration
-- Adds Slack, user webhooks, CRM integrations, and video enhancements

-- ============================================
-- SLACK INTEGRATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS slack_integrations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id VARCHAR(255) NOT NULL,
  team_name VARCHAR(255),
  access_token TEXT NOT NULL,
  bot_user_id VARCHAR(255),
  default_channel VARCHAR(255),
  notify_on_booking BOOLEAN DEFAULT TRUE,
  notify_on_summary BOOLEAN DEFAULT TRUE,
  notify_on_action_items BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_integrations_user
ON slack_integrations(user_id);

COMMENT ON TABLE slack_integrations IS 'Slack workspace integrations for notifications';
COMMENT ON COLUMN slack_integrations.team_id IS 'Slack workspace team ID';
COMMENT ON COLUMN slack_integrations.access_token IS 'Slack OAuth access token (encrypted)';
COMMENT ON COLUMN slack_integrations.default_channel IS 'Default channel ID for notifications';

-- ============================================
-- USER WEBHOOKS (Zapier/Make/Custom)
-- ============================================
CREATE TABLE IF NOT EXISTS user_webhooks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255),
  events TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMP,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_webhooks_user
ON user_webhooks(user_id);

CREATE INDEX IF NOT EXISTS idx_user_webhooks_active
ON user_webhooks(is_active)
WHERE is_active = TRUE;

COMMENT ON TABLE user_webhooks IS 'User-configured webhooks for Zapier, Make.com, and custom integrations';
COMMENT ON COLUMN user_webhooks.secret IS 'Secret for HMAC signature verification';
COMMENT ON COLUMN user_webhooks.events IS 'Array of event types to trigger on: [''booking.created'', ''booking.cancelled'', etc.]';
COMMENT ON COLUMN user_webhooks.failure_count IS 'Consecutive failure count (webhook disabled after 10 failures)';

-- ============================================
-- WEBHOOK DELIVERIES (audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER NOT NULL REFERENCES user_webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMP DEFAULT NOW(),
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook
ON webhook_deliveries(webhook_id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at
ON webhook_deliveries(delivered_at DESC);

COMMENT ON TABLE webhook_deliveries IS 'Audit log of webhook delivery attempts';
COMMENT ON COLUMN webhook_deliveries.response_status IS 'HTTP status code from webhook endpoint';
COMMENT ON COLUMN webhook_deliveries.retry_count IS 'Number of retry attempts for failed deliveries';

-- ============================================
-- CRM INTEGRATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS crm_integrations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  portal_id VARCHAR(255),
  sync_contacts BOOLEAN DEFAULT TRUE,
  sync_deals BOOLEAN DEFAULT TRUE,
  sync_activities BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_integrations_user
ON crm_integrations(user_id);

COMMENT ON TABLE crm_integrations IS 'CRM integrations (HubSpot, Salesforce, Pipedrive)';
COMMENT ON COLUMN crm_integrations.provider IS 'CRM provider: hubspot, salesforce, pipedrive';
COMMENT ON COLUMN crm_integrations.portal_id IS 'HubSpot portal ID or equivalent';

-- ============================================
-- CRM MAPPINGS
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_crm_mappings_user_email
ON crm_mappings(user_id, attendee_email);

CREATE INDEX IF NOT EXISTS idx_crm_mappings_provider_contact
ON crm_mappings(crm_provider, crm_contact_id);

COMMENT ON TABLE crm_mappings IS 'Maps TruCal attendees to CRM contacts and deals';

-- ============================================
-- VIDEO ENHANCEMENTS
-- ============================================

-- Add recording URL and meet ID to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS meet_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_bookings_meet_id
ON bookings(meet_id)
WHERE meet_id IS NOT NULL;

COMMENT ON COLUMN bookings.recording_url IS 'URL to video recording (Zoom cloud recording)';
COMMENT ON COLUMN bookings.meet_id IS 'Zoom meeting ID or Google Meet ID for webhook correlation';

-- ============================================
-- INTEGRATION SETTINGS (general)
-- ============================================
CREATE TABLE IF NOT EXISTS integration_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_type VARCHAR(50) NOT NULL,
  settings JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_settings_user
ON integration_settings(user_id);

COMMENT ON TABLE integration_settings IS 'General integration settings and preferences';
COMMENT ON COLUMN integration_settings.integration_type IS 'Type: slack, zoom, calendar, crm, zapier, etc.';
COMMENT ON COLUMN integration_settings.settings IS 'JSON settings specific to integration type';

-- ============================================
-- PERFORMANCE NOTES
-- ============================================
-- slack_integrations: Indexed by user_id for fast lookups
-- user_webhooks: Indexed by user_id and is_active for active webhook queries
-- webhook_deliveries: Indexed by webhook_id and delivered_at for audit history
-- crm_integrations: Indexed by user_id for CRM sync operations
-- crm_mappings: Indexed by user_id + email for contact lookup
