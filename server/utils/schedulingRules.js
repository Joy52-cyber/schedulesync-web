/**
 * Scheduling Rules Utility
 * Applies smart rules to bookings based on triggers (domain, keyword, time)
 */

const pool = require('../config/database');

/**
 * Apply scheduling rules to a booking request
 * @param {object} client - Database client
 * @param {number} userId - The user ID who owns the rules
 * @param {object} bookingData - The booking request data
 * @returns {object} - Modified booking data with rules applied, plus rule results
 */
async function applySchedulingRules(client, userId, bookingData) {
  const results = {
    originalData: { ...bookingData },
    modifiedData: { ...bookingData },
    appliedRules: [],
    blocked: false,
    blockReason: null,
    autoApproved: false
  };

  try {
    // Fetch active rules for this user
    const rulesResult = await client.query(
      `SELECT * FROM scheduling_rules
       WHERE user_id = $1 AND is_active = true
       ORDER BY priority DESC, created_at ASC`,
      [userId]
    );

    const rules = rulesResult.rows;
    if (rules.length === 0) {
      return results;
    }

    const attendeeEmail = (bookingData.attendee_email || '').toLowerCase();
    const attendeeDomain = attendeeEmail.includes('@') ? attendeeEmail.split('@')[1] : '';
    const bookingTitle = (bookingData.title || '').toLowerCase();
    const bookingNotes = (bookingData.notes || '').toLowerCase();
    const combinedText = `${bookingTitle} ${bookingNotes} ${attendeeEmail}`.toLowerCase();

    // Get booking hour for time-based rules
    let bookingHour = null;
    if (bookingData.start_time) {
      const startTime = new Date(bookingData.start_time);
      bookingHour = startTime.getHours();
    }

    // Get day of week for day-based rules
    let bookingDay = null;
    if (bookingData.start_time) {
      const startTime = new Date(bookingData.start_time);
      bookingDay = startTime.getDay(); // 0 = Sunday, 6 = Saturday
    }

    for (const rule of rules) {
      let matches = false;

      // Check trigger conditions
      switch (rule.trigger_type) {
        case 'domain':
          matches = attendeeDomain === rule.trigger_value.toLowerCase();
          break;

        case 'keyword':
          matches = combinedText.includes(rule.trigger_value.toLowerCase());
          break;

        case 'email':
          matches = attendeeEmail === rule.trigger_value.toLowerCase();
          break;

        case 'time_before':
          // Trigger if booking is before specified hour
          if (bookingHour !== null) {
            matches = bookingHour < parseInt(rule.trigger_value);
          }
          break;

        case 'time_after':
          // Trigger if booking is after specified hour
          if (bookingHour !== null) {
            matches = bookingHour >= parseInt(rule.trigger_value);
          }
          break;

        case 'day_of_week':
          // Trigger on specific days (0-6 or day names)
          if (bookingDay !== null) {
            const triggerDays = rule.trigger_value.toLowerCase().split(',').map(d => d.trim());
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            matches = triggerDays.some(d => {
              if (!isNaN(d)) return parseInt(d) === bookingDay;
              return dayNames[bookingDay] === d;
            });
          }
          break;

        case 'duration_greater':
          matches = (bookingData.duration || 30) > parseInt(rule.trigger_value);
          break;

        case 'duration_less':
          matches = (bookingData.duration || 30) < parseInt(rule.trigger_value);
          break;

        case 'all':
          // Always matches - useful for default rules
          matches = true;
          break;

        default:
          console.warn(`Unknown trigger type: ${rule.trigger_type}`);
      }

      if (matches) {
        // Apply the action
        const actionResult = applyRuleAction(results.modifiedData, rule);

        results.appliedRules.push({
          id: rule.id,
          name: rule.name,
          trigger: `${rule.trigger_type}: ${rule.trigger_value}`,
          action: `${rule.action_type}: ${rule.action_value}`,
          result: actionResult
        });

        // Handle special action results
        if (actionResult.blocked) {
          results.blocked = true;
          results.blockReason = actionResult.reason || `Blocked by rule: ${rule.name}`;
          // Stop processing more rules if blocked
          break;
        }

        if (actionResult.autoApproved) {
          results.autoApproved = true;
        }

        // Update modified data
        results.modifiedData = actionResult.data;
      }
    }

    // Log applied rules
    if (results.appliedRules.length > 0) {
      console.log(`📋 Applied ${results.appliedRules.length} scheduling rule(s) to booking:`,
        results.appliedRules.map(r => r.name).join(', '));
    }

    return results;

  } catch (error) {
    console.error('Error applying scheduling rules:', error);
    // Return original data if rules fail - don't block the booking
    return results;
  }
}

/**
 * Apply a single rule's action to booking data
 */
function applyRuleAction(bookingData, rule) {
  const result = {
    data: { ...bookingData },
    blocked: false,
    autoApproved: false,
    reason: null
  };

  switch (rule.action_type) {
    case 'set_duration':
      result.data.duration = parseInt(rule.action_value);
      break;

    case 'auto_approve':
      result.autoApproved = rule.action_value === 'true' || rule.action_value === true;
      result.data.status = result.autoApproved ? 'confirmed' : result.data.status;
      break;

    case 'block':
      if (rule.action_value === 'true' || rule.action_value === true) {
        result.blocked = true;
        result.reason = rule.block_message || `Booking blocked by rule: ${rule.name}`;
      }
      break;

    case 'set_priority':
      result.data.priority = rule.action_value;
      break;

    case 'set_location':
      result.data.location = rule.action_value;
      break;

    case 'set_buffer':
      result.data.buffer_minutes = parseInt(rule.action_value);
      break;

    case 'add_note':
      result.data.notes = result.data.notes
        ? `${result.data.notes}\n[Auto] ${rule.action_value}`
        : `[Auto] ${rule.action_value}`;
      break;

    case 'set_title_prefix':
      result.data.title = `${rule.action_value} ${result.data.title || 'Meeting'}`;
      break;

    case 'require_approval':
      result.data.status = 'pending_approval';
      result.data.requires_approval = true;
      break;

    case 'send_notification':
      result.data.send_extra_notification = true;
      result.data.notification_type = rule.action_value;
      break;

    default:
      console.warn(`Unknown action type: ${rule.action_type}`);
  }

  return result;
}

/**
 * Check if a booking should be blocked before creation
 * Quick check without modifying data
 */
async function shouldBlockBooking(client, userId, attendeeEmail) {
  try {
    const domain = attendeeEmail.includes('@') ? attendeeEmail.split('@')[1].toLowerCase() : '';

    const blockRule = await client.query(
      `SELECT * FROM scheduling_rules
       WHERE user_id = $1
       AND is_active = true
       AND action_type = 'block'
       AND action_value = 'true'
       AND (
         (trigger_type = 'domain' AND LOWER(trigger_value) = $2)
         OR (trigger_type = 'email' AND LOWER(trigger_value) = $3)
       )
       LIMIT 1`,
      [userId, domain, attendeeEmail.toLowerCase()]
    );

    if (blockRule.rows.length > 0) {
      return {
        blocked: true,
        reason: blockRule.rows[0].block_message || `Bookings from ${domain || attendeeEmail} are not accepted`
      };
    }

    return { blocked: false };
  } catch (error) {
    console.error('Error checking block rules:', error);
    return { blocked: false };
  }
}

module.exports = {
  applySchedulingRules,
  shouldBlockBooking
};
