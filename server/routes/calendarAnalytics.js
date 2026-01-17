const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getCalendarAnalytics } = require('../services/calendarAnalyticsService');

/**
 * GET /api/calendar-analytics
 * Get comprehensive calendar analytics
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange } = req.query;

    // Validate timeRange
    const validRanges = ['7d', '30d', '90d', 'all'];
    const range = validRanges.includes(timeRange) ? timeRange : '30d';

    const analytics = await getCalendarAnalytics(userId, range);

    res.json(analytics);

  } catch (error) {
    console.error('Error getting calendar analytics:', error);
    res.status(500).json({ error: 'Failed to get calendar analytics' });
  }
});

module.exports = router;
