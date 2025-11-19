const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a payment intent for a booking
 */
const createPaymentIntent = async ({ amount, currency = 'USD', metadata = {} }) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error('❌ Stripe payment intent error:', error);
    throw error;
  }
};

/**
 * Confirm a payment
 */
const confirmPayment = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('❌ Stripe confirm payment error:', error);
    throw error;
  }
};

/**
 * Create a refund
 */
const createRefund = async ({ paymentIntentId, amount, reason }) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
      reason: reason || 'requested_by_customer',
    });

    return refund;
  } catch (error) {
    console.error('❌ Stripe refund error:', error);
    throw error;
  }
};

/**
 * Get payment details
 */
const getPaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('❌ Stripe get payment error:', error);
    throw error;
  }
};

/**
 * Construct webhook event from request
 */
const constructWebhookEvent = (payload, signature) => {
  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('❌ Stripe webhook error:', error);
    throw error;
  }
};

module.exports = {
  stripe,
  createPaymentIntent,
  confirmPayment,
  createRefund,
  getPaymentIntent,
  constructWebhookEvent,
};