/**
 * Scheduling Service
 * Handles scheduling rules, auto-confirm logic, and preference learning
 */

const pool = require('../config/database');

// Apply scheduling rules during booking
async function applySchedulingRules(userId, bookingData) {
  try {
    // Get active rules for this user, sorted by priority
    const rulesResult = await pool.query(
      `SELECT * FROM scheduling_rules
       WHERE user_id = $1 AND is_active = true
       ORDER BY priority DESC`,
      [userId]
    );

    const rules = rulesResult.rows;
    const appliedRules = [];
    let modifiedData = { ...bookingData };
    let blocked = false;
    let blockReason = '';
    let autoApproved = false;

    for (const rule of rules) {
      const conditions = rule.conditions || {};
      const actions = rule.actions || {};

      // Check if rule conditions match
      let conditionsMet = true;

      // Check event type condition
      if (conditions.event_type) {
        const eventName = (bookingData.event_name || bookingData.title || '').toLowerCase();
        if (!eventName.includes(conditions.event_type)) {
          conditionsMet = false;
        }
      }

      // Check email domain condition
      if (conditions.email_domain) {
        const email = (bookingData.attendee_email || '').toLowerCase();
        if (!email.endsWith('@' + conditions.email_domain)) {
          conditionsMet = false;
        }
      }

      // Check day condition
      if (conditions.day_of_week !== undefined) {
        const bookingDay = new Date(bookingData.start_time).getDay();
        if (bookingDay !== conditions.day_of_week) {
          conditionsMet = false;
        }
      }

      if (!conditionsMet) continue;

      // Apply actions
      switch (rule.rule_type) {
        case 'buffer':
          if (actions.buffer_minutes) {
            modifiedData.buffer_minutes = actions.buffer_minutes;
            modifiedData.buffer_position = actions.buffer_position || 'after';
            appliedRules.push({ rule: rule.rule_text, action: `Added ${actions.buffer_minutes}min buffer` });
          }
          break;

        case 'routing':
          if (actions.assign_to && actions.assign_to.length > 0) {
            modifiedData.assigned_to = actions.assign_to;
            appliedRules.push({ rule: rule.rule_text, action: `Routed to ${actions.assign_to.join(', ')}` });
          }
          break;

        case 'priority':
          if (actions.priority_level) {
            modifiedData.priority = actions.priority_level;
            appliedRules.push({ rule: rule.rule_text, action: `Set priority: ${actions.priority_level}` });
          }
          break;

        case 'availability':
          if (actions.block_days) {
            const bookingDay = new Date(bookingData.start_time).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            if (actions.block_days.includes(bookingDay)) {
              blocked = true;
              blockReason = rule.rule_text;
              appliedRules.push({ rule: rule.rule_text, action: 'Blocked by availability rule' });
            }
          }
          break;

        case 'auto_response':
          if (actions.auto_action === 'confirm') {
            autoApproved = true;
            appliedRules.push({ rule: rule.rule_text, action: 'Auto-approved' });
          } else if (actions.auto_action === 'decline') {
            blocked = true;
            blockReason = rule.rule_text;
            appliedRules.push({ rule: rule.rule_text, action: 'Auto-declined' });
          }
          break;
      }
    }

    return { modifiedData, appliedRules, blocked, blockReason, autoApproved };
  } catch (error) {
    console.error('Apply scheduling rules error:', error);
    return { modifiedData: bookingData, appliedRules: [], blocked: false, blockReason: '', autoApproved: false };
  }
}

// Check if booking should be auto-confirmed based on user's autonomous settings
async function shouldAutoConfirm(userId, bookingData) {
  try {
    const user = await pool.query(
      'SELECT autonomous_mode, auto_confirm_rules FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) return { autoConfirm: false, reason: 'User not found' };

    const { autonomous_mode, auto_confirm_rules } = user.rows[0];
    const rules = auto_confirm_rules || {};

    // Manual mode - never auto-confirm
    if (autonomous_mode === 'manual') {
      return { autoConfirm: false, reason: 'Manual mode enabled', mode: autonomous_mode };
    }

    // Check rules
    let shouldConfirm = autonomous_mode === 'auto'; // Default to true for auto mode
    let reasons = [];

    // Rule: Max duration
    if (rules.max_duration && bookingData.duration > rules.max_duration) {
      shouldConfirm = false;
      reasons.push(`Duration ${bookingData.duration}min exceeds limit ${rules.max_duration}min`);
    }

    // Rule: Allowed hours
    if (rules.allowed_hours_start !== undefined && rules.allowed_hours_end !== undefined) {
      const bookingHour = new Date(bookingData.start_time).getHours();
      if (bookingHour < rules.allowed_hours_start || bookingHour >= rules.allowed_hours_end) {
        shouldConfirm = false;
        reasons.push(`Time ${bookingHour}:00 outside allowed hours ${rules.allowed_hours_start}-${rules.allowed_hours_end}`);
      }
    }

    // Rule: Blocked days
    if (rules.blocked_days && rules.blocked_days.length > 0) {
      const dayOfWeek = new Date(bookingData.start_time).getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      if (rules.blocked_days.includes(dayNames[dayOfWeek])) {
        shouldConfirm = false;
        reasons.push(`${dayNames[dayOfWeek]} is blocked`);
      }
    }

    // Rule: Max daily bookings
    if (rules.max_daily_bookings) {
      const bookingDate = new Date(bookingData.start_time);
      bookingDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(bookingDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const dailyCount = await pool.query(`
        SELECT COUNT(*) as count FROM bookings
        WHERE user_id = $1 AND start_time >= $2 AND start_time < $3 AND status = 'confirmed'
      `, [userId, bookingDate, nextDay]);

      if (parseInt(dailyCount.rows[0].count) >= rules.max_daily_bookings) {
        shouldConfirm = false;
        reasons.push(`Daily limit of ${rules.max_daily_bookings} bookings reached`);
      }
    }

    // Rule: VIP domains (always confirm)
    if (rules.vip_domains && rules.vip_domains.length > 0 && bookingData.attendee_email) {
      const emailDomain = bookingData.attendee_email.split('@')[1];
      if (rules.vip_domains.includes(emailDomain)) {
        shouldConfirm = true;
        reasons = [`VIP domain: ${emailDomain}`];
      }
    }

    // Rule: Blocked domains (never confirm)
    if (rules.blocked_domains && rules.blocked_domains.length > 0 && bookingData.attendee_email) {
      const emailDomain = bookingData.attendee_email.split('@')[1];
      if (rules.blocked_domains.includes(emailDomain)) {
        shouldConfirm = false;
        reasons.push(`Blocked domain: ${emailDomain}`);
      }
    }

    console.log(`Auto-confirm check for user ${userId}: ${shouldConfirm ? 'YES' : 'NO'} - ${reasons.join(', ') || 'Default rules'}`);

    return {
      autoConfirm: shouldConfirm,
      reason: reasons.join('; ') || (shouldConfirm ? 'Meets all criteria' : 'Does not meet criteria'),
      mode: autonomous_mode
    };
  } catch (error) {
    console.error('Auto-confirm check error:', error);
    return { autoConfirm: false, reason: 'Error checking rules', mode: 'manual' };
  }
}

// Record booking pattern for preference learning
async function recordBookingPattern(userId, booking) {
  try {
    const startTime = new Date(booking.start_time);
    const dayOfWeek = startTime.getDay();
    const hourOfDay = startTime.getHours();
    const duration = booking.duration || 30;

    await pool.query(`
      INSERT INTO booking_patterns (user_id, day_of_week, hour_of_day, duration, booking_count)
      VALUES ($1, $2, $3, $4, 1)
      ON CONFLICT (user_id, day_of_week, hour_of_day, duration)
      DO UPDATE SET
        booking_count = booking_patterns.booking_count + 1,
        updated_at = NOW()
    `, [userId, dayOfWeek, hourOfDay, duration]);

    console.log(`Recorded booking pattern: user=${userId}, day=${dayOfWeek}, hour=${hourOfDay}`);
  } catch (error) {
    console.error('Record booking pattern error:', error);
  }
}

module.exports = {
  applySchedulingRules,
  shouldAutoConfirm,
  recordBookingPattern
};
