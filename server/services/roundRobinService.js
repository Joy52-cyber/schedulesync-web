const pool = require('../config/database');
const { checkBookingConflicts } = require('./conflictDetection');

/**
 * Assign the next team member using round-robin (fairness-based) algorithm
 * Selects the member with the fewest upcoming confirmed bookings
 * @param {number} teamId - The team ID
 * @param {object} options - Additional options
 * @returns {Promise<object|null>} - The assigned team member or null
 */
async function assignNextTeamMember(teamId, options = {}) {
  try {
    const { excludeMemberIds = [] } = options;

    console.log(`🔄 Round-robin assignment for team ${teamId}`);

    // Get all active team members with their booking counts
    const excludeClause = excludeMemberIds.length > 0
      ? `AND tm.id NOT IN (${excludeMemberIds.map((_, i) => `$${i + 2}`).join(', ')})`
      : '';

    const queryParams = [teamId, ...excludeMemberIds];

    const membersResult = await pool.query(
      `SELECT
         tm.id,
         tm.user_id,
         tm.name,
         tm.email,
         tm.is_active,
         COUNT(b.id) FILTER (
           WHERE b.status = 'confirmed'
           AND b.start_time > NOW()
         ) as upcoming_booking_count,
         COUNT(b.id) FILTER (
           WHERE b.status = 'confirmed'
           AND b.start_time > NOW() - INTERVAL '7 days'
         ) as recent_booking_count
       FROM team_members tm
       LEFT JOIN bookings b ON (tm.id = b.assigned_member_id)
       WHERE tm.team_id = $1 AND tm.is_active = true ${excludeClause}
       GROUP BY tm.id, tm.user_id, tm.name, tm.email, tm.is_active
       ORDER BY upcoming_booking_count ASC, recent_booking_count ASC, tm.id ASC`,
      queryParams
    );

    if (membersResult.rows.length === 0) {
      console.log(`No available team members for team ${teamId}`);
      return null;
    }

    // Return member with fewest bookings (first in sorted result)
    const assigned = membersResult.rows[0];

    console.log(`✅ Assigned member ${assigned.name} (${assigned.upcoming_booking_count} upcoming bookings)`);

    return {
      memberId: assigned.id,
      userId: assigned.user_id,
      name: assigned.name,
      email: assigned.email,
      upcomingBookings: parseInt(assigned.upcoming_booking_count),
      recentBookings: parseInt(assigned.recent_booking_count)
    };

  } catch (error) {
    console.error('Error in round-robin assignment:', error);
    throw error;
  }
}

/**
 * Assign the first available team member (based on calendar availability)
 * Checks each member in order until finding one without conflicts
 * @param {number} teamId - The team ID
 * @param {Date} startTime - Proposed start time
 * @param {Date} endTime - Proposed end time
 * @param {object} options - Additional options
 * @returns {Promise<object|null>} - The assigned team member or null
 */
async function assignFirstAvailableMember(teamId, startTime, endTime, options = {}) {
  try {
    const { excludeMemberIds = [], includeBuffer = true } = options;

    console.log(`⏰ First-available assignment for team ${teamId}`);

    // Get all active team members
    const membersResult = await pool.query(
      `SELECT tm.id, tm.user_id, tm.name, tm.email
       FROM team_members tm
       WHERE tm.team_id = $1 AND tm.is_active = true
       ORDER BY tm.id ASC`,
      [teamId]
    );

    if (membersResult.rows.length === 0) {
      console.log(`No team members found for team ${teamId}`);
      return null;
    }

    // Check each member for availability
    for (const member of membersResult.rows) {
      // Skip excluded members
      if (excludeMemberIds.includes(member.id)) {
        continue;
      }

      // Skip members without a user_id (non-TruCal members can't check conflicts)
      if (!member.user_id) {
        console.log(`  ⏭️  ${member.name} - No user_id, skipping`);
        continue;
      }

      // Check for conflicts
      const conflict = await checkBookingConflicts(
        member.user_id,
        startTime,
        endTime,
        {
          includeBuffer: includeBuffer,
          eventTypeId: null
        }
      );

      if (!conflict || !conflict.hasConflict) {
        console.log(`✅ Assigned first available member: ${member.name}`);
        return {
          memberId: member.id,
          userId: member.user_id,
          name: member.name,
          email: member.email
        };
      } else {
        console.log(`  ⏭️  ${member.name} - Conflict detected, trying next`);
      }
    }

    console.log(`❌ No available team members for the requested time`);
    return null;

  } catch (error) {
    console.error('Error in first-available assignment:', error);
    throw error;
  }
}

/**
 * Assign team member based on team's booking mode
 * @param {number} teamId - The team ID
 * @param {Date} startTime - Proposed start time (for first-available mode)
 * @param {Date} endTime - Proposed end time (for first-available mode)
 * @param {object} options - Additional options
 * @returns {Promise<object|null>} - The assigned team member or null
 */
async function assignTeamMember(teamId, startTime, endTime, options = {}) {
  try {
    // Get team's booking mode
    const teamResult = await pool.query(
      'SELECT booking_mode FROM teams WHERE id = $1',
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      console.log(`Team ${teamId} not found`);
      return null;
    }

    const bookingMode = teamResult.rows[0].booking_mode || 'round_robin';

    console.log(`📋 Team booking mode: ${bookingMode}`);

    if (bookingMode === 'first_available') {
      return await assignFirstAvailableMember(teamId, startTime, endTime, options);
    } else {
      // Default to round_robin
      return await assignNextTeamMember(teamId, options);
    }

  } catch (error) {
    console.error('Error assigning team member:', error);
    throw error;
  }
}

/**
 * Get team assignment statistics
 * @param {number} teamId - The team ID
 * @returns {Promise<object>} - Assignment fairness statistics
 */
async function getTeamAssignmentStats(teamId) {
  try {
    const statsResult = await pool.query(
      `SELECT
         tm.id,
         tm.name,
         COUNT(b.id) FILTER (WHERE b.status = 'confirmed' AND b.start_time > NOW()) as upcoming_count,
         COUNT(b.id) FILTER (WHERE b.status = 'confirmed' AND b.start_time > NOW() - INTERVAL '30 days') as last_30_days_count,
         COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as total_count
       FROM team_members tm
       LEFT JOIN bookings b ON (tm.id = b.assigned_member_id)
       WHERE tm.team_id = $1 AND tm.is_active = true
       GROUP BY tm.id, tm.name
       ORDER BY upcoming_count DESC`,
      [teamId]
    );

    const members = statsResult.rows.map(row => ({
      memberId: row.id,
      name: row.name,
      upcomingBookings: parseInt(row.upcoming_count),
      last30DaysBookings: parseInt(row.last_30_days_count),
      totalBookings: parseInt(row.total_count)
    }));

    // Calculate fairness score (lower is more fair)
    const upcomingCounts = members.map(m => m.upcomingBookings);
    const avgUpcoming = upcomingCounts.reduce((a, b) => a + b, 0) / upcomingCounts.length;
    const variance = upcomingCounts.reduce((sum, count) => sum + Math.pow(count - avgUpcoming, 2), 0) / upcomingCounts.length;
    const stdDev = Math.sqrt(variance);
    const fairnessScore = stdDev / (avgUpcoming || 1); // Coefficient of variation

    return {
      teamId: teamId,
      memberCount: members.length,
      members: members,
      fairness: {
        averageUpcoming: avgUpcoming,
        standardDeviation: stdDev,
        fairnessScore: fairnessScore,
        description: fairnessScore < 0.3 ? 'Excellent' : fairnessScore < 0.5 ? 'Good' : fairnessScore < 0.8 ? 'Fair' : 'Needs balancing'
      }
    };

  } catch (error) {
    console.error('Error getting team assignment stats:', error);
    throw error;
  }
}

module.exports = {
  assignNextTeamMember,
  assignFirstAvailableMember,
  assignTeamMember,
  getTeamAssignmentStats
};
