import { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { TIERS, FEATURES, checkFeatureAccess, getMinimumTierForFeature, compareFeatures, TIER_DETAILS } from '../config/features';
import api from '../utils/api';

/**
 * Subscription Context
 */
const SubscriptionContext = createContext(null);

/**
 * Subscription Provider Component
 */
export function SubscriptionProvider({ children }) {
  const [subscription, setSubscription] = useState({
    tier: TIERS.FREE,
    loading: true,
    error: null,
    usage: {
      bookings_this_month: 0,
      event_types_count: 0,
      team_members_count: 1,
    },
    billing: {
      status: null,
      current_period_end: null,
      cancel_at_period_end: false,
    },
  });

  useEffect(() => {
    // Only fetch if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      fetchSubscription();
    } else {
      // Not logged in - just set loading to false
      setSubscription(prev => ({
        ...prev,
        loading: false,
      }));
    }
  }, []);

  const fetchSubscription = async () => {
    // Double-check token exists
    const token = localStorage.getItem('token');
    if (!token) {
      setSubscription(prev => ({
        ...prev,
        loading: false,
      }));
      return;
    }

    try {
      const response = await api.get('/user/subscription');
      const data = response.data;

      setSubscription({
        tier: data.tier || TIERS.FREE,
        loading: false,
        error: null,
        usage: {
          bookings_this_month: data.usage?.bookings_this_month || 0,
          event_types_count: data.usage?.event_types_count || 0,
          team_members_count: data.usage?.team_members_count || 1,
        },
        billing: {
          status: data.billing?.status || null,
          current_period_end: data.billing?.current_period_end || null,
          cancel_at_period_end: data.billing?.cancel_at_period_end || false,
        },
      });
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      // Don't trigger logout on error - just use defaults
      setSubscription(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load subscription',
        tier: TIERS.FREE,
      }));
    }
  };

  const refreshSubscription = useCallback(() => {
    return fetchSubscription();
  }, []);

  const value = {
    ...subscription,
    refresh: refreshSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Main hook for subscription and feature access
 */
export function useSubscription() {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }

  const { tier, loading, error, usage, billing, refresh } = context;

  const canUse = useCallback((featureKey) => {
    const access = checkFeatureAccess(tier, featureKey);

    if (typeof access === 'boolean') {
      return access;
    }

    if (typeof access === 'number') {
      switch (featureKey) {
        case 'bookings_per_month':
          return usage.bookings_this_month < access;
        case 'event_types':
          return usage.event_types_count < access;
        case 'team_members':
          return usage.team_members_count < access;
        default:
          return access > 0;
      }
    }

    return false;
  }, [tier, usage]);

  const getLimit = useCallback((featureKey) => {
    const access = checkFeatureAccess(tier, featureKey);

    if (access === true) return 'unlimited';
    if (access === false) return 0;
    if (typeof access === 'number') return access;

    return null;
  }, [tier]);

  const getUsage = useCallback((featureKey) => {
    switch (featureKey) {
      case 'bookings_per_month':
        return usage.bookings_this_month;
      case 'event_types':
        return usage.event_types_count;
      case 'team_members':
        return usage.team_members_count;
      default:
        return 0;
    }
  }, [usage]);

  const getUsageDisplay = useCallback((featureKey) => {
    const currentUsage = getUsage(featureKey);
    const limit = getLimit(featureKey);

    if (limit === 'unlimited') {
      return `${currentUsage} used`;
    }

    if (limit === 0) {
      return 'Not available';
    }

    return `${currentUsage} of ${limit}`;
  }, [getUsage, getLimit]);

  const isAtLimit = useCallback((featureKey) => {
    const limit = getLimit(featureKey);
    if (limit === 'unlimited') return false;
    if (limit === 0) return true;

    const currentUsage = getUsage(featureKey);
    return currentUsage >= limit;
  }, [getLimit, getUsage]);

  const getRequiredTier = useCallback((featureKey) => {
    return getMinimumTierForFeature(featureKey);
  }, []);

  const getUpgradeComparison = useCallback((targetTier) => {
    return compareFeatures(tier, targetTier);
  }, [tier]);

  const isTier = useCallback((checkTier) => {
    return tier === checkTier;
  }, [tier]);

  const isPaid = tier !== TIERS.FREE;
  const tierInfo = TIER_DETAILS[tier];

  return {
    tier,
    tierInfo,
    loading,
    error,
    usage,
    billing,
    isPaid,
    canUse,
    getLimit,
    getUsage,
    getUsageDisplay,
    isAtLimit,
    getRequiredTier,
    getUpgradeComparison,
    isTier,
    refresh,
    TIERS,
    FEATURES,
  };
}

export default useSubscription;