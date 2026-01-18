-- Migration: Add Smart Features Tables
-- Description: Creates tables for booking patterns, meeting templates, and follow-up sequences

-- First, rename the old booking_patterns table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_patterns') THEN
    ALTER TABLE IF EXISTS booking_patterns RENAME TO booking_patterns_old;
  END IF;
END $$;

-- 1. Booking Patterns Table (for smart scheduling suggestions)
CREATE TABLE IF NOT EXISTS booking_patterns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_type VARCHAR(50) NOT NULL, -- 'preferred_hours', 'preferred_days', 'avg_duration', 'acceptance_rate'
  pattern_data JSONB NOT NULL DEFAULT '{}',
  last_calculated TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, pattern_type)
);

CREATE INDEX IF NOT EXISTS idx_booking_patterns_user ON booking_patterns(user_id);

COMMENT ON TABLE booking_patterns IS 'Stores analyzed booking patterns for AI-powered scheduling suggestions';
COMMENT ON COLUMN booking_patterns.pattern_type IS 'Type of pattern: preferred_hours, preferred_days, avg_duration, acceptance_rate';
COMMENT ON COLUMN booking_patterns.pattern_data IS 'JSONB data for the pattern (e.g., {"hours": [9,10,14], "days": [2,3,4]})';

-- 2. Meeting Templates Table
CREATE TABLE IF NOT EXISTS meeting_templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER DEFAULT 30,
  pre_agenda TEXT,
  default_action_items JSONB DEFAULT '[]',
  email_template_id INTEGER REFERENCES email_templates(id),
  is_public BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_templates_user ON meeting_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_templates_public ON meeting_templates(is_public) WHERE is_public = TRUE;

COMMENT ON TABLE meeting_templates IS 'Pre-configured meeting templates with agendas and action items';
COMMENT ON COLUMN meeting_templates.pre_agenda IS 'Pre-written agenda template';
COMMENT ON COLUMN meeting_templates.default_action_items IS 'JSONB array of default action items';

-- 3. Follow-up Sequences Table
CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(50) NOT NULL, -- 'booking_completed', 'no_show', 'first_meeting'
  steps JSONB NOT NULL DEFAULT '[]', -- [{ delay_hours, action, template_id, subject }]
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_user ON follow_up_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_trigger ON follow_up_sequences(trigger_event);

COMMENT ON TABLE follow_up_sequences IS 'Automated follow-up email sequences';
COMMENT ON COLUMN follow_up_sequences.trigger_event IS 'Event that triggers this sequence';
COMMENT ON COLUMN follow_up_sequences.steps IS 'JSONB array of sequence steps with delay and action';

-- 4. Follow-up Sequence Runs Table
CREATE TABLE IF NOT EXISTS follow_up_sequence_runs (
  id SERIAL PRIMARY KEY,
  sequence_id INTEGER NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  next_action_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_runs_sequence ON follow_up_sequence_runs(sequence_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_runs_booking ON follow_up_sequence_runs(booking_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_runs_next_action ON follow_up_sequence_runs(next_action_at) WHERE status = 'pending';

COMMENT ON TABLE follow_up_sequence_runs IS 'Tracks execution of follow-up sequences';
COMMENT ON COLUMN follow_up_sequence_runs.current_step IS 'Current step index in the sequence';
COMMENT ON COLUMN follow_up_sequence_runs.next_action_at IS 'When the next action should be executed';

-- Insert default meeting templates
INSERT INTO meeting_templates (user_id, name, description, duration, pre_agenda, default_action_items, is_public) VALUES
(NULL, 'Sales Discovery Call', 'Initial sales call to understand prospect needs', 30,
'**Purpose**: Understand prospect''s needs and challenges

**Discussion Topics**:
- Current pain points
- Goals for next quarter
- Budget and timeline
- Decision-making process

**Questions to Address**:
- What''s your biggest challenge right now?
- What does success look like for you?
- Who else needs to be involved in this decision?',
'[{"description": "Send follow-up resources", "assigned_to": "host"}, {"description": "Schedule demo or next call", "assigned_to": "host"}, {"description": "Share pricing information", "assigned_to": "host"}]'::jsonb,
TRUE),

(NULL, 'Weekly 1-on-1', 'Regular check-in with team member', 30,
'**Purpose**: Check in on progress and blockers

**Discussion Topics**:
- Wins from last week
- Current projects status
- Challenges or blockers
- Goals for next week

**Questions**:
- What support do you need?
- Anything I should know about?',
'[{"description": "Follow up on discussed items", "assigned_to": "host"}]'::jsonb,
TRUE),

(NULL, 'Job Interview', 'Candidate interview template', 60,
'**Purpose**: Evaluate candidate fit for role

**Discussion Topics**:
- Background and experience
- Technical skills assessment
- Cultural fit
- Questions from candidate

**Key Areas**:
- Past projects and achievements
- Problem-solving approach
- Team collaboration style',
'[{"description": "Send feedback to hiring team", "assigned_to": "host"}, {"description": "Follow up with candidate", "assigned_to": "host"}]'::jsonb,
TRUE),

(NULL, 'Customer Feedback Session', 'Gather product feedback from users', 45,
'**Purpose**: Understand user experience and gather improvement ideas

**Discussion Topics**:
- Current product usage
- Pain points and challenges
- Feature requests
- Overall satisfaction

**Questions**:
- What do you love about the product?
- What frustrates you?
- What would make your workflow easier?',
'[{"description": "Share feedback with product team", "assigned_to": "host"}, {"description": "Follow up on feature requests", "assigned_to": "host"}]'::jsonb,
TRUE),

(NULL, 'Quick Sync', 'Brief alignment meeting', 15,
'**Purpose**: Quick status update and alignment

**Agenda**:
- Quick updates from each person
- Any blockers or urgent items
- Next steps',
'[]'::jsonb,
TRUE)

ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Smart features migration completed successfully';
  RAISE NOTICE '   - booking_patterns table created';
  RAISE NOTICE '   - meeting_templates table created (5 default templates)';
  RAISE NOTICE '   - follow_up_sequences table created';
  RAISE NOTICE '   - follow_up_sequence_runs table created';
END $$;
