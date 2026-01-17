const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateAgendaFromEmail, getAgenda, generateContextSummary } = require('../services/agendaService');
const {
  getAttendeeHistory,
  getAllAttendees,
  updateAttendeeNotes,
  enrichAttendeeProfile,
  getAttendeeStats
} = require('../services/attendeeProfileService');

/**
 * GET /api/bookings/:id/context
 * Get meeting context for a specific booking
 */
router.get('/bookings/:id/context', authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;

    // Verify booking belongs to user
    const bookingCheck = await pool.query(
      'SELECT attendee_email FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const attendeeEmail = bookingCheck.rows[0].attendee_email;

    // Get meeting context
    const contextResult = await pool.query(
      `SELECT mc.* FROM meeting_context mc
       WHERE mc.booking_id = $1`,
      [bookingId]
    );

    // Get attendee profile if available
    const attendeeHistory = attendeeEmail
      ? await getAttendeeHistory(userId, attendeeEmail)
      : null;

    res.json({
      context: contextResult.rows[0] || null,
      attendeeHistory: attendeeHistory
    });

  } catch (error) {
    console.error('Error fetching meeting context:', error);
    res.status(500).json({ error: 'Failed to fetch meeting context' });
  }
});

/**
 * POST /api/bookings/:id/context/agenda
 * Generate or regenerate meeting agenda
 */
router.post('/bookings/:id/context/agenda', authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;

    // Verify booking belongs to user
    const bookingCheck = await pool.query(
      'SELECT id FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Generate agenda
    const agenda = await generateAgendaFromEmail(bookingId);

    if (!agenda) {
      return res.status(404).json({ error: 'No email thread found or agenda could not be generated' });
    }

    res.json({ agenda });

  } catch (error) {
    console.error('Error generating agenda:', error);
    res.status(500).json({ error: 'Failed to generate agenda' });
  }
});

/**
 * PUT /api/bookings/:id/context/notes
 * Update attendee notes for a specific meeting
 */
router.put('/bookings/:id/context/notes', authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;
    const { notes } = req.body;

    // Verify booking belongs to user
    const bookingCheck = await pool.query(
      'SELECT id FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Update notes in meeting_context
    const result = await pool.query(
      `INSERT INTO meeting_context (booking_id, attendee_notes, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (booking_id) DO UPDATE SET
         attendee_notes = $2,
         updated_at = NOW()
       RETURNING *`,
      [bookingId, notes]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error updating meeting notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

/**
 * GET /api/attendees
 * Get all attendee profiles for the authenticated user
 */
router.get('/attendees', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 50,
      offset = 0,
      sortBy = 'last_meeting_date',
      order = 'DESC'
    } = req.query;

    const attendees = await getAllAttendees(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
      order
    });

    res.json(attendees);

  } catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

/**
 * GET /api/attendees/:email
 * Get detailed history for a specific attendee
 */
router.get('/attendees/:email', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const attendeeEmail = decodeURIComponent(req.params.email);

    const history = await getAttendeeHistory(userId, attendeeEmail);

    if (!history) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    res.json(history);

  } catch (error) {
    console.error('Error fetching attendee history:', error);
    res.status(500).json({ error: 'Failed to fetch attendee history' });
  }
});

/**
 * PUT /api/attendees/:email/notes
 * Update persistent notes for an attendee
 */
router.put('/attendees/:email/notes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const attendeeEmail = decodeURIComponent(req.params.email);
    const { notes } = req.body;

    const success = await updateAttendeeNotes(userId, attendeeEmail, notes);

    if (!success) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    res.json({ message: 'Notes updated successfully' });

  } catch (error) {
    console.error('Error updating attendee notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

/**
 * PUT /api/attendees/:email/profile
 * Enrich attendee profile with additional data
 */
router.put('/attendees/:email/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const attendeeEmail = decodeURIComponent(req.params.email);
    const { company, title, timezone } = req.body;

    const profile = await enrichAttendeeProfile(userId, attendeeEmail, {
      company,
      title,
      timezone
    });

    if (!profile) {
      return res.status(404).json({ error: 'Attendee not found or no data to update' });
    }

    res.json(profile);

  } catch (error) {
    console.error('Error enriching attendee profile:', error);
    res.status(500).json({ error: 'Failed to enrich profile' });
  }
});

/**
 * GET /api/attendees/stats
 * Get attendee statistics for the user
 */
router.get('/attendees-stats/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getAttendeeStats(userId);
    res.json(stats);

  } catch (error) {
    console.error('Error fetching attendee stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
