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

// GET /api/user/profile - Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, username, timezone, bio, profile_photo FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/user/profile - Update user profile (name, username, bio, timezone, etc.)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, username, bio, timezone, availability, inbox_assistant_enabled, has_completed_onboarding } = req.body;
    const updates = [];
    const values = [req.user.id];
    let paramIndex = 2;

    if (name !== undefined && name.trim()) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (username !== undefined) {
      // Validate username format
      const usernameClean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (usernameClean.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }

      // Check if username is taken by another user
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2',
        [usernameClean, req.user.id]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      updates.push(`username = $${paramIndex++}`);
      values.push(usernameClean);
    }

    if (bio !== undefined) {
      // Limit bio to 500 characters
      const bioClean = bio.trim().slice(0, 500);
      updates.push(`bio = $${paramIndex++}`);
      values.push(bioClean);
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(timezone);
    }

    // Handle onboarding_completed (database column name) from has_completed_onboarding (frontend key)
    if (has_completed_onboarding !== undefined) {
      updates.push(`onboarding_completed = $${paramIndex++}`);
      values.push(has_completed_onboarding);
    }

    // Log received availability and inbox settings for debugging (stored separately)
    if (availability !== undefined) {
      console.log(`Onboarding availability for user ${req.user.id}:`, availability);
      // Note: Availability is stored in availability_rules table, not users table
      // This can be implemented later to create default availability rules
    }

    if (inbox_assistant_enabled !== undefined) {
      console.log(`Inbox assistant setting for user ${req.user.id}:`, inbox_assistant_enabled);
      // Note: This feature flag can be added as a column later if needed
    }

    if (updates.length === 0) {
      // If only availability or inbox_assistant_enabled were provided, return success anyway
      if (availability !== undefined || inbox_assistant_enabled !== undefined) {
        const result = await pool.query(
          'SELECT id, name, email, username, timezone, bio, profile_photo, onboarding_completed FROM users WHERE id = $1',
          [req.user.id]
        );
        return res.json({ success: true, user: result.rows[0] });
      }
      return res.status(400).json({ error: 'No updates provided' });
    }

    await pool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`,
      values
    );

    // Return updated profile
    const result = await pool.query(
      'SELECT id, name, email, username, timezone, bio, profile_photo, onboarding_completed FROM users WHERE id = $1',
      [req.user.id]
    );

    console.log(`Profile updated for user ${req.user.id}:`, { name, username, timezone, onboarding_completed: has_completed_onboarding });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
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

// GET /api/user/usage - Get user's current AI usage
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [req.user.id]
    );

    const tier = user.rows[0]?.subscription_tier || 'free';

    const planLimits = {
      free: { ai_queries: 10 },
      starter: { ai_queries: 50 },
      pro: { ai_queries: 250 },
      team: { ai_queries: 750 },
      enterprise: { ai_queries: Infinity }
    };

    // Get current month's AI usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = await pool.query(`
      SELECT COUNT(*) as ai_used
      FROM ai_queries
      WHERE user_id = $1 AND created_at >= $2
    `, [req.user.id, startOfMonth]);

    const aiUsed = parseInt(usage.rows[0]?.ai_used) || 0;
    const aiLimit = planLimits[tier]?.ai_queries || 10;

    res.json({
      ai_queries_used: aiUsed,
      ai_queries_limit: aiLimit === Infinity ? -1 : aiLimit,
      tier
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

// GET /api/user/limits - Get user's plan limits and usage
router.get('/limits', authenticateToken, async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [req.user.id]
    );

    const tier = user.rows[0]?.subscription_tier || 'free';

    const planLimits = {
      free: { ai_queries: 10, bookings: 50, event_types: 2, quick_links: 3 },
      starter: { ai_queries: 50, bookings: 200, event_types: 5, quick_links: 10 },
      pro: { ai_queries: 250, bookings: Infinity, event_types: Infinity, quick_links: Infinity },
      team: { ai_queries: 750, bookings: Infinity, event_types: Infinity, quick_links: Infinity },
      enterprise: { ai_queries: Infinity, bookings: Infinity, event_types: Infinity, quick_links: Infinity }
    };

    // Get current usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM ai_queries WHERE user_id = $1 AND created_at >= $2) as ai_used,
        (SELECT COUNT(*) FROM bookings WHERE user_id = $1 AND created_at >= $2) as bookings_used,
        (SELECT COUNT(*) FROM event_types WHERE user_id = $1) as event_types_count,
        (SELECT COUNT(*) FROM quick_links WHERE user_id = $1 AND created_at >= $2) as quick_links_used
    `, [req.user.id, startOfMonth]);

    const u = usage.rows[0] || {};
    const limits = planLimits[tier] || planLimits.free;

    res.json({
      tier,
      limits,
      usage: {
        ai_queries: parseInt(u.ai_used) || 0,
        bookings: parseInt(u.bookings_used) || 0,
        event_types: parseInt(u.event_types_count) || 0,
        quick_links: parseInt(u.quick_links_used) || 0
      }
    });
  } catch (error) {
    console.error('Get limits error:', error);
    res.status(500).json({ error: 'Failed to get limits' });
  }
});

// GET /api/user/jwt-token - Get current JWT token
router.get('/jwt-token', authenticateToken, async (req, res) => {
  try {
    // Return the token from the request header (it's already valid since authenticateToken passed)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    res.json({ token });
  } catch (error) {
    console.error('Get JWT token error:', error);
    res.status(500).json({ error: 'Failed to get token' });
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

// ============ EMAIL BOT SETTINGS ============

// GET /api/settings/email-bot - Get email bot settings
router.get('/email-bot', authenticateToken, async (req, res) => {
  try {
    let result = await pool.query(
      'SELECT * FROM email_bot_settings WHERE user_id = $1',
      [req.user.id]
    );

    // Create default settings if none exist
    if (result.rows.length === 0) {
      result = await pool.query(`
        INSERT INTO email_bot_settings (user_id)
        VALUES ($1)
        RETURNING *
      `, [req.user.id]);
    }

    const settings = result.rows[0];

    // Get the bot email address
    const botEmail = process.env.BOT_EMAIL || 'schedule@trucal.xyz';

    res.json({
      success: true,
      settings: {
        ...settings,
        bot_email: botEmail
      }
    });
  } catch (error) {
    console.error('Get email bot settings error:', error);
    res.status(500).json({ error: 'Failed to fetch email bot settings' });
  }
});

// PUT /api/settings/email-bot - Update email bot settings
router.put('/email-bot', authenticateToken, async (req, res) => {
  try {
    const {
      is_enabled,
      default_duration,
      default_event_type_id,
      intro_message,
      signature,
      max_slots_to_show,
      prefer_time_of_day
    } = req.body;

    const allowedFields = [
      'is_enabled', 'default_duration', 'default_event_type_id',
      'intro_message', 'signature', 'max_slots_to_show', 'prefer_time_of_day'
    ];

    const updates = [];
    const values = [req.user.id];
    let paramCount = 2;

    const fieldValues = {
      is_enabled, default_duration, default_event_type_id,
      intro_message, signature, max_slots_to_show, prefer_time_of_day
    };

    for (const [key, value] of Object.entries(fieldValues)) {
      if (value !== undefined && allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = NOW()');

    // Upsert settings
    await pool.query(`
      INSERT INTO email_bot_settings (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `, [req.user.id]);

    const result = await pool.query(`
      UPDATE email_bot_settings
      SET ${updates.join(', ')}
      WHERE user_id = $1
      RETURNING *
    `, values);

    res.json({
      success: true,
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Update email bot settings error:', error);
    res.status(500).json({ error: 'Failed to update email bot settings' });
  }
});

// GET /api/settings/email-bot/threads - Get email bot threads
router.get('/email-bot/threads', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.*,
        b.title as booking_title,
        b.start_time as booking_start_time
      FROM email_bot_threads t
      LEFT JOIN bookings b ON b.id = t.booking_id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT 50
    `, [req.user.id]);

    res.json({
      success: true,
      threads: result.rows
    });
  } catch (error) {
    console.error('Get email bot threads error:', error);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

module.exports = router;
