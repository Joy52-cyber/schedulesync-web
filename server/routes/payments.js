const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const stripeService = require('../utils/stripe');
const { sendBookingEmail } = require('../services/email');
const { generateICS } = require('../utils/icsGenerator');
const { applySchedulingRules, recordBookingPattern } = require('../services/scheduling');
const { notifyPaymentReceived } = require('../services/notifications');
const emailTemplates = require('../emailTemplates');

// GET /api/payments/config - Get Stripe publishable key
router.get('/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// POST /api/payments/create-intent - Create payment intent
router.post('/create-intent', async (req, res) => {
  try {
    const { bookingToken, attendeeName, attendeeEmail } = req.body;

    if (!bookingToken) {
      return res.status(400).json({ error: 'Booking token required' });
    }

    // Get member pricing
    const memberResult = await pool.query(
      `SELECT tm.booking_price, tm.currency, tm.payment_required, tm.name,
              t.name as team_name
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.booking_token = $1`,
      [bookingToken]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    if (!member.payment_required || member.booking_price <= 0) {
      return res.status(400).json({ error: 'Payment not required for this booking' });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: member.booking_price,
      currency: member.currency || 'USD',
      metadata: {
        booking_token: bookingToken,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail,
        member_name: member.name,
        team_name: member.team_name,
      },
    });

    console.log('💳 Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: member.booking_price,
      currency: member.currency || 'USD',
    });
  } catch (error) {
    console.error('❌ Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// POST /api/payments/confirm-booking - Confirm payment and create booking
router.post('/confirm-booking', async (req, res) => {
  try {
    const { paymentIntentId, bookingToken, slot, attendeeName, attendeeEmail, notes } = req.body;

    console.log('💰 Confirming payment and creating booking:', paymentIntentId);

    // Verify payment was successful
    const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Get member details
    const memberResult = await pool.query(
      `SELECT tm.*, t.name as team_name, t.booking_mode, t.owner_id,
              u.google_access_token, u.google_refresh_token,
              u.email as member_email, u.name as member_name
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.booking_token = $1`,
      [bookingToken]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid booking token' });
    }

    const member = memberResult.rows[0];

    // Apply scheduling rules (notes only - payment already made, don't block)
    let finalNotes = notes || '';

    if (member.user_id) {
      const duration = Math.round((new Date(slot.end) - new Date(slot.start)) / 60000);
      const ruleBookingData = {
        title: `Meeting with ${attendeeName}`,
        start_time: slot.start,
        attendee_email: attendeeEmail,
        attendee_name: attendeeName,
        notes: notes || '',
        duration
      };

      const ruleResults = await applySchedulingRules(member.user_id, ruleBookingData);
      // Note: We don't block paid bookings - payment was already made
      finalNotes = ruleResults.modifiedData.notes || notes || '';

      if (ruleResults.appliedRules.length > 0) {
        console.log('📋 Applied rules to paid booking:', ruleResults.appliedRules.map(r => r.name).join(', '));
      }
    }

    // Create booking with payment info
    const bookingResult = await pool.query(
      `INSERT INTO bookings (
        team_id, member_id, user_id, attendee_name, attendee_email,
        start_time, end_time, notes, booking_token, status,
        payment_status, payment_amount, payment_currency,
        stripe_payment_intent_id, payment_receipt_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        member.team_id, member.id, member.user_id, attendeeName, attendeeEmail,
        slot.start, slot.end, finalNotes, bookingToken, 'confirmed',
        'paid', paymentIntent.amount / 100, paymentIntent.currency,
        paymentIntentId, paymentIntent.charges?.data[0]?.receipt_url
      ]
    );

    const booking = bookingResult.rows[0];

    // Record payment in payments table
    await pool.query(
      `INSERT INTO payments (
        booking_id, stripe_payment_intent_id, amount, currency,
        status, payment_method_id, receipt_url, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        booking.id, paymentIntentId, paymentIntent.amount / 100, paymentIntent.currency,
        'succeeded', paymentIntent.payment_method,
        paymentIntent.charges?.data[0]?.receipt_url,
        JSON.stringify(paymentIntent.metadata)
      ]
    );

    console.log('✅ Booking created with payment:', booking.id);

    // Record booking pattern for preference learning
    if (member.user_id) {
      const duration = Math.round((new Date(slot.end) - new Date(slot.start)) / 60000);
      await recordBookingPattern(member.user_id, { start_time: slot.start, duration });
    }

    // Notify organizer
    if (member.user_id) {
      await notifyPaymentReceived(booking, member.user_id, paymentIntent.amount / 100, paymentIntent.currency);
    }

    // Send confirmation emails (async)
    (async () => {
      try {
        const icsFile = generateICS({
          id: booking.id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          attendee_name: attendeeName,
          attendee_email: attendeeEmail,
          organizer_name: member.member_name || member.name,
          organizer_email: member.member_email || member.email,
          team_name: member.team_name,
          notes: notes,
        });

        const bookingWithPayment = {
          ...booking,
          attendee_name: attendeeName,
          attendee_email: attendeeEmail,
          organizer_name: member.member_name || member.name,
          team_name: member.team_name,
          notes,
          payment_amount: booking.payment_amount,
          payment_currency: booking.payment_currency,
          payment_receipt_url: booking.payment_receipt_url,
        };

        await sendBookingEmail({
          to: attendeeEmail,
          subject: '💳 Payment Confirmed & Booking Complete - ScheduleSync',
          html: emailTemplates.bookingConfirmationGuestWithPayment(bookingWithPayment),
          icsAttachment: icsFile,
        });

        if (member.member_email || member.email) {
          await sendBookingEmail({
            to: member.member_email || member.email,
            subject: '💰 New Paid Booking Received - ScheduleSync',
            html: emailTemplates.bookingConfirmationOrganizerWithPayment(bookingWithPayment),
            icsAttachment: icsFile,
          });
        }

        console.log('📧 Payment confirmation emails sent');
      } catch (emailError) {
        console.error('⚠️ Failed to send emails:', emailError);
      }
    })();

    res.json({
      success: true,
      booking: {
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        payment_amount: booking.payment_amount,
        payment_currency: booking.payment_currency,
        payment_receipt_url: booking.payment_receipt_url,
      },
    });
  } catch (error) {
    console.error('❌ Confirm booking error:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// POST /api/payments/refund - Process refund on cancellation
router.post('/refund', authenticateToken, async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    const userId = req.user.id;

    console.log('🔄 Processing refund for booking:', bookingId);

    // Get booking with payment info
    const bookingResult = await pool.query(
      `SELECT b.*, t.owner_id, tm.user_id as member_user_id
       FROM bookings b
       JOIN teams t ON b.team_id = t.id
       LEFT JOIN team_members tm ON b.member_id = tm.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Check permission
    const hasPermission = booking.owner_id === userId || booking.member_user_id === userId;
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if payment exists
    if (!booking.stripe_payment_intent_id || booking.payment_status !== 'paid') {
      return res.status(400).json({ error: 'No payment to refund' });
    }

    // Process refund via Stripe
    const refund = await stripeService.createRefund({
      paymentIntentId: booking.stripe_payment_intent_id,
      reason: reason || 'requested_by_customer',
    });

    // Update booking
    await pool.query(
      `UPDATE bookings
       SET payment_status = 'refunded',
           refund_id = $1,
           refund_amount = $2,
           refund_status = $3
       WHERE id = $4`,
      [refund.id, refund.amount / 100, refund.status, bookingId]
    );

    // Record refund
    await pool.query(
      `INSERT INTO refunds (booking_id, stripe_refund_id, amount, currency, status, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bookingId, refund.id, refund.amount / 100, refund.currency, refund.status, reason]
    );

    console.log('✅ Refund processed:', refund.id);

    res.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
      },
    });
  } catch (error) {
    console.error('❌ Refund error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

module.exports = router;
