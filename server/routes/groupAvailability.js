const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  findGroupAvailability,
  findTeamAvailability,
  checkGroupSlotAvailability
} = require('../services/groupAvailabilityService');
const { getTeamAssignmentStats } = require('../services/roundRobinService');

/**
 * POST /api/group-availability
 * Find mutual availability for multiple participants
 */
router.post('/group-availability', authenticateToken, async (req, res) => {
  try {
    const { participants, duration, timezone, maxSlots, preferences } = req.body;

    // Validation
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Participants array is required' });
    }

    if (!duration || duration < 1) {
      return res.status(400).json({ error: 'Valid duration is required' });
    }

    // Find group availability
    const result = await findGroupAvailability(participants, duration, {
      maxSlots: maxSlots || 10,
      timezone: timezone || 'America/New_York',
      preferences: preferences || {}
    });

    res.json(result);

  } catch (error) {
    console.error('Error finding group availability:', error);
    res.status(500).json({ error: 'Failed to find group availability' });
  }
});

/**
 * POST /api/teams/:id/availability
 * Find mutual availability for all team members
 */
router.post('/teams/:id/availability', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { duration, timezone, maxSlots } = req.body;

    if (!duration || duration < 1) {
      return res.status(400).json({ error: 'Valid duration is required' });
    }

    // Find team availability
    const result = await findTeamAvailability(teamId, duration, {
      maxSlots: maxSlots || 10,
      timezone: timezone || 'America/New_York'
    });

    res.json(result);

  } catch (error) {
    console.error('Error finding team availability:', error);
    res.status(500).json({ error: 'Failed to find team availability' });
  }
});

/**
 * POST /api/group-availability/check-slot
 * Check if a specific time slot works for all participants
 */
router.post('/group-availability/check-slot', authenticateToken, async (req, res) => {
  try {
    const { participants, startTime, endTime } = req.body;

    // Validation
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Participants array is required' });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Start time and end time are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start >= end) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Check slot availability
    const result = await checkGroupSlotAvailability(participants, start, end);

    res.json(result);

  } catch (error) {
    console.error('Error checking group slot:', error);
    res.status(500).json({ error: 'Failed to check group slot availability' });
  }
});

/**
 * GET /api/teams/:id/assignment-stats
 * Get team assignment fairness statistics
 */
router.get('/teams/:id/assignment-stats', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;

    const stats = await getTeamAssignmentStats(teamId);

    res.json(stats);

  } catch (error) {
    console.error('Error getting team assignment stats:', error);
    res.status(500).json({ error: 'Failed to get team assignment stats' });
  }
});

module.exports = router;
