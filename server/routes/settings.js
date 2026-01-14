const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/user/timezone - Get user timezone
router.get('/timezone', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT timezone FROM users WHERE id = $1', [req.user.id]);
    res.json({ timezone: result.rows[0]?.timezone || 'America/New_York' });
  } catch (error) {
    console.error('Get timezone error:', error);
    res.status(500).json({ error: 'Failed to fetch timezone' });
  }
});

// PUT /api/user/timezone - Update user timezone
router.put('/timezone', authenticateToken, async (req, res) => {
  try {
    const { timezone } = req.body;
    await pool.query('UPDATE users SET timezone = $1 WHERE id = $2', [timezone, req.user.id]);
    await pool.query('UPDATE team_members SET timezone = $1 WHERE user_id = $2', [timezone, req.user.id]);
    res.json({ success: true, timezone });
  } catch (error) {
    console.error('Update timezone error:', error);
    res.status(500).json({ error: 'Failed to update timezone' });
  }
});

// GET /api/settings/email-preferences - Get email preferences
router.get('/email-preferences', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT email_preferences FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return preferences or defaults
    const preferences = result.rows[0].email_preferences || {
      send_confirmations: true,
      send_reminders: true,
      send_cancellations: true,
      send_reschedule: true,
      reminder_hours: 24
    };

    res.json(preferences);
  } catch (error) {
    console.error('Get email preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch email preferences' });
  }
});

// PUT /api/settings/email-preferences - Update email preferences
router.put('/email-preferences', authenticateToken, async (req, res) => {
  try {
    const { send_confirmations, send_reminders, send_cancellations, send_reschedule, reminder_hours } = req.body;

    // Validate reminder_hours
    const validReminderHours = [1, 2, 24, 48];
    const sanitizedReminderHours = validReminderHours.includes(reminder_hours) ? reminder_hours : 24;

    const preferences = {
      send_confirmations: send_confirmations !== false,
      send_reminders: send_reminders !== false,
      send_cancellations: send_cancellations !== false,
      send_reschedule: send_reschedule !== false,
      reminder_hours: sanitizedReminderHours
    };

    await pool.query(
      'UPDATE users SET email_preferences = $1 WHERE id = $2',
      [JSON.stringify(preferences), req.user.id]
    );

    console.log(`Email preferences updated for user ${req.user.id}:`, preferences);
    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Update email preferences error:', error);
    res.status(500).json({ error: 'Failed to update email preferences' });
  }
});

// GET /api/autonomous-settings - Get autonomous mode settings
router.get('/autonomous', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT autonomous_mode, auto_confirm_rules FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({
      mode: result.rows[0]?.autonomous_mode || 'manual',
      rules: result.rows[0]?.auto_confirm_rules || {}
    });
  } catch (error) {
    console.error('Get autonomous settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PUT /api/autonomous-settings - Update autonomous mode settings
router.put('/autonomous', authenticateToken, async (req, res) => {
  try {
    const { mode, rules } = req.body;

    // Validate mode
    if (mode && !['manual', 'suggest', 'auto'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Use: manual, suggest, or auto' });
    }

    const updates = [];
    const values = [req.user.id];
    let paramIndex = 2;

    if (mode !== undefined) {
      updates.push(`autonomous_mode = $${paramIndex++}`);
      values.push(mode);
    }
    if (rules !== undefined) {
      updates.push(`auto_confirm_rules = $${paramIndex++}`);
      values.push(JSON.stringify(rules));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await pool.query(`
      UPDATE users SET ${updates.join(', ')} WHERE id = $1
    `, values);

    console.log(`Updated autonomous settings for user ${req.user.id}: mode=${mode}`);
    res.json({ success: true, mode, rules });
  } catch (error) {
    console.error('Update autonomous settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
