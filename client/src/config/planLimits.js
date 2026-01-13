// client/src/config/planLimits.js
export const PLAN_LIMITS = {
  free: {
    ai_queries: 10,
    bookings_per_month: 50,
    event_types: 2,
    quick_links: 3,
    calendar_connections: 1,
    teams: false,
    buffer_times: false,
    email_templates: false,
    smart_rules: false,
    email_assistant: false,
    autonomous_mode: false,
    price: 0,
    name: 'Free'
  },
  starter: {
    ai_queries: 50,
    bookings_per_month: 200,
    event_types: 5,
    quick_links: 10,
    calendar_connections: 2,
    teams: false,
    buffer_times: true,
    email_templates: true,
    smart_rules: false,
    email_assistant: false,
    autonomous_mode: false,
    price: 8,
    name: 'Starter'
  },
  pro: {
    ai_queries: 250,
    bookings_per_month: Infinity,
    event_types: Infinity,
    quick_links: Infinity,
    calendar_connections: 3,
    teams: false,
    buffer_times: true,
    email_templates: true,
    smart_rules: true,
    email_assistant: true,
    autonomous_mode: false,
    price: 15,
    name: 'Pro'
  },
  team: {
    ai_queries: 750, // pooled per 5 users
    bookings_per_month: Infinity,
    event_types: Infinity,
    quick_links: Infinity,
    calendar_connections: Infinity,
    teams: true,
    team_members: 10,
    buffer_times: true,
    email_templates: true,
    smart_rules: true,
    email_assistant: true,
    autonomous_mode: true,
    price: 20, // per user
    price_model: 'per_user',
    name: 'Team'
  },
  enterprise: {
    ai_queries: Infinity,
    bookings_per_month: Infinity,
    event_types: Infinity,
    quick_links: Infinity,
    calendar_connections: Infinity,
    teams: true,
    team_members: Infinity,
    buffer_times: true,
    email_templates: true,
    smart_rules: true,
    email_assistant: true,
    autonomous_mode: true,
    sso: true,
    audit_logs: true,
    price: 'custom',
    name: 'Enterprise'
  }
};

export const PLAN_ORDER = ['free', 'starter', 'pro', 'team', 'enterprise'];

// Helper to check if a limit is "unlimited"
export const isUnlimited = (limit) => limit === Infinity || limit >= 999999;

// Get limits for a tier
export const getLimitsForTier = (tier) => {
  return PLAN_LIMITS[tier] || PLAN_LIMITS.free;
};

// Check if tier has access to a feature
export const tierHasFeature = (tier, feature) => {
  const limits = getLimitsForTier(tier);
  return limits[feature] === true;
};
