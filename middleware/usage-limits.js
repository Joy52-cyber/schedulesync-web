// middleware/usage-limits.js
const pool = require('../database'); // Adjust path to match your database config

// Track ChatGPT usage and enforce limits
const trackChatGptUsage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentMonth = new Date().toISOString().slice(0, 7); // '2025-12'
    
    // Get user's subscription tier and grace period
    const userResult = await pool.query(
      'SELECT subscription_tier, grace_period_until FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Check grace period
    const isInGracePeriod = user.grace_period_until && 
                           new Date() < new Date(user.grace_period_until);
    
    // If user is Pro/Team or in grace period, allow unlimited
    if (user.subscription_tier !== 'free' || isInGracePeriod) {
      return next();
    }
    
    // For free users, check usage limit
    const usageResult = await pool.query(
      `INSERT INTO usage_tracking (user_id, month_year, chatgpt_queries_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, month_year)
       DO UPDATE SET 
         chatgpt_queries_used = usage_tracking.chatgpt_queries_used + 1,
         updated_at = CURRENT_TIMESTAMP
       RETURNING chatgpt_queries_used`,
      [userId, currentMonth]
    );
    
    const queriesUsed = usageResult.rows[0].chatgpt_queries_used;
    
    // Check if over limit (3 for free tier)
    if (queriesUsed > 3) {
      return res.status(403).json({
        error: 'ChatGPT usage limit exceeded',
        message: 'You have reached your monthly limit of 3 ChatGPT queries. Upgrade to Pro for unlimited access.',
        usage: {
          used: queriesUsed,
          limit: 3,
          tier: 'free'
        },
        upgrade_url: '/pricing'
      });
    }
    
    // Add usage info to request for response
    req.usage = { 
      chatgpt_queries_used: queriesUsed, 
      limit: 3,
      subscription_tier: user.subscription_tier,
      grace_period: isInGracePeriod
    };
    
    next();
  } catch (error) {
    console.error('Usage tracking error:', error);
    res.status(500).json({ error: 'Usage tracking failed' });
  }
};

// Get user's current usage stats
const getCurrentUsage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Get usage data
    const usageResult = await pool.query(
      'SELECT chatgpt_queries_used, bookings_this_month FROM usage_tracking WHERE user_id = $1 AND month_year = $2',
      [userId, currentMonth]
    );
    
    // Get user subscription info
    const userResult = await pool.query(
      'SELECT subscription_tier, grace_period_until FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    const usage = usageResult.rows[0] || { chatgpt_queries_used: 0, bookings_this_month: 0 };
    
    // Get plan limits
    const planResult = await pool.query(
      'SELECT chatgpt_queries_limit, bookings_limit FROM subscription_plans WHERE id = $1',
      [user.subscription_tier]
    );
    
    const plan = planResult.rows[0];
    const isInGracePeriod = user.grace_period_until && 
                           new Date() < new Date(user.grace_period_until);
    
    req.userUsage = {
      subscription_tier: user.subscription_tier,
      grace_period: isInGracePeriod,
      chatgpt: {
        used: usage.chatgpt_queries_used,
        limit: isInGracePeriod || user.subscription_tier !== 'free' ? -1 : plan.chatgpt_queries_limit
      },
      bookings: {
        used: usage.bookings_this_month,
        limit: plan.bookings_limit
      }
    };
    
    next();
  } catch (error) {
    console.error('Get usage error:', error);
    next(error);
  }
};

module.exports = {
  trackChatGptUsage,
  getCurrentUsage
};