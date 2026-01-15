import React, { useState, useEffect } from 'react';
import SubscriptionUpgradeModal from './SubscriptionUpgradeModal';

const UsageWidget = () => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
  try {
    const response = await fetch('/api/user/usage', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      // Map to expected format
      setUsage({
        subscription_tier: data.subscription_tier || 'free',
        grace_period: data.grace_period || false,
        chatgpt: { 
          used: data.ai_queries_used || 0, 
          limit: data.ai_queries_limit || 10 
        },
        bookings: { 
          used: data.bookings_used || 0, 
          limit: data.bookings_limit || 50 
        }
      });
    }
  } catch (error) {
    console.error('Failed to fetch usage:', error);
  } finally {
    setLoading(false);
  }
};

  const getUsagePercentage = (used, limit) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-2 bg-gray-200 rounded mb-2"></div>
        <div className="h-2 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!usage) return null;

  const { subscription_tier, grace_period, chatgpt, bookings } = usage;
  const chatgptPercentage = getUsagePercentage(chatgpt.used, chatgpt.limit);
  const bookingsPercentage = getUsagePercentage(bookings.used, bookings.limit);

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Usage This Month</h3>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              subscription_tier === 'free' ? 'bg-gray-100 text-gray-600' :
              subscription_tier === 'pro' ? 'bg-blue-100 text-blue-600' :
              'bg-purple-100 text-purple-600'
            }`}>
              {subscription_tier?.charAt(0).toUpperCase() + subscription_tier?.slice(1)} Plan
            </span>
            {grace_period && (
              <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded-full">
                Grace Period
              </span>
            )}
          </div>
        </div>

       {/* AI Features */}
<div>
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium text-gray-700">🤖 AI Features</span>
    <span className="text-sm font-semibold text-gray-900">
      {chatgpt.limit === -1 ? 'Unlimited' : 'Included'}
    </span>
  </div>

  {chatgptPercentage >= 100 && chatgpt.limit !== -1 && (
    <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-sm">
      <span className="text-purple-700 font-medium">Upgrade for unlimited AI</span>
      <button
        onClick={() => setShowUpgradeModal(true)}
        className="ml-2 text-purple-600 hover:text-purple-700 underline"
      >
        Get Pro
      </button>
    </div>
  )}
</div>

        {/* Bookings */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">📅 Bookings</span>
            <span className="text-sm font-semibold text-gray-900">
              {bookings.limit === -1 ? 'Unlimited' : 'Included'}
            </span>
          </div>

          {bookingsPercentage >= 100 && bookings.limit !== -1 && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
              <span className="text-blue-700 font-medium">Upgrade for unlimited bookings</span>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="ml-2 text-blue-600 hover:text-blue-700 underline"
              >
                Get Pro
              </button>
            </div>
          )}
        </div>

        {/* Upgrade CTA for Free Users */}
        {subscription_tier === 'free' && !grace_period && (
          <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">🚀 Ready for unlimited ChatGPT?</p>
                <p className="text-xs text-gray-600">Upgrade to Pro for just $15/month</p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Upgrade
              </button>
            </div>
          </div>
        )}

        {/* Team Upgrade CTA for Pro Users */}
        {subscription_tier === 'pro' && (
          <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">🏢 Need team features?</p>
                <p className="text-xs text-gray-600">Unlimited bookings + team management</p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                Upgrade to Team
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      <SubscriptionUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={subscription_tier}
      />
    </>
  );
};

export default UsageWidget;