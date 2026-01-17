const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { DateTime } = require('luxon');

/**
 * GET /api/conflicts/upcoming
 * Check for conflicts in the next 7 days
 */
router.get('/upcoming', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const now = new Date();
    const sevenDaysFromNow = DateTime.now().plus({ days: 7 }).toJSDate();

    // Get all upcoming bookings
    const bookingsResult = await client.query(
      `SELECT id, title, attendee_name, start_time, end_time
       FROM bookings
       WHERE user_id = $1
         AND status IN ('confirmed', 'pending_approval')
         AND start_time >= $2
         AND start_time < $3
       ORDER BY start_time`,
      [userId, now, sevenDaysFromNow]
    );

    const bookings = bookingsResult.rows;

    // Check for overlapping bookings
    const conflicts = [];
    for (let i = 0; i < bookings.length; i++) {
      for (let j = i + 1; j < bookings.length; j++) {
        const booking1 = bookings[i];
        const booking2 = bookings[j];

        const start1 = new Date(booking1.start_time);
        const end1 = new Date(booking1.end_time);
        const start2 = new Date(booking2.start_time);
        const end2 = new Date(booking2.end_time);

        // Check if they overlap
        if (start1 < end2 && end1 > start2) {
          conflicts.push({
            booking1: {
              id: booking1.id,
              title: booking1.title,
              attendee: booking1.attendee_name,
              startTime: booking1.start_time,
              endTime: booking1.end_time
            },
            booking2: {
              id: booking2.id,
              title: booking2.title,
              attendee: booking2.attendee_name,
              startTime: booking2.start_time,
              endTime: booking2.end_time
            },
            overlapStart: start1 > start2 ? start1 : start2,
            overlapEnd: end1 < end2 ? end1 : end2
          });
        }
      }
    }

    res.json({
      hasConflicts: conflicts.length > 0,
      count: conflicts.length,
      conflicts: conflicts.slice(0, 5) // Return first 5 conflicts
    });

  } catch (error) {
    console.error('Error checking upcoming conflicts:', error);
    res.status(500).json({ error: 'Failed to check conflicts' });
  } finally {
    client.release();
  }
});

module.exports = router;
