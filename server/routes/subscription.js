const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/user/subscription
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT subscription_tier, subscription_status FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const user = result.rows[0] || {};
    res.json({
      plan: user.subscription_tier || 'free',
      status: user.subscription_status || 'active'
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.json({ plan: 'free', status: 'active' });
  }
});

// GET /api/user/limits
router.get('/limits', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const tier = result.rows[0]?.subscription_tier || 'free';
    
    const bookingResult = await pool.query(
      'SELECT COUNT(*) FROM bookings WHERE user_id = $1',
      [req.user.id]
    );
    const currentBookings = parseInt(bookingResult.rows[0].count) || 0;
    
    const limits = {
      free: { bookings: 50, ai_queries: 10 },
      pro: { bookings: 999999, ai_queries: 999999 },
      team: { bookings: 999999, ai_queries: 999999 }
    };
    
    const tierLimits = limits[tier] || limits.free;
    
    res.json({
      tier,
      current_bookings: currentBookings,
      limits: tierLimits,
      status: {
        withinLimit: currentBookings < tierLimits.bookings,
        upgrade_recommended: tier === 'free' && currentBookings > 40
      }
    });
  } catch (error) {
    console.error('Limits error:', error);
    res.json({
      tier: 'free',
      current_bookings: 0,
      limits: { bookings: 50, ai_queries: 10 },
      status: { withinLimit: true }
    });
  }
});

module.exports = router;
