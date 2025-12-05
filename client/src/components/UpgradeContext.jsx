import React, { createContext, useContext, useState, useEffect } from 'react';
import UpgradeModal from '../components/UpgradeModal';

const UpgradeContext = createContext();

export const useUpgrade = () => {
  const context = useContext(UpgradeContext);
  if (!context) {
    throw new Error('useUpgrade must be used within UpgradeProvider');
  }
  return context;
};

export const UpgradeProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState(null);
  const [currentTier, setCurrentTier] = useState('free');
  const [usage, setUsage] = useState({});

  // Fetch usage on mount
  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/user/usage', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUsage({
          ai_queries_used: data.ai_queries_used || 0,
          ai_queries_limit: data.ai_queries_limit || 10,
          bookings_used: data.bookings_used || 0,
          bookings_limit: data.bookings_limit || 50,
          event_types_used: data.event_types_used || 0,
          event_types_limit: data.event_types_limit || 2,
          magic_links_used: data.magic_links_used || 0,
          magic_links_limit: data.magic_links_limit || 3
        });
        setCurrentTier(data.subscription_tier || 'free');
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  };

  // Open modal for a specific feature
  const showUpgradeModal = (featureName = null) => {
    setFeature(featureName);
    setIsOpen(true);
  };

  // Close modal
  const closeUpgradeModal = () => {
    setIsOpen(false);
    setFeature(null);
  };

  // Check if a feature is at limit
  const isAtLimit = (featureName) => {
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
      default:
        return false;
    }
  };

  // Check if user has access to a Pro feature
  const hasProFeature = (featureName) => {
    return currentTier === 'pro' || currentTier === 'team';
  };

  // Check if user has access to Team features
  const hasTeamFeature = () => {
    return currentTier === 'team';
  };

  return (
    <UpgradeContext.Provider
      value={{
        showUpgradeModal,
        closeUpgradeModal,
        isAtLimit,
        hasProFeature,
        hasTeamFeature,
        currentTier,
        usage,
        refreshUsage: fetchUsage
      }}
    >
      {children}
      <UpgradeModal
        isOpen={isOpen}
        onClose={closeUpgradeModal}
        feature={feature}
        currentTier={currentTier}
        usage={usage}
      />
    </UpgradeContext.Provider>
  );
};

export default UpgradeProvider;