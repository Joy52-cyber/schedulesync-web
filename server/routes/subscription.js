/**
 * Subscription Routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');

const TIERS = {
  FREE: 'free',
  PRO: 'pro',
  TEAMS: 'teams',
};

const TIER_LIMITS = {
  [TIERS.FREE]: {
    bookings_per_month: 10,
    event_types: 1,
    team_members: 1,
  },
  [TIERS.PRO]: {
    bookings_per_month: Infinity,
    event_types: Infinity,
    team_members: 1,
  },
  [TIERS.TEAMS]: {
    bookings_per_month: Infinity,
    event_types: Infinity,
    team_members: 10,
  },
};

/**
 * GET /api/user/subscription
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      'SELECT subscription_tier, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    const user = userResult.rows[0];
    const tier = user?.subscription_tier || TIERS.FREE;

    const usage = await getUsageStats(userId);

    let billing = null;
    if (user?.stripe_customer_id) {
      billing = await getBillingInfo(user.stripe_customer_id);
    }

    res.json({
      tier,
      usage,
      billing,
      limits: TIER_LIMITS[tier],
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * GET /api/user/subscription/usage
 */
router.get('/subscription/usage', authenticateToken, async (req, res) => {
  try {
    const usage = await getUsageStats(req.user.id);
    res.json(usage);
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

/**
 * POST /api/user/subscription/check-limit
 */
router.post('/subscription/check-limit', authenticateToken, async (req, res) => {
  try {
    const { feature } = req.body;
    const userId = req.user.id;

    const userResult = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [userId]
    );
    const tier = userResult.rows[0]?.subscription_tier || TIERS.FREE;
    const limits = TIER_LIMITS[tier];

    const usage = await getUsageStats(userId);

    let allowed = true;
    let currentUsage = 0;
    let limit = 0;

    switch (feature) {
      case 'bookings_per_month':
        currentUsage = usage.bookings_this_month;
        limit = limits.bookings_per_month;
        allowed = currentUsage < limit;
        break;
      case 'event_types':
        currentUsage = usage.event_types_count;
        limit = limits.event_types;
        allowed = currentUsage < limit;
        break;
      case 'team_members':
        currentUsage = usage.team_members_count;
        limit = limits.team_members;
        allowed = currentUsage < limit;
        break;
      default:
        return res.status(400).json({ error: 'Unknown feature' });
    }

    res.json({
      allowed,
      currentUsage,
      limit: limit === Infinity ? 'unlimited' : limit,
      tier,
    });
  } catch (error) {
    console.error('Error checking limit:', error);
    res.status(500).json({ error: 'Failed to check limit' });
  }
});

/**
 * Helper: Get usage statistics for a user
 */
async function getUsageStats(userId) {
  // Get bookings this month
  const bookingsResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM bookings b
    JOIN event_types et ON b.event_type_id = et.id
    WHERE et.user_id = $1
      AND b.created_at >= date_trunc('month', CURRENT_DATE)
      AND b.status != 'cancelled'
  `, [userId]);

  // Get event types count
  const eventTypesResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM event_types
    WHERE user_id = $1 AND deleted_at IS NULL
  `, [userId]);

  // Get team members count
  const teamMembersResult = await pool.query(`
    SELECT COUNT(DISTINCT tm.user_id) as count
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    WHERE t.owner_id = $1
  `, [userId]);

  return {
    bookings_this_month: parseInt(bookingsResult.rows[0]?.count || 0),
    event_types_count: parseInt(eventTypesResult.rows[0]?.count || 0),
    team_members_count: parseInt(teamMembersResult.rows[0]?.count || 1),
  };
}

/**
 * Helper: Get billing info from Stripe
 */
async function getBillingInfo(stripeCustomerId) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return null;
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return { status: 'none' };
    }

    const sub = subscriptions.data[0];
    return {
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
    };
  } catch (error) {
    console.error('Error fetching Stripe billing:', error);
    return null;
  }
}

/**
 * Middleware: Check feature access before allowing action
 */
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      const userResult = await pool.query(
        'SELECT subscription_tier FROM users WHERE id = $1',
        [userId]
      );
      const tier = userResult.rows[0]?.subscription_tier || TIERS.FREE;
      const limits = TIER_LIMITS[tier];

      const usage = await getUsageStats(userId);

      let allowed = true;

      switch (feature) {
        case 'bookings_per_month':
          allowed = usage.bookings_this_month < limits.bookings_per_month;
          break;
        case 'event_types':
          allowed = usage.event_types_count < limits.event_types;
          break;
        case 'team_members':
          allowed = usage.team_members_count < limits.team_members;
          break;
        case 'magic_links':
        case 'buffer_times':
        case 'email_reminders':
        case 'custom_email_templates':
        case 'chatgpt_integration':
        case 'stripe_payments':
        case 'microsoft_calendar':
          allowed = tier !== TIERS.FREE;
          break;
        case 'round_robin':
        case 'team_availability':
        case 'role_permissions':
          allowed = tier === TIERS.TEAMS;
          break;
        default:
          allowed = true;
      }

      if (!allowed) {
        return res.status(403).json({
          error: 'Feature not available',
          code: 'UPGRADE_REQUIRED',
          feature,
          currentTier: tier,
          requiredTier: feature.includes('team') || feature === 'round_robin' 
            ? TIERS.TEAMS 
            : TIERS.PRO,
        });
      }

      next();
    } catch (error) {
      console.error('Error checking feature access:', error);
      res.status(500).json({ error: 'Failed to check feature access' });
    }
  };
}

router.requireFeature = requireFeature;

module.exports = router;