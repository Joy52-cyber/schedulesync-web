const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/bookings/:id/action-items
 * Get all action items for a specific booking
 */
router.get('/bookings/:id/action-items', authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;

    // Verify booking belongs to user
    const bookingCheck = await pool.query(
      'SELECT id FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Get action items
    const result = await pool.query(
      `SELECT * FROM booking_action_items
       WHERE booking_id = $1
       ORDER BY created_at ASC`,
      [bookingId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching action items:', error);
    res.status(500).json({ error: 'Failed to fetch action items' });
  }
});

/**
 * POST /api/bookings/:id/action-items
 * Create a new action item for a booking
 */
router.post('/bookings/:id/action-items', authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;
    const { description, assigned_to, due_date } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Verify booking belongs to user
    const bookingCheck = await pool.query(
      'SELECT id FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Create action item
    const result = await pool.query(
      `INSERT INTO booking_action_items
       (booking_id, description, assigned_to, due_date, created_by)
       VALUES ($1, $2, $3, $4, 'host')
       RETURNING *`,
      [bookingId, description, assigned_to || null, due_date || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating action item:', error);
    res.status(500).json({ error: 'Failed to create action item' });
  }
});

/**
 * PUT /api/action-items/:id/complete
 * Mark an action item as completed
 */
router.put('/action-items/:id/complete', authenticateToken, async (req, res) => {
  try {
    const actionItemId = req.params.id;
    const userId = req.user.id;

    // Verify action item belongs to user's booking
    const verifyResult = await pool.query(
      `SELECT ai.id FROM booking_action_items ai
       JOIN bookings b ON ai.booking_id = b.id
       WHERE ai.id = $1 AND b.user_id = $2`,
      [actionItemId, userId]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    // Mark as completed
    const result = await pool.query(
      `UPDATE booking_action_items
       SET completed = TRUE, completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [actionItemId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error completing action item:', error);
    res.status(500).json({ error: 'Failed to complete action item' });
  }
});

/**
 * PUT /api/action-items/:id/uncomplete
 * Mark an action item as not completed
 */
router.put('/action-items/:id/uncomplete', authenticateToken, async (req, res) => {
  try {
    const actionItemId = req.params.id;
    const userId = req.user.id;

    // Verify action item belongs to user's booking
    const verifyResult = await pool.query(
      `SELECT ai.id FROM booking_action_items ai
       JOIN bookings b ON ai.booking_id = b.id
       WHERE ai.id = $1 AND b.user_id = $2`,
      [actionItemId, userId]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    // Mark as not completed
    const result = await pool.query(
      `UPDATE booking_action_items
       SET completed = FALSE, completed_at = NULL
       WHERE id = $1
       RETURNING *`,
      [actionItemId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error uncompleting action item:', error);
    res.status(500).json({ error: 'Failed to uncomplete action item' });
  }
});

/**
 * DELETE /api/action-items/:id
 * Delete an action item
 */
router.delete('/action-items/:id', authenticateToken, async (req, res) => {
  try {
    const actionItemId = req.params.id;
    const userId = req.user.id;

    // Verify action item belongs to user's booking
    const verifyResult = await pool.query(
      `SELECT ai.id FROM booking_action_items ai
       JOIN bookings b ON ai.booking_id = b.id
       WHERE ai.id = $1 AND b.user_id = $2`,
      [actionItemId, userId]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    // Delete action item
    await pool.query(
      'DELETE FROM booking_action_items WHERE id = $1',
      [actionItemId]
    );

    res.json({ message: 'Action item deleted' });
  } catch (error) {
    console.error('Error deleting action item:', error);
    res.status(500).json({ error: 'Failed to delete action item' });
  }
});

/**
 * GET /api/action-items/my-tasks
 * Get all action items assigned to the authenticated user
 */
router.get('/action-items/my-tasks', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;

    // Check if table exists first
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'booking_action_items'
      );
    `);

    // If table doesn't exist yet, return empty array
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }

    // Check if assigned_to column exists
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'booking_action_items'
        AND column_name = 'assigned_to'
    `);

    if (columnCheck.rows.length === 0) {
      // Column doesn't exist, return empty array
      return res.json([]);
    }

    // Get action items assigned to this user
    const result = await pool.query(
      `SELECT booking_action_items.*,
              b.title as booking_title,
              b.start_time,
              b.attendee_name,
              u.name as host_name
       FROM booking_action_items
       JOIN bookings b ON booking_action_items.booking_id = b.id
       JOIN users u ON b.user_id = u.id
       WHERE booking_action_items.assigned_to = $1
         AND booking_action_items.completed = FALSE
       ORDER BY booking_action_items.due_date ASC NULLS LAST,
                booking_action_items.created_at DESC`,
      [userEmail]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    // Return empty array instead of error for better UX
    res.json([]);
  }
});

module.exports = router;
