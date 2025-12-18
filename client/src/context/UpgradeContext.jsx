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
  magic_links_limit: 3
};

const defaultContextValue = {
  showUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  isAtLimit: () => false,
  requiresUpgrade: () => false,
  hasProFeature: () => false,
  hasTeamFeature: () => false,
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
          magic_links_limit: data.magic_links_limit || 3
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
    switch (featureName) {
      case 'branding':
        return currentTier === 'free';
      case 'templates':
        return currentTier === 'free';
      case 'teams':
        return currentTier !== 'team';
      case 'magic_links':
        return currentTier === 'free';
      default:
        return false;
    }
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
        return currentTier !== 'team';
      case 'templates':
        return currentTier === 'free';
      case 'branding':
        return currentTier === 'free';
      default:
        return false;
    }
  }, [usage, currentTier]);

  // Check if user has access to Pro features (Pro or Team tier)
  const hasProFeature = useCallback(() => {
    return currentTier === 'pro' || currentTier === 'team';
  }, [currentTier]);

  // Check if user has access to Team features
  const hasTeamFeature = useCallback(() => {
    return currentTier === 'team';
  }, [currentTier]);

  const value = {
    showUpgradeModal,
    closeUpgradeModal,
    isAtLimit,
    requiresUpgrade,
    hasProFeature,
    hasTeamFeature,
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