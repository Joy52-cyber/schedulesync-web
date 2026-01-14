const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { google } = require('googleapis');
const pool = require('../config/database');
const { generateICS } = require('../../icsGenerator');
const { sendTemplatedEmail, buildEmailVariables } = require('../services/email');
const { applySchedulingRules, shouldAutoConfirm, recordBookingPattern } = require('../services/scheduling');

// GET /api/public/user/:username - Get user profile and event types for booking page
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    console.log(`Public user profile request: ${username}`);

    // Find user by username or email prefix
    const userResult = await pool.query(
      `SELECT id, name, email, username, bio, profile_photo, timezone,
              brand_logo_url, brand_primary_color, brand_accent_color, hide_powered_by
       FROM users
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(email) LIKE LOWER($2)
       LIMIT 1`,
      [username, `${username}%`]
    );

    if (userResult.rows.length === 0) {
      console.log(`User not found: ${username}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user's active event types with all booking-related fields
    const eventTypes = await pool.query(
      `SELECT id, title as name, slug, duration, description, color, is_active,
              custom_questions, pre_meeting_instructions, confirmation_message,
              buffer_before, buffer_after, min_notice_hours, max_days_ahead
       FROM event_types
       WHERE user_id = $1 AND is_active = true
       ORDER BY title`,
      [user.id]
    );

    res.json({
      user: {
        name: user.name,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        bio: user.bio,
        profile_photo: user.profile_photo,
        timezone: user.timezone || 'America/New_York'
      },
      eventTypes: eventTypes.rows,
      branding: {
        logo_url: user.brand_logo_url,
        primary_color: user.brand_primary_color || '#8B5CF6',
        accent_color: user.brand_accent_color || '#EC4899',
        hide_powered_by: user.hide_powered_by || false
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to load user profile' });
  }
});

// GET /api/public/booking/:username/:eventSlug - Get public event type info
router.get('/booking/:username/:eventSlug', async (req, res) => {
  try {
    const { username, eventSlug } = req.params;
    console.log(`Public Event Type request: ${username}/${eventSlug}`);

    // Find user by username or email prefix - with branding fields
    const userResult = await pool.query(
      `SELECT id, name, email, username,
              brand_logo_url, brand_primary_color, brand_accent_color, hide_powered_by
       FROM users
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(email) LIKE LOWER($2)
       LIMIT 1`,
      [username, `${username}%`]
    );

    if (userResult.rows.length === 0) {
      console.log(`User not found: ${username}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const host = userResult.rows[0];

    // Find active event type by slug
    const eventResult = await pool.query(
      `SELECT id, title, duration, description, color, slug, is_active
       FROM event_types
       WHERE user_id = $1
         AND LOWER(slug) = LOWER($2)
         AND is_active = true`,
      [host.id, eventSlug]
    );

    if (eventResult.rows.length === 0) {
      console.log(`Event type not found or inactive: ${eventSlug}`);
      return res.status(404).json({ error: 'Event type not found or inactive' });
    }

    const eventType = eventResult.rows[0];
    console.log(`Event Type found: ${eventType.title} (${eventType.duration}min)`);

    res.json({
      success: true,
      host: {
        name: host.name,
        email: host.email,
        username: host.username || host.email.split('@')[0],
      },
      eventType: {
        id: eventType.id,
        title: eventType.title,
        duration: eventType.duration,
        description: eventType.description,
        color: eventType.color,
        slug: eventType.slug,
      },
      branding: {
        logo_url: host.brand_logo_url,
        primary_color: host.brand_primary_color || '#3B82F6',
        accent_color: host.brand_accent_color || '#6366F1',
        hide_powered_by: host.hide_powered_by || false
      }
    });
  } catch (error) {
    console.error('Error fetching Event Type booking info:', error);
    res.status(500).json({ error: 'Failed to load event information' });
  }
});

// GET /api/public/available-slots - Get available time slots
router.get('/available-slots', async (req, res) => {
  try {
    const { username, event_slug, date, timezone = 'UTC' } = req.query;

    console.log('Fetching public available slots:', { username, event_slug, date, timezone });

    if (!username || !event_slug || !date) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Find user
    const userResult = await pool.query(
      `SELECT id, name, email, google_access_token, google_refresh_token,
              microsoft_access_token, microsoft_refresh_token, provider
       FROM users
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(email) LIKE LOWER($2)
       LIMIT 1`,
      [username, `${username}%`]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const host = userResult.rows[0];

    // Find event type
    const eventResult = await pool.query(
      `SELECT id, duration, buffer_before, buffer_after, max_bookings_per_day, slot_interval,
              min_notice_hours, max_days_ahead
       FROM event_types
       WHERE user_id = $1
         AND LOWER(slug) = LOWER($2)
         AND is_active = true`,
      [host.id, event_slug]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found or inactive' });
    }

    const eventType = eventResult.rows[0];
    const duration = eventType.duration;
    const bufferBefore = eventType.buffer_before || 0;
    const bufferAfter = eventType.buffer_after || 0;
    const slotInterval = eventType.slot_interval || Math.min(duration, 60);
    const minNoticeHours = eventType.min_notice_hours || 1;
    const maxDaysAhead = eventType.max_days_ahead || 60;

    console.log('Event type found:', { duration, bufferBefore, bufferAfter, slotInterval, minNoticeHours, maxDaysAhead });

    // Calculate earliest allowed booking time based on min_notice_hours
    const now = new Date();
    const earliestAllowedTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);

    // Check if requested date is within max_days_ahead
    const requestedDate = new Date(date);
    const maxAllowedDate = new Date(now);
    maxAllowedDate.setDate(maxAllowedDate.getDate() + maxDaysAhead);
    maxAllowedDate.setHours(23, 59, 59, 999);

    if (requestedDate > maxAllowedDate) {
      return res.json({
        success: true,
        slots: [],
        date: date,
        timezone: timezone,
        message: `Bookings are only available up to ${maxDaysAhead} days in advance`
      });
    }

    // Get host's calendar events
    let calendarEvents = [];

    try {
      if (host.provider === 'google' && host.google_access_token) {
        console.log('Fetching Google Calendar events...');

        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
          access_token: host.google_access_token,
          refresh_token: host.google_refresh_token
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        });

        calendarEvents = response.data.items || [];
        console.log(`Found ${calendarEvents.length} Google Calendar events`);

      } else if (host.provider === 'microsoft' && host.microsoft_access_token) {
        console.log('Fetching Microsoft Calendar events...');

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const response = await fetch(
          `https://graph.microsoft.com/v1.0/me/calendarview?startdatetime=${startOfDay.toISOString()}&enddatetime=${endOfDay.toISOString()}`,
          {
            headers: {
              'Authorization': `Bearer ${host.microsoft_access_token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          calendarEvents = data.value || [];
          console.log(`Found ${calendarEvents.length} Microsoft Calendar events`);
        }
      }
    } catch (calendarError) {
      console.error('Calendar fetch failed:', calendarError.message);
      // Continue with empty calendar (show all slots as available)
    }

    // Get existing bookings
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookingsResult = await pool.query(
      `SELECT start_time, end_time
       FROM bookings
       WHERE host_user_id = $1
         AND event_type_id = $2
         AND status != 'cancelled'
         AND start_time >= $3
         AND start_time < $4`,
      [host.id, eventType.id, startOfDay.toISOString(), endOfDay.toISOString()]
    );

    const existingBookings = bookingsResult.rows;
    console.log(`Found ${existingBookings.length} existing bookings`);

    // Generate time slots
    const slots = [];
    const startHour = 9;  // 9 AM
    const endHour = 17;   // 5 PM

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, minute, 0, 0);

        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        // Skip if slot end goes past working hours
        if (slotEnd.getHours() >= endHour || (slotEnd.getHours() === endHour && slotEnd.getMinutes() > 0)) {
          continue;
        }

        // Check if slot conflicts with calendar events
        let hasConflict = false;

        for (const event of calendarEvents) {
          const eventStart = new Date(event.start?.dateTime || event.start?.date);
          const eventEnd = new Date(event.end?.dateTime || event.end?.date);

          const slotStartWithBuffer = new Date(slotStart.getTime() - bufferBefore * 60000);
          const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferAfter * 60000);

          if (slotStartWithBuffer < eventEnd && slotEndWithBuffer > eventStart) {
            hasConflict = true;
            break;
          }
        }

        // Check existing bookings
        if (!hasConflict) {
          for (const booking of existingBookings) {
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);

            const slotStartWithBuffer = new Date(slotStart.getTime() - bufferBefore * 60000);
            const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferAfter * 60000);

            if (slotStartWithBuffer < bookingEnd && slotEndWithBuffer > bookingStart) {
              hasConflict = true;
              break;
            }
          }
        }

        // Check if slot respects min_notice_hours
        if (!hasConflict && slotStart >= earliestAllowedTime) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString()
          });
        }
      }
    }

    console.log(`Generated ${slots.length} available slots`);

    res.json({
      success: true,
      slots: slots,
      date: date,
      timezone: timezone
    });

  } catch (error) {
    console.error('Error fetching public available slots:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

// POST /api/public/booking/create - Create a public booking
router.post('/booking/create', async (req, res) => {
  try {
    const {
      username,
      event_slug,
      start_time,
      end_time,
      attendee_name,
      attendee_email,
      notes,
      additional_attendees,
      guest_timezone,
      custom_answers
    } = req.body;

    console.log('Creating public event type booking:', { username, event_slug, attendee_email });

    // Find user by username
    const userResult = await pool.query(
      `SELECT id, name, email, username, google_access_token, microsoft_access_token,
              subscription_tier, monthly_bookings, bookings_limit
       FROM users
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(email) LIKE LOWER($2)
       LIMIT 1`,
      [username, `${username}%`]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const host = userResult.rows[0];

    // Check host's booking limit
    const tier = host.subscription_tier || 'free';
    const bookingsUsed = host.monthly_bookings || 0;
    const bookingsLimit = host.bookings_limit || 50;
    const isUnlimited = bookingsLimit >= 1000;

    if (!isUnlimited && bookingsUsed >= bookingsLimit) {
      console.log(`Booking limit reached for host ${host.id}: ${bookingsUsed}/${bookingsLimit}`);
      return res.status(429).json({
        error: 'Host booking limit reached',
        message: 'This user has reached their monthly booking limit. Please try again later or contact them directly.',
        upgrade_required: true
      });
    }

    // Find event type
    const eventResult = await pool.query(
      `SELECT id, title, duration, description, location, location_type
       FROM event_types
       WHERE user_id = $1
         AND LOWER(slug) = LOWER($2)
         AND is_active = true`,
      [host.id, event_slug]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found or inactive' });
    }

    const eventType = eventResult.rows[0];

    // Generate manage token
    const manageToken = crypto.randomBytes(32).toString('hex');

    // Apply scheduling rules
    const ruleBookingData = {
      title: eventType.title,
      start_time,
      attendee_email,
      attendee_name,
      notes: notes || '',
      duration: eventType.duration
    };

    const ruleResults = await applySchedulingRules(host.id, ruleBookingData);

    // Check if booking is blocked by rules
    if (ruleResults.blocked) {
      console.log('Public booking blocked by rule:', ruleResults.blockReason);
      return res.status(403).json({
        error: 'Booking not available',
        reason: ruleResults.blockReason
      });
    }

    // Check for auto-confirm based on autonomous mode
    const autoConfirmResult = await shouldAutoConfirm(host.id, {
      start_time: start_time,
      duration: eventType.duration,
      attendee_email: attendee_email
    });

    let bookingStatus = 'confirmed'; // Default

    if (ruleResults.autoApproved) {
      bookingStatus = 'confirmed';
      console.log('Booking auto-approved by scheduling rule');
    } else if (autoConfirmResult.mode === 'suggest') {
      bookingStatus = 'pending';
      console.log(`Booking pending approval: ${autoConfirmResult.reason}`);
    } else if (autoConfirmResult.mode === 'auto' && !autoConfirmResult.autoConfirm) {
      bookingStatus = 'pending';
      console.log(`Booking pending (auto rules not met): ${autoConfirmResult.reason}`);
    }

    // Use modified notes from rules
    const finalNotes = ruleResults.modifiedData.notes || notes || null;

    // Create booking
    const bookingResult = await pool.query(
      `INSERT INTO bookings (
        host_user_id,
        event_type_id,
        attendee_name,
        attendee_email,
        start_time,
        end_time,
        notes,
        manage_token,
        guest_timezone,
        status,
        title,
        additional_guests,
        custom_answers
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        host.id,
        eventType.id,
        attendee_name,
        attendee_email,
        start_time,
        end_time,
        finalNotes,
        manageToken,
        guest_timezone || 'UTC',
        bookingStatus,
        eventType.title,
        JSON.stringify(additional_attendees || []),
        JSON.stringify(custom_answers || {})
      ]
    );

    const booking = bookingResult.rows[0];

    // Increment host's booking count
    await pool.query(
      'UPDATE users SET monthly_bookings = COALESCE(monthly_bookings, 0) + 1 WHERE id = $1',
      [host.id]
    );
    console.log(`Booking count incremented for host ${host.id}: ${bookingsUsed + 1}/${bookingsLimit}`);

    // Record booking pattern for preference learning
    await recordBookingPattern(host.id, { start_time: start_time, duration: eventType.duration });

    // Store additional attendees if provided
    if (additional_attendees && additional_attendees.length > 0) {
      for (const email of additional_attendees) {
        await pool.query(
          `INSERT INTO booking_attendees (booking_id, email)
           VALUES ($1, $2)`,
          [booking.id, email]
        );
      }
    }

    console.log('Public booking created:', booking.id);

    // Respond immediately
    res.json({
      success: true,
      booking: {
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        manage_token: booking.manage_token,
        status: booking.status
      },
      message: 'Booking confirmed! Confirmation email will arrive shortly.'
    });

    // Send emails in background
    (async () => {
      try {
        console.log('Preparing to send emails...');

        const manageUrl = `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/manage/${manageToken}`;
        const duration = eventType.duration;

        const startDate = new Date(start_time);
        const endDate = new Date(end_time);

        // Create ICS file
        const icsContent = generateICS({
          id: booking.id,
          start_time: start_time,
          end_time: end_time,
          attendee_name: attendee_name,
          attendee_email: attendee_email,
          organizer_name: host.name,
          organizer_email: host.email,
          team_name: `${host.name}'s Events`,
          notes: notes || '',
        });

        // Primary attendee email
        const emailVars = buildEmailVariables(booking, {
          name: host.name,
          email: host.email
        }, {
          guestName: attendee_name,
          guestEmail: attendee_email,
          duration: duration,
          notes: notes || '',
          additionalAttendees: additional_attendees?.join(', ') || '',
          manageLink: manageUrl,
          meetingLink: eventType.location || '',
          eventTitle: eventType.title
        });

        await sendTemplatedEmail(attendee_email, host.id, 'confirmation', emailVars, {
          from: 'ScheduleSync <bookings@trucal.xyz>',
          attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }]
        });
        console.log('Email sent to primary attendee:', attendee_email);

        // Additional attendees
        if (additional_attendees && Array.isArray(additional_attendees) && additional_attendees.length > 0) {
          console.log(`Sending to ${additional_attendees.length} additional attendees...`);
          for (const additionalEmail of additional_attendees) {
            const additionalVars = {
              ...emailVars,
              guestName: additionalEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              invitedBy: `${attendee_name} (${attendee_email})`
            };
            await sendTemplatedEmail(additionalEmail, host.id, 'confirmation', additionalVars, {
              from: 'ScheduleSync <bookings@trucal.xyz>',
              attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }]
            });
            console.log(`Email sent to: ${additionalEmail}`);
          }
        }

        // Host email
        const hostVars = {
          ...emailVars,
          guestName: host.name,
          attendeeName: attendee_name,
          attendeeEmail: attendee_email
        };
        await sendTemplatedEmail(host.email, host.id, 'confirmation', hostVars, {
          from: 'ScheduleSync <bookings@trucal.xyz>',
          attachments: [{ filename: 'meeting.ics', content: Buffer.from(icsContent).toString('base64') }]
        });
        console.log('Email sent to host:', host.email);
        console.log('All confirmation emails sent');

      } catch (emailError) {
        console.error('Email send failed:', emailError);
      }
    })();

  } catch (error) {
    console.error('Public booking creation error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

module.exports = router;
