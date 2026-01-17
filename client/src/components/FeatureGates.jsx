// client/src/components/FeatureGates.jsx
import React from 'react';
import { AlertTriangle, Zap, Users, Crown, ArrowRight } from 'lucide-react';
import { useFeatureGates } from '../hooks/useFeatureGates';

// ============================================
// UPGRADE PROMPT COMPONENT
// ============================================
export const UpgradePrompt = ({ feature, onUpgrade, onClose }) => {
  const prompts = {
    ai_queries: {
      title: 'AI Query Limit Reached',
      description: 'Unlock unlimited AI scheduling assistance with Pro.',
      icon: <Zap className="h-7 w-7 text-white" />,
      iconBg: 'from-purple-500 to-indigo-500',
      bgGradient: 'from-purple-50 to-indigo-50',
      borderColor: 'border-purple-300',
      buttonGradient: 'from-purple-600 to-indigo-600'
    },
    bookings: {
      title: 'Booking Limit Reached',
      description: 'Get unlimited bookings with Pro subscription.',
      icon: <AlertTriangle className="h-7 w-7 text-white" />,
      iconBg: 'from-orange-500 to-amber-500',
      bgGradient: 'from-orange-50 to-amber-50',
      borderColor: 'border-orange-300',
      buttonGradient: 'from-orange-600 to-amber-600'
    },
    team_features: {
      title: 'Team Features Available',
      description: 'Unlock advanced team management with Team plan.',
      icon: <Users className="h-7 w-7 text-white" />,
      iconBg: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      borderColor: 'border-blue-300',
      buttonGradient: 'from-blue-600 to-cyan-600'
    }
  };

  const prompt = prompts[feature] || prompts.ai_queries;

  return (
    <div className={`rounded-2xl border-2 ${prompt.borderColor} bg-gradient-to-br ${prompt.bgGradient} p-6 sm:p-7 shadow-xl backdrop-blur-sm hover:shadow-2xl transition-all`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br ${prompt.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
          {prompt.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-gray-900 text-base sm:text-lg">
              {prompt.title}
            </h3>
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-sm text-gray-700 mb-5 leading-relaxed">
            {prompt.description}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onUpgrade}
              className={`group flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r ${prompt.buttonGradient} text-white rounded-xl hover:shadow-lg hover:scale-105 font-bold text-sm transition-all`}
            >
              <Crown className="h-4 w-4" />
              Upgrade Now
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-white/80 hover:border-gray-400 font-semibold text-sm transition-all"
              >
                Maybe Later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// USAGE INDICATOR COMPONENT
// ============================================
export const UsageIndicator = ({ feature, showUpgradePrompt = true }) => {
  const { getUsage, tier } = useFeatureGates();
  const usage = getUsage(feature);

  if (usage.limit === 'unlimited') return null;

  const isNearLimit = usage.percentage > 80;
  const isAtLimit = usage.percentage >= 100;

  const getColorClasses = () => {
    if (isAtLimit) return {
      gradient: 'from-red-500 to-rose-500',
      bg: 'bg-red-100',
      text: 'text-red-700',
      glow: 'shadow-red-200'
    };
    if (isNearLimit) return {
      gradient: 'from-orange-500 to-amber-500',
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      glow: 'shadow-orange-200'
    };
    return {
      gradient: 'from-blue-500 to-cyan-500',
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      glow: 'shadow-blue-200'
    };
  };

  const colors = getColorClasses();

  return (
    <div className={`bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 ${isAtLimit ? 'border-red-200' : isNearLimit ? 'border-orange-200' : 'border-gray-200'} p-4 sm:p-5 shadow-lg ${colors.glow} transition-all hover:shadow-xl`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-900">
          {feature === 'ai_queries' ? 'AI Queries' : 'Bookings'} This Month
        </span>
        <span className={`text-sm font-bold ${colors.text} px-3 py-1 ${colors.bg} rounded-full`}>
          {usage.used}/{usage.limit}
        </span>
      </div>

      {/* Premium Progress Bar with Gradient */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden shadow-inner">
        <div
          className={`bg-gradient-to-r ${colors.gradient} h-3 rounded-full transition-all duration-500 shadow-lg relative`}
          style={{ width: `${Math.min(100, usage.percentage)}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
        </div>
      </div>

      {/* Warning Message with Icons */}
      {isNearLimit && showUpgradePrompt && (
        <div className={`flex items-start gap-2 text-xs ${colors.text} font-semibold ${colors.bg} p-3 rounded-lg`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            {isAtLimit ?
              `Limit reached! Upgrade to Pro for unlimited ${feature === 'ai_queries' ? 'AI queries' : 'bookings'}.` :
              `You're close to your limit. Consider upgrading soon.`
            }
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================
// FEATURE BLOCK COMPONENT
// ============================================
export const FeatureBlock = ({ 
  feature, 
  children, 
  fallback, 
  showUpgradePrompt = true,
  onUpgrade 
}) => {
  const { checkFeature } = useFeatureGates();
  const canUse = checkFeature(feature);
  
  if (canUse) {
    return children;
  }
  
  return (
    <div className="relative">
      {/* Blurred/disabled content */}
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center p-4">
        {fallback || (
          showUpgradePrompt ? (
            <UpgradePrompt 
              feature={feature} 
              onUpgrade={onUpgrade || (() => window.location.href = '/billing')}
            />
          ) : (
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 font-medium">
                {feature === 'team_features' ? 
                  'Team subscription required' : 
                  'Upgrade required to use this feature'
                }
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

// ============================================
// AI QUERY GUARD COMPONENT
// ============================================
export const AIQueryGuard = ({ children, onUpgrade }) => {
  return (
    <FeatureBlock 
      feature="ai_queries" 
      onUpgrade={onUpgrade}
    >
      {children}
    </FeatureBlock>
  );
};

// ============================================
// TEAM FEATURE GUARD COMPONENT  
// ============================================
export const TeamFeatureGuard = ({ children, onUpgrade }) => {
  return (
    <FeatureBlock 
      feature="team_features"
      onUpgrade={onUpgrade}
    >
      {children}
    </FeatureBlock>
  );
};

// ============================================
// DASHBOARD USAGE OVERVIEW
// ============================================
export const DashboardUsage = ({ onUpgrade }) => {
  const { features, tier, loading } = useFeatureGates();
  
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }
  
  if (tier === 'pro' || tier === 'team') {
    return (
      <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl border-2 border-green-300 p-6 sm:p-7 shadow-xl hover:shadow-2xl transition-all">
        <div className="flex items-start gap-4 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-green-900 text-lg mb-1">
              {tier === 'team' ? 'Team Plan' : 'Pro Plan'}
            </h3>
            <p className="text-sm text-green-700 font-medium">
              You have unlimited access to all features!
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t-2 border-green-200/50">
          <div className="flex items-center gap-2 text-xs text-green-600 font-semibold">
            <Zap className="w-4 h-4" />
            <span>Unlimited AI Queries • Unlimited Bookings • Priority Support</span>
          </div>
        </div>
      </div>
    );
  }

  const needsUpgrade =
    (features.ai_queries?.used >= features.ai_queries?.limit * 0.8) ||
    (features.bookings?.used >= features.bookings?.limit * 0.8);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 border-gray-200 p-6 sm:p-7 shadow-xl hover:shadow-2xl transition-all">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-sm">FREE</span>
          </div>
          <h3 className="font-bold text-gray-900 text-lg">
            Free Plan Usage
          </h3>
        </div>

        <div className="space-y-4">
          <UsageIndicator feature="ai_queries" />
          <UsageIndicator feature="bookings" />
        </div>

        {needsUpgrade && (
          <div className="mt-6 pt-5 border-t-2 border-gray-200">
            <button
              onClick={onUpgrade || (() => window.location.href = '/billing')}
              className="group w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-3.5 rounded-xl hover:shadow-2xl hover:shadow-purple-500/50 hover:scale-105 font-bold transition-all flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5" />
              Upgrade to Pro - Unlimited Everything!
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default {
  UpgradePrompt,
  UsageIndicator, 
  FeatureBlock,
  AIQueryGuard,
  TeamFeatureGuard,
  DashboardUsage
};