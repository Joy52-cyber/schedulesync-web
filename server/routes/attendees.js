const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/attendees
 * Get all attendees for the authenticated user
 */
router.get('/attendees', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if attendee_profiles table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'attendee_profiles'
      );
    `);

    // If table doesn't exist, return empty array
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT
        ap.email,
        ap.name,
        ap.company,
        ap.title,
        ap.notes,
        ap.meeting_count,
        ap.last_meeting_date,
        ap.total_meeting_minutes,
        ap.first_meeting_date,
        ap.created_at
       FROM attendee_profiles ap
       WHERE ap.user_id = $1
       ORDER BY ap.meeting_count DESC, ap.last_meeting_date DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attendees:', error);
    // Return empty array instead of error for better UX
    res.json([]);
  }
});

/**
 * GET /api/attendees-stats/summary
 * Get aggregate stats about attendees
 */
router.get('/attendees-stats/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'attendee_profiles'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({
        totalAttendees: 0,
        totalMeetings: 0,
        avgMeetings: 0
      });
    }

    const result = await pool.query(
      `SELECT
        COUNT(*) as total_attendees,
        SUM(meeting_count) as total_meetings,
        AVG(meeting_count) as avg_meetings
       FROM attendee_profiles
       WHERE user_id = $1`,
      [userId]
    );

    const stats = result.rows[0];
    res.json({
      totalAttendees: parseInt(stats.total_attendees) || 0,
      totalMeetings: parseInt(stats.total_meetings) || 0,
      avgMeetings: parseFloat(stats.avg_meetings) || 0
    });
  } catch (error) {
    console.error('Error fetching attendee stats:', error);
    res.json({
      totalAttendees: 0,
      totalMeetings: 0,
      avgMeetings: 0
    });
  }
});

/**
 * GET /api/attendees/:email
 * Get detailed information about a specific attendee
 */
router.get('/attendees/:email', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = decodeURIComponent(req.params.email);

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'attendee_profiles'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    // Get attendee profile
    const profileResult = await pool.query(
      `SELECT * FROM attendee_profiles
       WHERE user_id = $1 AND email = $2`,
      [userId, email]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    const profile = profileResult.rows[0];

    // Get recent meetings with this attendee
    const meetingsResult = await pool.query(
      `SELECT id, title, start_time, end_time, status, duration, notes
       FROM bookings
       WHERE user_id = $1 AND attendee_email = $2
       ORDER BY start_time DESC
       LIMIT 10`,
      [userId, email]
    );

    res.json({
      profile,
      recentMeetings: meetingsResult.rows
    });
  } catch (error) {
    console.error('Error fetching attendee details:', error);
    res.status(500).json({ error: 'Failed to fetch attendee details' });
  }
});

/**
 * PUT /api/attendees/:email/notes
 * Update notes for an attendee
 */
router.put('/attendees/:email/notes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = decodeURIComponent(req.params.email);
    const { notes } = req.body;

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'attendee_profiles'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ error: 'Attendee profiles not available' });
    }

    const result = await pool.query(
      `UPDATE attendee_profiles
       SET notes = $1, updated_at = NOW()
       WHERE user_id = $2 AND email = $3
       RETURNING *`,
      [notes, userId, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating attendee notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

/**
 * PUT /api/attendees/:email/profile
 * Update company/title for an attendee
 */
router.put('/attendees/:email/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = decodeURIComponent(req.params.email);
    const { company, title } = req.body;

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'attendee_profiles'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ error: 'Attendee profiles not available' });
    }

    const result = await pool.query(
      `UPDATE attendee_profiles
       SET company = $1, title = $2, updated_at = NOW()
       WHERE user_id = $3 AND email = $4
       RETURNING *`,
      [company, title, userId, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating attendee profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
