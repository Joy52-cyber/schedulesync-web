const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============ TEAM MEMBER AVAILABILITY ROUTES ============

// GET /api/team-members/:id/availability - Get team member availability settings
router.get('/:id/availability', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;

    console.log('Getting availability for member:', memberId);

    // Get team member and verify ownership
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.id = $1`,
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const member = memberResult.rows[0];

    // Verify ownership
    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get blocked times
    const blockedResult = await pool.query(
      `SELECT * FROM blocked_times
       WHERE team_member_id = $1
       ORDER BY start_time ASC`,
      [memberId]
    );

    res.json({
      member: {
        id: member.id,
        name: member.name,
        buffer_time: member.buffer_time || 0,
        working_hours: member.working_hours || {
          monday: { enabled: true, start: '09:00', end: '17:00' },
          tuesday: { enabled: true, start: '09:00', end: '17:00' },
          wednesday: { enabled: true, start: '09:00', end: '17:00' },
          thursday: { enabled: true, start: '09:00', end: '17:00' },
          friday: { enabled: true, start: '09:00', end: '17:00' },
          saturday: { enabled: false, start: '09:00', end: '17:00' },
          sunday: { enabled: false, start: '09:00', end: '17:00' },
        },
      },
      blocked_times: blockedResult.rows,
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed to get availability settings' });
  }
});

// PUT /api/team-members/:id/availability - Update team member availability settings
router.put('/:id/availability', authenticateToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const userId = req.user.id;
    const {
      buffer_time,
      lead_time_hours,
      booking_horizon_days,
      daily_booking_cap,
      working_hours,
      blocked_times
    } = req.body;

    console.log('Updating availability for member:', memberId);

    // Verify ownership
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.id = $1`,
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const member = memberResult.rows[0];

    if (member.owner_id !== userId && member.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Validate and fix working_hours structure
    const validatedWorkingHours = {};
    for (const [day, settings] of Object.entries(working_hours)) {
      if (settings.slots) {
        // Frontend sent wrong format with 'slots' array, fix it
        console.log(`Fixing invalid working_hours for ${day}`);
        validatedWorkingHours[day] = {
          enabled: settings.enabled || false,
          start: "09:00",
          end: "17:00"
        };
      } else {
        // Correct format already
        validatedWorkingHours[day] = {
          enabled: settings.enabled || false,
          start: settings.start || "09:00",
          end: settings.end || "17:00"
        };
      }
    }

    // Update team member settings
    await pool.query(
      `UPDATE team_members
       SET buffer_time = $1,
           lead_time_hours = $2,
           booking_horizon_days = $3,
           daily_booking_cap = $4,
           working_hours = $5
       WHERE id = $6`,
      [buffer_time || 0, lead_time_hours || 0, booking_horizon_days || 30,
       daily_booking_cap, JSON.stringify(validatedWorkingHours), memberId]
    );

    // Update blocked times
    await pool.query('DELETE FROM blocked_times WHERE team_member_id = $1', [memberId]);

    // Handle blocked times
    console.log('Processing blocked times:', blocked_times);

    if (blocked_times && blocked_times.length > 0) {
      console.log(`Saving ${blocked_times.length} blocked time(s)`);

      for (const block of blocked_times) {
        console.log('Processing block:', block);

        // Skip blocks with temp IDs and no dates
        if (!block.start_time || !block.end_time) {
          console.log('Skipping block - missing dates');
          continue;
        }

        // Convert datetime-local format to ISO timestamp
        const startTime = new Date(block.start_time).toISOString();
        const endTime = new Date(block.end_time).toISOString();

        console.log('Inserting blocked time:', {
          memberId,
          startTime,
          endTime,
          reason: block.reason
        });

        try {
          await pool.query(
            `INSERT INTO blocked_times (team_member_id, start_time, end_time, reason)
             VALUES ($1, $2, $3, $4)`,
            [memberId, startTime, endTime, block.reason || null]
          );
          console.log('Blocked time inserted');
        } catch (blockError) {
          console.error('Failed to insert blocked time:', blockError);
        }
      }
    } else {
      console.log('No blocked times to save');
    }

    console.log('Availability settings updated');
    res.json({ success: true, message: 'Availability settings updated' });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Failed to update availability settings' });
  }
});

module.exports = router;
