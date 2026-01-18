const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');

/**
 * Get default meeting templates
 * @returns {Array} - Default templates
 */
function getDefaultTemplates() {
  return [
    {
      id: 'default-1',
      name: 'Sales Discovery Call',
      description: 'Initial sales conversation to understand prospect needs',
      duration: 30,
      pre_agenda: `**Purpose**: Understand prospect's needs and challenges

**Discussion Topics**:
- Current pain points and challenges
- Goals for next quarter/year
- Budget and timeline considerations
- Decision-making process

**Questions to Address**:
- What's your biggest challenge right now?
- What does success look like for you?
- Who else needs to be involved in this decision?
- What's your timeline for implementation?`,
      default_action_items: [
        { description: 'Send follow-up resources and case studies', assigned_to: 'host' },
        { description: 'Schedule product demo or next call', assigned_to: 'host' },
        { description: 'Share pricing information', assigned_to: 'host' }
      ],
      is_public: true,
      use_count: 0
    },
    {
      id: 'default-2',
      name: 'Weekly 1-on-1',
      description: 'Regular one-on-one check-in meeting',
      duration: 30,
      pre_agenda: `**Purpose**: Check in on progress, discuss blockers, and align on priorities

**Discussion Topics**:
- Wins and accomplishments from last week
- Current projects status update
- Challenges or blockers
- Goals and priorities for next week
- Career development and growth

**Questions**:
- What support or resources do you need?
- Is there anything I should know about?
- What's the biggest challenge you're facing?`,
      default_action_items: [
        { description: 'Follow up on discussed items', assigned_to: 'host' }
      ],
      is_public: true,
      use_count: 0
    },
    {
      id: 'default-3',
      name: 'Product Demo',
      description: 'Product demonstration and walkthrough',
      duration: 45,
      pre_agenda: `**Purpose**: Demonstrate product capabilities and address questions

**Agenda**:
- Introduction and objectives (5 min)
- Product overview and key features (15 min)
- Live demonstration (15 min)
- Q&A session (10 min)

**What to Prepare**:
- Demo environment ready
- Relevant use cases prepared
- Questions about their specific needs`,
      default_action_items: [
        { description: 'Send demo recording and resources', assigned_to: 'host' },
        { description: 'Schedule follow-up discussion', assigned_to: 'host' },
        { description: 'Provide trial access if applicable', assigned_to: 'host' }
      ],
      is_public: true,
      use_count: 0
    },
    {
      id: 'default-4',
      name: 'Team Standup',
      description: 'Quick daily team sync',
      duration: 15,
      pre_agenda: `**Purpose**: Quick team alignment and blocker identification

**Format** (2-3 min per person):
- What did you accomplish yesterday?
- What are you working on today?
- Any blockers or concerns?

**Keep it Brief**:
- Focus on outcomes, not details
- Raise blockers, don't solve them here
- Take detailed discussions offline`,
      default_action_items: [],
      is_public: true,
      use_count: 0
    },
    {
      id: 'default-5',
      name: 'Project Kickoff',
      description: 'Initial project planning meeting',
      duration: 60,
      pre_agenda: `**Purpose**: Align on project goals, scope, and next steps

**Agenda**:
- Project overview and objectives (10 min)
- Scope and deliverables (15 min)
- Timeline and milestones (15 min)
- Team roles and responsibilities (10 min)
- Next steps and action items (10 min)

**Outcomes**:
- Clear understanding of project goals
- Defined scope and boundaries
- Initial timeline with key milestones
- Assigned responsibilities`,
      default_action_items: [
        { description: 'Create detailed project plan', assigned_to: 'host' },
        { description: 'Set up project tracking system', assigned_to: 'host' },
        { description: 'Schedule first sprint planning', assigned_to: 'host' }
      ],
      is_public: true,
      use_count: 0
    },
    {
      id: 'default-6',
      name: 'Customer Support Call',
      description: 'Customer issue resolution and support',
      duration: 30,
      pre_agenda: `**Purpose**: Address customer concerns and provide solutions

**Topics to Cover**:
- Issue description and impact
- Steps already attempted
- Expected outcome
- Timeline for resolution

**Support Process**:
- Listen actively and take notes
- Ask clarifying questions
- Propose solutions or workarounds
- Set clear expectations for follow-up`,
      default_action_items: [
        { description: 'Document issue details', assigned_to: 'host' },
        { description: 'Investigate root cause', assigned_to: 'host' },
        { description: 'Follow up with resolution', assigned_to: 'host' }
      ],
      is_public: true,
      use_count: 0
    }
  ];
}

/**
 * GET /api/meeting-templates
 * Get all templates (user's private templates + public templates)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'meeting_templates'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Return default templates
      return res.json(getDefaultTemplates());
    }

    const result = await pool.query(`
      SELECT
        id,
        user_id,
        name,
        description,
        duration,
        pre_agenda,
        default_action_items,
        email_template_id,
        is_public,
        use_count,
        created_at,
        updated_at
      FROM meeting_templates
      WHERE user_id = $1 OR is_public = TRUE
      ORDER BY
        CASE WHEN user_id = $1 THEN 0 ELSE 1 END,
        use_count DESC,
        name ASC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meeting templates:', error);
    res.json(getDefaultTemplates());
  }
});

/**
 * GET /api/meeting-templates/:id
 * Get a specific template
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT * FROM meeting_templates
      WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching meeting template:', error);
    res.status(500).json({ error: 'Failed to fetch meeting template' });
  }
});

/**
 * POST /api/meeting-templates
 * Create a new template
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      duration,
      pre_agenda,
      default_action_items,
      email_template_id,
      is_public
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    if (duration && (duration < 5 || duration > 480)) {
      return res.status(400).json({ error: 'Duration must be between 5 and 480 minutes' });
    }

    const result = await pool.query(`
      INSERT INTO meeting_templates (
        user_id,
        name,
        description,
        duration,
        pre_agenda,
        default_action_items,
        email_template_id,
        is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId,
      name,
      description || null,
      duration || 30,
      pre_agenda || null,
      JSON.stringify(default_action_items || []),
      email_template_id || null,
      is_public || false
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating meeting template:', error);
    res.status(500).json({ error: 'Failed to create meeting template' });
  }
});

/**
 * PUT /api/meeting-templates/:id
 * Update a template (must be owner)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      name,
      description,
      duration,
      pre_agenda,
      default_action_items,
      email_template_id,
      is_public
    } = req.body;

    // Check ownership
    const checkResult = await pool.query(
      'SELECT id FROM meeting_templates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found or unauthorized' });
    }

    // Update template
    const result = await pool.query(`
      UPDATE meeting_templates
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        duration = COALESCE($3, duration),
        pre_agenda = COALESCE($4, pre_agenda),
        default_action_items = COALESCE($5, default_action_items),
        email_template_id = COALESCE($6, email_template_id),
        is_public = COALESCE($7, is_public),
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      name,
      description,
      duration,
      pre_agenda,
      default_action_items ? JSON.stringify(default_action_items) : null,
      email_template_id,
      is_public,
      id
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating meeting template:', error);
    res.status(500).json({ error: 'Failed to update meeting template' });
  }
});

/**
 * DELETE /api/meeting-templates/:id
 * Delete a template (must be owner)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM meeting_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found or unauthorized' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting meeting template:', error);
    res.status(500).json({ error: 'Failed to delete meeting template' });
  }
});

/**
 * POST /api/bookings/from-template/:templateId
 * Create a booking from a template
 */
router.post('/bookings/from-template/:templateId', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    const {
      start_time,
      attendee_name,
      attendee_email,
      notes
    } = req.body;

    // Validation
    if (!start_time || !attendee_email) {
      return res.status(400).json({ error: 'Start time and attendee email are required' });
    }

    // Get template
    const templateResult = await pool.query(
      'SELECT * FROM meeting_templates WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)',
      [templateId, userId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Calculate end time
    const startTime = new Date(start_time);
    const endTime = new Date(startTime.getTime() + template.duration * 60000);

    // Create booking
    const bookingResult = await pool.query(`
      INSERT INTO bookings (
        user_id,
        title,
        start_time,
        end_time,
        attendee_name,
        attendee_email,
        notes,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
      RETURNING *
    `, [
      userId,
      template.name,
      startTime,
      endTime,
      attendee_name || attendee_email.split('@')[0],
      attendee_email,
      notes || template.pre_agenda
    ]);

    const booking = bookingResult.rows[0];

    // Create meeting context with pre-agenda
    if (template.pre_agenda) {
      await pool.query(`
        INSERT INTO meeting_context (booking_id, generated_agenda)
        VALUES ($1, $2)
      `, [booking.id, template.pre_agenda]);
    }

    // Create default action items
    if (template.default_action_items && template.default_action_items.length > 0) {
      for (const item of template.default_action_items) {
        const assignedTo = item.assigned_to === 'host' ? userId : attendee_email;

        await pool.query(`
          INSERT INTO booking_action_items (
            booking_id,
            description,
            assigned_to,
            created_by
          ) VALUES ($1, $2, $3, 'ai')
        `, [booking.id, item.description, assignedTo]);
      }
    }

    // Increment use count
    await pool.query(
      'UPDATE meeting_templates SET use_count = use_count + 1 WHERE id = $1',
      [templateId]
    );

    res.status(201).json({
      booking,
      message: 'Booking created from template successfully'
    });

  } catch (error) {
    console.error('Error creating booking from template:', error);
    res.status(500).json({ error: 'Failed to create booking from template' });
  }
});

module.exports = router;
