const express = require('express');
const router = express.Router();
const pool = require('../db');

// ============================================
// GET BOOKING PAGE INFO BY TOKEN
// ============================================
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('📋 Loading booking info for token:', token);
    
    const result = await pool.query(
      `SELECT tm.*, t.name as team_name, t.description as team_description, 
       u.name as member_name, u.email as member_email
       FROM team_members tm 
       JOIN teams t ON tm.team_id = t.id 
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking link not found' });
    }

    const member = result.rows[0];
    
    res.json({
      success: true,
      data: {
        team: { 
          id: member.team_id, 
          name: member.team_name, 
          description: member.team_description 
        },
        member: { 
          name: member.name || member.member_name || member.email, 
          email: member.email || member.member_email, 
          external_booking_link: member.external_booking_link, 
          external_booking_platform: member.external_booking_platform 
        }
      }
    });
  } catch (error) {
    console.error('❌ Error loading booking info:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

// ============================================
// GET PRICING INFO
// ============================================
router.get('/:token/pricing', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('💰 Loading pricing for token:', token);

    const memberResult = await pool.query(
      `SELECT tm.booking_price, tm.currency, tm.payment_required, tm.name,
              t.name as team_name
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.booking_token = $1`,
      [token]
    );

    if (memberResult.rows.length === 0) {
      return res.json({ 
        price: 0,
        currency: 'USD',
        paymentRequired: false
      });
    }

    const member = memberResult.rows[0];

    res.json({
      price: parseFloat(member.booking_price) || 0,
      currency: member.currency || 'USD',
      paymentRequired: !!member.payment_required,
      memberName: member.name,
      teamName: member.team_name,
    });
  } catch (error) {
    console.error('❌ Error loading pricing:', error);
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

module.exports = router;