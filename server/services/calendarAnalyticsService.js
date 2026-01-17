const pool = require('../config/database');
const { DateTime } = require('luxon');

/**
 * Get comprehensive calendar analytics for a user
 * @param {number} userId - User ID
 * @param {string} timeRange - Time range: '7d', '30d', '90d', 'all'
 * @returns {Promise<object>} - Analytics data
 */
async function getCalendarAnalytics(userId, timeRange = '30d') {
  try {
    const startDate = getStartDateFromRange(timeRange);

    console.log(`📈 Generating calendar analytics for user ${userId} (${timeRange})`);

    // 1. Basic Totals
    const totalsResult = await pool.query(`
      SELECT
        COUNT(*) as total_meetings,
        SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours,
        AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) as avg_duration_minutes,
        COUNT(DISTINCT attendee_email) as unique_attendees,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM bookings
      WHERE user_id = $1 AND start_time >= $2
    `, [userId, startDate]);

    const totals = totalsResult.rows[0];

    // 2. By Day of Week
    const byDayResult = await pool.query(`
      SELECT
        EXTRACT(DOW FROM start_time) as day_of_week,
        TO_CHAR(start_time, 'Day') as day_name,
        COUNT(*) as meeting_count,
        SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
      FROM bookings
      WHERE user_id = $1 AND start_time >= $2
      GROUP BY EXTRACT(DOW FROM start_time), TO_CHAR(start_time, 'Day')
      ORDER BY EXTRACT(DOW FROM start_time)
    `, [userId, startDate]);

    const byDayOfWeek = byDayResult.rows.map(row => ({
      dayOfWeek: parseInt(row.day_of_week),
      dayName: row.day_name.trim(),
      meetingCount: parseInt(row.meeting_count),
      totalHours: parseFloat(row.total_hours || 0)
    }));

    // 3. By Hour of Day
    const byHourResult = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM start_time) as hour_of_day,
        COUNT(*) as meeting_count
      FROM bookings
      WHERE user_id = $1 AND start_time >= $2
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY EXTRACT(HOUR FROM start_time)
    `, [userId, startDate]);

    const byHour = byHourResult.rows.map(row => ({
      hour: parseInt(row.hour_of_day),
      meetingCount: parseInt(row.meeting_count)
    }));

    // 4. Focus Time (gaps between meetings)
    const focusBlocks = await calculateFocusTime(userId, startDate);

    // 5. Trends (week-over-week or month-over-month)
    const trends = await calculateTrends(userId, timeRange);

    // 6. Top Collaborators
    const topCollaboratorsResult = await pool.query(`
      SELECT
        attendee_email,
        attendee_name,
        COUNT(*) as meeting_count,
        SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) as total_minutes,
        MAX(start_time) as last_meeting
      FROM bookings
      WHERE user_id = $1 AND start_time >= $2
      GROUP BY attendee_email, attendee_name
      ORDER BY meeting_count DESC
      LIMIT 10
    `, [userId, startDate]);

    const topCollaborators = topCollaboratorsResult.rows.map(row => ({
      email: row.attendee_email,
      name: row.attendee_name,
      meetingCount: parseInt(row.meeting_count),
      totalMinutes: parseInt(row.total_minutes),
      lastMeeting: row.last_meeting
    }));

    // 7. Meeting Density (busiest days)
    const busiestDaysResult = await pool.query(`
      SELECT
        DATE(start_time) as date,
        COUNT(*) as meeting_count,
        SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
      FROM bookings
      WHERE user_id = $1 AND start_time >= $2
      GROUP BY DATE(start_time)
      ORDER BY meeting_count DESC
      LIMIT 10
    `, [userId, startDate]);

    const busiestDays = busiestDaysResult.rows.map(row => ({
      date: row.date,
      meetingCount: parseInt(row.meeting_count),
      totalHours: parseFloat(row.total_hours)
    }));

    const analytics = {
      timeRange,
      generatedAt: new Date().toISOString(),
      totals: {
        totalMeetings: parseInt(totals.total_meetings) || 0,
        totalHours: parseFloat(totals.total_hours || 0),
        avgDurationMinutes: parseFloat(totals.avg_duration_minutes || 0),
        uniqueAttendees: parseInt(totals.unique_attendees) || 0,
        statusBreakdown: {
          completed: parseInt(totals.completed) || 0,
          confirmed: parseInt(totals.confirmed) || 0,
          cancelled: parseInt(totals.cancelled) || 0,
          pending: parseInt(totals.pending) || 0
        }
      },
      patterns: {
        byDayOfWeek,
        byHour,
        busiestDays
      },
      focusTime: focusBlocks,
      trends,
      topCollaborators
    };

    console.log(`✅ Analytics generated: ${analytics.totals.totalMeetings} meetings, ${analytics.totals.totalHours.toFixed(1)} hours`);

    return analytics;

  } catch (error) {
    console.error('Error generating calendar analytics:', error);
    throw error;
  }
}

/**
 * Calculate focus time blocks (gaps >= 2 hours between meetings)
 * @param {number} userId - User ID
 * @param {Date} startDate - Start date
 * @returns {Promise<object>} - Focus time data
 */
async function calculateFocusTime(userId, startDate) {
  const result = await pool.query(`
    WITH meetings AS (
      SELECT
        start_time,
        end_time,
        LAG(end_time) OVER (ORDER BY start_time) as prev_end_time
      FROM bookings
      WHERE user_id = $1
        AND start_time >= $2
        AND status IN ('confirmed', 'completed')
      ORDER BY start_time
    ),
    gaps AS (
      SELECT
        prev_end_time as gap_start,
        start_time as gap_end,
        EXTRACT(EPOCH FROM (start_time - prev_end_time)) / 3600 as gap_hours
      FROM meetings
      WHERE prev_end_time IS NOT NULL
        AND EXTRACT(EPOCH FROM (start_time - prev_end_time)) / 3600 >= 2
    )
    SELECT
      COUNT(*) as focus_block_count,
      SUM(gap_hours) as total_focus_hours,
      AVG(gap_hours) as avg_focus_block_hours
    FROM gaps
  `, [userId, startDate]);

  const data = result.rows[0];

  return {
    focusBlockCount: parseInt(data.focus_block_count) || 0,
    totalFocusHours: parseFloat(data.total_focus_hours || 0),
    avgFocusBlockHours: parseFloat(data.avg_focus_block_hours || 0)
  };
}

/**
 * Calculate trends (week-over-week or month-over-month)
 * @param {number} userId - User ID
 * @param {string} timeRange - Time range
 * @returns {Promise<object>} - Trend data
 */
async function calculateTrends(userId, timeRange) {
  try {
    let interval, periods;

    if (timeRange === '7d') {
      interval = '1 day';
      periods = 7;
    } else if (timeRange === '30d') {
      interval = '1 week';
      periods = 5;
    } else {
      interval = '1 month';
      periods = 12;
    }

    const result = await pool.query(`
      SELECT
        DATE_TRUNC($1, start_time) as period,
        COUNT(*) as meeting_count,
        SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
      FROM bookings
      WHERE user_id = $2
        AND start_time >= NOW() - INTERVAL '${periods} ${interval}'
      GROUP BY DATE_TRUNC($1, start_time)
      ORDER BY period ASC
    `, [interval.split(' ')[1], userId]); // 'day', 'week', or 'month'

    const trendData = result.rows.map(row => ({
      period: row.period,
      meetingCount: parseInt(row.meeting_count),
      totalHours: parseFloat(row.total_hours)
    }));

    // Calculate percentage change
    let percentageChange = 0;
    if (trendData.length >= 2) {
      const latest = trendData[trendData.length - 1].meetingCount;
      const previous = trendData[trendData.length - 2].meetingCount;
      percentageChange = previous > 0 ? ((latest - previous) / previous) * 100 : 0;
    }

    return {
      data: trendData,
      percentageChange: parseFloat(percentageChange.toFixed(1)),
      trend: percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable'
    };

  } catch (error) {
    console.error('Error calculating trends:', error);
    return { data: [], percentageChange: 0, trend: 'stable' };
  }
}

/**
 * Get start date from time range string
 * @param {string} timeRange - Time range
 * @returns {Date} - Start date
 */
function getStartDateFromRange(timeRange) {
  const now = new Date();

  switch (timeRange) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'all':
      return new Date('2020-01-01'); // Far enough back
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
  }
}

module.exports = {
  getCalendarAnalytics,
  calculateFocusTime,
  calculateTrends
};
