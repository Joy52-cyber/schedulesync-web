const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.get('/stats', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const totalBookings = await client.query(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = $1',
      [userId]
    );
    const upcomingBookings = await client.query(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = $1 AND start_time > NOW()',
      [userId]
    );
    const activeTeams = await client.query(
      `SELECT COUNT(DISTINCT t.id) as count FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1 AND t.is_active = true`,
      [userId]
    );
    const recentBookings = await client.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    res.json({
      stats: {
        totalBookings: parseInt(totalBookings.rows[0].count),
        upcomingBookings: parseInt(upcomingBookings.rows[0].count),
        revenue: 0,
        activeTeams: parseInt(activeTeams.rows[0].count)
      },
      recentBookings: recentBookings.rows
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  } finally {
    client.release();
  }
});

module.exports = router;