const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Initialize Stripe if configured
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// POST /api/webhooks/stripe - Stripe webhook handler
// Note: This route needs express.raw() middleware, not express.json()
// The raw body parsing is handled in the route definition
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    if (!stripe) {
      console.log('Stripe not configured, skipping webhook');
      return res.json({ received: true });
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('Stripe webhook event:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        // Payment was successful
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        // Payment failed
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);
        break;

      case 'charge.refunded':
        // Refund processed
        const refund = event.data.object;
        console.log('Refund processed:', refund.id);
        break;

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;

        if (userId && tier) {
          await pool.query(
            `UPDATE users SET subscription_tier = $1, stripe_customer_id = $2, updated_at = NOW() WHERE id = $3`,
            [tier, session.customer, userId]
          );
          console.log(`User ${userId} upgraded to ${tier} via Stripe checkout`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by stripe_customer_id and update status
        const status = subscription.status;
        if (status === 'canceled' || status === 'unpaid') {
          await pool.query(
            `UPDATE users SET subscription_tier = 'free' WHERE stripe_customer_id = $1`,
            [customerId]
          );
          console.log(`Subscription ${status} for customer ${customerId}, downgraded to free`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await pool.query(
          `UPDATE users SET subscription_tier = 'free' WHERE stripe_customer_id = $1`,
          [customerId]
        );
        console.log(`Subscription deleted for customer ${customerId}, downgraded to free`);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

module.exports = router;
