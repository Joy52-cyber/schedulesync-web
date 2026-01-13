// config/planLimits.js
const PLAN_LIMITS = {
  free: {
    ai_queries_limit: 10,
    bookings_limit: 50,
    event_types_limit: 2,
    quick_links_limit: 2,
    magic_links_limit: 2,
    calendar_connections_limit: 1,
    teams_enabled: false,
    buffer_times_enabled: false,
    email_templates_enabled: false,
    smart_rules_enabled: false,
    email_assistant_enabled: false,
    autonomous_mode_enabled: false,
    booking_caps_enabled: false,
    stripe_payments_enabled: false,
    custom_branding_enabled: false,
    advanced_reminders_enabled: false,
    remove_branding_enabled: false,
    price: 0,
    name: 'Free'
  },
  starter: {
    ai_queries_limit: 50,
    bookings_limit: 200,
    event_types_limit: 5,
    quick_links_limit: 10,
    magic_links_limit: 10,
    calendar_connections_limit: 2,
    teams_enabled: false,
    buffer_times_enabled: true,
    email_templates_enabled: true,
    smart_rules_enabled: false,
    email_assistant_enabled: false,
    autonomous_mode_enabled: false,
    booking_caps_enabled: true,
    stripe_payments_enabled: true,
    custom_branding_enabled: false,
    advanced_reminders_enabled: true,
    remove_branding_enabled: false,
    price: 8,
    name: 'Starter'
  },
  pro: {
    ai_queries_limit: 250,
    bookings_limit: 999999,
    event_types_limit: 999999,
    quick_links_limit: 999999,
    magic_links_limit: 999999,
    calendar_connections_limit: 3,
    teams_enabled: false,
    buffer_times_enabled: true,
    email_templates_enabled: true,
    smart_rules_enabled: true,
    email_assistant_enabled: true,
    autonomous_mode_enabled: false,
    booking_caps_enabled: true,
    stripe_payments_enabled: true,
    custom_branding_enabled: true,
    advanced_reminders_enabled: true,
    remove_branding_enabled: true,
    price: 15,
    name: 'Pro'
  },
  team: {
    ai_queries_limit: 750, // pooled per 5 users
    bookings_limit: 999999,
    event_types_limit: 999999,
    quick_links_limit: 999999,
    magic_links_limit: 999999,
    calendar_connections_limit: 999999,
    teams_enabled: true,
    team_members_limit: 10,
    buffer_times_enabled: true,
    email_templates_enabled: true,
    smart_rules_enabled: true,
    email_assistant_enabled: true,
    autonomous_mode_enabled: true,
    booking_caps_enabled: true,
    stripe_payments_enabled: true,
    custom_branding_enabled: true,
    advanced_reminders_enabled: true,
    remove_branding_enabled: true,
    price: 20, // per user
    price_model: 'per_user',
    name: 'Team'
  },
  enterprise: {
    ai_queries_limit: 999999,
    bookings_limit: 999999,
    event_types_limit: 999999,
    quick_links_limit: 999999,
    magic_links_limit: 999999,
    calendar_connections_limit: 999999,
    teams_enabled: true,
    team_members_limit: 999999,
    buffer_times_enabled: true,
    email_templates_enabled: true,
    smart_rules_enabled: true,
    email_assistant_enabled: true,
    autonomous_mode_enabled: true,
    booking_caps_enabled: true,
    stripe_payments_enabled: true,
    custom_branding_enabled: true,
    advanced_reminders_enabled: true,
    remove_branding_enabled: true,
    sso_enabled: true,
    audit_logs_enabled: true,
    price: 'custom',
    name: 'Enterprise'
  }
};

const PLAN_ORDER = ['free', 'starter', 'pro', 'team', 'enterprise'];

// Helper to check if a limit is "unlimited"
const isUnlimited = (limit) => limit >= 1000;

// Get limits for a tier
const getLimitsForTier = (tier) => {
  return PLAN_LIMITS[tier] || PLAN_LIMITS.free;
};

// Apply limits when user upgrades/downgrades
const applyTierLimits = (tier) => {
  const limits = getLimitsForTier(tier);
  return {
    ai_queries_limit: limits.ai_queries_limit,
    bookings_limit: limits.bookings_limit,
    event_types_limit: limits.event_types_limit,
    magic_links_limit: limits.magic_links_limit,
    quick_links_limit: limits.quick_links_limit,
    calendar_connections_limit: limits.calendar_connections_limit
  };
};

// Check if tier has access to a feature
const tierHasFeature = (tier, feature) => {
  const limits = getLimitsForTier(tier);
  return limits[`${feature}_enabled`] === true;
};

module.exports = {
  PLAN_LIMITS,
  PLAN_ORDER,
  isUnlimited,
  getLimitsForTier,
  applyTierLimits,
  tierHasFeature
};
