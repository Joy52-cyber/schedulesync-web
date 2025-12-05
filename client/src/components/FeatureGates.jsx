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
      icon: <Zap className="h-6 w-6 text-purple-600" />,
      color: 'purple'
    },
    bookings: {
      title: 'Booking Limit Reached', 
      description: 'Get unlimited bookings with Pro subscription.',
      icon: <AlertTriangle className="h-6 w-6 text-orange-600" />,
      color: 'orange'
    },
    team_features: {
      title: 'Team Features Available',
      description: 'Unlock advanced team management with Team plan.',
      icon: <Users className="h-6 w-6 text-blue-600" />,
      color: 'blue'
    }
  };

  const prompt = prompts[feature] || prompts.ai_queries;
  const colorClasses = {
    purple: 'border-purple-200 bg-purple-50',
    orange: 'border-orange-200 bg-orange-50', 
    blue: 'border-blue-200 bg-blue-50'
  };

  return (
    <div className={`rounded-2xl border-2 p-6 ${colorClasses[prompt.color]}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {prompt.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 mb-2">
            {prompt.title}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {prompt.description}
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onUpgrade}
              className={`flex items-center gap-2 px-4 py-2 bg-${prompt.color}-600 text-white rounded-xl hover:bg-${prompt.color}-700 font-medium text-sm transition-colors`}
            >
              <Crown className="h-4 w-4" />
              Upgrade Now
              <ArrowRight className="h-4 w-4" />
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm transition-colors"
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
  
  const getColor = () => {
    if (isAtLimit) return 'red';
    if (isNearLimit) return 'orange';
    return 'blue';
  };
  
  const color = getColor();
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          {feature === 'ai_queries' ? 'AI Queries' : 'Bookings'} This Month
        </span>
        <span className={`text-sm font-semibold text-${color}-600`}>
          {usage.used}/{usage.limit}
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div 
          className={`bg-${color}-500 h-2 rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(100, usage.percentage)}%` }}
        />
      </div>
      
      {/* Warning Message */}
      {isNearLimit && showUpgradePrompt && (
        <div className={`text-xs ${isAtLimit ? 'text-red-600' : 'text-orange-600'} font-medium`}>
          {isAtLimit ? 
            `Limit reached! Upgrade to Pro for unlimited ${feature === 'ai_queries' ? 'AI queries' : 'bookings'}.` :
            `You're close to your limit. Consider upgrading soon.`
          }
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
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
        <div className="flex items-center gap-3 mb-3">
          <Crown className="h-6 w-6 text-green-600" />
          <h3 className="font-semibold text-green-900">
            {tier === 'team' ? '👑 Team Plan' : '⚡ Pro Plan'}
          </h3>
        </div>
        <p className="text-sm text-green-700">
          You have unlimited access to all features!
        </p>
      </div>
    );
  }
  
  const needsUpgrade = 
    (features.ai_queries?.used >= features.ai_queries?.limit * 0.8) ||
    (features.bookings?.used >= features.bookings?.limit * 0.8);
  
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          🆓 Free Plan Usage
        </h3>
        
        <div className="space-y-4">
          <UsageIndicator feature="ai_queries" />
          <UsageIndicator feature="bookings" />
        </div>
        
        {needsUpgrade && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={onUpgrade || (() => window.location.href = '/billing')}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 font-medium transition-colors"
            >
              Upgrade to Pro - Unlimited Everything!
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