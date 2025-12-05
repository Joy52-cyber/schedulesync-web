// config/planLimits.js
const PLAN_LIMITS = {
  free: {
    ai_queries_limit: 10,
    bookings_limit: 50,
    event_types_limit: 2,
    magic_links_limit: 3,
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
    teams_enabled: true,
    team_members_limit: 10,
    buffer_times_enabled: true,
    booking_caps_enabled: true,
    stripe_payments_enabled: true,
    custom_branding_enabled: true,
    advanced_reminders_enabled: true,
    remove_branding_enabled: true
  }
};

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
    calendar_connections_limit: limits.calendar_connections_limit
  };
};

module.exports = {
  PLAN_LIMITS,
  isUnlimited,
  getLimitsForTier,
  applyTierLimits
};