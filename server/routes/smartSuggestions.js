const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getSmartSuggestions,
  analyzeBookingPatterns,
  getBookingPatterns
} = require('../services/smartSchedulingService');

/**
 * POST /api/smart-suggestions
 * Get AI-scored time slot suggestions
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      duration,
      attendeeEmail,
      timezone,
      maxSlots
    } = req.body;

    // Validation
    if (!duration || duration < 5 || duration > 480) {
      return res.status(400).json({ error: 'Duration must be between 5 and 480 minutes' });
    }

    const suggestions = await getSmartSuggestions(userId, {
      duration,
      attendeeEmail,
      timezone,
      maxSlots
    });

    res.json({
      suggestions,
      count: suggestions.length
    });

  } catch (error) {
    console.error('Error getting smart suggestions:', error);
    res.status(500).json({ error: 'Failed to get smart suggestions' });
  }
});

/**
 * POST /api/smart-suggestions/analyze-patterns
 * Manually trigger pattern analysis
 */
router.post('/analyze-patterns', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const patterns = await analyzeBookingPatterns(userId);

    if (!patterns) {
      return res.json({
        message: 'No booking history found for pattern analysis',
        patterns: null
      });
    }

    res.json({
      message: 'Patterns analyzed successfully',
      patterns
    });

  } catch (error) {
    console.error('Error analyzing patterns:', error);
    res.status(500).json({ error: 'Failed to analyze booking patterns' });
  }
});

/**
 * GET /api/smart-suggestions/patterns
 * Get current booking patterns
 */
router.get('/patterns', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const patterns = await getBookingPatterns(userId);

    res.json({ patterns });

  } catch (error) {
    console.error('Error getting patterns:', error);
    res.status(500).json({ error: 'Failed to get booking patterns' });
  }
});

module.exports = router;
