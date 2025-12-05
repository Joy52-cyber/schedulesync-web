// client/src/hooks/useFeatureGates.js
import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export const useFeatureGates = () => {
  const [features, setFeatures] = useState({
    ai_queries: { enabled: true, used: 0, limit: 10 },
    bookings: { enabled: true, used: 0, limit: 50 },
    team_features: { enabled: false }
  });
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState('free');

  const fetchFeatureAccess = async () => {
    try {
      setLoading(true);
      const response = await api.get('/user/feature-access');
      setFeatures(response.data.features);
      setTier(response.data.tier);
    } catch (error) {
      console.error('Failed to fetch feature access:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatureAccess();
  }, []);

  const checkFeature = (featureName) => {
    return features[featureName]?.enabled || false;
  };

  const getUsage = (featureName) => {
    const feature = features[featureName];
    return {
      used: feature?.used || 0,
      limit: feature?.limit || 'unlimited',
      percentage: feature?.limit !== 'unlimited' ? 
        Math.min(100, (feature?.used / feature?.limit) * 100) : 0
    };
  };

  return {
    features,
    tier,
    loading,
    checkFeature,
    getUsage,
    refreshFeatures: fetchFeatureAccess
  };
};

// Hook for specific feature checking
export const useFeatureCheck = (featureName) => {
  const [canUse, setCanUse] = useState(true);
  const [usage, setUsage] = useState({ used: 0, limit: 'unlimited' });
  const [tier, setTier] = useState('free');

  useEffect(() => {
    const checkFeature = async () => {
      try {
        const response = await api.get(`/user/feature-status/${featureName}`);
        setCanUse(response.data.enabled);
        setUsage({ used: response.data.used, limit: response.data.limit });
        setTier(response.data.tier);
      } catch (error) {
        console.error(`Failed to check ${featureName}:`, error);
      }
    };

    checkFeature();
  }, [featureName]);

  return { canUse, usage, tier };
};