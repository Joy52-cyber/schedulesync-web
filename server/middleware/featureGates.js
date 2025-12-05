// server/middleware/featureGates.js
const pool = require('../db/pool'); // Adjust path to your DB

// ============================================
// FEATURE GATEKEEPING MIDDLEWARE
// ============================================

// Check if user has reached AI query limit
const checkAIQueryLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      'SELECT subscription_tier, ai_queries_used, ai_queries_limit FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const tier = user.subscription_tier || 'free';
    
    // Pro and Team have unlimited AI queries
    if (tier === 'pro' || tier === 'team') {
      return next();
    }
    
    // Free tier: check limits
    const used = user.ai_queries_used || 0;
    const limit = user.ai_queries_limit || 10;
    
    if (used >= limit) {
      return res.status(403).json({
        error: 'AI query limit reached',
        message: `You've used ${used}/${limit} AI queries this month. Upgrade to Pro for unlimited queries.`,
        upgrade_required: true,
        feature: 'ai_queries',
        current_usage: used,
        limit: limit
      });
    }
    
    // Add usage info to request for later use
    req.aiUsage = { used, limit, tier };
    next();
    
  } catch (error) {
    console.error('AI query limit check error:', error);
    res.status(500).json({ error: 'Failed to check AI query limits' });
  }
};

// Check if user has reached booking limit
const checkBookingLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      'SELECT subscription_tier, monthly_bookings FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const tier = user.subscription_tier || 'free';
    
    // Pro and Team have unlimited bookings
    if (tier === 'pro' || tier === 'team') {
      return next();
    }
    
    // Free tier: check 50 booking limit
    const used = user.monthly_bookings || 0;
    const limit = 50;
    
    if (used >= limit) {
      return res.status(403).json({
        error: 'Monthly booking limit reached',
        message: `You've used ${used}/${limit} bookings this month. Upgrade to Pro for unlimited bookings.`,
        upgrade_required: true,
        feature: 'bookings',
        current_usage: used,
        limit: limit
      });
    }
    
    // Add usage info to request
    req.bookingUsage = { used, limit, tier };
    next();
    
  } catch (error) {
    console.error('Booking limit check error:', error);
    res.status(500).json({ error: 'Failed to check booking limits' });
  }
};

// Check if user has access to team features
const checkTeamAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const tier = user.subscription_tier || 'free';
    
    // Only Team tier has full team features
    if (tier !== 'team') {
      return res.status(403).json({
        error: 'Team features require Team subscription',
        message: 'Upgrade to Team plan to access advanced team management features.',
        upgrade_required: true,
        feature: 'team_features',
        required_tier: 'team',
        current_tier: tier
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Team access check error:', error);
    res.status(500).json({ error: 'Failed to check team access' });
  }
};

// Check if user can create more event types (Pro/Team get unlimited)
const checkEventTypeLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const userResult = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    const tier = user.subscription_tier || 'free';
    
    // Pro and Team have unlimited event types
    if (tier === 'pro' || tier === 'team') {
      return next();
    }
    
    // Free tier: limit to 3 event types
    const eventCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM event_types WHERE user_id = $1',
      [userId]
    );
    
    const eventCount = parseInt(eventCountResult.rows[0].count);
    const limit = 3;
    
    if (eventCount >= limit) {
      return res.status(403).json({
        error: 'Event type limit reached',
        message: `Free accounts are limited to ${limit} event types. You have ${eventCount}. Upgrade to Pro for unlimited event types.`,
        upgrade_required: true,
        feature: 'event_types',
        current_usage: eventCount,
        limit: limit
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Event type limit check error:', error);
    res.status(500).json({ error: 'Failed to check event type limits' });
  }
};

// Utility function to increment AI query usage
const incrementAIUsage = async (userId) => {
  try {
    await pool.query(
      'UPDATE users SET ai_queries_used = COALESCE(ai_queries_used, 0) + 1 WHERE id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Failed to increment AI usage:', error);
  }
};

// Utility function to increment booking usage
const incrementBookingUsage = async (userId) => {
  try {
    await pool.query(
      'UPDATE users SET monthly_bookings = COALESCE(monthly_bookings, 0) + 1 WHERE id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Failed to increment booking usage:', error);
  }
};

// Feature gate checker (for frontend usage)
const checkFeatureAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    const { feature } = req.query; // ?feature=ai_queries|bookings|team_features
    
    const result = await pool.query(`
      SELECT 
        subscription_tier,
        ai_queries_used,
        ai_queries_limit,
        monthly_bookings
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const tier = user.subscription_tier || 'free';
    
    const access = {
      ai_queries: {
        enabled: tier === 'pro' || tier === 'team' || (user.ai_queries_used || 0) < (user.ai_queries_limit || 10),
        used: user.ai_queries_used || 0,
        limit: tier === 'pro' || tier === 'team' ? 'unlimited' : (user.ai_queries_limit || 10),
        upgrade_required: tier === 'free' && (user.ai_queries_used || 0) >= (user.ai_queries_limit || 10)
      },
      bookings: {
        enabled: tier === 'pro' || tier === 'team' || (user.monthly_bookings || 0) < 50,
        used: user.monthly_bookings || 0,
        limit: tier === 'pro' || tier === 'team' ? 'unlimited' : 50,
        upgrade_required: tier === 'free' && (user.monthly_bookings || 0) >= 50
      },
      team_features: {
        enabled: tier === 'team',
        upgrade_required: tier !== 'team'
      }
    };
    
    // Return specific feature or all features
    const response = feature ? { [feature]: access[feature] } : access;
    
    res.json({
      tier,
      features: response
    });
    
  } catch (error) {
    console.error('Feature access check error:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
};

module.exports = {
  checkAIQueryLimit,
  checkBookingLimit,
  checkTeamAccess,
  checkEventTypeLimit,
  incrementAIUsage,
  incrementBookingUsage,
  checkFeatureAccess
};