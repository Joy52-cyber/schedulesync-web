const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET all bookings for the user
router.get('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY start_time DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  } finally {
    client.release();
  }
});

// GET booking by token (public endpoint)
router.get('/book/:token', async (req, res) => {
  const client = await pool.connect();
  try {
    const { token } = req.params;
    const result = await client.query(
      'SELECT * FROM teams WHERE slug = $1 OR name = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking page not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching booking page:', error);
    res.status(500).json({ error: 'Failed to fetch booking page' });
  } finally {
    client.release();
  }
});

// POST create a new booking
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { attendee_name, attendee_email, start_time, end_time, user_id, team_id } = req.body;
    
    const result = await client.query(
      `INSERT INTO bookings (attendee_name, attendee_email, start_time, end_time, user_id, team_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
       RETURNING *`,
      [attendee_name, attendee_email, start_time, end_time, user_id, team_id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// GET booking availability
router.get('/book/:token/availability', async (req, res) => {
  const client = await pool.connect();
  try {
    const { token } = req.params;
    const { date } = req.query;
    
    // Return empty availability for now
    res.json({ slots: [] });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  } finally {
    client.release();
  }
});

module.exports = router;