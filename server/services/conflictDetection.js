/**
 * Conflict Detection Service
 * Prevents double-bookings, enforces buffer times, and suggests alternatives
 */

const pool = require('../config/database');
const { DateTime } = require('luxon');

/**
 * Check if a booking conflicts with existing bookings
 * @param {number} userId - User ID to check conflicts for
 * @param {Date} startTime - Proposed booking start time
 * @param {Date} endTime - Proposed booking end time
 * @param {Object} options - Additional options
 * @returns {Object|null} Conflict details or null if no conflicts
 */
async function checkBookingConflicts(userId, startTime, endTime, options = {}) {
  const {
    excludeBookingId = null,
    includeBuffer = true,
    teamMemberId = null,
    eventTypeId = null
  } = options;

  try {
    // Get buffer time from event_type if specified
    let bufferBefore = 0;
    let bufferAfter = 0;

    if (includeBuffer && eventTypeId) {
      const eventTypeResult = await pool.query(
        'SELECT buffer_before, buffer_after FROM event_types WHERE id = $1',
        [eventTypeId]
      );

      if (eventTypeResult.rows.length > 0) {
        bufferBefore = eventTypeResult.rows[0].buffer_before || 0;
        bufferAfter = eventTypeResult.rows[0].buffer_after || 0;
      }
    }

    // Apply buffer to time range
    const checkStart = new Date(startTime.getTime() - bufferBefore * 60000);
    const checkEnd = new Date(endTime.getTime() + bufferAfter * 60000);

    // Build query for overlapping bookings
    let query = `
      SELECT id, title, start_time, end_time, attendee_name, attendee_email
      FROM bookings
      WHERE user_id = $1
        AND status IN ('confirmed', 'pending_approval')
        AND start_time < $2
        AND end_time > $3
    `;

    const params = [userId, checkEnd, checkStart];

    if (excludeBookingId) {
      query += ` AND id != $${params.length + 1}`;
      params.push(excludeBookingId);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return null; // No conflicts
    }

    // Analyze conflicts to determine if they're direct overlaps or buffer violations
    const conflicts = result.rows.map(row => {
      const bookingStart = new Date(row.start_time);
      const bookingEnd = new Date(row.end_time);

      // Check if it's a buffer violation (bookings don't directly overlap)
      const isBufferViolation = (
        (bookingStart >= startTime && bookingStart < endTime) ||
        (bookingEnd > startTime && bookingEnd <= endTime)
      ) ? false : true;

      return {
        bookingId: row.id,
        title: row.title,
        startTime: row.start_time,
        endTime: row.end_time,
        attendee: row.attendee_name,
        attendeeEmail: row.attendee_email,
        isBufferViolation,
        bufferType: isBufferViolation ? (
          bookingEnd <= checkStart ? 'before' : 'after'
        ) : null
      };
    });

    return {
      hasConflict: true,
      conflicts,
      bufferRequired: { before: bufferBefore, after: bufferAfter }
    };

  } catch (error) {
    console.error('Error checking booking conflicts:', error);
    throw error;
  }
}

/**
 * Find alternative available time slots when a conflict is detected
 * @param {number} userId - User ID
 * @param {Date} requestedStart - Requested start time that had a conflict
 * @param {number} duration - Duration in minutes
 * @param {Object} options - Search options
 * @returns {Array} Array of alternative slots
 */
async function findAlternativeSlots(userId, requestedStart, duration, options = {}) {
  const {
    maxSlots = 5,
    maxDaysAhead = 14,
    eventTypeId = null,
    preferredDays = null, // ['monday', 'tuesday', etc.]
    timeRange = null // 'morning', 'afternoon', 'evening'
  } = options;

  try {
    // Get user timezone
    const userResult = await pool.query(
      'SELECT timezone FROM users WHERE id = $1',
      [userId]
    );

    const userTimezone = userResult.rows[0]?.timezone || 'America/New_York';

    // Get buffer time from event type
    let bufferBefore = 0;
    let bufferAfter = 0;

    if (eventTypeId) {
      const eventTypeResult = await pool.query(
        'SELECT buffer_before, buffer_after FROM event_types WHERE id = $1',
        [eventTypeId]
      );

      if (eventTypeResult.rows.length > 0) {
        bufferBefore = eventTypeResult.rows[0].buffer_before || 0;
        bufferAfter = eventTypeResult.rows[0].buffer_after || 0;
      }
    }

    // Get existing bookings for the search period
    const endDate = DateTime.fromJSDate(requestedStart)
      .setZone(userTimezone)
      .plus({ days: maxDaysAhead });

    const existingBookings = await pool.query(
      `SELECT start_time, end_time FROM bookings
       WHERE user_id = $1
         AND status IN ('confirmed', 'pending_approval')
         AND start_time >= $2
         AND start_time < $3
       ORDER BY start_time`,
      [userId, requestedStart, endDate.toJSDate()]
    );

    // Generate potential slots
    const alternatives = [];
    let currentDate = DateTime.fromJSDate(requestedStart).setZone(userTimezone);
    const maxDate = currentDate.plus({ days: maxDaysAhead });

    // Define working hours based on time range preference
    const timeRanges = {
      morning: { start: 9, end: 12 },
      afternoon: { start: 12, end: 17 },
      evening: { start: 17, end: 20 },
      default: { start: 9, end: 17 }
    };

    const workingHours = timeRanges[timeRange] || timeRanges.default;

    while (alternatives.length < maxSlots && currentDate < maxDate) {
      // Skip weekends unless explicitly preferred
      if (!preferredDays && (currentDate.weekday === 6 || currentDate.weekday === 7)) {
        currentDate = currentDate.plus({ days: 1 }).startOf('day');
        continue;
      }

      // Check preferred days filter
      if (preferredDays && preferredDays.length > 0) {
        const dayName = currentDate.toFormat('EEEE').toLowerCase();
        if (!preferredDays.includes(dayName)) {
          currentDate = currentDate.plus({ days: 1 }).startOf('day');
          continue;
        }
      }

      // Generate slots for this day
      for (let hour = workingHours.start; hour < workingHours.end; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotStart = currentDate.set({ hour, minute, second: 0, millisecond: 0 });
          const slotEnd = slotStart.plus({ minutes: duration });

          // Skip if slot is in the past
          if (slotStart < DateTime.now().setZone(userTimezone)) {
            continue;
          }

          // Check if this slot is at least 30 minutes after the requested time
          // (to avoid suggesting times too close to the conflict)
          if (slotStart < DateTime.fromJSDate(requestedStart).plus({ minutes: 30 })) {
            continue;
          }

          // Check for conflicts with existing bookings
          const slotStartWithBuffer = slotStart.minus({ minutes: bufferBefore });
          const slotEndWithBuffer = slotEnd.plus({ minutes: bufferAfter });

          let hasConflict = false;
          for (const booking of existingBookings.rows) {
            const bookingStart = DateTime.fromJSDate(booking.start_time).setZone(userTimezone);
            const bookingEnd = DateTime.fromJSDate(booking.end_time).setZone(userTimezone);

            if (slotStartWithBuffer < bookingEnd && slotEndWithBuffer > bookingStart) {
              hasConflict = true;
              break;
            }
          }

          if (!hasConflict) {
            alternatives.push({
              start: slotStart.toJSDate(),
              end: slotEnd.toJSDate(),
              startFormatted: slotStart.toFormat('EEE, MMM d \'at\' h:mm a'),
              reason: 'available'
            });

            if (alternatives.length >= maxSlots) {
              return alternatives;
            }
          }
        }
      }

      currentDate = currentDate.plus({ days: 1 }).startOf('day');
    }

    return alternatives;

  } catch (error) {
    console.error('Error finding alternative slots:', error);
    throw error;
  }
}

/**
 * Validate buffer time requirements
 * @param {number} userId - User ID
 * @param {Date} startTime - Booking start time
 * @param {Date} endTime - Booking end time
 * @param {number} bufferMinutes - Required buffer in minutes
 * @returns {Array} Array of buffer violations
 */
async function validateBufferTime(userId, startTime, endTime, bufferMinutes) {
  try {
    const bufferStart = new Date(startTime.getTime() - bufferMinutes * 60000);
    const bufferEnd = new Date(endTime.getTime() + bufferMinutes * 60000);

    const result = await pool.query(
      `SELECT id, title, start_time, end_time
       FROM bookings
       WHERE user_id = $1
         AND status IN ('confirmed', 'pending_approval')
         AND (
           (start_time >= $2 AND start_time < $3) OR
           (end_time > $2 AND end_time <= $4)
         )`,
      [userId, bufferStart, startTime, endTime, bufferEnd]
    );

    return result.rows.map(row => ({
      bookingId: row.id,
      title: row.title,
      startTime: row.start_time,
      endTime: row.end_time,
      violationType: new Date(row.end_time) <= startTime ? 'before' : 'after',
      requiredBuffer: bufferMinutes
    }));

  } catch (error) {
    console.error('Error validating buffer time:', error);
    throw error;
  }
}

/**
 * Check recurring meeting instances for conflicts
 * @param {number} userId - User ID
 * @param {Array} instances - Array of recurring instances with start_time and end_time
 * @param {Object} options - Options including eventTypeId
 * @returns {Array|null} Array of conflicting instances or null
 */
async function checkRecurringConflicts(userId, instances, options = {}) {
  const { eventTypeId = null, maxInstancesToCheck = 52 } = options;

  try {
    const conflicts = [];
    const instancesToCheck = instances.slice(0, maxInstancesToCheck);

    for (let i = 0; i < instancesToCheck.length; i++) {
      const instance = instancesToCheck[i];

      const conflictCheck = await checkBookingConflicts(
        userId,
        instance.start_time,
        instance.end_time,
        { eventTypeId, includeBuffer: true }
      );

      if (conflictCheck?.hasConflict) {
        conflicts.push({
          instanceIndex: i,
          date: instance.start_time,
          conflicts: conflictCheck.conflicts,
          bufferRequired: conflictCheck.bufferRequired
        });

        // Limit the number of conflicts reported to avoid overwhelming output
        if (conflicts.length >= 10) {
          break;
        }
      }
    }

    return conflicts.length > 0 ? conflicts : null;

  } catch (error) {
    console.error('Error checking recurring conflicts:', error);
    throw error;
  }
}

/**
 * Format conflict message for user display
 * @param {Object} conflictCheck - Result from checkBookingConflicts
 * @returns {string} Human-readable conflict message
 */
function formatConflictMessage(conflictCheck) {
  if (!conflictCheck || !conflictCheck.hasConflict) {
    return null;
  }

  const { conflicts, bufferRequired } = conflictCheck;
  const count = conflicts.length;

  if (count === 1) {
    const conflict = conflicts[0];
    const time = DateTime.fromJSDate(conflict.startTime).toFormat('h:mm a');

    if (conflict.isBufferViolation) {
      return `This time is too close to your ${time} "${conflict.title}" meeting. You need ${bufferRequired.before || bufferRequired.after} minutes of buffer time.`;
    } else {
      return `This time conflicts with your ${time} "${conflict.title}" meeting with ${conflict.attendee}.`;
    }
  } else {
    const bufferViolations = conflicts.filter(c => c.isBufferViolation).length;
    const directConflicts = count - bufferViolations;

    if (bufferViolations > 0 && directConflicts === 0) {
      return `This time violates buffer time requirements for ${bufferViolations} existing ${bufferViolations === 1 ? 'meeting' : 'meetings'}.`;
    } else {
      return `This time conflicts with ${count} existing ${count === 1 ? 'meeting' : 'meetings'}.`;
    }
  }
}

module.exports = {
  checkBookingConflicts,
  findAlternativeSlots,
  validateBufferTime,
  checkRecurringConflicts,
  formatConflictMessage
};
