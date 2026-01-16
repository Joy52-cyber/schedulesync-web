import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UpgradeContext = createContext(null);

// Default values for when context is not available
const defaultUsage = {
  ai_queries_used: 0,
  ai_queries_limit: 10,
  bookings_used: 0,
  bookings_limit: 50,
  event_types_used: 0,
  event_types_limit: 2,
  magic_links_used: 0,
  magic_links_limit: 2
};

const defaultContextValue = {
  showUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  isAtLimit: () => false,
  requiresUpgrade: () => false,
  hasPlusFeature: () => false,
  hasProFeature: () => false,
  hasTeamFeature: () => false,
  hasEnterpriseFeature: () => false,
  handleUpgrade: () => {},
  getRecommendedTier: () => 'pro',
  currentTier: 'free',
  usage: defaultUsage,
  loading: false,
  refreshUsage: () => {},
  modalOpen: false,
  modalFeature: null
};

// Helper to get usage from localStorage
const getStoredUsage = () => {
  try {
    const stored = localStorage.getItem('usage_data');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to parse stored usage:', e);
  }
  return defaultUsage;
};

// Helper to save usage to localStorage
const saveUsage = (usage) => {
  try {
    localStorage.setItem('usage_data', JSON.stringify(usage));
  } catch (e) {
    console.warn('Failed to save usage:', e);
  }
};

export const useUpgrade = () => {
  const context = useContext(UpgradeContext);
  
  if (!context) {
    console.warn('useUpgrade called outside UpgradeProvider, using defaults');
    return defaultContextValue;
  }
  
  return context;
};

export const UpgradeProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState(null);
  
  // Initialize from localStorage to prevent flash
  const [currentTier, setCurrentTier] = useState(() => {
    return localStorage.getItem('subscription_tier') || 'free';
  });
  
  // Initialize usage from localStorage
  const [usage, setUsage] = useState(() => getStoredUsage());
  const [loading, setLoading] = useState(true);

  // Fetch usage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUsage();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUsage = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/user/usage', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Get tier from response
        const tier = data.subscription_tier || data.tier || 'free';
        
        // Save tier to localStorage
        localStorage.setItem('subscription_tier', tier);
        
        // Build usage object
        const newUsage = {
          ai_queries_used: data.ai_queries_used || 0,
          ai_queries_limit: data.ai_queries_limit || 10,
          bookings_used: data.bookings_used || data.monthly_bookings || 0,
          bookings_limit: data.bookings_limit || 50,
          event_types_used: data.event_types_used || 0,
          event_types_limit: data.event_types_limit || 2,
          magic_links_used: data.magic_links_used || 0,
          magic_links_limit: data.magic_links_limit || 2
        };
        
        // Save to localStorage for persistence
        saveUsage(newUsage);
        
        setUsage(newUsage);
        setCurrentTier(tier);
        
        console.log('✅ Usage loaded:', { tier, usage: newUsage });
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    } finally {
      setLoading(false);
    }
  };

  // Open modal for a specific feature
  const showUpgradeModal = useCallback((featureName = null) => {
    setFeature(featureName);
    setIsOpen(true);
  }, []);

  // Close modal
  const closeUpgradeModal = useCallback(() => {
    setIsOpen(false);
    setFeature(null);
  }, []);

  // Check if a feature requires upgrade based on tier
  const requiresUpgrade = useCallback((featureName) => {
    const plusFeatures = ['buffer_times', 'email_templates', 'templates'];
    const proFeatures = ['branding', 'smart_rules', 'email_assistant', 'email'];
    const teamFeatures = ['teams', 'autonomous', 'round_robin'];

    if (plusFeatures.includes(featureName)) {
      return !['plus', 'pro', 'team', 'enterprise'].includes(currentTier);
    }
    if (proFeatures.includes(featureName)) {
      return !['pro', 'team', 'enterprise'].includes(currentTier);
    }
    if (teamFeatures.includes(featureName)) {
      return !['team', 'enterprise'].includes(currentTier);
    }
    return false;
  }, [currentTier]);

  // Check if a feature is at limit (or locked for tier)
  const isAtLimit = useCallback((featureName) => {
    switch (featureName) {
      case 'ai_queries':
        return usage.ai_queries_limit < 1000 && usage.ai_queries_used >= usage.ai_queries_limit;
      case 'bookings':
        return usage.bookings_limit < 1000 && usage.bookings_used >= usage.bookings_limit;
      case 'event_types':
        return usage.event_types_limit < 1000 && usage.event_types_used >= usage.event_types_limit;
      case 'magic_links':
        return usage.magic_links_limit < 1000 && usage.magic_links_used >= usage.magic_links_limit;
      case 'teams':
      case 'autonomous':
      case 'round_robin':
        return !['team', 'enterprise'].includes(currentTier);
      case 'templates':
      case 'buffer_times':
      case 'email_templates':
        return !['plus', 'pro', 'team', 'enterprise'].includes(currentTier);
      case 'branding':
      case 'smart_rules':
      case 'email_assistant':
        return !['pro', 'team', 'enterprise'].includes(currentTier);
      default:
        return false;
    }
  }, [usage, currentTier]);

  // Check if user has access to Plus features (Plus, Pro, Team, or Enterprise)
  const hasPlusFeature = useCallback(() => {
    return ['plus', 'pro', 'team', 'enterprise'].includes(currentTier);
  }, [currentTier]);

  // Check if user has access to Pro features (Pro, Team, or Enterprise)
  const hasProFeature = useCallback(() => {
    return ['pro', 'team', 'enterprise'].includes(currentTier);
  }, [currentTier]);

  // Check if user has access to Team features (Team or Enterprise)
  const hasTeamFeature = useCallback(() => {
    return ['team', 'enterprise'].includes(currentTier);
  }, [currentTier]);

  // Check if user has access to Enterprise features
  const hasEnterpriseFeature = useCallback(() => {
    return currentTier === 'enterprise';
  }, [currentTier]);

  // Get recommended tier based on feature
  const getRecommendedTier = useCallback((feature) => {
    const featureTiers = {
      'buffer_times': 'plus',
      'email_templates': 'plus',
      'smart_rules': 'pro',
      'email_assistant': 'pro',
      'email': 'pro',
      'branding': 'pro',
      'teams': 'team',
      'autonomous': 'team',
      'round_robin': 'team',
      'ai_queries': currentTier === 'free' ? 'plus' : 'pro',
      'bookings': currentTier === 'free' ? 'plus' : 'pro',
      'event_types': currentTier === 'free' ? 'plus' : 'pro',
      'magic_links': currentTier === 'free' ? 'plus' : 'pro',
    };
    return featureTiers[feature] || 'pro';
  }, [currentTier]);

  // Handle upgrade to a specific tier
  const handleUpgrade = useCallback(async (tier) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login?redirect=/pricing';
        return;
      }

      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: tier })
      });

      const data = await response.json();

      if (data.url) {
        // Stripe checkout URL
        window.location.href = data.url;
      } else if (data.checkout_url) {
        // Success redirect
        window.location.href = data.checkout_url;
      } else if (data.success) {
        // Immediate upgrade (dev mode)
        fetchUsage();
        return { success: true };
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      throw error;
    }
  }, []);

  const value = {
    showUpgradeModal,
    closeUpgradeModal,
    isAtLimit,
    requiresUpgrade,
    hasPlusFeature,
    hasProFeature,
    hasTeamFeature,
    hasEnterpriseFeature,
    handleUpgrade,
    getRecommendedTier,
    currentTier,
    usage,
    loading,
    refreshUsage: fetchUsage,
    modalOpen: isOpen,
    modalFeature: feature
  };

  return (
    <UpgradeContext.Provider value={value}>
      {children}
    </UpgradeContext.Provider>
  );
};

export default UpgradeProvider;