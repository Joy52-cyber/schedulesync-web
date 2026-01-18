/**
 * AI Analytics Service
 * Provides conversational analytics queries for the AI Assistant
 */

const pool = require('../config/database');
const { DateTime } = require('luxon');

/**
 * Parse time range from natural language
 * @param {string} timeRangeStr - e.g., "last month", "this year", "Q1"
 * @returns {object} - { start, end, label }
 */
function parseTimeRange(timeRangeStr) {
  const now = DateTime.now();
  const lowerStr = timeRangeStr.toLowerCase();

  // This week
  if (lowerStr.includes('this week')) {
    const start = now.startOf('week');
    const end = now.endOf('week');
    return { start: start.toJSDate(), end: end.toJSDate(), label: 'This Week' };
  }

  // Last week
  if (lowerStr.includes('last week')) {
    const start = now.minus({ weeks: 1 }).startOf('week');
    const end = now.minus({ weeks: 1 }).endOf('week');
    return { start: start.toJSDate(), end: end.toJSDate(), label: 'Last Week' };
  }

  // This month
  if (lowerStr.includes('this month')) {
    const start = now.startOf('month');
    const end = now.endOf('month');
    return { start: start.toJSDate(), end: end.toJSDate(), label: 'This Month' };
  }

  // Last month
  if (lowerStr.includes('last month')) {
    const start = now.minus({ months: 1 }).startOf('month');
    const end = now.minus({ months: 1 }).endOf('month');
    return { start: start.toJSDate(), end: end.toJSDate(), label: 'Last Month' };
  }

  // This year
  if (lowerStr.includes('this year')) {
    const start = now.startOf('year');
    const end = now.endOf('year');
    return { start: start.toJSDate(), end: end.toJSDate(), label: 'This Year' };
  }

  // Last year
  if (lowerStr.includes('last year')) {
    const start = now.minus({ years: 1 }).startOf('year');
    const end = now.minus({ years: 1 }).endOf('year');
    return { start: start.toJSDate(), end: end.toJSDate(), label: 'Last Year' };
  }

  // Default: last 30 days
  const start = now.minus({ days: 30 });
  return { start: start.toJSDate(), end: now.toJSDate(), label: 'Last 30 Days' };
}

/**
 * Get booking count for a time range
 * @param {number} userId - User ID
 * @param {string} timeRangeStr - Time range string
 * @returns {Promise<object>} - Count statistics
 */
async function getBookingCount(userId, timeRangeStr) {
  try {
    const { start, end, label } = parseTimeRange(timeRangeStr);

    const result = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'confirmed') as upcoming,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
       FROM bookings
       WHERE user_id = $1
         AND start_time >= $2
         AND start_time < $3`,
      [userId, start, end]
    );

    return {
      ...result.rows[0],
      timeRange: label,
      start,
      end
    };
  } catch (error) {
    console.error('Error getting booking count:', error);
    return { total: 0, completed: 0, upcoming: 0, cancelled: 0, timeRange: timeRangeStr };
  }
}

/**
 * Get average meeting duration
 * @param {number} userId - User ID
 * @param {string} timeRangeStr - Time range string
 * @returns {Promise<object>} - Average duration stats
 */
async function getAverageDuration(userId, timeRangeStr) {
  try {
    const { start, end, label } = parseTimeRange(timeRangeStr);

    const result = await pool.query(
      `SELECT
         ROUND(AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)) as avg_minutes,
         MIN(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) as min_minutes,
         MAX(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) as max_minutes
       FROM bookings
       WHERE user_id = $1
         AND start_time >= $2
         AND start_time < $3
         AND status != 'cancelled'`,
      [userId, start, end]
    );

    return {
      average: result.rows[0].avg_minutes || 0,
      min: result.rows[0].min_minutes || 0,
      max: result.rows[0].max_minutes || 0,
      timeRange: label
    };
  } catch (error) {
    console.error('Error getting average duration:', error);
    return { average: 0, min: 0, max: 0, timeRange: timeRangeStr };
  }
}

/**
 * Get top attendees
 * @param {number} userId - User ID
 * @param {string} timeRangeStr - Time range string
 * @param {number} limit - Max number of attendees
 * @returns {Promise<Array>} - Top attendees list
 */
async function getTopAttendees(userId, timeRangeStr, limit = 5) {
  try {
    const { start, end, label } = parseTimeRange(timeRangeStr);

    const result = await pool.query(
      `SELECT
         attendee_email,
         attendee_name,
         COUNT(*) as meeting_count
       FROM bookings
       WHERE user_id = $1
         AND start_time >= $2
         AND start_time < $3
         AND status != 'cancelled'
         AND attendee_email IS NOT NULL
       GROUP BY attendee_email, attendee_name
       ORDER BY meeting_count DESC
       LIMIT $4`,
      [userId, start, end, limit]
    );

    return {
      attendees: result.rows,
      timeRange: label
    };
  } catch (error) {
    console.error('Error getting top attendees:', error);
    return { attendees: [], timeRange: timeRangeStr };
  }
}

/**
 * Get busiest days of the week
 * @param {number} userId - User ID
 * @param {string} timeRangeStr - Time range string
 * @returns {Promise<object>} - Busiest days stats
 */
async function getBusiestDays(userId, timeRangeStr) {
  try {
    const { start, end, label } = parseTimeRange(timeRangeStr);

    const result = await pool.query(
      `SELECT
         EXTRACT(DOW FROM start_time) as day_of_week,
         COUNT(*) as meeting_count
       FROM bookings
       WHERE user_id = $1
         AND start_time >= $2
         AND start_time < $3
         AND status != 'cancelled'
       GROUP BY EXTRACT(DOW FROM start_time)
       ORDER BY meeting_count DESC`,
      [userId, start, end]
    );

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const days = result.rows.map(row => ({
      day: dayNames[row.day_of_week],
      count: parseInt(row.meeting_count)
    }));

    return {
      days,
      busiest: days[0]?.day || null,
      timeRange: label
    };
  } catch (error) {
    console.error('Error getting busiest days:', error);
    return { days: [], busiest: null, timeRange: timeRangeStr };
  }
}

/**
 * Get trends (compare current period with previous)
 * @param {number} userId - User ID
 * @param {string} timeRangeStr - Time range string
 * @returns {Promise<object>} - Trend data
 */
async function getTrends(userId, timeRangeStr) {
  try {
    const current = await getBookingCount(userId, timeRangeStr);

    // Get previous period for comparison
    let previousRange = 'last month';
    if (timeRangeStr.includes('week')) {
      previousRange = 'last week';
    } else if (timeRangeStr.includes('year')) {
      previousRange = 'last year';
    }

    const previous = await getBookingCount(userId, previousRange);

    const change = parseInt(current.total) - parseInt(previous.total);
    const percentChange = previous.total > 0
      ? ((change / previous.total) * 100).toFixed(1)
      : 0;

    return {
      current: {
        total: parseInt(current.total),
        completed: parseInt(current.completed),
        timeRange: current.timeRange
      },
      previous: {
        total: parseInt(previous.total),
        completed: parseInt(previous.completed),
        timeRange: previous.timeRange
      },
      change,
      percentChange,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
    };
  } catch (error) {
    console.error('Error getting trends:', error);
    return {
      current: { total: 0, completed: 0, timeRange: timeRangeStr },
      previous: { total: 0, completed: 0, timeRange: 'previous' },
      change: 0,
      percentChange: 0,
      trend: 'flat'
    };
  }
}

module.exports = {
  parseTimeRange,
  getBookingCount,
  getAverageDuration,
  getTopAttendees,
  getBusiestDays,
  getTrends
};
