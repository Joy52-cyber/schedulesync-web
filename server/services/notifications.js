/**
 * Notifications Service
 * Handles creating and managing user notifications
 */

const pool = require('../config/database');

async function createNotification({ userId, type, title, message, link, bookingId, metadata }) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link, booking_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, type, title, message, link || null, bookingId || null, metadata ? JSON.stringify(metadata) : null]
    );
    console.log(`🔔 Notification: ${title}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Notification error:', error);
    return null;
  }
}

async function notifyBookingCreated(booking, organizerId) {
  return createNotification({
    userId: organizerId,
    type: 'booking_created',
    title: '📅 New Booking Received',
    message: `${booking.attendee_name} scheduled a meeting for ${new Date(booking.start_time).toLocaleDateString()}`,
    link: `/bookings/${booking.id}`,
    bookingId: booking.id,
  });
}

async function notifyBookingCancelled(booking, userId) {
  return createNotification({
    userId: userId,
    type: 'booking_cancelled',
    title: '❌ Booking Cancelled',
    message: `Meeting with ${booking.attendee_name} has been cancelled`,
    link: `/bookings`,
    bookingId: booking.id,
  });
}

async function notifyBookingRescheduled(booking, userId, oldStartTime) {
  const newTime = new Date(booking.start_time);
  return createNotification({
    userId: userId,
    type: 'booking_rescheduled',
    title: '📆 Booking Rescheduled',
    message: `Meeting rescheduled to ${newTime.toLocaleDateString()}`,
    link: `/bookings/${booking.id}`,
    bookingId: booking.id,
  });
}

async function notifyPaymentReceived(booking, userId, amount, currency) {
  return createNotification({
    userId: userId,
    type: 'payment_received',
    title: '💰 Payment Received',
    message: `${currency.toUpperCase()} ${amount} from ${booking.attendee_name}`,
    link: `/bookings/${booking.id}`,
    bookingId: booking.id,
  });
}

module.exports = {
  createNotification,
  notifyBookingCreated,
  notifyBookingCancelled,
  notifyBookingRescheduled,
  notifyPaymentReceived,
};
