const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { checkEventTypeLimit } = require('../middleware/featureGates');

// GET /api/event-types - List user's event types
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM event_types WHERE user_id = $1 ORDER BY created_at ASC',
      [req.user.id]
    );
    res.json({ eventTypes: result.rows });
  } catch (error) {
    console.error('Get event types error:', error);
    res.status(500).json({ error: 'Failed to fetch event types' });
  }
});

// POST /api/event-types - Create event type
router.post('/', authenticateToken, checkEventTypeLimit, async (req, res) => {
  try {
    const {
      title, duration, description, color, slug,
      custom_questions, pre_meeting_instructions, confirmation_message,
      buffer_before, buffer_after, min_notice_hours, max_days_ahead,
      location, location_type, max_bookings_per_day, require_approval
    } = req.body;

    // Auto-generate slug if not provided: "My Meeting" -> "my-meeting"
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const result = await pool.query(
      `INSERT INTO event_types (
        user_id, title, slug, duration, description, color,
        custom_questions, pre_meeting_instructions, confirmation_message,
        buffer_before, buffer_after, min_notice_hours, max_days_ahead,
        location, location_type, max_bookings_per_day, require_approval
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        req.user.id, title, finalSlug, duration || 30, description, color || 'blue',
        JSON.stringify(custom_questions || []),
        pre_meeting_instructions || '',
        confirmation_message || '',
        buffer_before || 0,
        buffer_after || 0,
        min_notice_hours || 1,
        max_days_ahead || 60,
        location || '',
        location_type || 'google_meet',
        max_bookings_per_day || null,
        require_approval || false
      ]
    );

    // Return usage info so frontend can update
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM event_types WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      eventType: result.rows[0],
      message: 'Event type created successfully',
      usage: {
        event_types_used: parseInt(countResult.rows[0].count),
        event_types_limit: req.eventTypeUsage?.limit || 2
      }
    });
  } catch (error) {
    console.error('Create event type error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'An event with this URL slug already exists.' });
    }
    res.status(500).json({ error: 'Failed to create event type' });
  }
});

// PUT /api/event-types/:id - Update event type
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, duration, description, color, slug, is_active,
      custom_questions, pre_meeting_instructions, confirmation_message,
      buffer_before, buffer_after, min_notice_hours, max_days_ahead,
      location, location_type, max_bookings_per_day, require_approval
    } = req.body;

    const result = await pool.query(
      `UPDATE event_types
       SET title = COALESCE($1, title),
           slug = COALESCE($2, slug),
           duration = COALESCE($3, duration),
           description = COALESCE($4, description),
           color = COALESCE($5, color),
           is_active = COALESCE($6, is_active),
           custom_questions = COALESCE($7, custom_questions),
           pre_meeting_instructions = COALESCE($8, pre_meeting_instructions),
           confirmation_message = COALESCE($9, confirmation_message),
           buffer_before = COALESCE($10, buffer_before),
           buffer_after = COALESCE($11, buffer_after),
           min_notice_hours = COALESCE($12, min_notice_hours),
           max_days_ahead = COALESCE($13, max_days_ahead),
           location = COALESCE($14, location),
           location_type = COALESCE($15, location_type),
           max_bookings_per_day = $16,
           require_approval = COALESCE($17, require_approval)
       WHERE id = $18 AND user_id = $19
       RETURNING *`,
      [
        title, slug, duration, description, color, is_active,
        custom_questions !== undefined ? JSON.stringify(custom_questions) : null,
        pre_meeting_instructions,
        confirmation_message,
        buffer_before,
        buffer_after,
        min_notice_hours,
        max_days_ahead,
        location,
        location_type,
        max_bookings_per_day,  // Allow setting to null
        require_approval,
        id, req.user.id
      ]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event type not found' });
    }

    res.json({ eventType: result.rows[0], message: 'Updated successfully' });
  } catch (error) {
    console.error('Update event type error:', error);
    res.status(500).json({ error: 'Failed to update event type' });
  }
});

// DELETE /api/event-types/:id - Delete event type
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM event_types WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event type not found' });
    }

    res.json({ success: true, message: 'Event type deleted' });
  } catch (error) {
    console.error('Delete event type error:', error);
    res.status(500).json({ error: 'Failed to delete event type' });
  }
});

// PATCH /api/event-types/:id/toggle - Toggle event type active status
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;  // Frontend sends 'active', not 'is_active'

    const result = await pool.query(
      `UPDATE event_types
       SET is_active = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [active, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    res.json({
      success: true,
      eventType: result.rows[0],
      message: 'Event type status updated'
    });
  } catch (error) {
    console.error('Toggle event type error:', error);
    res.status(500).json({ error: 'Failed to toggle event type status' });
  }
});

module.exports = router;
