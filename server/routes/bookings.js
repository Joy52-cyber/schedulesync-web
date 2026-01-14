const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { applySchedulingRules, shouldBlockBooking } = require('../utils/schedulingRules');
const { sendBookingEmail, sendTemplatedEmail, buildEmailVariables } = require('../services/email');
const { generateICS } = require('../utils/icsGenerator');
const { notifyBookingCancelled, notifyBookingRescheduled } = require('../services/notifications');
const emailTemplates = require('../emailTemplates');

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
      'SELECT * FROM teams WHERE team_booking_token = $1 OR name = $1',
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

// ============ BOOKING MANAGEMENT (CANCEL & RESCHEDULE) ============

// POST /api/bookings/:id/cancel - Cancel a booking (authenticated)
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { reason } = req.body;

    console.log('Canceling booking:', bookingId);

    // Verify ownership
    const bookingCheck = await pool.query(
      `SELECT b.*, t.owner_id, tm.user_id as member_user_id
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Check if user has permission (team owner or assigned member)
    const hasPermission = booking.owner_id === userId || booking.member_user_id === userId;

    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }

    // Update booking status
    await pool.query(
      `UPDATE bookings
       SET status = 'cancelled',
           notes = COALESCE(notes, '') || E'\nCancellation reason: ' || COALESCE($1, 'No reason provided')
       WHERE id = $2`,
      [reason, bookingId]
    );

    console.log('Booking cancelled successfully');

    // Notify organizer
    if (booking.member_user_id) {
      await notifyBookingCancelled(booking, booking.member_user_id);
    }

    // Send cancellation email
    try {
      await sendBookingEmail({
        to: booking.attendee_email,
        subject: 'Booking Cancelled - ScheduleSync',
        html: emailTemplates.bookingCancellation(booking, reason),
      });
      console.log('Cancellation email sent');
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// POST /api/bookings/:id/reschedule - Reschedule a booking (authenticated)
router.post('/:id/reschedule', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { newStartTime, newEndTime } = req.body;

    console.log('Rescheduling booking:', bookingId);

    if (!newStartTime || !newEndTime) {
      return res.status(400).json({ error: 'New start and end times are required' });
    }

    // Verify ownership
    const bookingCheck = await pool.query(
      `SELECT b.*, t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];
    const oldStartTime = booking.start_time;

    // Check permission
    const hasPermission = booking.owner_id === userId || booking.member_user_id === userId;

    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to reschedule this booking' });
    }

    // Update booking times
    const updateResult = await pool.query(
      `UPDATE bookings
       SET start_time = $1,
           end_time = $2
       WHERE id = $3
       RETURNING *`,
      [newStartTime, newEndTime, bookingId]
    );

    const updatedBooking = updateResult.rows[0];

    console.log('Booking rescheduled successfully');

    // Notify organizer
    if (booking.member_user_id) {
      await notifyBookingRescheduled(updatedBooking, booking.member_user_id, oldStartTime);
    }

    // Send reschedule email
    try {
      const icsFile = generateICS({
        id: updatedBooking.id,
        start_time: updatedBooking.start_time,
        end_time: updatedBooking.end_time,
        attendee_name: booking.attendee_name,
        attendee_email: booking.attendee_email,
        organizer_name: booking.member_name,
        organizer_email: booking.member_email,
        team_name: booking.team_name,
        notes: booking.notes,
      });

      await sendBookingEmail({
        to: booking.attendee_email,
        subject: 'Booking Rescheduled - ScheduleSync',
        html: emailTemplates.bookingReschedule(
          {
            ...updatedBooking,
            organizer_name: booking.member_name,
            team_name: booking.team_name,
          },
          booking.start_time
        ),
        icsAttachment: icsFile,
      });
      console.log('Reschedule email sent');
    } catch (emailError) {
      console.error('Failed to send reschedule email:', emailError);
    }

    res.json({
      success: true,
      booking: updatedBooking,
      message: 'Booking rescheduled successfully'
    });

  } catch (error) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// ============ BOOKING MANAGEMENT BY TOKEN (NO AUTH REQUIRED) ============

// GET /api/bookings/manage/:token - Get booking by manage token (for guest management page)
router.get('/manage/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log('Getting booking for management:', token);

    const result = await pool.query(
      `SELECT b.*,
       b.meet_link,
       b.calendar_event_id,
       t.name as team_name,
       tm.name as organizer_name,
       tm.email as organizer_email,
       tm.booking_token as member_booking_token,
       u.name as user_organizer_name,
       u.email as user_organizer_email
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.manage_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = result.rows[0];

    // Check if booking is in the past
    const now = new Date();
    const bookingTime = new Date(booking.start_time);
    const canModify = bookingTime > now && booking.status === 'confirmed';

    res.json({
      booking: {
        id: booking.id,
        attendee_name: booking.attendee_name,
        attendee_email: booking.attendee_email,
        start_time: booking.start_time,
        end_time: booking.end_time,
        notes: booking.notes,
        status: booking.status,
        team_name: booking.team_name,
        organizer_name: booking.organizer_name || booking.user_organizer_name,
        organizer_email: booking.organizer_email || booking.user_organizer_email,
        member_booking_token: booking.member_booking_token,
        meet_link: booking.meet_link,
        calendar_event_id: booking.calendar_event_id,
        can_modify: canModify,
        is_past: bookingTime < now
      }
    });
  } catch (error) {
    console.error('Get booking by token error:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// POST /api/bookings/manage/:token/reschedule - Reschedule booking by token (public)
router.post('/manage/:token/reschedule', async (req, res) => {
  try {
    const { token } = req.params;
    const { newStartTime, newEndTime } = req.body;

    console.log('Rescheduling booking via token:', token);

    if (!newStartTime || !newEndTime) {
      return res.status(400).json({ error: 'New start and end times are required' });
    }

    // Get booking by token
    const bookingCheck = await pool.query(
      `SELECT b.*, b.meet_link, b.calendar_event_id, t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.manage_token = $1 AND b.status = 'confirmed'`,
      [token]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }

    const booking = bookingCheck.rows[0];

    // Don't allow rescheduling past bookings
    const now = new Date();
    const bookingTime = new Date(booking.start_time);
    if (bookingTime < now) {
      return res.status(400).json({ error: 'Cannot reschedule past bookings' });
    }

    // Store old time for email
    const oldStartTime = booking.start_time;

    // Update booking times
    const updateResult = await pool.query(
      `UPDATE bookings
       SET start_time = $1,
           end_time = $2,
           updated_at = NOW()
       WHERE manage_token = $3
       RETURNING *`,
      [newStartTime, newEndTime, token]
    );

    const updatedBooking = updateResult.rows[0];

    console.log('Booking rescheduled successfully');

    // Send reschedule emails using templates
    try {
      const icsFile = generateICS({
        id: updatedBooking.id,
        start_time: updatedBooking.start_time,
        end_time: updatedBooking.end_time,
        attendee_name: booking.attendee_name,
        attendee_email: booking.attendee_email,
        organizer_name: booking.member_name,
        organizer_email: booking.member_email,
        team_name: booking.team_name,
        notes: booking.notes,
      });

      const manageUrl = `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/manage/${token}`;
      const rescheduleVars = buildEmailVariables(updatedBooking, {
        name: booking.member_name,
        email: booking.member_email
      }, {
        guestName: booking.attendee_name,
        guestEmail: booking.attendee_email,
        previousDate: new Date(oldStartTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        previousTime: new Date(oldStartTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        meetingLink: booking.meet_link || '',
        manageLink: manageUrl
      });

      // Email to guest
      await sendTemplatedEmail(booking.attendee_email, booking.member_user_id, 'reschedule', rescheduleVars, {
        attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsFile).toString('base64') }]
      });

      // Email to organizer
      if (booking.member_email) {
        await sendTemplatedEmail(booking.member_email, booking.member_user_id, 'reschedule', {
          ...rescheduleVars,
          guestName: booking.member_name,
        }, {
          attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsFile).toString('base64') }]
        });
      }

      console.log('Reschedule emails sent');
    } catch (emailError) {
      console.error('Failed to send reschedule email:', emailError);
    }

    res.json({
      success: true,
      booking: {
        ...updatedBooking,
        team_name: booking.team_name,
        organizer_name: booking.member_name,
      },
      message: 'Booking rescheduled successfully'
    });

  } catch (error) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// POST /api/bookings/manage/:token/cancel - Cancel booking by token (public)
router.post('/manage/:token/cancel', async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    console.log('Canceling booking via token:', token);

    // Get booking by token
    const bookingCheck = await pool.query(
      `SELECT b.*, b.meet_link, b.calendar_event_id, t.owner_id, tm.user_id as member_user_id, tm.name as member_name,
              tm.email as member_email, t.name as team_name, tm.booking_token as member_booking_token
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.manage_token = $1 AND b.status = 'confirmed'`,
      [token]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }

    const booking = bookingCheck.rows[0];

    // Update booking status
    await pool.query(
      `UPDATE bookings
       SET status = 'cancelled',
           notes = COALESCE(notes, '') || E'\n\nCancellation reason: ' || COALESCE($1, 'No reason provided'),
           updated_at = NOW()
       WHERE manage_token = $2`,
      [reason, token]
    );

    console.log('Booking cancelled successfully');

    // Notify organizer
    if (booking.member_user_id) {
      await notifyBookingCancelled(booking, booking.member_user_id);
    }

    // Send cancellation emails using templates
    try {
      const cancellationVars = buildEmailVariables(booking, {
        name: booking.member_name,
        email: booking.member_email
      }, {
        guestName: booking.attendee_name,
        guestEmail: booking.attendee_email,
        cancellationReason: reason ? `Reason: ${reason}` : '',
        bookingLink: `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/book/${booking.member_booking_token || ''}`
      });

      // Email to guest
      await sendTemplatedEmail(booking.attendee_email, booking.member_user_id, 'cancellation', cancellationVars);

      // Email to organizer
      if (booking.member_email) {
        await sendTemplatedEmail(booking.member_email, booking.member_user_id, 'cancellation', {
          ...cancellationVars,
          guestName: booking.member_name,
        });
      }

      console.log('Cancellation emails sent');
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;