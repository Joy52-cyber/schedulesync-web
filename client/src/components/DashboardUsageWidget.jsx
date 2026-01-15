import React from 'react';
import { useUpgrade } from '../context/UpgradeContext';
import { 
  Bot, 
  Calendar, 
  Sparkles, 
  Link, 
  Users, 
  Zap,
  TrendingUp,
  ArrowRight,
  Loader2
} from 'lucide-react';

const DashboardUsageWidget = () => {
  const upgradeContext = useUpgrade();
  
  // Safely destructure with defaults
  const { 
    usage = {
      ai_queries_used: 0,
      ai_queries_limit: 10,
      bookings_used: 0,
      bookings_limit: 50,
      event_types_used: 0,
      event_types_limit: 2,
      magic_links_used: 0,
      magic_links_limit: 3
    }, 
    currentTier = 'free', 
    showUpgradeModal = () => {}, 
    isAtLimit = () => false,
    hasTeamFeature = () => false,
    loading = false
  } = upgradeContext || {};

  // Show loading state
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading usage...</span>
      </div>
    );
  }

  // Check if limit is unlimited
  const isUnlimited = (limit) => !limit || limit >= 1000;

  // Calculate percentage
  const getPercentage = (used, limit) => {
    if (isUnlimited(limit)) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const usageItems = [
    {
      key: 'ai_queries',
      label: 'AI Queries',
      icon: Bot,
      used: usage.ai_queries_used || 0,
      limit: usage.ai_queries_limit || 10,
      color: 'purple'
    },
    {
      key: 'bookings',
      label: 'Bookings',
      icon: Calendar,
      used: usage.bookings_used || 0,
      limit: usage.bookings_limit || 50,
      color: 'blue'
    },
    {
      key: 'event_types',
      label: 'Event Types',
      icon: Sparkles,
      used: usage.event_types_used || 0,
      limit: usage.event_types_limit || 2,
      color: 'pink'
    },
    {
      key: 'magic_links',
      label: 'Quick Links',
      icon: Link,
      used: usage.magic_links_used || 0,
      limit: usage.magic_links_limit || 2,
      color: 'indigo'
    }
  ];

  const colorClasses = {
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      icon: 'text-purple-600',
      bar: 'bg-purple-500',
      barBg: 'bg-purple-100'
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-600',
      bar: 'bg-blue-500',
      barBg: 'bg-blue-100'
    },
    pink: {
      bg: 'bg-pink-50',
      border: 'border-pink-200',
      icon: 'text-pink-600',
      bar: 'bg-pink-500',
      barBg: 'bg-pink-100'
    },
    indigo: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      icon: 'text-indigo-600',
      bar: 'bg-indigo-500',
      barBg: 'bg-indigo-100'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'text-green-600',
      bar: 'bg-green-500',
      barBg: 'bg-green-100'
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Usage This Month</h3>
              <p className="text-sm text-blue-100">
                <span className="capitalize">{currentTier}</span> Plan
              </p>
            </div>
          </div>
          
          {currentTier === 'free' && (
            <button
              onClick={() => showUpgradeModal()}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Usage Items */}
      <div className="p-6 space-y-4">
        {usageItems.map((item) => {
          const Icon = item.icon;
          const colors = colorClasses[item.color];
          const unlimited = isUnlimited(item.limit);
          const percentage = getPercentage(item.used, item.limit);
          const atLimit = !unlimited && item.used >= item.limit;

          return (
            <div 
              key={item.key}
              className={`rounded-xl p-4 border ${
                atLimit ? 'bg-red-50 border-red-200' : `${colors.bg} ${colors.border}`
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${atLimit ? 'text-red-600' : colors.icon}`} />
                  <span className={`font-medium ${atLimit ? 'text-red-900' : 'text-gray-900'}`}>
                    {item.label}
                  </span>
                </div>
                <span className={`font-bold ${
                  atLimit ? 'text-red-600' :
                  unlimited ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {unlimited ? 'Unlimited' : atLimit ? 'Upgrade for more' : 'Included'}
                </span>
              </div>

              {atLimit && (
                <button
                  onClick={() => showUpgradeModal(item.key)}
                  className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                >
                  Upgrade for unlimited <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Teams Access */}
        <div className={`rounded-xl p-4 border ${
          hasTeamFeature() 
            ? 'bg-green-50 border-green-200' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className={`h-5 w-5 ${
                hasTeamFeature() ? 'text-green-600' : 'text-gray-400'
              }`} />
              <span className="font-medium text-gray-900">Team Features</span>
            </div>
            {hasTeamFeature() ? (
              <span className="text-green-600 font-bold flex items-center gap-1">
                ✓ Enabled
              </span>
            ) : (
              <button
                onClick={() => showUpgradeModal('teams')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
              >
                Upgrade <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade CTA for Free Users */}
      {currentTier === 'free' && (
        <div className="px-6 pb-6">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-600" />
                  Upgrade to Pro
                </h4>
                <p className="text-sm text-gray-600">
                  Unlimited everything for just $15/month
                </p>
              </div>
              <button
                onClick={() => showUpgradeModal()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pro user - Team upsell */}
      {currentTier === 'pro' && (
        <div className="px-6 pb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  Need Team Features?
                </h4>
                <p className="text-sm text-gray-600">
                  Round-robin, collective booking & more
                </p>
              </div>
              <button
                onClick={() => showUpgradeModal('teams')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
              >
                Upgrade to Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardUsageWidget;