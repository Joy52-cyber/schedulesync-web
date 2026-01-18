/**
 * Proactive Suggestions Service
 * Generates context-aware helpful suggestions for users
 */

const pool = require('../config/database');

/**
 * Get proactive suggestions based on user context
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - List of proactive suggestions
 */
async function getProactiveSuggestions(userId) {
  const suggestions = [];

  try {
    // Check: No availability set
    const availabilityCheck = await pool.query(
      'SELECT COUNT(*) as count FROM user_availability WHERE user_id = $1',
      [userId]
    );
    if (parseInt(availabilityCheck.rows[0].count) === 0) {
      suggestions.push({
        type: 'setup_availability',
        priority: 'high',
        message: "You haven't set your availability yet. Want to do that now?",
        action: { text: 'Set Availability', link: '/availability' }
      });
    }

    // Check: No event types created
    const eventTypesCheck = await pool.query(
      'SELECT COUNT(*) as count FROM event_types WHERE user_id = $1',
      [userId]
    );
    if (parseInt(eventTypesCheck.rows[0].count) === 0) {
      suggestions.push({
        type: 'create_event_type',
        priority: 'high',
        message: "No event types created yet. Create one to start accepting bookings!",
        action: { text: 'Create Event Type', link: '/events' }
      });
    }

    // Check: No recent bookings (last 30 days)
    const recentBookings = await pool.query(
      `SELECT COUNT(*) as count FROM bookings
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );
    if (parseInt(recentBookings.rows[0].count) === 0 && parseInt(eventTypesCheck.rows[0].count) > 0) {
      suggestions.push({
        type: 'share_link',
        priority: 'medium',
        message: "No recent bookings. Share your booking link to get meetings scheduled!",
        action: { text: 'Get Link', command: 'my link' }
      });
    }

    // Check: Heavy week ahead (10+ meetings)
    const upcomingWeek = await pool.query(
      `SELECT COUNT(*) as count FROM bookings
       WHERE user_id = $1
       AND start_time >= CURRENT_DATE
       AND start_time < CURRENT_DATE + INTERVAL '7 days'
       AND status IN ('confirmed', 'pending_approval')`,
      [userId]
    );
    if (parseInt(upcomingWeek.rows[0].count) >= 10) {
      // Check if they have buffer rules
      const bufferRules = await pool.query(
        `SELECT COUNT(*) as count FROM scheduling_rules
         WHERE user_id = $1 AND action_type = 'add_buffer' AND is_active = true`,
        [userId]
      );
      if (parseInt(bufferRules.rows[0].count) === 0) {
        suggestions.push({
          type: 'add_buffer',
          priority: 'medium',
          message: `You have ${upcomingWeek.rows[0].count} meetings this week! Consider adding buffer time between meetings.`,
          action: { text: 'Add Buffer Rule', command: 'add 15 min buffer after meetings' }
        });
      }
    }

    // Check: Pending action items
    const userEmail = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userEmail.rows.length > 0) {
      // Check if booking_action_items table exists and has assigned_to column
      const columnCheck = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'booking_action_items' AND column_name = 'assigned_to'
      `);

      if (columnCheck.rows.length > 0) {
        const actionItems = await pool.query(
          `SELECT COUNT(*) as count FROM booking_action_items
           WHERE assigned_to = $1 AND completed = false`,
          [userEmail.rows[0].email]
        );
        if (parseInt(actionItems.rows[0].count) > 0) {
          suggestions.push({
            type: 'pending_action_items',
            priority: 'low',
            message: `You have ${actionItems.rows[0].count} pending action item${actionItems.rows[0].count !== 1 ? 's' : ''}. Want to review them?`,
            action: { text: 'View Action Items', link: '/dashboard' }
          });
        }
      }
    }

    // Check: Many meetings with no templates (5+ bookings, 0 templates)
    const totalBookings = await pool.query(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = $1',
      [userId]
    );

    const templates = await pool.query(
      'SELECT COUNT(*) as count FROM meeting_templates WHERE user_id = $1',
      [userId]
    );

    if (parseInt(totalBookings.rows[0].count) >= 5 && parseInt(templates.rows[0].count) === 0) {
      suggestions.push({
        type: 'create_template',
        priority: 'low',
        message: 'Save time by creating meeting templates for recurring meeting types!',
        action: { text: 'View Templates', link: '/templates' }
      });
    }

    // Sort by priority and return top 2 suggestions
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return suggestions
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
      .slice(0, 2);

  } catch (error) {
    console.error('Error getting proactive suggestions:', error);
    return [];
  }
}

module.exports = {
  getProactiveSuggestions
};
