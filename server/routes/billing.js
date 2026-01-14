const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Initialize Stripe if configured
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Plan configuration
const PLANS = {
  starter: {
    price: 8,
    name: 'Starter Plan',
    ai_queries_limit: 50,
    bookings_limit: 200,
    event_types_limit: 5,
    magic_links_limit: 10,
    quick_links_limit: 10
  },
  pro: {
    price: 15,
    name: 'Pro Plan',
    ai_queries_limit: 250,
    bookings_limit: 999999,
    event_types_limit: 999999,
    magic_links_limit: 999999,
    quick_links_limit: 999999
  },
  team: {
    price: 20,
    name: 'Team Plan',
    ai_queries_limit: 750,
    bookings_limit: 999999,
    event_types_limit: 999999,
    magic_links_limit: 999999,
    quick_links_limit: 999999
  },
  enterprise: {
    price: 'custom',
    name: 'Enterprise Plan',
    ai_queries_limit: 999999,
    bookings_limit: 999999,
    event_types_limit: 999999,
    magic_links_limit: 999999,
    quick_links_limit: 999999
  }
};

const STRIPE_PRICES = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
  team: process.env.STRIPE_TEAM_PRICE_ID
};

// POST /api/billing/create-checkout - Create checkout session
router.post('/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.id;

    console.log(`Creating checkout session for user ${userId}, plan: ${plan}`);

    const selectedPlan = PLANS[plan];
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // For enterprise, redirect to contact sales
    if (plan === 'enterprise') {
      return res.json({
        success: false,
        contact_sales: true,
        message: 'Please contact sales for Enterprise pricing'
      });
    }

    // If Stripe is configured with price IDs, create a real checkout session
    if (stripe && STRIPE_PRICES[plan]) {
      try {
        const user = await pool.query('SELECT email, stripe_customer_id FROM users WHERE id = $1', [userId]);
        const userEmail = user.rows[0]?.email;
        const customerId = user.rows[0]?.stripe_customer_id;

        const sessionParams = {
          payment_method_types: ['card'],
          line_items: [{
            price: STRIPE_PRICES[plan],
            quantity: 1
          }],
          mode: 'subscription',
          success_url: `${process.env.CLIENT_URL || process.env.FRONTEND_URL}/settings?session_id={CHECKOUT_SESSION_ID}&upgraded=true`,
          cancel_url: `${process.env.CLIENT_URL || process.env.FRONTEND_URL}/pricing`,
          metadata: {
            userId: userId.toString(),
            tier: plan
          },
          subscription_data: {
            metadata: {
              userId: userId.toString(),
              tier: plan
            }
          }
        };

        if (customerId) {
          sessionParams.customer = customerId;
        } else {
          sessionParams.customer_email = userEmail;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);
        return res.json({ url: session.url });
      } catch (stripeError) {
        console.log('Stripe checkout failed, falling back to dev mode:', stripeError.message);
      }
    }

    // Dev mode: Immediate upgrade without Stripe
    await pool.query(
      `UPDATE users
       SET tier = $1,
           subscription_tier = $1,
           subscription_status = 'active',
           ai_queries_limit = $2,
           bookings_limit = $3,
           event_types_limit = $4,
           magic_links_limit = $5,
           ai_queries_used = 0
       WHERE id = $6`,
      [plan, selectedPlan.ai_queries_limit, selectedPlan.bookings_limit,
       selectedPlan.event_types_limit, selectedPlan.magic_links_limit, userId]
    );

    console.log(`User ${userId} upgraded to ${plan} plan`);

    res.json({
      success: true,
      checkout_url: `${process.env.CLIENT_URL || 'https://schedulesync-web-production.up.railway.app'}/settings?upgraded=true`,
      session_id: `sim_${Date.now()}`
    });

  } catch (error) {
    console.error('Checkout creation failed:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// GET /api/billing/invoices - Get invoices
router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    res.json({
      invoices: [
        {
          id: 'inv_demo',
          amount: 12.00,
          description: 'Pro Plan - Monthly',
          status: 'paid',
          date: new Date().toISOString()
        }
      ]
    });
  } catch (error) {
    console.error('Invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/billing/subscription - Get subscription info
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      'SELECT subscription_tier, subscription_status, stripe_subscription_id, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const plan = user.subscription_tier || 'free';
    const isPaid = plan !== 'free';

    console.log('Billing subscription for user:', userId, { plan, isPaid });

    res.json({
      id: user.stripe_subscription_id || 'free_plan',
      plan: plan,
      status: user.subscription_status || 'active',
      price: plan === 'pro' ? 12 : plan === 'team' ? 25 : 0,
      next_billing_date: isPaid ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
      current_period_end: isPaid ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
      cancel_at: null,
      payment_method: isPaid ? {
        last4: '4242',
        brand: 'visa',
        exp_month: 12,
        exp_year: 2026
      } : null
    });
  } catch (error) {
    console.error('Billing subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch billing subscription' });
  }
});

// POST /api/billing/cancel - Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`Cancelling subscription for user ${userId}`);

    // Get current plan
    const userResult = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [userId]
    );

    const currentPlan = userResult.rows[0]?.subscription_tier || 'free';

    if (currentPlan === 'free') {
      return res.status(400).json({ error: 'No active subscription to cancel' });
    }

    // Calculate when access ends
    const accessEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Update subscription status
    await pool.query(
      `UPDATE users
       SET subscription_status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    console.log(`Successfully cancelled subscription for user ${userId}`);

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      plan: currentPlan,
      status: 'cancelled',
      current_period_end: accessEndsAt.toISOString(),
      cancel_at: accessEndsAt.toISOString()
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// POST /api/billing/portal - Create billing portal session
router.post('/portal', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`Creating billing portal for user ${userId}`);

    const userResult = await pool.query(
      'SELECT stripe_customer_id, subscription_tier FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    // If real Stripe customer, create real portal
    if (user?.stripe_customer_id && user.stripe_customer_id.startsWith('cus_') && stripe) {
      try {
        const session = await stripe.billingPortal.sessions.create({
          customer: user.stripe_customer_id,
          return_url: `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/billing`,
        });

        return res.json({ url: session.url, is_simulated: false });
      } catch (stripeError) {
        console.error('Stripe portal error:', stripeError);
      }
    }

    // Fallback for simulated mode
    res.json({
      url: null,
      is_simulated: true,
      message: 'Billing management - contact support for payment changes'
    });

  } catch (error) {
    console.error('Billing portal error:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

// POST /api/billing/reactivate - Reactivate cancelled subscription
router.post('/reactivate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`Reactivating subscription for user ${userId}`);

    const userResult = await pool.query(
      'SELECT subscription_tier, subscription_status FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    if (!user || user.subscription_tier === 'free') {
      return res.status(400).json({ error: 'No subscription to reactivate' });
    }

    if (user.subscription_status !== 'cancelled') {
      return res.status(400).json({ error: 'Subscription is not cancelled' });
    }

    await pool.query(
      `UPDATE users SET subscription_status = 'active', updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    console.log(`Subscription reactivated for user ${userId}`);

    res.json({
      success: true,
      message: 'Subscription reactivated successfully',
      status: 'active'
    });
  } catch (error) {
    console.error('Reactivate error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

module.exports = router;
