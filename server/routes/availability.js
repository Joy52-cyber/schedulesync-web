const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM availability_rules WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  } finally {
    client.release();
  }
});

module.exports = router;