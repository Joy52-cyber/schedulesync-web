const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

// POST /api/bookings - Create a new booking
router.post('/', async (req, res) => {
  const { token, slot, attendee_name, attendee_email, notes } = req.body;
  
  try {
    const pool = req.app.get('pool'); // Get database pool from app
    
    // 1. Get booking token details
    const tokenResult = await pool.query(
      `SELECT tm.*, t.name as team_name, u.email as organizer_email, u.name as organizer_name,
              u.google_access_token, u.google_refresh_token
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1 AND t.is_active = true`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = tokenResult.rows[0];
    
    // 2. Set up Google Calendar API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: member.google_access_token,
      refresh_token: member.google_refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 3. Create calendar event with Google Meet
    const event = {
      summary: `Meeting with ${attendee_name}`,
      description: notes || 'Scheduled via ScheduleSync',
      start: {
        dateTime: slot.start,
        timeZone: 'UTC',
      },
      end: {
        dateTime: slot.end,
        timeZone: 'UTC',
      },
      attendees: [
        { email: attendee_email, displayName: attendee_name },
        { email: member.organizer_email, displayName: member.organizer_name }
      ],
      // 🎥 AUTO-CREATE GOOGLE MEET LINK
      conferenceData: {
        createRequest: {
          requestId: `schedulesync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };

    // Insert event with conference data enabled
    const calendarResponse = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1, // 🎥 ENABLE CONFERENCE DATA
      sendUpdates: 'all'
    });

    // 4. Extract Meet link
    const meetLink = calendarResponse.data.hangoutLink || null;
    const calendarEventId = calendarResponse.data.id;

    console.log('📅 Calendar event created:', calendarEventId);
    console.log('🎥 Meet link:', meetLink);

    // 5. Generate management token
    const crypto = require('crypto');
    const managementToken = crypto.randomBytes(32).toString('hex');

    // 6. Save booking to database
    const bookingResult = await pool.query(
      `INSERT INTO bookings 
       (team_id, user_id, attendee_name, attendee_email, start_time, end_time, 
        notes, status, management_token, meet_link, calendar_event_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [
        member.team_id,
        member.user_id,
        attendee_name,
        attendee_email,
        slot.start,
        slot.end,
        notes,
        'confirmed',
        managementToken,
        meetLink,
        calendarEventId
      ]
    );

    const booking = bookingResult.rows[0];

    // 7. Send confirmation email (implement this in your email service)
    try {
      await sendBookingConfirmationEmail({
        attendee_name,
        attendee_email,
        organizer_name: member.organizer_name,
        start_time: slot.start,
        end_time: slot.end,
        notes,
        meetLink,
        managementToken
      });
    } catch (emailError) {
      console.error('❌ Email error:', emailError);
      // Don't fail the booking if email fails
    }

    res.json({
      success: true,
      booking: {
        id: booking.id,
        management_token: managementToken,
        meet_link: meetLink
      }
    });

  } catch (error) {
    console.error('❌ Booking creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create booking',
      details: error.message 
    });
  }
});

// GET /api/bookings/manage/:token - Get booking by management token
router.get('/manage/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    const pool = req.app.get('pool');
    
    const result = await pool.query(
      `SELECT b.*, 
              t.name as team_name,
              u.name as organizer_name,
              u.email as organizer_email,
              tm.booking_token as member_booking_token
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       JOIN users u ON b.user_id = u.id
       LEFT JOIN team_members tm ON tm.team_id = b.team_id AND tm.user_id = b.user_id
       WHERE b.management_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = result.rows[0];
    
    // Check if booking can be modified (not in the past and not cancelled)
    const now = new Date();
    const startTime = new Date(booking.start_time);
    const canModify = startTime > now && booking.status === 'confirmed';

    res.json({
      booking: {
        ...booking,
        can_modify: canModify
      }
    });

  } catch (error) {
    console.error('❌ Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// POST /api/bookings/:id/reschedule - Reschedule booking
router.post('/:id/reschedule', async (req, res) => {
  const { id } = req.params;
  const { newStartTime, newEndTime } = req.body;
  
  try {
    const pool = req.app.get('pool');
    
    // Get booking details
    const bookingResult = await pool.query(
      `SELECT b.*, u.google_access_token, u.google_refresh_token
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1`,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Update calendar event
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: booking.google_access_token,
      refresh_token: booking.google_refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.patch({
      calendarId: 'primary',
      eventId: booking.calendar_event_id,
      resource: {
        start: { dateTime: newStartTime, timeZone: 'UTC' },
        end: { dateTime: newEndTime, timeZone: 'UTC' }
      },
      sendUpdates: 'all'
    });

    // Update database
    await pool.query(
      `UPDATE bookings 
       SET start_time = $1, end_time = $2, updated_at = NOW()
       WHERE id = $3`,
      [newStartTime, newEndTime, id]
    );

    res.json({ success: true, message: 'Booking rescheduled successfully' });

  } catch (error) {
    console.error('❌ Reschedule error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// POST /api/bookings/:id/cancel - Cancel booking
router.post('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  try {
    const pool = req.app.get('pool');
    
    // Get booking details
    const bookingResult = await pool.query(
      `SELECT b.*, u.google_access_token, u.google_refresh_token
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1`,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Cancel calendar event
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: booking.google_access_token,
      refresh_token: booking.google_refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: booking.calendar_event_id,
      sendUpdates: 'all'
    });

    // Update database
    await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW()
       WHERE id = $2`,
      [reason, id]
    );

    res.json({ success: true, message: 'Booking cancelled successfully' });

  } catch (error) {
    console.error('❌ Cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Helper function for sending emails (implement based on your email service)
async function sendBookingConfirmationEmail(data) {
  // Implement with Resend or your email service
  console.log('📧 Sending confirmation email to:', data.attendee_email);
}

module.exports = router;