const pool = require('../config/database');
const { DateTime } = require('luxon');

/**
 * Analyze user's booking patterns and store them
 * @param {number} userId - User ID
 * @returns {Promise<object>} - Pattern analysis results
 */
async function analyzeBookingPatterns(userId) {
  try {
    console.log(`📊 Analyzing booking patterns for user ${userId}`);

    // Get all completed bookings from last 90 days
    const bookingsResult = await pool.query(`
      SELECT
        id,
        start_time,
        end_time,
        status,
        attendee_email,
        EXTRACT(DOW FROM start_time) as day_of_week,
        EXTRACT(HOUR FROM start_time) as hour_of_day,
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60 as duration_minutes
      FROM bookings
      WHERE user_id = $1
        AND start_time > NOW() - INTERVAL '90 days'
        AND status IN ('confirmed', 'completed')
      ORDER BY start_time DESC
    `, [userId]);

    const bookings = bookingsResult.rows;

    if (bookings.length === 0) {
      console.log('No booking history found for pattern analysis');
      return null;
    }

    // 1. Preferred Hours Analysis
    const hourCounts = {};
    bookings.forEach(b => {
      const hour = parseInt(b.hour_of_day);
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const sortedHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));

    const preferredHoursData = {
      topHours: sortedHours,
      peakHour: sortedHours[0]?.hour,
      distribution: hourCounts
    };

    await upsertPattern(userId, 'preferred_hours', preferredHoursData);

    // 2. Preferred Days Analysis
    const dayCounts = {};
    bookings.forEach(b => {
      const day = parseInt(b.day_of_week); // 0=Sunday, 6=Saturday
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    const sortedDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([day, count]) => ({ day: parseInt(day), count }));

    const preferredDaysData = {
      topDays: sortedDays,
      distribution: dayCounts
    };

    await upsertPattern(userId, 'preferred_days', preferredDaysData);

    // 3. Average Duration Analysis
    const durations = bookings.map(b => parseFloat(b.duration_minutes));
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const commonDurations = [15, 30, 45, 60, 90, 120];
    const closestDuration = commonDurations.reduce((prev, curr) =>
      Math.abs(curr - avgDuration) < Math.abs(prev - avgDuration) ? curr : prev
    );

    const durationData = {
      average: avgDuration,
      mostCommon: closestDuration,
      distribution: durations
    };

    await upsertPattern(userId, 'avg_duration', durationData);

    // 4. Acceptance Rate Analysis (if we track declines)
    const totalBookings = bookingsResult.rows.length;
    const confirmedCount = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length;
    const acceptanceRate = totalBookings > 0 ? (confirmedCount / totalBookings) * 100 : 100;

    const acceptanceData = {
      rate: acceptanceRate,
      totalBookings,
      confirmedCount
    };

    await upsertPattern(userId, 'acceptance_rate', acceptanceData);

    console.log(`✅ Pattern analysis complete: ${sortedHours.length} preferred hours, ${sortedDays.length} preferred days`);

    return {
      preferredHours: preferredHoursData,
      preferredDays: preferredDaysData,
      avgDuration: durationData,
      acceptanceRate: acceptanceData
    };

  } catch (error) {
    console.error('Error analyzing booking patterns:', error);
    throw error;
  }
}

/**
 * Upsert a booking pattern
 * @param {number} userId - User ID
 * @param {string} patternType - Type of pattern
 * @param {object} patternData - Pattern data
 */
async function upsertPattern(userId, patternType, patternData) {
  await pool.query(`
    INSERT INTO booking_patterns (user_id, pattern_type, pattern_data, last_calculated)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, pattern_type)
    DO UPDATE SET
      pattern_data = $3,
      last_calculated = NOW()
  `, [userId, patternType, JSON.stringify(patternData)]);
}

/**
 * Get stored booking patterns for a user
 * @param {number} userId - User ID
 * @returns {Promise<object>} - Patterns object
 */
async function getBookingPatterns(userId) {
  const result = await pool.query(`
    SELECT pattern_type, pattern_data
    FROM booking_patterns
    WHERE user_id = $1
  `, [userId]);

  const patterns = {};
  result.rows.forEach(row => {
    patterns[row.pattern_type] = row.pattern_data;
  });

  return patterns;
}

/**
 * Get available time slots (simple version - assumes 9am-5pm weekdays)
 * @param {number} userId - User ID
 * @param {number} duration - Duration in minutes
 * @param {object} options - Options
 * @returns {Promise<Array>} - Available slots
 */
async function getAvailableSlots(userId, duration, options = {}) {
  const { daysAhead = 14, timezone = 'America/New_York' } = options;

  const slots = [];
  const now = DateTime.now().setZone(timezone);

  // Get existing bookings for the next N days
  const bookingsResult = await pool.query(`
    SELECT start_time, end_time
    FROM bookings
    WHERE user_id = $1
      AND start_time >= $2
      AND start_time < $3
      AND status IN ('confirmed', 'pending')
    ORDER BY start_time
  `, [userId, now.toISO(), now.plus({ days: daysAhead }).toISO()]);

  const existingBookings = bookingsResult.rows.map(b => ({
    start: DateTime.fromJSDate(b.start_time).setZone(timezone),
    end: DateTime.fromJSDate(b.end_time).setZone(timezone)
  }));

  // Generate potential slots (9am-5pm, weekdays only, every 30 min)
  for (let dayOffset = 1; dayOffset <= daysAhead; dayOffset++) {
    const day = now.plus({ days: dayOffset });

    // Skip weekends
    if (day.weekday === 6 || day.weekday === 7) continue;

    // Generate slots from 9am to 5pm
    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = day.set({ hour, minute, second: 0, millisecond: 0 });
        const slotEnd = slotStart.plus({ minutes: duration });

        // Skip if slot end is after 5pm
        if (slotEnd.hour >= 17) continue;

        // Check for conflicts
        const hasConflict = existingBookings.some(booking =>
          (slotStart >= booking.start && slotStart < booking.end) ||
          (slotEnd > booking.start && slotEnd <= booking.end) ||
          (slotStart <= booking.start && slotEnd >= booking.end)
        );

        if (!hasConflict) {
          slots.push({
            start: slotStart.toISO(),
            end: slotEnd.toISO(),
            startDate: slotStart.toJSDate(),
            endDate: slotEnd.toJSDate()
          });
        }
      }
    }
  }

  return slots;
}

/**
 * Get smart scheduling suggestions with AI scoring
 * @param {number} userId - User ID
 * @param {object} params - Request parameters
 * @returns {Promise<Array>} - Scored and sorted time slots
 */
async function getSmartSuggestions(userId, params = {}) {
  try {
    const {
      duration = 30,
      attendeeEmail = null,
      timezone = 'America/New_York',
      maxSlots = 5
    } = params;

    console.log(`🧠 Getting smart suggestions for user ${userId}`);

    // 1. Get user's booking patterns (or analyze if not cached)
    let patterns = await getBookingPatterns(userId);

    if (Object.keys(patterns).length === 0) {
      console.log('No patterns found, analyzing now...');
      await analyzeBookingPatterns(userId);
      patterns = await getBookingPatterns(userId);
    }

    // 2. Get available slots
    const availableSlots = await getAvailableSlots(userId, duration, { timezone });

    if (availableSlots.length === 0) {
      return [];
    }

    // 3. Get attendee preferences if available
    let attendeePrefs = null;
    if (attendeeEmail) {
      const attendeeResult = await pool.query(`
        SELECT
          EXTRACT(HOUR FROM start_time) as hour,
          EXTRACT(DOW FROM start_time) as day,
          COUNT(*) as count
        FROM bookings
        WHERE user_id = $1
          AND attendee_email = $2
          AND status IN ('confirmed', 'completed')
        GROUP BY EXTRACT(HOUR FROM start_time), EXTRACT(DOW FROM start_time)
        ORDER BY count DESC
      `, [userId, attendeeEmail]);

      if (attendeeResult.rows.length > 0) {
        attendeePrefs = {
          preferredHours: attendeeResult.rows.map(r => parseInt(r.hour)),
          preferredDays: attendeeResult.rows.map(r => parseInt(r.day))
        };
      }
    }

    // 4. Score each slot
    const scoredSlots = availableSlots.map(slot => {
      let score = 100;
      const reasons = [];

      const slotTime = DateTime.fromISO(slot.start);
      const hour = slotTime.hour;
      const dayOfWeek = slotTime.weekday === 7 ? 0 : slotTime.weekday; // Luxon: 1=Mon, 7=Sun

      // Score based on user's preferred hours
      if (patterns.preferred_hours?.topHours) {
        const isPreferredHour = patterns.preferred_hours.topHours.some(h => h.hour === hour);
        if (isPreferredHour) {
          score += 30;
          reasons.push('Your preferred meeting time');
        }
      }

      // Score based on user's preferred days
      if (patterns.preferred_days?.topDays) {
        const isPreferredDay = patterns.preferred_days.topDays.slice(0, 3).some(d => d.day === dayOfWeek);
        if (isPreferredDay) {
          score += 20;
          reasons.push('Your preferred day');
        }
      }

      // Score based on attendee preferences
      if (attendeePrefs) {
        if (attendeePrefs.preferredHours.includes(hour)) {
          score += 20;
          reasons.push('Attendee\'s preferred time');
        }
        if (attendeePrefs.preferredDays.includes(dayOfWeek)) {
          score += 15;
          reasons.push('Attendee\'s preferred day');
        }
      }

      // Prefer morning for certain types (9am-11am)
      if (hour >= 9 && hour <= 11) {
        score += 15;
        reasons.push('Morning energy boost');
      }

      // Penalize late afternoon/evening
      if (hour >= 16) {
        score -= 10;
        reasons.push('Late in the day');
      }

      // Avoid lunch hour (12pm-1pm)
      if (hour === 12) {
        score -= 15;
        reasons.push('Lunch time');
      }

      // Prefer mid-week
      if (dayOfWeek >= 2 && dayOfWeek <= 4) { // Tue-Thu
        score += 10;
        reasons.push('Mid-week focus time');
      }

      // Bonus for next available
      const daysFromNow = slotTime.diff(DateTime.now(), 'days').days;
      if (daysFromNow <= 2) {
        score += 5;
        reasons.push('Soon available');
      }

      return {
        ...slot,
        score,
        reasoning: reasons.join(', ') || 'Available time'
      };
    });

    // 5. Sort by score and return top N
    const topSlots = scoredSlots
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSlots);

    console.log(`✅ Returning ${topSlots.length} smart suggestions (scored ${topSlots[0]?.score} to ${topSlots[topSlots.length - 1]?.score})`);

    return topSlots;

  } catch (error) {
    console.error('Error getting smart suggestions:', error);
    throw error;
  }
}

module.exports = {
  analyzeBookingPatterns,
  getBookingPatterns,
  getSmartSuggestions,
  getAvailableSlots
};
