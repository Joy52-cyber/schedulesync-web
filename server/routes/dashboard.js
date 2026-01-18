const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getDashboardIntelligence } = require('../services/dashboardIntelligenceService');

router.get('/stats', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    
    // Get user's subscription tier
    const userResult = await client.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [userId]
    );
    const tier = userResult.rows[0]?.subscription_tier || 'free';
    
    // Total bookings (all time)
    const totalBookings = await client.query(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = $1',
      [userId]
    );
    
    // Upcoming bookings
    const upcomingBookings = await client.query(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = $1 AND start_time > NOW() AND status != $2',
      [userId, 'cancelled']
    );
    
    // Active Teams - EXCLUDE personal booking teams
    // Only count for Team tier users, and exclude teams the user owns (personal teams)
    let activeTeamsCount = 0;
    if (tier === 'team') {
      const activeTeams = await client.query(
        `SELECT COUNT(DISTINCT t.id) as count FROM teams t
         JOIN team_members tm ON t.id = tm.team_id
         WHERE tm.user_id = $1 
         AND tm.is_active = true
         AND t.owner_id != $1
         AND t.name NOT LIKE '%Personal%'`,
        [userId]
      );
      activeTeamsCount = parseInt(activeTeams.rows[0].count);
    }
    
    // Get user's personal booking link
    const personalTeam = await client.query(
      `SELECT team_booking_token FROM teams 
       WHERE owner_id = $1 AND name LIKE '%Personal%'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    
    const bookingToken = personalTeam.rows[0]?.team_booking_token || null;
    const bookingLink = bookingToken 
      ? `${process.env.APP_URL || 'https://schedulesync-web-production.up.railway.app'}/book/${bookingToken}`
      : null;
    
    // Recent bookings
    const recentBookings = await client.query(
      `SELECT * FROM bookings 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [userId]
    );
    
    res.json({
      stats: {
        totalBookings: parseInt(totalBookings.rows[0].count),
        upcomingBookings: parseInt(upcomingBookings.rows[0].count),
        revenue: 0,
        activeTeams: activeTeamsCount,
        tier: tier,
        bookingLink: bookingLink,
        bookingToken: bookingToken
      },
      recentBookings: recentBookings.rows
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  } finally {
    client.release();
  }
});

/**
 * GET /dashboard/intelligence
 * Get AI-powered dashboard intelligence (alerts, insights, recommendations)
 */
router.get('/intelligence', authenticateToken, async (req, res) => {
  try {
    const intelligence = await getDashboardIntelligence(req.user.id);
    res.json(intelligence);
  } catch (error) {
    console.error('Error fetching dashboard intelligence:', error);
    res.status(500).json({ error: 'Failed to fetch intelligence data' });
  }
});

module.exports = router;