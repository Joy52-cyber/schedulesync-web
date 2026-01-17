const pool = require('../config/database');
const { getMutualAvailableSlots } = require('./emailBot');

/**
 * Find availability for multiple participants
 * @param {Array<string>} participantEmails - Array of participant email addresses
 * @param {number} duration - Meeting duration in minutes
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Available slots and metadata
 */
async function findGroupAvailability(participantEmails, duration, options = {}) {
  try {
    const {
      maxSlots = 10,
      timezone = 'America/New_York',
      preferences = {}
    } = options;

    console.log(`🔍 Finding group availability for ${participantEmails.length} participants`);

    // Convert emails to user IDs (only for TruCal users)
    const userIds = [];
    const participantInfo = [];

    for (const email of participantEmails) {
      const userResult = await pool.query(
        'SELECT id, name, email FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        userIds.push(user.id);
        participantInfo.push({
          email: user.email,
          name: user.name,
          isTruCalUser: true,
          userId: user.id
        });
      } else {
        participantInfo.push({
          email: email,
          name: email.split('@')[0],
          isTruCalUser: false,
          userId: null
        });
      }
    }

    if (userIds.length === 0) {
      return {
        availableSlots: [],
        participantCount: participantEmails.length,
        truCalUsersCount: 0,
        participants: participantInfo,
        error: 'No TruCal users found in participant list. At least one participant must be a TruCal user.'
      };
    }

    // Use existing multi-participant logic
    const slots = await getMutualAvailableSlots(
      userIds,
      duration,
      preferences,
      maxSlots,
      timezone
    );

    console.log(`✅ Found ${slots.length} mutual available slots`);

    return {
      availableSlots: slots,
      participantCount: participantEmails.length,
      truCalUsersCount: userIds.length,
      participants: participantInfo,
      duration: duration,
      timezone: timezone
    };

  } catch (error) {
    console.error('Error finding group availability:', error);
    throw error;
  }
}

/**
 * Find availability for team members
 * @param {number} teamId - The team ID
 * @param {number} duration - Meeting duration in minutes
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Available slots and team member info
 */
async function findTeamAvailability(teamId, duration, options = {}) {
  try {
    const {
      maxSlots = 10,
      timezone = 'America/New_York',
      includeAllMembers = true
    } = options;

    console.log(`🔍 Finding team availability for team ${teamId}`);

    // Get all active team members
    const membersResult = await pool.query(
      `SELECT tm.id, tm.user_id, tm.name, tm.email, tm.is_active, u.timezone
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1 AND tm.is_active = true
       ORDER BY tm.name`,
      [teamId]
    );

    if (membersResult.rows.length === 0) {
      return {
        availableSlots: [],
        teamMemberCount: 0,
        teamMembers: [],
        error: 'No active team members found'
      };
    }

    const teamMembers = membersResult.rows;

    // Get user IDs for TruCal users in the team
    const userIds = teamMembers
      .filter(m => m.user_id)
      .map(m => m.user_id);

    if (userIds.length === 0) {
      return {
        availableSlots: [],
        teamMemberCount: teamMembers.length,
        teamMembers: teamMembers.map(m => ({
          id: m.id,
          name: m.name,
          email: m.email,
          isTruCalUser: false
        })),
        error: 'No TruCal users found in team members'
      };
    }

    // Find mutual availability
    const slots = await getMutualAvailableSlots(
      userIds,
      duration,
      {},
      maxSlots,
      timezone
    );

    console.log(`✅ Found ${slots.length} mutual slots for ${teamMembers.length} team members`);

    return {
      availableSlots: slots,
      teamMemberCount: teamMembers.length,
      teamMembers: teamMembers.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        isTruCalUser: !!m.user_id,
        userId: m.user_id,
        timezone: m.timezone
      })),
      duration: duration,
      timezone: timezone
    };

  } catch (error) {
    console.error('Error finding team availability:', error);
    throw error;
  }
}

/**
 * Check if a specific time slot works for all participants
 * @param {Array<string>} participantEmails - Array of participant emails
 * @param {Date} startTime - Proposed start time
 * @param {Date} endTime - Proposed end time
 * @returns {Promise<object>} - Conflict information
 */
async function checkGroupSlotAvailability(participantEmails, startTime, endTime) {
  try {
    const conflicts = [];

    for (const email of participantEmails) {
      // Find user by email
      const userResult = await pool.query(
        'SELECT id, name FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        // Non-TruCal user, assume available
        continue;
      }

      const userId = userResult.rows[0].id;
      const userName = userResult.rows[0].name;

      // Check for conflicts
      const conflictResult = await pool.query(
        `SELECT id, title, start_time, end_time
         FROM bookings
         WHERE user_id = $1
           AND status IN ('confirmed', 'pending_approval')
           AND start_time < $2
           AND end_time > $3`,
        [userId, endTime, startTime]
      );

      if (conflictResult.rows.length > 0) {
        conflicts.push({
          participant: {
            email: email,
            name: userName
          },
          conflicts: conflictResult.rows.map(c => ({
            title: c.title,
            startTime: c.start_time,
            endTime: c.end_time
          }))
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts,
      availableParticipants: participantEmails.length - conflicts.length,
      totalParticipants: participantEmails.length
    };

  } catch (error) {
    console.error('Error checking group slot availability:', error);
    throw error;
  }
}

module.exports = {
  findGroupAvailability,
  findTeamAvailability,
  checkGroupSlotAvailability
};
