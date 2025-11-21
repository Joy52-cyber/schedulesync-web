const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Use existing auth middleware
const { authenticateToken } = require('../middleware/auth');

// GET /api/my-booking-link
router.get('/my-booking-link', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    console.log('📋 Fetching booking link for user:', userId);
    
    const userResult = await client.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    const username = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const teamsResult = await client.query(
      `SELECT t.* FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1 AND t.is_active = true
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [userId]
    );
    
    let bookingToken = username;
    if (teamsResult.rows.length > 0) {
      const team = teamsResult.rows[0];
      bookingToken = team.slug || team.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app';
    const bookingUrl = `${frontendUrl}/book/${bookingToken}`;
    
    console.log('✅ Booking link generated:', bookingUrl);
    
    res.json({
      bookingUrl,
      bookingToken,
      hasAvailability: true
    });
    
  } catch (error) {
    console.error('❌ Error in GET /my-booking-link:', error);
    res.status(500).json({ 
      error: 'Failed to generate booking link',
      message: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;