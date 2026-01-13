// server/middleware/featureGates.js
 
const pool = require('../../db/pool');

// ============================================
// PLAN LIMITS CONFIGURATION
// ============================================
const PLAN_LIMITS = {
  free: {
    ai_queries_limit: 10,
    bookings_limit: 50,
    event_types_limit: 2,
    magic_links_limit: 2,
    calendar_connections_limit: 1,
    teams_enabled: false,
    buffer_times_enabled: false,
    booking_caps_enabled: false,
    stripe_payments_enabled: false,
    custom_branding_enabled: false,
    advanced_reminders_enabled: false,
    remove_branding_enabled: false
  },
  pro: {
    ai_queries_limit: 999999,
    bookings_limit: 999999,
    event_types_limit: 999999,
    magic_links_limit: 999999,
    calendar_connections_limit: 3,
    teams_enabled: false,
    buffer_times_enabled: true,
    booking_caps_enabled: true,
    stripe_payments_enabled: true,
    custom_branding_enabled: true,
    advanced_reminders_enabled: true,
    remove_branding_enabled: true
  },
  team: {
    ai_queries_limit: 999999,
    bookings_limit: 999999,
    event_types_limit: 999999,
    magic_links_limit: 999999,
    calendar_connections_limit: 999999,
    team_members_limit: 10,
    teams_enabled: true,
    buffer_times_enabled: true,
    booking_caps_enabled: true,
    stripe_payments_enabled: true,
    custom_branding_enabled: true,
    advanced_reminders_enabled: true,
    remove_branding_enabled: true
  }
};

// Helper to check if limit is "unlimited"
const isUnlimited = (limit) => limit >= 1000;

// Get limits for a tier
const getLimitsForTier = (tier) => PLAN_LIMITS[tier] || PLAN_LIMITS.free;

// ============================================
// FEATURE GATEKEEPING MIDDLEWARE
// ============================================

// Check if user has reached AI query limit
const checkAIQueryLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // ✅ Check if monthly reset is needed
    await checkAndResetIfNeeded(userId);

    const result = await pool.query(
      'SELECT subscription_tier, ai_queries_used, ai_queries_limit FROM users WHERE id = $1',
      [userId]
    );
    
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const tier = user.subscription_tier || 'free';
    const used = user.ai_queries_used || 0;
    const limit = user.ai_queries_limit || PLAN_LIMITS[tier]?.ai_queries_limit || 10;
    
    // Skip check for unlimited users
    if (isUnlimited(limit)) {
      req.aiUsage = { used, limit, tier, unlimited: true };
      return next();
    }
    
    if (used >= limit) {
      console.log(`🚫 AI limit reached for user ${userId}: ${used}/${limit}`);
      return res.status(429).json({
        error: 'AI query limit reached',
        message: `You've used ${used}/${limit} AI queries this month. Upgrade to Pro for unlimited queries.`,
        upgrade_required: true,
        feature: 'ai_queries',
        usage: { ai_queries_used: used, ai_queries_limit: limit },
        current_tier: tier
      });
    }
    
    req.aiUsage = { used, limit, tier, unlimited: false };
    next();
    
  } catch (error) {
    console.error('❌ AI query limit check error:', error);
    // Fail closed - block request if we can't verify
    res.status(500).json({ error: 'Failed to check AI query limits' });
  }
};

// Check and reset if user's reset date has passed
const checkAndResetIfNeeded = async (userId) => {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET ai_queries_used = 0,
           monthly_bookings = 0,
           magic_links_used = 0,
           chatgpt_queries_reset_date = NOW() + INTERVAL '1 month'
       WHERE id = $1 
         AND (chatgpt_queries_reset_date IS NULL OR chatgpt_queries_reset_date <= NOW())
       RETURNING id`,
      [userId]
    );
    
    if (result.rows.length > 0) {
      console.log(`🔄 Monthly reset triggered for user ${userId}`);
    }
  } catch (error) {
    console.error('❌ Reset check error:', error);
  }
};

// Check if user has reached booking limit
const checkBookingLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const result = await pool.query(
      'SELECT subscription_tier, monthly_bookings, bookings_limit FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const tier = user.subscription_tier || 'free';
    const used = user.monthly_bookings || 0;
    const limit = user.bookings_limit || PLAN_LIMITS[tier]?.bookings_limit || 50;
    
    // Skip check for unlimited users
    if (isUnlimited(limit)) {
      req.bookingUsage = { used, limit, tier, unlimited: true };
      return next();
    }
    
    if (used >= limit) {
      console.log(`🚫 Booking limit reached for user ${userId}: ${used}/${limit}`);
      return res.status(429).json({
        error: 'Monthly booking limit reached',
        message: `You've used ${used}/${limit} bookings this month. Upgrade to Pro for unlimited bookings.`,
        upgrade_required: true,
        feature: 'bookings',
        usage: { bookings_used: used, bookings_limit: limit },
        current_tier: tier
      });
    }
    
    req.bookingUsage = { used, limit, tier, unlimited: false };
    next();
    
  } catch (error) {
    console.error('❌ Booking limit check error:', error);
    res.status(500).json({ error: 'Failed to check booking limits' });
  }
};

// Check if user can create more event types
const checkEventTypeLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const userResult = await pool.query(
      'SELECT subscription_tier, event_types_limit FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    const tier = user.subscription_tier || 'free';
    const limit = user.event_types_limit || PLAN_LIMITS[tier]?.event_types_limit || 2;
    
    // Skip check for unlimited users
    if (isUnlimited(limit)) {
      return next();
    }
    
    // Count existing event types
    const eventCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM event_types WHERE user_id = $1',
      [userId]
    );
    
    const eventCount = parseInt(eventCountResult.rows[0].count);
    
    if (eventCount >= limit) {
      console.log(`🚫 Event type limit reached for user ${userId}: ${eventCount}/${limit}`);
      return res.status(429).json({
        error: 'Event type limit reached',
        message: `Free accounts are limited to ${limit} event types. You have ${eventCount}. Upgrade to Pro for unlimited.`,
        upgrade_required: true,
        feature: 'event_types',
        usage: { event_types_used: eventCount, event_types_limit: limit },
        current_tier: tier
      });
    }
    
    req.eventTypeUsage = { used: eventCount, limit, tier };
    next();
    
  } catch (error) {
    console.error('❌ Event type limit check error:', error);
    res.status(500).json({ error: 'Failed to check event type limits' });
  }
};

// Check if user can create more magic links
const checkMagicLinkLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const result = await pool.query(
      'SELECT subscription_tier, magic_links_used, magic_links_limit FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const tier = user.subscription_tier || 'free';
    const used = user.magic_links_used || 0;
    const limit = user.magic_links_limit || PLAN_LIMITS[tier]?.magic_links_limit || 2;
    
    // Skip check for unlimited users
    if (isUnlimited(limit)) {
      req.magicLinkUsage = { used, limit, tier, unlimited: true };
      return next();
    }
    
    if (used >= limit) {
      console.log(`🚫 Quick link limit reached for user ${userId}: ${used}/${limit}`);
      return res.status(429).json({
        error: 'Quick link limit reached',
        message: `You've used ${used}/${limit} quick links this month. Upgrade to Pro for unlimited.`,
        upgrade_required: true,
        feature: 'magic_links',
        usage: { magic_links_used: used, magic_links_limit: limit },
        current_tier: tier
      });
    }
    
    req.magicLinkUsage = { used, limit, tier, unlimited: false };
    next();
    
  } catch (error) {
    console.error('❌ Magic link limit check error:', error);
    res.status(500).json({ error: 'Failed to check magic link limits' });
  }
};

// Check if user has access to team features
const checkTeamAccess = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const result = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const tier = result.rows[0].subscription_tier || 'free';
    
    if (!PLAN_LIMITS[tier]?.teams_enabled) {
      return res.status(403).json({
        error: 'Team features require Team subscription',
        message: 'Upgrade to Team plan to access team management features.',
        upgrade_required: true,
        feature: 'teams',
        required_tier: 'team',
        current_tier: tier
      });
    }
    
    req.userTier = tier;
    next();
    
  } catch (error) {
    console.error('❌ Team access check error:', error);
    res.status(500).json({ error: 'Failed to check team access' });
  }
};

// Check if user has access to Pro features (buffer times, booking caps, etc.)
const checkProFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const result = await pool.query(
        'SELECT subscription_tier FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const tier = result.rows[0].subscription_tier || 'free';
      const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;
      
      if (!limits[featureName]) {
        const featureDisplayName = featureName.replace(/_/g, ' ').replace('enabled', '').trim();
        return res.status(403).json({
          error: `${featureDisplayName} requires Pro subscription`,
          message: `Upgrade to Pro to access ${featureDisplayName}.`,
          upgrade_required: true,
          feature: featureName,
          required_tier: 'pro',
          current_tier: tier
        });
      }
      
      req.userTier = tier;
      next();
      
    } catch (error) {
      console.error(`❌ ${featureName} check error:`, error);
      res.status(500).json({ error: `Failed to check ${featureName} access` });
    }
  };
};

// Specific Pro feature checks
const checkBufferTimesEnabled = checkProFeature('buffer_times_enabled');
const checkBookingCapsEnabled = checkProFeature('booking_caps_enabled');
const checkStripePaymentsEnabled = checkProFeature('stripe_payments_enabled');
const checkCustomBrandingEnabled = checkProFeature('custom_branding_enabled');
const checkAdvancedRemindersEnabled = checkProFeature('advanced_reminders_enabled');

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Increment AI query usage
const incrementAIUsage = async (userId) => {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET ai_queries_used = COALESCE(ai_queries_used, 0) + 1 
       WHERE id = $1 
       RETURNING ai_queries_used, ai_queries_limit`,
      [userId]
    );
    console.log(`📊 AI usage incremented for user ${userId}: ${result.rows[0]?.ai_queries_used}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Failed to increment AI usage:', error);
    return null;
  }
};

// Increment booking usage
const incrementBookingUsage = async (userId) => {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET monthly_bookings = COALESCE(monthly_bookings, 0) + 1 
       WHERE id = $1 
       RETURNING monthly_bookings, bookings_limit`,
      [userId]
    );
    console.log(`📊 Booking usage incremented for user ${userId}: ${result.rows[0]?.monthly_bookings}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Failed to increment booking usage:', error);
    return null;
  }
};

// Increment magic link usage
const incrementMagicLinkUsage = async (userId) => {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET magic_links_used = COALESCE(magic_links_used, 0) + 1 
       WHERE id = $1 
       RETURNING magic_links_used, magic_links_limit`,
      [userId]
    );
    console.log(`📊 Magic link usage incremented for user ${userId}: ${result.rows[0]?.magic_links_used}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Failed to increment magic link usage:', error);
    return null;
  }
};

// Apply tier limits when user upgrades/downgrades
const applyTierLimits = async (userId, tier) => {
  try {
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;
    
    await pool.query(`
      UPDATE users SET
        ai_queries_limit = $2,
        bookings_limit = $3,
        event_types_limit = $4,
        magic_links_limit = $5,
        calendar_connections_limit = $6,
        subscription_tier = $7
      WHERE id = $1
    `, [
      userId,
      limits.ai_queries_limit,
      limits.bookings_limit,
      limits.event_types_limit,
      limits.magic_links_limit,
      limits.calendar_connections_limit,
      tier
    ]);
    
    console.log(`✅ Applied ${tier} limits for user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to apply tier limits:', error);
    return false;
  }
};

// ============================================
// API ENDPOINT: Check all feature access
// ============================================
const checkFeatureAccess = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { feature } = req.query;
    
    const result = await pool.query(`
      SELECT 
        subscription_tier,
        ai_queries_used,
        ai_queries_limit,
        monthly_bookings,
        bookings_limit,
        magic_links_used,
        magic_links_limit,
        event_types_limit
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const tier = user.subscription_tier || 'free';
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;
    
    // Count event types
    const eventCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM event_types WHERE user_id = $1',
      [userId]
    );
    const eventTypesUsed = parseInt(eventCountResult.rows[0].count);
    
    const access = {
      ai_queries: {
        enabled: isUnlimited(user.ai_queries_limit) || (user.ai_queries_used || 0) < (user.ai_queries_limit || 10),
        used: user.ai_queries_used || 0,
        limit: isUnlimited(user.ai_queries_limit) ? 'unlimited' : (user.ai_queries_limit || 10),
        unlimited: isUnlimited(user.ai_queries_limit)
      },
      bookings: {
        enabled: isUnlimited(user.bookings_limit) || (user.monthly_bookings || 0) < (user.bookings_limit || 50),
        used: user.monthly_bookings || 0,
        limit: isUnlimited(user.bookings_limit) ? 'unlimited' : (user.bookings_limit || 50),
        unlimited: isUnlimited(user.bookings_limit)
      },
      event_types: {
        enabled: isUnlimited(user.event_types_limit) || eventTypesUsed < (user.event_types_limit || 2),
        used: eventTypesUsed,
        limit: isUnlimited(user.event_types_limit) ? 'unlimited' : (user.event_types_limit || 2),
        unlimited: isUnlimited(user.event_types_limit)
      },
      magic_links: {
        enabled: isUnlimited(user.magic_links_limit) || (user.magic_links_used || 0) < (user.magic_links_limit || 2),
        used: user.magic_links_used || 0,
        limit: isUnlimited(user.magic_links_limit) ? 'unlimited' : (user.magic_links_limit || 2),
        unlimited: isUnlimited(user.magic_links_limit)
      },
      teams: {
        enabled: limits.teams_enabled,
        required_tier: 'team'
      },
      buffer_times: {
        enabled: limits.buffer_times_enabled,
        required_tier: 'pro'
      },
      booking_caps: {
        enabled: limits.booking_caps_enabled,
        required_tier: 'pro'
      },
      stripe_payments: {
        enabled: limits.stripe_payments_enabled,
        required_tier: 'pro'
      },
      custom_branding: {
        enabled: limits.custom_branding_enabled,
        required_tier: 'pro'
      }
    };
    
    // Return specific feature or all features
    const response = feature && access[feature] ? { [feature]: access[feature] } : access;
    
    res.json({
      tier,
      features: response,
      limits: {
        ai_queries_limit: user.ai_queries_limit,
        bookings_limit: user.bookings_limit,
        event_types_limit: user.event_types_limit,
        magic_links_limit: user.magic_links_limit
      }
    });
    
  } catch (error) {
    console.error('❌ Feature access check error:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
};

// ============================================
// MONTHLY RESET FUNCTION
// ============================================
const resetMonthlyUsage = async () => {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET 
        monthly_bookings = 0,
        magic_links_used = 0,
        ai_queries_used = 0
      WHERE chatgpt_queries_reset_date <= NOW()
      RETURNING id
    `);
    
    // Update reset date for affected users
    if (result.rows.length > 0) {
      const userIds = result.rows.map(r => r.id);
      await pool.query(`
        UPDATE users 
        SET chatgpt_queries_reset_date = NOW() + INTERVAL '1 month'
        WHERE id = ANY($1)
      `, [userIds]);
    }
    
    console.log(`✅ Monthly usage reset for ${result.rows.length} users`);
    return result.rows.length;
  } catch (error) {
    console.error('❌ Monthly reset failed:', error);
    return 0;
  }
};

module.exports = {
  // Middleware
  checkAIQueryLimit,
  checkBookingLimit,
  checkEventTypeLimit,
  checkMagicLinkLimit,
  checkTeamAccess,
  checkBufferTimesEnabled,
  checkBookingCapsEnabled,
  checkStripePaymentsEnabled,
  checkCustomBrandingEnabled,
  checkAdvancedRemindersEnabled,
  
  // Utility functions
  incrementAIUsage,
  incrementBookingUsage,
  incrementMagicLinkUsage,
  applyTierLimits,
  resetMonthlyUsage,
  checkAndResetIfNeeded,
  
  // API endpoint
  checkFeatureAccess,
  
  // Constants
  PLAN_LIMITS,
  isUnlimited,
  getLimitsForTier
};