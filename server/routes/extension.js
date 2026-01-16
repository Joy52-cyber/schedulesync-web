/**
 * Chrome Extension API Routes
 * Handles requests from the TruCal Chrome Extension
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { DateTime } = require('luxon');

/**
 * GET /api/extension/slots
 * Get available time slots for the authenticated user
 */
router.get('/slots', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const duration = parseInt(req.query.duration) || 30;
    const count = parseInt(req.query.count) || 5;

    console.log(`📅 Extension: Fetching ${count} slots (${duration}min) for user ${userId}`);

    // Get user info
    const userResult = await pool.query(
      'SELECT username, timezone, email, name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const userTimezone = user.timezone || 'America/New_York';

    if (!user.username) {
      return res.status(400).json({
        error: 'Please complete your onboarding first',
        message: 'Go to TruCal settings to set up your username and availability'
      });
    }

    // Get available slots
    const slots = await getAvailableSlots(userId, duration, count, userTimezone);

    // Generate booking URLs for each slot
    const slotsWithUrls = slots.map(slot => {
      const bookUrl = `https://www.trucal.xyz/quick-book?user=${user.username}&time=${encodeURIComponent(slot.start)}`;

      return {
        start: slot.start,
        end: slot.end,
        label: slot.label,
        bookUrl: bookUrl
      };
    });

    res.json({
      success: true,
      slots: slotsWithUrls,
      user: {
        name: user.name,
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('❌ Extension slots error:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

/**
 * Get available time slots for user
 */
async function getAvailableSlots(userId, duration, maxSlots = 5, userTimezone) {
  const slots = [];
  const nowInUserTz = DateTime.now().setZone(userTimezone);

  // Look at next 14 days
  for (let day = 0; day < 14 && slots.length < maxSlots; day++) {
    const dateInUserTz = nowInUserTz.plus({ days: day }).startOf('day');

    // Skip weekends
    if (dateInUserTz.weekday === 6 || dateInUserTz.weekday === 7) continue;

    // Get existing bookings for this day
    const dayStart = dateInUserTz.toUTC().toJSDate();
    const dayEnd = dateInUserTz.plus({ days: 1 }).toUTC().toJSDate();

    const bookings = await pool.query(`
      SELECT start_time, end_time FROM bookings
      WHERE user_id = $1 AND status = 'confirmed'
        AND start_time >= $2 AND start_time < $3
    `, [userId, dayStart, dayEnd]);

    const bookedSlots = bookings.rows;

    // Generate slots (9 AM to 5 PM)
    const startHour = 9;
    const endHour = 17;

    for (let hour = startHour; hour < endHour && slots.length < maxSlots; hour++) {
      const slotStart = dateInUserTz.set({ hour, minute: 0, second: 0, millisecond: 0 });
      const slotEnd = slotStart.plus({ minutes: duration });

      // Skip if in the past
      if (slotStart <= nowInUserTz) continue;

      // Convert to UTC for conflict checking
      const slotStartUTC = slotStart.toUTC().toJSDate();
      const slotEndUTC = slotEnd.toUTC().toJSDate();

      // Check for conflicts
      const hasConflict = bookedSlots.some(b => {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        return slotStartUTC < bEnd && slotEndUTC > bStart;
      });

      if (!hasConflict) {
        // Generate label
        const label = formatSlotLabel(slotStart, nowInUserTz);

        slots.push({
          start: slotStart.toUTC().toISO(),
          end: slotEnd.toUTC().toISO(),
          label: label
        });
      }
    }
  }

  return slots;
}

/**
 * Format slot label for display
 */
function formatSlotLabel(slotDateTime, nowDateTime) {
  const slotDay = slotDateTime.startOf('day');
  const nowDay = nowDateTime.startOf('day');
  const daysDiff = Math.floor(slotDay.diff(nowDay, 'days').days);

  let dayLabel;
  if (daysDiff === 0) {
    dayLabel = 'Today';
  } else if (daysDiff === 1) {
    dayLabel = 'Tomorrow';
  } else if (daysDiff < 7) {
    dayLabel = slotDateTime.toFormat('EEEE'); // Monday, Tuesday, etc.
  } else {
    dayLabel = slotDateTime.toFormat('EEE, MMM d'); // Mon, Jan 20
  }

  const timeLabel = slotDateTime.toFormat('h:mm a'); // 2:00 PM

  return `${dayLabel} at ${timeLabel}`;
}

module.exports = router;
