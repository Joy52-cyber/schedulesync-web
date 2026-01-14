const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/admin/users - List all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('Admin fetching user list...');
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.provider,
        u.created_at,
        u.subscription_tier,
        u.is_admin,
        (SELECT COUNT(*) FROM teams WHERE owner_id = u.id) as team_count,
        (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) as booking_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);

    // Safety: Prevent deleting yourself
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    console.log(`ADMIN ACTION: User ${req.user.email} is deleting user ID ${targetId}`);

    // Perform delete
    // Note: Because your initDB uses "ON DELETE CASCADE", this will automatically
    // remove their teams, bookings, and membership records.
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [targetId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`User ${result.rows[0].email} deleted successfully.`);
    res.json({
      success: true,
      message: `User ${result.rows[0].email} and all associated data have been deleted.`
    });

  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PATCH /api/admin/users/:id - Update user (tier, admin status)
router.patch('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { subscription_tier, is_admin } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (subscription_tier !== undefined) {
      updates.push(`subscription_tier = $${paramIndex++}`);
      values.push(subscription_tier);
    }

    if (is_admin !== undefined) {
      // Safety: Prevent removing your own admin status
      if (targetId === req.user.id && !is_admin) {
        return res.status(400).json({ error: 'You cannot remove your own admin status.' });
      }
      updates.push(`is_admin = $${paramIndex++}`);
      values.push(is_admin);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(targetId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING id, email, subscription_tier, is_admin`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`Admin updated user ${targetId}:`, result.rows[0]);
    res.json({ success: true, user: result.rows[0] });

  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/stats - Get admin dashboard stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [usersResult, bookingsResult, teamsResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users'),
      pool.query('SELECT COUNT(*) as total FROM bookings'),
      pool.query('SELECT COUNT(*) as total FROM teams')
    ]);

    res.json({
      total_users: parseInt(usersResult.rows[0].total),
      total_bookings: parseInt(bookingsResult.rows[0].total),
      total_teams: parseInt(teamsResult.rows[0].total)
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/migrate-event-types - Migration helper
router.get('/migrate-event-types', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('Seeding default event types...');

    // Get all users
    const users = await pool.query('SELECT id FROM users');

    for (const user of users.rows) {
      // Check if they already have events
      const check = await pool.query('SELECT id FROM event_types WHERE user_id = $1', [user.id]);

      if (check.rows.length === 0) {
        await pool.query(`
          INSERT INTO event_types (user_id, title, slug, duration, description, color)
          VALUES ($1, '30 Min Meeting', '30min', 30, 'A standard 30 minute meeting.', 'blue')
        `, [user.id]);
      }
    }

    res.json({ success: true, message: "Default event types created for all users." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
