/**
 * Dashboard Intelligence Service
 * Provides proactive insights, alerts, and recommendations for dashboard
 */

const pool = require('../config/database');

/**
 * Get comprehensive dashboard intelligence
 */
async function getDashboardIntelligence(userId) {
  try {
    // Run all intelligence functions independently with fallbacks
    const [alerts, relationships, patterns, recommendations, weekAnalysis] = await Promise.allSettled([
      getProactiveAlerts(userId),
      getRelationshipInsights(userId),
      getBehavioralPatterns(userId),
      getActionableRecommendations(userId),
      getWeekAnalysis(userId),
    ]);

    return {
      alerts: alerts.status === 'fulfilled' ? alerts.value : [],
      relationships: relationships.status === 'fulfilled' ? relationships.value : [],
      patterns: patterns.status === 'fulfilled' ? patterns.value : {},
      recommendations: recommendations.status === 'fulfilled' ? recommendations.value : [],
      weekAnalysis: weekAnalysis.status === 'fulfilled' ? weekAnalysis.value : {},
    };
  } catch (error) {
    console.error('Error getting dashboard intelligence:', error);
    return {
      alerts: [],
      relationships: [],
      patterns: {},
      recommendations: [],
      weekAnalysis: {},
    };
  }
}

/**
 * Get proactive alerts for the user
 */
async function getProactiveAlerts(userId) {
  const alerts = [];

  try {
    // Get this week's booking count
    const thisWeekResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1
        AND start_time >= date_trunc('week', CURRENT_DATE)
        AND start_time < date_trunc('week', CURRENT_DATE) + interval '1 week'
        AND status != 'cancelled'
    `, [userId]);

    const thisWeekCount = parseInt(thisWeekResult.rows[0].count);

    // Alert: Heavy week
    if (thisWeekCount >= 10) {
      alerts.push({
        type: 'heavy_week',
        severity: 'warning',
        icon: 'alert-triangle',
        title: 'Heavy Week Ahead',
        message: `You have ${thisWeekCount} meetings this week. Consider blocking time for focused work.`,
        action: { text: 'Add Buffer Time', link: '/rules' },
        color: 'orange',
      });
    }

    // Alert: Light week - opportunity to market
    if (thisWeekCount <= 2) {
      alerts.push({
        type: 'light_week',
        severity: 'info',
        icon: 'sparkles',
        title: 'Light Week - Great Time to Market',
        message: `Only ${thisWeekCount} meeting${thisWeekCount === 1 ? '' : 's'} this week. Share your booking link to fill your calendar!`,
        action: { text: 'Share Calendar', link: '/my-links' },
        color: 'blue',
      });
    }

    // Check for upcoming meeting gaps (no meetings in next 3 days)
    const nextThreeDaysResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1
        AND start_time >= CURRENT_DATE
        AND start_time < CURRENT_DATE + interval '3 days'
        AND status != 'cancelled'
    `, [userId]);

    if (parseInt(nextThreeDaysResult.rows[0].count) === 0) {
      alerts.push({
        type: 'quiet_next_days',
        severity: 'info',
        icon: 'calendar-off',
        title: 'No Meetings Next 3 Days',
        message: 'Your calendar is clear. Perfect time for deep work or client outreach.',
        action: { text: 'View Calendar', link: '/bookings' },
        color: 'green',
      });
    }

    // Check for weekend bookings
    const weekendResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1
        AND start_time >= date_trunc('week', CURRENT_DATE) + interval '5 days'
        AND start_time < date_trunc('week', CURRENT_DATE) + interval '7 days'
        AND status != 'cancelled'
    `, [userId]);

    if (parseInt(weekendResult.rows[0].count) > 0) {
      alerts.push({
        type: 'weekend_bookings',
        severity: 'warning',
        icon: 'alert-circle',
        title: 'Weekend Meetings Scheduled',
        message: `You have ${weekendResult.rows[0].count} meeting${parseInt(weekendResult.rows[0].count) === 1 ? '' : 's'} this weekend. Don't forget to rest!`,
        action: null,
        color: 'purple',
      });
    }

    // Check for no active event types
    const eventTypesResult = await pool.query(`
      SELECT COUNT(*) as count FROM event_types WHERE user_id = $1
    `, [userId]);

    if (parseInt(eventTypesResult.rows[0].count) === 0) {
      alerts.push({
        type: 'no_event_types',
        severity: 'error',
        icon: 'alert-triangle',
        title: 'No Event Types Created',
        message: 'Create your first event type to start accepting bookings.',
        action: { text: 'Create Event Type', link: '/events' },
        color: 'red',
      });
    }

  } catch (error) {
    console.error('Error getting proactive alerts:', error);
  }

  return alerts;
}

/**
 * Get relationship insights (top collaborators, meeting frequency)
 */
async function getRelationshipInsights(userId) {
  try {
    const result = await pool.query(`
      SELECT
        attendee_email,
        attendee_name,
        COUNT(*) as meeting_count,
        MAX(start_time) as last_meeting_date,
        SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
      FROM bookings
      WHERE user_id = $1 AND status != 'cancelled'
      GROUP BY attendee_email, attendee_name
      HAVING COUNT(*) >= 2
      ORDER BY meeting_count DESC
      LIMIT 5
    `, [userId]);

    return result.rows.map(row => ({
      email: row.attendee_email,
      name: row.attendee_name || row.attendee_email.split('@')[0],
      meetingCount: parseInt(row.meeting_count),
      lastMeeting: row.last_meeting_date,
      totalHours: parseFloat(row.total_hours).toFixed(1),
      daysSinceLastMeeting: Math.floor((Date.now() - new Date(row.last_meeting_date).getTime()) / (1000 * 60 * 60 * 24)),
    }));
  } catch (error) {
    console.error('Error getting relationship insights:', error);
    return [];
  }
}

/**
 * Get behavioral patterns (busiest days, preferred times)
 */
async function getBehavioralPatterns(userId) {
  try {
    // Get busiest day of week
    const dayResult = await pool.query(`
      SELECT
        EXTRACT(DOW FROM start_time) as dow,
        COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND status = 'confirmed'
      GROUP BY EXTRACT(DOW FROM start_time)
      ORDER BY count DESC
      LIMIT 1
    `, [userId]);

    // Get preferred hour
    const hourResult = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM start_time) as hour,
        COUNT(*) as count
      FROM bookings
      WHERE user_id = $1 AND status = 'confirmed'
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY count DESC
      LIMIT 1
    `, [userId]);

    // Get average meeting duration
    const durationResult = await pool.query(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) as avg_duration_minutes
      FROM bookings
      WHERE user_id = $1 AND status = 'confirmed'
    `, [userId]);

    // Get meeting type distribution - skip if column doesn't exist
    let typeResult = { rows: [] };
    try {
      typeResult = await pool.query(`
        SELECT
          event_type,
          COUNT(*) as count
        FROM bookings
        WHERE user_id = $1 AND status = 'confirmed' AND event_type IS NOT NULL
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 3
      `, [userId]);
    } catch (error) {
      // Column might not exist, skip this metric silently
    }

    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const busiestDay = dayResult.rows[0] ? dayMap[dayResult.rows[0].dow] : null;
    const preferredHour = hourResult.rows[0] ? parseInt(hourResult.rows[0].hour) : null;

    return {
      busiestDay,
      busiestDayCount: dayResult.rows[0] ? parseInt(dayResult.rows[0].count) : 0,
      preferredHour,
      preferredHourDisplay: preferredHour !== null ? formatHour(preferredHour) : null,
      avgDuration: durationResult.rows[0] ? Math.round(parseFloat(durationResult.rows[0].avg_duration_minutes)) : null,
      topMeetingTypes: typeResult.rows.map(row => ({
        type: row.event_type,
        count: parseInt(row.count),
      })),
    };
  } catch (error) {
    console.error('Error getting behavioral patterns:', error);
    return {};
  }
}

/**
 * Get actionable recommendations
 */
async function getActionableRecommendations(userId) {
  const recommendations = [];

  try {
    // Check if user has templates
    const templatesResult = await pool.query(`
      SELECT COUNT(*) as count FROM meeting_templates WHERE user_id = $1
    `, [userId]).catch(() => ({ rows: [{ count: 0 }] }));

    const templateCount = parseInt(templatesResult.rows[0].count);

    // Check total bookings
    const bookingsResult = await pool.query(`
      SELECT COUNT(*) as count FROM bookings WHERE user_id = $1
    `, [userId]);

    const totalBookings = parseInt(bookingsResult.rows[0].count);

    // Recommendation: Create templates if you have meetings but no templates
    if (totalBookings >= 5 && templateCount === 0) {
      recommendations.push({
        type: 'create_templates',
        priority: 'medium',
        icon: 'file-text',
        title: 'Save Time with Meeting Templates',
        description: `You've had ${totalBookings} meetings. Create templates with pre-filled agendas to save time!`,
        action: { text: 'Create Template', link: '/meeting-templates' },
        color: 'purple',
      });
    }

    // Check if user has smart rules
    const rulesResult = await pool.query(`
      SELECT COUNT(*) as count FROM scheduling_rules WHERE user_id = $1 AND is_active = TRUE
    `, [userId]).catch(() => ({ rows: [{ count: 0 }] }));

    const rulesCount = parseInt(rulesResult.rows[0].count);

    // Recommendation: Add smart rules
    if (rulesCount === 0 && totalBookings >= 3) {
      recommendations.push({
        type: 'add_rules',
        priority: 'high',
        icon: 'zap',
        title: 'Automate with Smart Rules',
        description: 'Add buffer time, block certain days, or route meetings automatically.',
        action: { text: 'Create Rule', link: '/rules' },
        color: 'blue',
      });
    }

    // Check for repeat meetings without recurrence (skip if column doesn't exist)
    try {
      const repeatResult = await pool.query(`
        SELECT attendee_email, COUNT(*) as count
        FROM bookings
        WHERE user_id = $1 AND status != 'cancelled'
        GROUP BY attendee_email
        HAVING COUNT(*) >= 4
        LIMIT 1
      `, [userId]);

      if (repeatResult.rows.length > 0) {
        const repeatAttendee = repeatResult.rows[0];
        recommendations.push({
          type: 'setup_recurring',
          priority: 'medium',
          icon: 'repeat',
          title: 'Set Up Recurring Meeting',
          description: `You've met with ${repeatAttendee.attendee_email} ${repeatAttendee.count} times. Consider a recurring meeting.`,
          action: { text: 'Schedule Recurring', link: '/bookings' },
          color: 'green',
        });
      }
    } catch (error) {
      // Skip if column doesn't exist
    }

    // Check if no meetings in next 7 days
    const upcomingResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1
        AND start_time >= CURRENT_DATE
        AND start_time < CURRENT_DATE + interval '7 days'
        AND status != 'cancelled'
    `, [userId]);

    if (parseInt(upcomingResult.rows[0].count) === 0 && totalBookings > 0) {
      recommendations.push({
        type: 'market_availability',
        priority: 'high',
        icon: 'share-2',
        title: 'No Meetings Next Week',
        description: 'Your calendar is wide open. Share your booking link to get booked!',
        action: { text: 'Share Link', link: '/my-links' },
        color: 'pink',
      });
    }

  } catch (error) {
    console.error('Error getting recommendations:', error);
  }

  // Sort by priority
  const priorityMap = { high: 3, medium: 2, low: 1 };
  return recommendations.sort((a, b) => priorityMap[b.priority] - priorityMap[a.priority]);
}

/**
 * Get week analysis (comparison to average)
 */
async function getWeekAnalysis(userId) {
  try {
    // This week's bookings
    const thisWeekResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1
        AND start_time >= date_trunc('week', CURRENT_DATE)
        AND start_time < date_trunc('week', CURRENT_DATE) + interval '1 week'
        AND status != 'cancelled'
    `, [userId]);

    // Average weekly bookings (last 8 weeks)
    const avgResult = await pool.query(`
      SELECT AVG(weekly_count) as avg_weekly
      FROM (
        SELECT
          date_trunc('week', start_time) as week,
          COUNT(*) as weekly_count
        FROM bookings
        WHERE user_id = $1
          AND start_time >= CURRENT_DATE - interval '8 weeks'
          AND status != 'cancelled'
        GROUP BY date_trunc('week', start_time)
      ) weekly_counts
    `, [userId]);

    const thisWeek = parseInt(thisWeekResult.rows[0].count);
    const avgWeekly = avgResult.rows[0].avg_weekly ? parseFloat(avgResult.rows[0].avg_weekly) : thisWeek;
    const percentChange = avgWeekly > 0 ? ((thisWeek - avgWeekly) / avgWeekly * 100).toFixed(0) : 0;

    return {
      thisWeek,
      avgWeekly: Math.round(avgWeekly),
      percentChange: parseInt(percentChange),
      trend: thisWeek > avgWeekly ? 'up' : thisWeek < avgWeekly ? 'down' : 'stable',
    };
  } catch (error) {
    console.error('Error getting week analysis:', error);
    return { thisWeek: 0, avgWeekly: 0, percentChange: 0, trend: 'stable' };
  }
}

/**
 * Helper: Format hour (24h to 12h AM/PM)
 */
function formatHour(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${ampm}`;
}

module.exports = {
  getDashboardIntelligence,
  getProactiveAlerts,
  getRelationshipInsights,
  getBehavioralPatterns,
  getActionableRecommendations,
  getWeekAnalysis,
};
