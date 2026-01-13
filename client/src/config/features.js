/**
 * ScheduleSync Feature Configuration
 * 
 * This file defines what features are available in each subscription tier.
 * Used by useSubscription hook and UpgradeGate component.
 */

export const TIERS = {
  FREE: 'free',
  PRO: 'pro',
  TEAMS: 'teams',
};

export const TIER_DETAILS = {
  [TIERS.FREE]: {
    name: 'Free',
    price: 0,
    priceLabel: 'Free forever',
    description: 'Perfect for getting started',
    color: 'gray',
  },
  [TIERS.PRO]: {
    name: 'Pro',
    price: 15,
    priceLabel: '$15/month',
    description: 'For professionals who need more',
    color: 'blue',
    popular: true,
  },
  [TIERS.TEAMS]: {
    name: 'Teams',
    price: 29,
    priceLabel: '$29/month',
    description: 'For teams that collaborate',
    color: 'purple',
  },
};

/**
 * Feature definitions with tier access and limits
 */
export const FEATURES = {
  // ============ BOOKING BASICS ============
  event_types: {
    key: 'event_types',
    label: 'Event Types',
    description: 'Create different meeting types for various purposes',
    category: 'Booking',
    tiers: {
      [TIERS.FREE]: 1,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },
  
  bookings_per_month: {
    key: 'bookings_per_month',
    label: 'Monthly Bookings',
    description: 'Number of bookings you can receive each month',
    category: 'Booking',
    tiers: {
      [TIERS.FREE]: 10,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  booking_page: {
    key: 'booking_page',
    label: 'Personal Booking Page',
    description: 'Your own booking page URL',
    category: 'Booking',
    tiers: {
      [TIERS.FREE]: true,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  // ============ CALENDAR ============
  google_calendar: {
    key: 'google_calendar',
    label: 'Google Calendar Sync',
    description: 'Two-way sync with Google Calendar',
    category: 'Calendar',
    tiers: {
      [TIERS.FREE]: true,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  microsoft_calendar: {
    key: 'microsoft_calendar',
    label: 'Microsoft Outlook Sync',
    description: 'Two-way sync with Microsoft Outlook',
    category: 'Calendar',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  // ============ SCHEDULING FEATURES ============
  buffer_times: {
    key: 'buffer_times',
    label: 'Buffer Times',
    description: 'Add padding before and after meetings',
    category: 'Scheduling',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  minimum_lead_time: {
    key: 'minimum_lead_time',
    label: 'Minimum Lead Time',
    description: 'Require advance notice for bookings',
    category: 'Scheduling',
    tiers: {
      [TIERS.FREE]: 60,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  daily_caps: {
    key: 'daily_caps',
    label: 'Daily Booking Limits',
    description: 'Limit how many meetings per day',
    category: 'Scheduling',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  booking_horizon: {
    key: 'booking_horizon',
    label: 'Booking Horizon',
    description: 'How far in advance people can book',
    category: 'Scheduling',
    tiers: {
      [TIERS.FREE]: 7,
      [TIERS.PRO]: 60,
      [TIERS.TEAMS]: 365,
    },
  },

  // ============ LINKS & SHARING ============
  permanent_links: {
    key: 'permanent_links',
    label: 'Permanent Booking Links',
    description: 'Shareable links that never expire',
    category: 'Links',
    tiers: {
      [TIERS.FREE]: true,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  magic_links: {
    key: 'magic_links',
    label: 'Quick Links',
    description: 'Create one-time booking links for specific guests',
    category: 'Links',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  custom_branding: {
    key: 'custom_branding',
    label: 'Custom Branding',
    description: 'Add your logo and brand colors',
    category: 'Links',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  // ============ NOTIFICATIONS ============
  email_confirmations: {
    key: 'email_confirmations',
    label: 'Email Confirmations',
    description: 'Automatic booking confirmation emails',
    category: 'Notifications',
    tiers: {
      [TIERS.FREE]: true,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  email_reminders: {
    key: 'email_reminders',
    label: 'Email Reminders',
    description: 'Automated reminder emails before meetings',
    category: 'Notifications',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  custom_email_templates: {
    key: 'custom_email_templates',
    label: 'Custom Email Templates',
    description: 'Personalize your booking emails',
    category: 'Notifications',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  // ============ INTEGRATIONS ============
  chatgpt_integration: {
    key: 'chatgpt_integration',
    label: 'ChatGPT Integration',
    description: 'AI-powered scheduling assistant',
    category: 'Integrations',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  stripe_payments: {
    key: 'stripe_payments',
    label: 'Payment Collection',
    description: 'Charge for meetings via Stripe',
    category: 'Integrations',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  calendly_import: {
    key: 'calendly_import',
    label: 'Calendly Import',
    description: 'Import your data from Calendly',
    category: 'Integrations',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: true,
      [TIERS.TEAMS]: true,
    },
  },

  // ============ TEAM FEATURES ============
  team_members: {
    key: 'team_members',
    label: 'Team Members',
    description: 'Collaborate with your team',
    category: 'Team',
    tiers: {
      [TIERS.FREE]: 1,
      [TIERS.PRO]: 1,
      [TIERS.TEAMS]: 10,
    },
  },

  round_robin: {
    key: 'round_robin',
    label: 'Round-Robin Scheduling',
    description: 'Distribute meetings across team members',
    category: 'Team',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: false,
      [TIERS.TEAMS]: true,
    },
  },

  team_availability: {
    key: 'team_availability',
    label: 'Team Availability View',
    description: 'See when your whole team is free',
    category: 'Team',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: false,
      [TIERS.TEAMS]: true,
    },
  },

  role_permissions: {
    key: 'role_permissions',
    label: 'Role-Based Permissions',
    description: 'Control what team members can do',
    category: 'Team',
    tiers: {
      [TIERS.FREE]: false,
      [TIERS.PRO]: false,
      [TIERS.TEAMS]: true,
    },
  },
};

/**
 * Get all features for a specific tier
 */
export function getFeaturesForTier(tier) {
  return Object.values(FEATURES).reduce((acc, feature) => {
    acc[feature.key] = feature.tiers[tier];
    return acc;
  }, {});
}

/**
 * Get features grouped by category
 */
export function getFeaturesByCategory() {
  return Object.values(FEATURES).reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {});
}

/**
 * Check if a tier has access to a feature
 */
export function checkFeatureAccess(tier, featureKey) {
  const feature = FEATURES[featureKey];
  if (!feature) {
    console.warn(`Unknown feature: ${featureKey}`);
    return false;
  }
  return feature.tiers[tier] ?? false;
}

/**
 * Get the minimum tier required for a feature
 */
export function getMinimumTierForFeature(featureKey) {
  const feature = FEATURES[featureKey];
  if (!feature) return null;

  const tierOrder = [TIERS.FREE, TIERS.PRO, TIERS.TEAMS];
  
  for (const tier of tierOrder) {
    const access = feature.tiers[tier];
    if (access === true || (typeof access === 'number' && access > 0)) {
      return tier;
    }
  }
  
  return null;
}

/**
 * Compare features between tiers (for upgrade prompts)
 */
export function compareFeatures(currentTier, targetTier) {
  const improvements = [];
  
  Object.values(FEATURES).forEach(feature => {
    const current = feature.tiers[currentTier];
    const target = feature.tiers[targetTier];
    
    if (current === false && target !== false) {
      improvements.push({
        ...feature,
        type: 'unlock',
        newValue: target,
      });
    }
    else if (typeof current === 'number' && (target === true || target > current)) {
      improvements.push({
        ...feature,
        type: 'upgrade',
        oldValue: current,
        newValue: target,
      });
    }
  });
  
  return improvements;
}

export default FEATURES;