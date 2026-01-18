const pool = require('../config/database');
const { DateTime } = require('luxon');

/**
 * Update attendee profile after a booking is created or completed
 * @param {number} userId - The host user ID
 * @param {string} attendeeEmail - The attendee's email
 * @param {number} bookingId - The booking ID
 * @returns {Promise<object>} - The updated profile
 */
async function updateAttendeeProfile(userId, attendeeEmail, bookingId) {
  try {
    // Get booking details
    const bookingResult = await pool.query(
      `SELECT start_time, end_time, attendee_name, attendee_email
       FROM bookings
       WHERE id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      console.log(`Booking ${bookingId} not found`);
      return null;
    }

    const booking = bookingResult.rows[0];

    // Calculate meeting duration in minutes
    const startTime = new Date(booking.start_time);
    const endTime = new Date(booking.end_time);
    const durationMinutes = Math.round((endTime - startTime) / 60000);

    // Upsert attendee profile
    const result = await pool.query(
      `INSERT INTO attendee_profiles
       (user_id, email, name, meeting_count, last_meeting_date, total_meeting_minutes, updated_at)
       VALUES ($1, $2, $3, 1, $4, $5, NOW())
       ON CONFLICT (user_id, email) DO UPDATE SET
         meeting_count = attendee_profiles.meeting_count + 1,
         last_meeting_date = $4,
         total_meeting_minutes = attendee_profiles.total_meeting_minutes + $5,
         name = COALESCE(attendee_profiles.name, $3),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        attendeeEmail,
        booking.attendee_name,
        booking.start_time,
        durationMinutes
      ]
    );

    console.log(`✅ Updated attendee profile for ${attendeeEmail} (meeting #${result.rows[0].meeting_count})`);
    return result.rows[0];

  } catch (error) {
    console.error(`Error updating attendee profile:`, error);
    return null;
  }
}

/**
 * Get attendee history for a specific attendee
 * @param {number} userId - The host user ID
 * @param {string} attendeeEmail - The attendee's email
 * @returns {Promise<object|null>} - Profile and recent meetings
 */
async function getAttendeeHistory(userId, attendeeEmail) {
  try {
    // Get attendee profile
    const profileResult = await pool.query(
      `SELECT * FROM attendee_profiles
       WHERE user_id = $1 AND email = $2`,
      [userId, attendeeEmail]
    );

    if (profileResult.rows.length === 0) {
      return null;
    }

    const profile = profileResult.rows[0];

    // Get recent meetings with this attendee
    const meetingsResult = await pool.query(
      `SELECT id, title, start_time, end_time, meeting_summary, status
       FROM bookings
       WHERE user_id = $1 AND attendee_email = $2 AND status != 'cancelled'
       ORDER BY start_time DESC
       LIMIT 5`,
      [userId, attendeeEmail]
    );

    return {
      profile: profile,
      recentMeetings: meetingsResult.rows
    };

  } catch (error) {
    console.error(`Error getting attendee history:`, error);
    return null;
  }
}

/**
 * Get all attendees for a user, sorted by recent activity
 * @param {number} userId - The host user ID
 * @param {object} options - Query options
 * @returns {Promise<Array>} - List of attendee profiles
 */
async function getAllAttendees(userId, options = {}) {
  try {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'last_meeting_date', // or 'meeting_count', 'name'
      order = 'DESC'
    } = options;

    const validSortColumns = ['last_meeting_date', 'meeting_count', 'name', 'total_meeting_minutes'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'last_meeting_date';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const result = await pool.query(
      `SELECT
         ap.*,
         COUNT(b.id) FILTER (WHERE b.start_time > NOW()) as upcoming_meetings
       FROM attendee_profiles ap
       LEFT JOIN bookings b ON (b.user_id = ap.user_id AND b.attendee_email = ap.email AND b.status = 'confirmed')
       WHERE ap.user_id = $1
       GROUP BY ap.id
       ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;

  } catch (error) {
    console.error(`Error getting all attendees:`, error);
    return [];
  }
}

/**
 * Update attendee notes
 * @param {number} userId - The host user ID
 * @param {string} attendeeEmail - The attendee's email
 * @param {string} notes - Notes to save
 * @returns {Promise<boolean>} - Success status
 */
async function updateAttendeeNotes(userId, attendeeEmail, notes) {
  try {
    const result = await pool.query(
      `UPDATE attendee_profiles
       SET notes = $1, updated_at = NOW()
       WHERE user_id = $2 AND email = $3
       RETURNING *`,
      [notes, userId, attendeeEmail]
    );

    if (result.rows.length === 0) {
      console.log(`Attendee profile not found for ${attendeeEmail}`);
      return false;
    }

    console.log(`✅ Updated notes for attendee ${attendeeEmail}`);
    return true;

  } catch (error) {
    console.error(`Error updating attendee notes:`, error);
    return false;
  }
}

/**
 * Enrich attendee profile with additional data (company, title, etc.)
 * This can be called when additional info is available
 * @param {number} userId - The host user ID
 * @param {string} attendeeEmail - The attendee's email
 * @param {object} data - Additional profile data
 * @returns {Promise<object|null>} - Updated profile
 */
async function enrichAttendeeProfile(userId, attendeeEmail, data) {
  try {
    const { company, title, timezone } = data;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (company !== undefined) {
      updates.push(`company = $${paramIndex++}`);
      values.push(company);
    }

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(timezone);
    }

    if (updates.length === 0) {
      console.log('No data to enrich');
      return null;
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId, attendeeEmail);

    const result = await pool.query(
      `UPDATE attendee_profiles
       SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex++} AND email = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      console.log(`Attendee profile not found for ${attendeeEmail}`);
      return null;
    }

    console.log(`✅ Enriched profile for ${attendeeEmail}`);
    return result.rows[0];

  } catch (error) {
    console.error(`Error enriching attendee profile:`, error);
    return null;
  }
}

/**
 * Get attendee statistics for a user
 * @param {number} userId - The host user ID
 * @returns {Promise<object>} - Statistics about attendees
 */
async function getAttendeeStats(userId) {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(DISTINCT email) as total_attendees,
         SUM(meeting_count) as total_meetings,
         SUM(total_meeting_minutes) as total_minutes,
         AVG(meeting_count) as avg_meetings_per_attendee,
         MAX(meeting_count) as max_meetings_with_one_attendee,
         COUNT(*) FILTER (WHERE meeting_count = 1) as one_time_attendees,
         COUNT(*) FILTER (WHERE meeting_count >= 5) as frequent_attendees
       FROM attendee_profiles
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0] || {};

  } catch (error) {
    console.error(`Error getting attendee stats:`, error);
    return {};
  }
}

/**
 * Get attendee's preferred meeting times and days
 * @param {number} userId - The host user ID
 * @param {string} attendeeEmail - The attendee's email
 * @returns {Promise<object>} - Preferred days, times, and patterns
 */
async function getAttendeePreferences(userId, attendeeEmail) {
  try {
    // Get day and time patterns from completed meetings
    const patterns = await pool.query(
      `SELECT
         EXTRACT(DOW FROM start_time) as day_of_week,
         EXTRACT(HOUR FROM start_time) as hour_of_day,
         COUNT(*) as frequency,
         ROUND(AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)) as avg_duration_minutes
       FROM bookings
       WHERE user_id = $1
         AND attendee_email = $2
         AND status IN ('confirmed', 'completed')
         AND start_time < NOW()
       GROUP BY EXTRACT(DOW FROM start_time), EXTRACT(HOUR FROM start_time)
       ORDER BY frequency DESC
       LIMIT 5`,
      [userId, attendeeEmail]
    );

    // Convert day numbers to names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Get most common days
    const dayFrequency = {};
    patterns.rows.forEach(row => {
      const day = dayNames[row.day_of_week];
      dayFrequency[day] = (dayFrequency[day] || 0) + parseInt(row.frequency);
    });

    const preferredDays = Object.entries(dayFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([day]) => day);

    // Get most common hours
    const hourFrequency = {};
    patterns.rows.forEach(row => {
      const hour = parseInt(row.hour_of_day);
      hourFrequency[hour] = (hourFrequency[hour] || 0) + parseInt(row.frequency);
    });

    const preferredHours = Object.entries(hourFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => {
        const h = parseInt(hour);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${displayHour}:00 ${ampm}`;
      });

    // Calculate average duration
    const avgDuration = patterns.rows.length > 0
      ? Math.round(patterns.rows.reduce((sum, r) => sum + parseFloat(r.avg_duration_minutes), 0) / patterns.rows.length)
      : null;

    return {
      preferredDays,
      preferredTimes: preferredHours,
      averageDuration: avgDuration,
      hasPattern: patterns.rows.length >= 2
    };

  } catch (error) {
    console.error(`Error getting attendee preferences:`, error);
    return {
      preferredDays: [],
      preferredTimes: [],
      averageDuration: null,
      hasPattern: false
    };
  }
}

module.exports = {
  updateAttendeeProfile,
  getAttendeeHistory,
  getAllAttendees,
  updateAttendeeNotes,
  enrichAttendeeProfile,
  getAttendeeStats,
  getAttendeePreferences
};
