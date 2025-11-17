const express = require('express');
const router = express.Router();
const { 
  sendBookingConfirmation, 
  sendOrganizerNotification, 
  isEmailAvailable 
} = require('../utils/email');
const db = require('../utils/db');

// POST /api/bookings - Create a new booking
router.post('/api/bookings', async (req, res) => {
  try {
    const { token, slot, attendee_name, attendee_email, notes } = req.body;

    console.log('📝 Creating booking:', { token, attendee_name, attendee_email });

    // Validate required fields
    if (!token || !slot || !attendee_name || !attendee_email) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['token', 'slot', 'attendee_name', 'attendee_email']
      });
    }

    // Get booking link details from database
    const bookingLink = await db.query(
      `SELECT bl.*, t.name as team_name, tm.name as member_name, tm.email as member_email
       FROM booking_links bl
       LEFT JOIN teams t ON bl.team_id = t.id
       LEFT JOIN team_members tm ON bl.member_id = tm.id
       WHERE bl.token = $1`,
      [token]
    );

    if (bookingLink.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking link' });
    }

    const bookingInfo = bookingLink.rows[0];
    
    // Create booking in database
    const bookingResult = await db.query(
      `INSERT INTO bookings 
       (team_id, member_id, attendee_name, attendee_email, start_time, end_time, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
       RETURNING *`,
      [
        bookingInfo.team_id,
        bookingInfo.member_id,
        attendee_name,
        attendee_email,
        slot.start,
        slot.end,
        notes || ''
      ]
    );

    const booking = bookingResult.rows[0];
    
    console.log('✅ Booking created in database:', booking.id);

    // Format date/time for emails
    const meetingDate = new Date(slot.start).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const meetingTime = new Date(slot.start).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Calculate duration in minutes
    const durationMs = new Date(slot.end) - new Date(slot.start);
    const durationMinutes = Math.round(durationMs / 60000);

    // Send confirmation emails
    if (isEmailAvailable()) {
      console.log('📧 Sending confirmation emails...');

      // Send email to guest
      try {
        await sendBookingConfirmation({
          attendee_email,
          attendee_name,
          organizer_name: bookingInfo.member_name,
          organizer_email: bookingInfo.member_email,
          team_name: bookingInfo.team_name,
          meeting_date: meetingDate,
          meeting_time: meetingTime,
          meeting_duration: durationMinutes,
          notes: notes || '',
        });
        console.log('✅ Guest confirmation email sent');
      } catch (emailError) {
        console.error('⚠️ Failed to send guest email:', emailError);
        // Don't fail the booking if email fails
      }

      // Send notification to organizer
      if (bookingInfo.member_email) {
        try {
          await sendOrganizerNotification({
            organizer_email: bookingInfo.member_email,
            organizer_name: bookingInfo.member_name,
            attendee_name,
            attendee_email,
            meeting_date: meetingDate,
            meeting_time: meetingTime,
            meeting_duration: durationMinutes,
            notes: notes || '',
          });
          console.log('✅ Organizer notification email sent');
        } catch (emailError) {
          console.error('⚠️ Failed to send organizer email:', emailError);
          // Don't fail the booking if email fails
        }
      }
    } else {
      console.log('⚠️ Email not configured, skipping notifications');
    }

    // Return success response
    res.json({
      success: true,
      booking: {
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        attendee_name: booking.attendee_name,
        attendee_email: booking.attendee_email,
        status: booking.status,
      },
    });

  } catch (error) {
    console.error('❌ Booking creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create booking',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/bookings - Get all bookings for authenticated user
router.get('/api/bookings', async (req, res) => {
  try {
    // Get user ID from auth token (you'll need to implement auth middleware)
    const userId = req.user?.id; // Assuming you have auth middleware

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get bookings for teams the user is a member of
    const result = await db.query(
      `SELECT 
        b.*,
        t.name as team_name,
        tm.name as member_name
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.team_id IN (
         SELECT team_id FROM team_members WHERE user_id = $1
       )
       ORDER BY b.start_time DESC
       LIMIT 100`,
      [userId]
    );

    res.json({
      success: true,
      bookings: result.rows,
    });

  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bookings',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/bookings/:id - Get a specific booking
router.get('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await db.query(
      `SELECT 
        b.*,
        t.name as team_name,
        tm.name as member_name,
        tm.email as member_email
       FROM bookings b
       LEFT JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1
       AND b.team_id IN (
         SELECT team_id FROM team_members WHERE user_id = $2
       )`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      booking: result.rows[0],
    });

  } catch (error) {
    console.error('❌ Error fetching booking:', error);
    res.status(500).json({ 
      error: 'Failed to fetch booking',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/bookings/:id - Cancel a booking
router.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if booking exists and user has access
    const bookingCheck = await db.query(
      `SELECT b.*, tm.email as organizer_email
       FROM bookings b
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1
       AND b.team_id IN (
         SELECT team_id FROM team_members WHERE user_id = $2
       )`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Update booking status to cancelled
    await db.query(
      `UPDATE bookings 
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    console.log('✅ Booking cancelled:', id);

    // TODO: Send cancellation emails to both parties
    // if (isEmailAvailable()) {
    //   await sendCancellationEmail(...);
    // }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
    });

  } catch (error) {
    console.error('❌ Error cancelling booking:', error);
    res.status(500).json({ 
      error: 'Failed to cancel booking',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/book/:token - Get booking link details (public endpoint)
router.get('/api/book/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `SELECT 
        bl.*,
        t.name as team_name,
        t.id as team_id,
        tm.name as member_name,
        tm.email as member_email,
        tm.external_booking_link,
        tm.external_booking_platform
       FROM booking_links bl
       LEFT JOIN teams t ON bl.team_id = t.id
       LEFT JOIN team_members tm ON bl.member_id = tm.id
       WHERE bl.token = $1
       AND bl.is_active = true`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking link not found or inactive' });
    }

    const linkData = result.rows[0];

    res.json({
      success: true,
      data: {
        team: {
          id: linkData.team_id,
          name: linkData.team_name,
        },
        member: {
          name: linkData.member_name,
          email: linkData.member_email,
          external_booking_link: linkData.external_booking_link,
          external_booking_platform: linkData.external_booking_platform,
        },
        bookingLink: {
          token: linkData.token,
          title: linkData.title,
          description: linkData.description,
        },
      },
    });

  } catch (error) {
    console.error('❌ Error fetching booking link:', error);
    res.status(500).json({ 
      error: 'Failed to fetch booking link',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;