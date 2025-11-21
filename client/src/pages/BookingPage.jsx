const express = require('express');
const router = express.Router();
const pool = require('../db');

// ============================================
// GET BOOKING PAGE INFO
// ============================================
router.get('/:bookingToken', async (req, res) => {
  try {
    const { bookingToken } = req.params;
    
    console.log('📋 Loading booking info for token:', bookingToken);

    // Get team info
    const teamResult = await pool.query(`
      SELECT 
        t.id,
        t.name,
        t.description,
        t.duration,
        t.booking_mode as mode,
        t.buffer_time,
        t.lead_time,
        t.booking_token
      FROM teams t
      WHERE t.booking_token = $1
    `, [bookingToken]);

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking page not found' });
    }

    const team = teamResult.rows[0];

    // Get active team members
    const membersResult = await pool.query(`
      SELECT 
        tm.id,
        tm.user_id,
        u.name,
        u.email,
        tm.booking_price,
        tm.currency,
        tm.payment_required,
        tm.external_booking_link,
        tm.external_booking_platform,
        tm.working_hours,
        tm.buffer_time,
        tm.lead_time_hours,
        tm.booking_horizon_days,
        tm.daily_booking_cap
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1 AND tm.is_active = true
      ORDER BY tm.priority ASC, u.name ASC
    `, [team.id]);

    // Return in the format the frontend expects
    res.json({
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          duration: team.duration,
          mode: team.mode,
          bufferTime: team.buffer_time,
          leadTime: team.lead_time
        },
        member: membersResult.rows.length > 0 ? {
          id: membersResult.rows[0].id,
          userId: membersResult.rows[0].user_id,
          name: membersResult.rows[0].name,
          email: membersResult.rows[0].email,
          bookingPrice: parseFloat(membersResult.rows[0].booking_price) || 0,
          currency: membersResult.rows[0].currency || 'USD',
          paymentRequired: membersResult.rows[0].payment_required || false,
          externalLink: membersResult.rows[0].external_booking_link,
          externalPlatform: membersResult.rows[0].external_booking_platform,
          workingHours: membersResult.rows[0].working_hours,
          bufferTime: membersResult.rows[0].buffer_time || 0,
          leadTimeHours: membersResult.rows[0].lead_time_hours || 0,
          horizonDays: membersResult.rows[0].booking_horizon_days || 30,
          dailyCap: membersResult.rows[0].daily_booking_cap
        } : null,
        members: membersResult.rows.map(m => ({
          id: m.id,
          userId: m.user_id,
          name: m.name,
          email: m.email
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error loading booking info:', error);
    res.status(500).json({ error: 'Failed to load booking information' });
  }
});

// ============================================
// GET PRICING INFO
// ============================================
router.get('/:bookingToken/pricing', async (req, res) => {
  try {
    const { bookingToken } = req.params;
    
    console.log('💰 Loading pricing for token:', bookingToken);

    const result = await pool.query(`
      SELECT 
        tm.id,
        tm.booking_price,
        tm.currency,
        tm.payment_required,
        u.name as member_name
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      JOIN users u ON tm.user_id = u.id
      WHERE t.booking_token = $1 AND tm.is_active = true
      ORDER BY tm.priority ASC
      LIMIT 1
    `, [bookingToken]);

    if (result.rows.length === 0) {
      // Return default pricing if no members
      return res.json({
        memberId: null,
        memberName: null,
        price: 0,
        currency: 'USD',
        paymentRequired: false
      });
    }

    const pricing = result.rows[0];

    res.json({
      memberId: pricing.id,
      memberName: pricing.member_name,
      price: parseFloat(pricing.booking_price) || 0,
      currency: pricing.currency || 'USD',
      paymentRequired: pricing.payment_required || false
    });

  } catch (error) {
    console.error('❌ Error loading pricing:', error);
    res.status(500).json({ error: 'Failed to load pricing information' });
  }
});

// ============================================
// GET AVAILABLE SLOTS
// ============================================
router.post('/:bookingToken/availability', async (req, res) => {
  try {
    const { bookingToken } = req.params;
    const { date, memberId, timezone } = req.body;

    console.log('📅 Getting availability:', { bookingToken, date, memberId, timezone });

    // Get team and member info
    const teamResult = await pool.query(`
      SELECT t.id, t.duration, t.booking_mode
      FROM teams t
      WHERE t.booking_token = $1
    `, [bookingToken]);

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];

    // Get member working hours
    const memberResult = await pool.query(`
      SELECT 
        working_hours,
        buffer_time,
        lead_time_hours,
        booking_horizon_days,
        daily_booking_cap
      FROM team_members
      WHERE id = $1 AND is_active = true
    `, [memberId]);

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = memberResult.rows[0];
    
    // TODO: Implement actual availability calculation with calendar integration
    // For now, return sample slots based on working hours
    const slots = [
      '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'
    ];

    res.json({
      date,
      timezone,
      slots,
      duration: team.duration
    });

  } catch (error) {
    console.error('❌ Error getting availability:', error);
    res.status(500).json({ error: 'Failed to get availability' });
  }
});

// ============================================
// CONFIRM BOOKING
// ============================================
router.post('/:bookingToken/confirm', async (req, res) => {
  try {
    const { bookingToken } = req.params;
    const { 
      memberId, 
      guestName, 
      guestEmail, 
      startTime, 
      endTime,
      timezone,
      notes 
    } = req.body;

    console.log('✅ Confirming booking:', { bookingToken, guestEmail, startTime });

    // Get team info
    const teamResult = await pool.query(`
      SELECT t.id, t.name, t.duration
      FROM teams t
      WHERE t.booking_token = $1
    `, [bookingToken]);

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];

    // Generate booking token
    const crypto = require('crypto');
    const newBookingToken = crypto.randomBytes(16).toString('hex');

    // Create booking
    const bookingResult = await pool.query(`
      INSERT INTO bookings (
        team_id,
        member_id,
        attendee_name,
        attendee_email,
        start_time,
        end_time,
        timezone,
        notes,
        status,
        booking_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9)
      RETURNING id, booking_token
    `, [
      team.id,
      memberId,
      guestName,
      guestEmail,
      startTime,
      endTime,
      timezone,
      notes,
      newBookingToken
    ]);

    const booking = bookingResult.rows[0];

    console.log('✅ Booking created:', booking.id);

    res.json({
      success: true,
      bookingId: booking.id,
      bookingToken: booking.booking_token,
      message: 'Booking confirmed successfully'
    });

  } catch (error) {
    console.error('❌ Error confirming booking:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

module.exports = router;