const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// POST /api/users/onboarding - Complete user onboarding
router.post('/onboarding', authenticateToken, async (req, res) => {
  try {
    const { username, timezone, availableFrom, availableTo, workDays } = req.body;

    // Validate input
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({
        error: 'Username can only contain letters, numbers, hyphens, and underscores'
      });
    }

    // Check if username is already taken
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2',
      [username, req.user.id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Update user with onboarding data
    await pool.query(
      `UPDATE users
       SET username = $1,
           timezone = $2,
           available_from = $3,
           available_to = $4,
           work_days = $5,
           onboarded = true
       WHERE id = $6`,
      [username, timezone, availableFrom, availableTo, JSON.stringify(workDays), req.user.id]
    );

    // Get updated user data
    const result = await pool.query(
      'SELECT id, name, email, username, timezone, onboarded FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      user: result.rows[0],
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

module.exports = router;
