import React, { useState, useEffect } from 'react';
import PricingModal from './PricingModal';

const UsageIndicator = () => {
  const [usage, setUsage] = useState(null);
  const [showPricing, setShowPricing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch current usage from your backend
  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/usage', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!usage) return null;

  const { subscription_tier, grace_period, chatgpt, bookings } = usage;

  // Calculate usage percentages
  const chatGptUsed = chatgpt.used || 0;
  const chatGptLimit = chatgpt.limit === -1 ? null : chatgpt.limit;
  const chatGptPercentage = chatGptLimit ? (chatGptUsed / chatGptLimit) * 100 : 0;

  const bookingsUsed = bookings.used || 0;
  const bookingsLimit = bookings.limit === -1 ? null : bookings.limit;
  const bookingsPercentage = bookingsLimit ? (bookingsUsed / bookingsLimit) * 100 : 0;

  // Determine alert level
  const isNearLimit = chatGptLimit && chatGptUsed >= chatGptLimit * 0.8;
  const isAtLimit = chatGptLimit && chatGptUsed >= chatGptLimit;

  const getProgressBarColor = (percentage, isUnlimited = false) => {
    if (isUnlimited) return 'bg-green-500';
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getPlanBadgeColor = (tier) => {
    switch(tier) {
      case 'free': return 'bg-gray-100 text-gray-800';
      case 'pro': return 'bg-blue-100 text-blue-800';
      case 'team': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Usage & Limits</h3>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanBadgeColor(subscription_tier)}`}>
            {subscription_tier?.charAt(0).toUpperCase() + subscription_tier?.slice(1) || 'Free'}
            {grace_period && ' (Grace Period)'}
          </div>
        </div>

        {/* ChatGPT Usage */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">🤖 ChatGPT Queries</span>
            <span className="text-sm text-gray-600">
              {chatGptUsed}{chatGptLimit ? `/${chatGptLimit}` : ' (unlimited)'}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(chatGptPercentage, !chatGptLimit)}`}
              style={{ width: chatGptLimit ? `${Math.min(chatGptPercentage, 100)}%` : '100%' }}
            ></div>
          </div>

          {isAtLimit && (
            <div className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
              <span className="text-sm text-red-700">⚠️ ChatGPT limit reached</span>
              <button 
                onClick={() => setShowPricing(true)}
                className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
              >
                Upgrade Now
              </button>
            </div>
          )}

          {isNearLimit && !isAtLimit && (
            <div className="flex items-center justify-between p-2 bg-yellow-50 rounded border border-yellow-200">
              <span className="text-sm text-yellow-700">⚠️ Running low on ChatGPT queries</span>
              <button 
                onClick={() => setShowPricing(true)}
                className="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
              >
                Upgrade
              </button>
            </div>
          )}
        </div>

        {/* Bookings Usage */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">📅 Monthly Bookings</span>
            <span className="text-sm text-gray-600">
              {bookingsUsed}{bookingsLimit ? `/${bookingsLimit}` : ' (unlimited)'}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(bookingsPercentage, !bookingsLimit)}`}
              style={{ width: bookingsLimit ? `${Math.min(bookingsPercentage, 100)}%` : '100%' }}
            ></div>
          </div>
        </div>

        {/* Upgrade CTA for Free Users */}
        {subscription_tier === 'free' && !grace_period && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start">
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium mb-1">🚀 Unlock unlimited AI</p>
                <p className="text-xs text-blue-600 mb-2">
                  Get unlimited AI queries, unlimited bookings, and priority support.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPricing(true)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Upgrade to Pro - $15/month
            </button>
          </div>
        )}

        {/* Grace Period Notice */}
        {grace_period && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-800 font-medium">🎉 Welcome! Grace period active</p>
            <p className="text-xs text-green-600">
              You have Pro features free for 90 days. Upgrade anytime to continue unlimited access.
            </p>
          </div>
        )}

        {/* Billing Management */}
        {subscription_tier !== 'free' && !grace_period && (
          <div className="pt-3 border-t">
            <button
              onClick={() => setShowPricing(true)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Manage billing →
            </button>
          </div>
        )}
      </div>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentPlan={subscription_tier}
      />
    </>
  );
};

export default UsageIndicator;