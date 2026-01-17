-- Smart Features Migration
-- Adds booking patterns, meeting templates, and follow-up sequences

-- ============================================
-- BOOKING PATTERNS (for smart scheduling)
-- ============================================
CREATE TABLE IF NOT EXISTS booking_patterns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_type VARCHAR(50) NOT NULL,
  pattern_data JSONB NOT NULL DEFAULT '{}',
  last_calculated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, pattern_type)
);

CREATE INDEX IF NOT EXISTS idx_booking_patterns_user
ON booking_patterns(user_id);

COMMENT ON TABLE booking_patterns IS 'Stores analyzed booking patterns for smart scheduling suggestions';
COMMENT ON COLUMN booking_patterns.pattern_type IS 'Type of pattern: preferred_hours, preferred_days, avg_duration, acceptance_rate';
COMMENT ON COLUMN booking_patterns.pattern_data IS 'JSON data containing pattern analysis results';

-- ============================================
-- MEETING TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER DEFAULT 30,
  pre_agenda TEXT,
  default_action_items JSONB DEFAULT '[]',
  email_template_id INTEGER REFERENCES email_templates(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_templates_user
ON meeting_templates(user_id);

CREATE INDEX IF NOT EXISTS idx_meeting_templates_public
ON meeting_templates(is_public)
WHERE is_public = TRUE;

COMMENT ON TABLE meeting_templates IS 'Pre-configured meeting templates with agendas and action items';
COMMENT ON COLUMN meeting_templates.pre_agenda IS 'Default agenda text (supports markdown)';
COMMENT ON COLUMN meeting_templates.default_action_items IS 'JSON array of default action items: [{"description": "...", "assigned_to": "host|guest"}]';

-- ============================================
-- FOLLOW-UP SEQUENCES
-- ============================================
CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(50) NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_user
ON follow_up_sequences(user_id);

CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_active
ON follow_up_sequences(is_active)
WHERE is_active = TRUE;

COMMENT ON TABLE follow_up_sequences IS 'Automated follow-up email sequences triggered by booking events';
COMMENT ON COLUMN follow_up_sequences.trigger_event IS 'Event that triggers sequence: booking_completed, no_show, first_meeting, etc.';
COMMENT ON COLUMN follow_up_sequences.steps IS 'JSON array of sequence steps: [{"delay_hours": 2, "action": "send_email", "template_id": 123}]';

-- ============================================
-- FOLLOW-UP SEQUENCE RUNS (execution tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS follow_up_sequence_runs (
  id SERIAL PRIMARY KEY,
  sequence_id INTEGER NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  next_action_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'cancelled', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_follow_up_runs_sequence
ON follow_up_sequence_runs(sequence_id);

CREATE INDEX IF NOT EXISTS idx_follow_up_runs_booking
ON follow_up_sequence_runs(booking_id);

CREATE INDEX IF NOT EXISTS idx_follow_up_runs_next_action
ON follow_up_sequence_runs(next_action_at)
WHERE status = 'pending' AND next_action_at IS NOT NULL;

COMMENT ON TABLE follow_up_sequence_runs IS 'Tracks execution of follow-up sequences for individual bookings';
COMMENT ON COLUMN follow_up_sequence_runs.current_step IS 'Index of current step in sequence (0-based)';
COMMENT ON COLUMN follow_up_sequence_runs.next_action_at IS 'Timestamp when next step should execute';

-- ============================================
-- INSERT DEFAULT MEETING TEMPLATES
-- ============================================
INSERT INTO meeting_templates (user_id, name, description, duration, pre_agenda, default_action_items, is_public)
VALUES
  -- Sales Discovery Call
  (NULL, 'Sales Discovery Call', 'Initial consultation to understand prospect needs', 30,
   E'**Purpose**: Understand prospect''s needs and challenges\n\n**Discussion Topics**:\n- Current pain points\n- Goals for next quarter\n- Budget and timeline\n- Decision-making process\n\n**Questions to Address**:\n- What''s your biggest challenge right now?\n- What does success look like for you?\n- Who else needs to be involved in this decision?',
   '[{"description": "Send follow-up resources", "assigned_to": "host"}, {"description": "Schedule demo or next call", "assigned_to": "host"}, {"description": "Share pricing information", "assigned_to": "host"}]',
   TRUE),

  -- Weekly 1-on-1
  (NULL, 'Weekly 1-on-1', 'Regular check-in with team member', 30,
   E'**Purpose**: Check in on progress and blockers\n\n**Discussion Topics**:\n- Wins from last week\n- Current projects status\n- Challenges or blockers\n- Goals for next week\n\n**Questions**:\n- What support do you need?\n- Anything I should know about?',
   '[{"description": "Follow up on discussed items", "assigned_to": "host"}]',
   TRUE),

  -- Interview
  (NULL, 'Job Interview', 'Candidate interview session', 60,
   E'**Purpose**: Evaluate candidate fit for role\n\n**Discussion Topics**:\n- Background and experience\n- Technical skills assessment\n- Cultural fit\n- Career goals\n\n**Questions to Ask**:\n- Tell me about a challenging project you worked on\n- How do you handle tight deadlines?\n- What are you looking for in your next role?',
   '[{"description": "Send candidate feedback to hiring team", "assigned_to": "host"}, {"description": "Schedule follow-up interview if needed", "assigned_to": "host"}]',
   TRUE),

  -- Customer Feedback Session
  (NULL, 'Customer Feedback', 'Gather product feedback from users', 30,
   E'**Purpose**: Understand customer experience and gather insights\n\n**Discussion Topics**:\n- Current usage patterns\n- Pain points or friction\n- Feature requests\n- Overall satisfaction\n\n**Questions**:\n- What do you love most about the product?\n- What would you improve?\n- Are there any missing features?',
   '[{"description": "Document feedback in product roadmap", "assigned_to": "host"}, {"description": "Send thank you note", "assigned_to": "host"}]',
   TRUE),

  -- Quick Sync
  (NULL, 'Quick Sync', 'Brief alignment meeting', 15,
   E'**Purpose**: Quick alignment on specific topic\n\n**Discussion Topics**:\n- Status update\n- Quick decision needed\n- Clarify next steps',
   '[]',
   TRUE);

-- ============================================
-- PERFORMANCE NOTES
-- ============================================
-- booking_patterns: Indexed by user_id for fast pattern lookups
-- meeting_templates: Indexed by user_id and is_public for template discovery
-- follow_up_sequences: Indexed by user_id and is_active for active sequence queries
-- follow_up_sequence_runs: Indexed by next_action_at for cron job efficiency
