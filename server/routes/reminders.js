/**
 * Reminder Settings Routes
 * Manage email reminder preferences
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/reminders/settings
 * Get user's reminder settings
 */
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT * FROM reminder_settings
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Create default settings if none exist
      const defaultResult = await pool.query(`
        INSERT INTO reminder_settings (user_id, enabled, send_to_host, send_to_guest, hours_before, custom_hours)
        VALUES ($1, true, true, true, 24, ARRAY[24, 1])
        RETURNING *
      `, [userId]);

      return res.json({ settings: defaultResult.rows[0] });
    }

    res.json({ settings: result.rows[0] });
  } catch (error) {
    console.error('Error fetching reminder settings:', error);
    res.status(500).json({ error: 'Failed to fetch reminder settings' });
  }
});

/**
 * PUT /api/reminders/settings
 * Update user's reminder settings
 */
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      enabled,
      send_to_host,
      send_to_guest,
      hours_before,
      custom_hours
    } = req.body;

    // Validate custom_hours
    if (custom_hours && (!Array.isArray(custom_hours) || custom_hours.some(h => typeof h !== 'number' || h < 0))) {
      return res.status(400).json({ error: 'Invalid custom_hours format' });
    }

    const result = await pool.query(`
      INSERT INTO reminder_settings (
        user_id, enabled, send_to_host, send_to_guest, hours_before, custom_hours, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        send_to_host = EXCLUDED.send_to_host,
        send_to_guest = EXCLUDED.send_to_guest,
        hours_before = EXCLUDED.hours_before,
        custom_hours = EXCLUDED.custom_hours,
        updated_at = NOW()
      RETURNING *
    `, [userId, enabled, send_to_host, send_to_guest, hours_before, custom_hours]);

    res.json({
      success: true,
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating reminder settings:', error);
    res.status(500).json({ error: 'Failed to update reminder settings' });
  }
});

/**
 * GET /api/reminders/history
 * Get history of sent reminders for user's bookings
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(`
      SELECT
        sr.*,
        b.guest_name,
        b.guest_email,
        b.start_time,
        b.status as booking_status
      FROM sent_reminders sr
      JOIN bookings b ON sr.booking_id = b.id
      WHERE b.user_id = $1
      ORDER BY sr.sent_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM sent_reminders sr
      JOIN bookings b ON sr.booking_id = b.id
      WHERE b.user_id = $1
    `, [userId]);

    res.json({
      reminders: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching reminder history:', error);
    res.status(500).json({ error: 'Failed to fetch reminder history' });
  }
});

module.exports = router;
