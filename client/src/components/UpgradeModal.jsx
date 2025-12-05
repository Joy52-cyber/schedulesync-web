import React from 'react';
import { X, Check, Zap, Calendar, Bot, Link, Users, Sparkles } from 'lucide-react';

const UpgradeModal = ({ 
  isOpen, 
  onClose, 
  feature = null,  // Which feature triggered it: 'ai_queries', 'bookings', 'event_types', 'magic_links', 'teams'
  currentTier = 'free',
  usage = {}
}) => {
  if (!isOpen) return null;

  const featureMessages = {
    ai_queries: {
      icon: Bot,
      title: '🤖 AI Query Limit Reached',
      message: `You've used all ${usage.ai_queries_limit || 10} AI queries this month.`
    },
    bookings: {
      icon: Calendar,
      title: '📅 Booking Limit Reached',
      message: `You've used all ${usage.bookings_limit || 50} bookings this month.`
    },
    event_types: {
      icon: Sparkles,
      title: '📋 Event Type Limit Reached',
      message: `You can only create ${usage.event_types_limit || 2} event types on the free plan.`
    },
    magic_links: {
      icon: Link,
      title: '🔗 Magic Link Limit Reached',
      message: `You've used all ${usage.magic_links_limit || 3} magic links this month.`
    },
    teams: {
      icon: Users,
      title: '🏢 Teams Require Team Plan',
      message: 'Team features are only available on the Team plan.'
    },
    buffer_times: {
      icon: Zap,
      title: '⏱️ Buffer Times Require Pro',
      message: 'Buffer times between meetings is a Pro feature.'
    },
    booking_caps: {
      icon: Calendar,
      title: '📊 Booking Caps Require Pro',
      message: 'Daily/weekly booking caps are a Pro feature.'
    }
  };

  const currentFeature = feature ? featureMessages[feature] : null;
  const FeatureIcon = currentFeature?.icon || Zap;

  const plans = [
    {
      name: 'Pro',
      price: '$12',
      period: '/month',
      description: 'For busy professionals',
      highlighted: currentTier === 'free' && feature !== 'teams',
      features: [
        { text: 'Unlimited AI queries', included: true },
        { text: 'Unlimited bookings', included: true },
        { text: 'Unlimited event types', included: true },
        { text: 'Unlimited magic links', included: true },
        { text: 'Buffer times', included: true },
        { text: 'Booking caps', included: true },
        { text: 'Custom branding', included: true },
        { text: 'Team features', included: false }
      ],
      cta: 'Upgrade to Pro',
      tier: 'pro'
    },
    {
      name: 'Team',
      price: '$25',
      period: '/month',
      description: 'For teams & businesses',
      highlighted: feature === 'teams',
      features: [
        { text: 'Everything in Pro', included: true },
        { text: 'Team scheduling', included: true },
        { text: 'Up to 10 team members', included: true },
        { text: 'Round-robin booking', included: true },
        { text: 'Collective booking', included: true },
        { text: 'Team analytics', included: true },
        { text: 'Priority support', included: true },
        { text: 'API access', included: true }
      ],
      cta: 'Upgrade to Team',
      tier: 'team'
    }
  ];

  const handleUpgrade = async (tier) => {
    try {
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ plan_id: tier })
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh the page to reflect new limits
        window.location.reload();
      } else {
        alert('Failed to upgrade. Please try again.');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to upgrade. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-8 text-center text-white">
          {currentFeature ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                <FeatureIcon className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{currentFeature.title}</h2>
              <p className="text-purple-100">{currentFeature.message}</p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                <Zap className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Upgrade Your Plan</h2>
              <p className="text-purple-100">Unlock unlimited features and grow your scheduling business</p>
            </>
          )}
        </div>

        {/* Current Usage (if feature triggered) */}
        {feature && usage && (
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Your Current Usage</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <UsageBadge 
                label="AI Queries" 
                used={usage.ai_queries_used || 0} 
                limit={usage.ai_queries_limit || 10}
                isHit={feature === 'ai_queries'}
              />
              <UsageBadge 
                label="Bookings" 
                used={usage.bookings_used || 0} 
                limit={usage.bookings_limit || 50}
                isHit={feature === 'bookings'}
              />
              <UsageBadge 
                label="Event Types" 
                used={usage.event_types_used || 0} 
                limit={usage.event_types_limit || 2}
                isHit={feature === 'event_types'}
              />
              <UsageBadge 
                label="Magic Links" 
                used={usage.magic_links_used || 0} 
                limit={usage.magic_links_limit || 3}
                isHit={feature === 'magic_links'}
              />
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border-2 p-6 transition-all ${
                  plan.highlighted
                    ? 'border-purple-500 bg-purple-50 shadow-lg scale-[1.02]'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                {plan.highlighted && (
                  <div className="text-center mb-4">
                    <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      RECOMMENDED
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500 ml-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {feat.included ? (
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-300 flex-shrink-0" />
                      )}
                      <span className={feat.included ? 'text-gray-700' : 'text-gray-400'}>
                        {feat.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={currentTier === plan.tier}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                    currentTier === plan.tier
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : plan.highlighted
                        ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {currentTier === plan.tier ? 'Current Plan' : plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500 mt-6">
            💳 Secure payment powered by Stripe • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
};

// Usage badge component
const UsageBadge = ({ label, used, limit, isHit }) => {
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isUnlimited = limit >= 1000;
  
  return (
    <div className={`rounded-lg p-2 text-center ${
      isHit ? 'bg-red-100 border-2 border-red-300' : 'bg-white border border-gray-200'
    }`}>
      <div className={`text-xs font-medium ${isHit ? 'text-red-700' : 'text-gray-500'}`}>
        {label}
      </div>
      <div className={`text-sm font-bold ${
        isHit ? 'text-red-700' : percentage >= 80 ? 'text-orange-600' : 'text-gray-900'
      }`}>
        {isUnlimited ? '∞' : `${used}/${limit}`}
      </div>
    </div>
  );
};

export default UpgradeModal;