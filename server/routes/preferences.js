const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Analyze user preferences based on booking patterns
async function analyzeUserPreferences(userId) {
  try {
    // Get booking patterns
    const patterns = await pool.query(`
      SELECT
        EXTRACT(DOW FROM start_time) as day_of_week,
        EXTRACT(HOUR FROM start_time) as hour_of_day,
        COUNT(*) as booking_count
      FROM bookings
      WHERE user_id = $1 AND status = 'confirmed'
      GROUP BY day_of_week, hour_of_day
      ORDER BY booking_count DESC
    `, [userId]);

    // Store patterns
    for (const pattern of patterns.rows) {
     await pool.query(`
  INSERT INTO booking_patterns (user_id, day_of_week, hour_of_day, booking_count)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT ON CONSTRAINT booking_patterns_user_day_hour_unique
  DO UPDATE SET booking_count = booking_patterns.booking_count + 1, updated_at = NOW()
`, [userId, pattern.day_of_week, pattern.hour_of_day, pattern.booking_count]); 
    }

    return patterns.rows;
  } catch (error) {
    console.error('Analyze preferences error:', error);
    return [];
  }
}

// Detect booking conflicts
async function detectConflicts(userId) {
  try {
    const result = await pool.query(`
      SELECT
        b1.id as booking1_id,
        b2.id as booking2_id,
        b1.start_time as start1,
        b2.start_time as start2
      FROM bookings b1
      JOIN bookings b2 ON b1.user_id = b2.user_id
        AND b1.id < b2.id
        AND b1.start_time < b2.end_time
        AND b2.start_time < b1.end_time
      WHERE b1.user_id = $1
        AND b1.status = 'confirmed'
        AND b2.status = 'confirmed'
    `, [userId]);

    return result.rows;
  } catch (error) {
    console.error('Detect conflicts error:', error);
    return [];
  }
}

// Create reschedule suggestion
async function createRescheduleSuggestion(bookingId, userId, reason) {
  try {
    // Get booking details
    const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
    if (booking.rows.length === 0) return null;

    const b = booking.rows[0];
    const duration = b.duration || 30;

    // Find alternative time slots (simple: suggest same day, different hour)
    const alternativeTimes = [];
    const startDate = new Date(b.start_time);

    for (let hourOffset = 1; hourOffset <= 3; hourOffset++) {
      const altTime = new Date(startDate);
      altTime.setHours(altTime.getHours() + hourOffset);
      alternativeTimes.push(altTime.toISOString());
    }

    // Create suggestion
    const result = await pool.query(`
      INSERT INTO reschedule_suggestions (booking_id, user_id, reason, alternative_times, expires_at)
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
      RETURNING *
    `, [bookingId, userId, reason, JSON.stringify(alternativeTimes)]);

    return result.rows[0];
  } catch (error) {
    console.error('Create suggestion error:', error);
    return null;
  }
}

// GET /api/preferences - Get learned preferences
router.get('/', authenticateToken, async (req, res) => {
  try {
    // First, analyze/update preferences
    await analyzeUserPreferences(req.user.id);

    // Then fetch the latest
    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );

    // Get pattern count for stats
    const patternCount = await pool.query(
      'SELECT COUNT(*) as count, SUM(booking_count) as total FROM booking_patterns WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      preferences: result.rows[0] || null,
      stats: {
        patterns_tracked: parseInt(patternCount.rows[0]?.count || 0),
        total_bookings_analyzed: parseInt(patternCount.rows[0]?.total || 0)
      }
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// GET /api/reschedule-suggestions - Get pending suggestions
router.get('/reschedule-suggestions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rs.*, b.title, b.attendee_name, b.attendee_email
      FROM reschedule_suggestions rs
      JOIN bookings b ON rs.booking_id = b.id
      WHERE rs.user_id = $1
        AND rs.status = 'pending'
        AND rs.expires_at > NOW()
      ORDER BY rs.created_at DESC
    `, [req.user.id]);

    res.json({ suggestions: result.rows });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// POST /api/reschedule-suggestions/:id/accept - Accept suggestion
router.post('/reschedule-suggestions/:id/accept', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { selected_time } = req.body; // ISO string of chosen slot

    // Get the suggestion
    const suggestion = await pool.query(
      'SELECT * FROM reschedule_suggestions WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (suggestion.rows.length === 0) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    const s = suggestion.rows[0];
    const newStart = new Date(selected_time);
    const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [s.booking_id]);
    const b = booking.rows[0];
    const duration = b.duration || 30;
    const newEnd = new Date(newStart);
    newEnd.setMinutes(newEnd.getMinutes() + duration);

    // Update the booking
    await pool.query(`
      UPDATE bookings
      SET start_time = $1, end_time = $2, updated_at = NOW()
      WHERE id = $3
    `, [newStart, newEnd, s.booking_id]);

    // Mark suggestion as accepted
    await pool.query(
      'UPDATE reschedule_suggestions SET status = $1 WHERE id = $2',
      ['accepted', id]
    );

    console.log(`Reschedule accepted: booking ${s.booking_id} moved to ${newStart}`);

    res.json({ success: true, new_time: newStart });
  } catch (error) {
    console.error('Accept suggestion error:', error);
    res.status(500).json({ error: 'Failed to accept suggestion' });
  }
});

// POST /api/reschedule-suggestions/:id/decline - Decline suggestion
router.post('/reschedule-suggestions/:id/decline', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      'UPDATE reschedule_suggestions SET status = $1 WHERE id = $2 AND user_id = $3',
      ['declined', id, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Decline suggestion error:', error);
    res.status(500).json({ error: 'Failed to decline suggestion' });
  }
});

// POST /api/check-conflicts - Check for booking conflicts
router.post('/check-conflicts', authenticateToken, async (req, res) => {
  try {
    const conflicts = await detectConflicts(req.user.id);

    // Create suggestions for each conflict
    const suggestions = [];
    for (const conflict of conflicts) {
      // Suggest rescheduling the later booking
      const suggestion = await createRescheduleSuggestion(
        conflict.booking2_id,
        req.user.id,
        'conflict'
      );
      if (suggestion) suggestions.push(suggestion);
    }

    res.json({
      conflicts_found: conflicts.length,
      suggestions_created: suggestions.length,
      conflicts,
      suggestions
    });
  } catch (error) {
    console.error('Check conflicts error:', error);
    res.status(500).json({ error: 'Failed to check conflicts' });
  }
});

module.exports = router;
