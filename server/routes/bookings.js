const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { applySchedulingRules, shouldBlockBooking } = require('../utils/schedulingRules');

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
    const { attendee_name, attendee_email, start_time, end_time, user_id, team_id, title, notes, duration } = req.body;

    // Apply scheduling rules
    const bookingData = {
      attendee_name,
      attendee_email,
      start_time,
      end_time,
      user_id,
      team_id,
      title: title || 'Meeting',
      notes: notes || '',
      duration: duration || 30,
      status: 'confirmed'
    };

    const ruleResults = await applySchedulingRules(client, user_id, bookingData);

    // Check if booking is blocked by rules
    if (ruleResults.blocked) {
      return res.status(403).json({
        error: 'Booking blocked',
        reason: ruleResults.blockReason,
        appliedRules: ruleResults.appliedRules
      });
    }

    // Use modified data from rules
    const finalData = ruleResults.modifiedData;

    // Calculate end_time if duration was modified
    let finalEndTime = end_time;
    if (ruleResults.appliedRules.some(r => r.action.includes('set_duration'))) {
      const startDate = new Date(start_time);
      finalEndTime = new Date(startDate.getTime() + finalData.duration * 60000).toISOString();
    }

    const result = await client.query(
      `INSERT INTO bookings (attendee_name, attendee_email, start_time, end_time, user_id, team_id, status, title, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        finalData.attendee_name,
        finalData.attendee_email,
        finalData.start_time,
        finalEndTime,
        finalData.user_id,
        finalData.team_id,
        finalData.status,
        finalData.title,
        finalData.notes
      ]
    );

    // Include applied rules in response
    const response = {
      ...result.rows[0],
      appliedRules: ruleResults.appliedRules.length > 0 ? ruleResults.appliedRules : undefined,
      autoApproved: ruleResults.autoApproved || undefined
    };

    res.json(response);
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

// POST /chatgpt/book-meeting - AI Chat booking creation
router.post('/chatgpt/book-meeting', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const {
      title,
      start_time,
      end_time,
      attendees,
      attendee_email,
      attendee_name,
      notes,
      team_id
    } = req.body;

    // Calculate duration from start/end time
    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    const duration = Math.round((endDate - startDate) / 60000);

    // Apply scheduling rules
    const bookingData = {
      attendee_name: attendee_name || (attendee_email ? attendee_email.split('@')[0] : 'Guest'),
      attendee_email: attendee_email || (attendees && attendees[0]) || '',
      start_time,
      end_time,
      user_id: userId,
      team_id: team_id || null,
      title: title || 'Meeting',
      notes: notes || '',
      duration,
      status: 'confirmed'
    };

    console.log('📅 AI Chat creating booking:', bookingData.title, 'for', bookingData.attendee_email);

    const ruleResults = await applySchedulingRules(client, userId, bookingData);

    // Check if booking is blocked by rules
    if (ruleResults.blocked) {
      console.log('🚫 Booking blocked by rule:', ruleResults.blockReason);
      return res.status(403).json({
        error: 'Booking blocked',
        reason: ruleResults.blockReason,
        appliedRules: ruleResults.appliedRules
      });
    }

    // Use modified data from rules
    const finalData = ruleResults.modifiedData;

    // Recalculate end_time if duration was modified by rules
    let finalEndTime = end_time;
    if (ruleResults.appliedRules.some(r => r.action.includes('set_duration'))) {
      finalEndTime = new Date(startDate.getTime() + finalData.duration * 60000).toISOString();
    }

    const result = await client.query(
      `INSERT INTO bookings (attendee_name, attendee_email, start_time, end_time, user_id, team_id, status, title, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        finalData.attendee_name,
        finalData.attendee_email,
        finalData.start_time,
        finalEndTime,
        finalData.user_id,
        finalData.team_id,
        finalData.status,
        finalData.title,
        finalData.notes
      ]
    );

    const booking = result.rows[0];

    // Log applied rules
    if (ruleResults.appliedRules.length > 0) {
      console.log('✨ Applied rules to AI booking:', ruleResults.appliedRules.map(r => r.name).join(', '));
    }

    res.json({
      success: true,
      booking,
      appliedRules: ruleResults.appliedRules.length > 0 ? ruleResults.appliedRules : undefined,
      autoApproved: ruleResults.autoApproved || undefined
    });

  } catch (error) {
    console.error('Error creating AI chat booking:', error);
    res.status(500).json({ error: 'Failed to create booking', message: error.message });
  } finally {
    client.release();
  }
});

// POST /public/booking/create - Public booking page creation
router.post('/public/booking/create', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      username,
      event_type_slug,
      attendee_name,
      attendee_email,
      start_time,
      end_time,
      notes,
      answers,
      timezone
    } = req.body;

    // Find the user by username
    const userResult = await client.query(
      `SELECT id, email, name FROM users WHERE username = $1 OR email LIKE $2`,
      [username, `${username}@%`]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const userId = user.id;

    // Calculate duration
    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    const duration = Math.round((endDate - startDate) / 60000);

    // Apply scheduling rules
    const bookingData = {
      attendee_name,
      attendee_email,
      start_time,
      end_time,
      user_id: userId,
      team_id: null,
      title: event_type_slug ? `${event_type_slug} with ${attendee_name}` : `Meeting with ${attendee_name}`,
      notes: notes || '',
      duration,
      status: 'confirmed'
    };

    console.log('📅 Public booking request:', bookingData.title, 'from', attendee_email);

    const ruleResults = await applySchedulingRules(client, userId, bookingData);

    // Check if booking is blocked by rules
    if (ruleResults.blocked) {
      console.log('🚫 Public booking blocked by rule:', ruleResults.blockReason);
      return res.status(403).json({
        error: 'Booking not available',
        reason: ruleResults.blockReason
      });
    }

    // Use modified data from rules
    const finalData = ruleResults.modifiedData;

    // Recalculate end_time if duration was modified
    let finalEndTime = end_time;
    if (ruleResults.appliedRules.some(r => r.action.includes('set_duration'))) {
      finalEndTime = new Date(startDate.getTime() + finalData.duration * 60000).toISOString();
    }

    const result = await client.query(
      `INSERT INTO bookings (attendee_name, attendee_email, start_time, end_time, user_id, status, title, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        finalData.attendee_name,
        finalData.attendee_email,
        finalData.start_time,
        finalEndTime,
        finalData.user_id,
        finalData.status,
        finalData.title,
        finalData.notes
      ]
    );

    const booking = result.rows[0];

    // Log applied rules
    if (ruleResults.appliedRules.length > 0) {
      console.log('✨ Applied rules to public booking:', ruleResults.appliedRules.map(r => r.name).join(', '));
    }

    res.json({
      success: true,
      booking,
      message: ruleResults.autoApproved
        ? 'Your booking has been automatically confirmed!'
        : 'Your booking request has been received.'
    });

  } catch (error) {
    console.error('Error creating public booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// GET /public/booking/:username/:eventSlug - Get booking page info
router.get('/public/booking/:username/:eventSlug?', async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, eventSlug } = req.params;

    // Find user by username
    const userResult = await client.query(
      `SELECT id, name, email, profile_picture, timezone FROM users
       WHERE username = $1 OR email LIKE $2`,
      [username, `${username}@%`]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking page not found' });
    }

    const user = userResult.rows[0];

    // Get event types for this user
    const eventTypesResult = await client.query(
      `SELECT * FROM event_types WHERE user_id = $1 AND is_active = true`,
      [user.id]
    );

    res.json({
      user: {
        name: user.name,
        profile_picture: user.profile_picture,
        timezone: user.timezone
      },
      event_types: eventTypesResult.rows
    });

  } catch (error) {
    console.error('Error fetching booking page:', error);
    res.status(500).json({ error: 'Failed to fetch booking page' });
  } finally {
    client.release();
  }
});

module.exports = router;