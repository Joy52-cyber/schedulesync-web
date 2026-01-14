const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/analytics - Get booking analytics
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const prevStartDate = new Date();
    prevStartDate.setDate(prevStartDate.getDate() - (days * 2));

    // Total bookings in current period
    const totalBookings = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND created_at >= $2
    `, [userId, startDate]);

    // Previous period for comparison
    const prevBookings = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
    `, [userId, prevStartDate, startDate]);

    // Completed/confirmed bookings
    const completedBookings = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND status = 'confirmed' AND created_at >= $2
    `, [userId, startDate]);

    // Previous completed for comparison
    const prevCompleted = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND status = 'confirmed' AND created_at >= $2 AND created_at < $3
    `, [userId, prevStartDate, startDate]);

    // Cancelled bookings
    const cancelledBookings = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND status = 'cancelled' AND created_at >= $2
    `, [userId, startDate]);

    // Previous cancelled
    const prevCancelled = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND status = 'cancelled' AND created_at >= $2 AND created_at < $3
    `, [userId, prevStartDate, startDate]);

    // Unique guests
    const uniqueGuests = await pool.query(`
      SELECT COUNT(DISTINCT attendee_email) as count
      FROM bookings
      WHERE user_id = $1 AND created_at >= $2
    `, [userId, startDate]);

    // Previous unique guests
    const prevGuests = await pool.query(`
      SELECT COUNT(DISTINCT attendee_email) as count
      FROM bookings
      WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
    `, [userId, prevStartDate, startDate]);

    // Bookings by day
    const bookingsByDay = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND created_at >= $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [userId, startDate]);

    // Bookings by hour of day (when meetings are scheduled)
    const bookingsByHour = await pool.query(`
      SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND created_at >= $2
      GROUP BY EXTRACT(HOUR FROM start_time)
    `, [userId, startDate]);

    // Bookings by day of week
    const bookingsByDayOfWeek = await pool.query(`
      SELECT EXTRACT(DOW FROM start_time) as day, COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND created_at >= $2
      GROUP BY EXTRACT(DOW FROM start_time)
    `, [userId, startDate]);

    // Top event types
    const topEventTypes = await pool.query(`
      SELECT
        COALESCE(et.name, 'Default Meeting') as name,
        COUNT(*) as count
      FROM bookings b
      LEFT JOIN event_types et ON b.event_type_id = et.id
      WHERE b.user_id = $1 AND b.created_at >= $2
      GROUP BY et.name
      ORDER BY count DESC
      LIMIT 5
    `, [userId, startDate]);

    // Recent bookings
    const recentBookings = await pool.query(`
      SELECT attendee_name, attendee_email, status, created_at
      FROM bookings
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId]);

    // Calculate percentage changes
    const current = parseInt(totalBookings.rows[0]?.count) || 0;
    const previous = parseInt(prevBookings.rows[0]?.count) || 0;
    const bookingsChange = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

    const currentCompleted = parseInt(completedBookings.rows[0]?.count) || 0;
    const previousCompleted = parseInt(prevCompleted.rows[0]?.count) || 0;
    const completedChange = previousCompleted > 0 ? Math.round(((currentCompleted - previousCompleted) / previousCompleted) * 100) : 0;

    const currentCancelled = parseInt(cancelledBookings.rows[0]?.count) || 0;
    const previousCancelled = parseInt(prevCancelled.rows[0]?.count) || 0;
    const cancelledChange = previousCancelled > 0 ? Math.round(((currentCancelled - previousCancelled) / previousCancelled) * 100) : 0;

    const currentGuests = parseInt(uniqueGuests.rows[0]?.count) || 0;
    const previousGuests = parseInt(prevGuests.rows[0]?.count) || 0;
    const guestsChange = previousGuests > 0 ? Math.round(((currentGuests - previousGuests) / previousGuests) * 100) : 0;

    // Format hour data (24 hours array)
    const hourData = Array(24).fill(0);
    bookingsByHour.rows.forEach(row => {
      hourData[parseInt(row.hour)] = parseInt(row.count);
    });

    // Format day of week data (7 days array, 0=Sunday)
    const dayOfWeekData = Array(7).fill(0);
    bookingsByDayOfWeek.rows.forEach(row => {
      dayOfWeekData[parseInt(row.day)] = parseInt(row.count);
    });

    // Format top event types with percentage
    const totalForPercentage = topEventTypes.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const formattedEventTypes = topEventTypes.rows.map(r => ({
      name: r.name || 'Default Meeting',
      count: parseInt(r.count),
      percentage: totalForPercentage > 0 ? Math.round((parseInt(r.count) / totalForPercentage) * 100) : 0
    }));

    res.json({
      totalBookings: current,
      completedBookings: currentCompleted,
      cancelledBookings: currentCancelled,
      uniqueGuests: currentGuests,
      bookingsChange,
      completedChange,
      cancelledChange,
      guestsChange,
      bookingsByDay: bookingsByDay.rows.map(r => ({
        date: r.date,
        count: parseInt(r.count)
      })),
      bookingsByHour: hourData,
      bookingsByDayOfWeek: dayOfWeekData,
      topEventTypes: formattedEventTypes,
      recentBookings: recentBookings.rows
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
