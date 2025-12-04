import React, { useState } from 'react';
import { Lock, Sparkles, Crown, Zap } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { TIERS, TIER_DETAILS, FEATURES } from '../config/features';
import UpgradeModal from './UpgradeModal';

/**
 * UpgradeGate Component
 * 
 * Usage:
 *   <UpgradeGate feature="magic_links">
 *     <MagicLinksEditor />
 *   </UpgradeGate>
 */
export default function UpgradeGate({
  feature,
  children,
  mode = 'hard',
  fallback = null,
  showUsage = false,
  className = '',
}) {
  const { canUse, getRequiredTier, getUsageDisplay, isAtLimit, tier } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const featureConfig = FEATURES[feature];
  const hasAccess = canUse(feature);
  const requiredTier = getRequiredTier(feature);
  const atLimit = isAtLimit(feature);

  if (hasAccess && !atLimit) {
    if (mode === 'badge' && requiredTier !== TIERS.FREE) {
      return (
        <div className={`relative ${className}`}>
          {children}
        </div>
      );
    }
    return <>{children}</>;
  }

  const upgradeTier = requiredTier || TIERS.PRO;
  const tierDetails = TIER_DETAILS[upgradeTier];

  if (mode === 'hidden') {
    return null;
  }

  if (fallback) {
    return (
      <>
        {fallback}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          feature={feature}
          requiredTier={upgradeTier}
        />
      </>
    );
  }

  if (mode === 'badge') {
    return (
      <div className={`relative ${className}`}>
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="absolute top-0 right-0 flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold rounded-full shadow-sm hover:shadow-md transition-shadow"
        >
          <Crown className="h-3 w-3" />
          {tierDetails.name}
        </button>
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          feature={feature}
          requiredTier={upgradeTier}
        />
      </div>
    );
  }

  if (mode === 'soft') {
    return (
      <div className={`relative ${className}`}>
        <div className="opacity-40 blur-[2px] pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-lg">
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="flex flex-col items-center gap-2 p-6 text-center hover:scale-105 transition-transform"
          >
            <div className={`p-3 rounded-full bg-gradient-to-br ${
              upgradeTier === TIERS.TEAMS 
                ? 'from-purple-500 to-pink-500' 
                : 'from-blue-500 to-indigo-500'
            }`}>
              <Lock className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {featureConfig?.label || 'This feature'} requires {tierDetails.name}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Click to upgrade
              </p>
            </div>
          </button>
        </div>
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          feature={feature}
          requiredTier={upgradeTier}
        />
      </div>
    );
  }

  // Hard mode (default)
  return (
    <div className={className}>
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gradient-to-br from-gray-50 to-white">
        <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${
          upgradeTier === TIERS.TEAMS 
            ? 'from-purple-100 to-pink-100' 
            : 'from-blue-100 to-indigo-100'
        } mb-4`}>
          {upgradeTier === TIERS.TEAMS ? (
            <Sparkles className={`h-8 w-8 text-purple-600`} />
          ) : (
            <Zap className="h-8 w-8 text-blue-600" />
          )}
        </div>
        
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {atLimit ? 'Limit Reached' : `Unlock ${featureConfig?.label || 'this feature'}`}
        </h3>
        
        <p className="text-gray-600 mb-2 max-w-md mx-auto">
          {atLimit 
            ? `You've reached your ${tier} plan limit.`
            : featureConfig?.description || `This feature is available on ${tierDetails.name} and above.`
          }
        </p>

        {showUsage && (
          <p className="text-sm text-gray-500 mb-4">
            Current usage: {getUsageDisplay(feature)}
          </p>
        )}

        <button
          onClick={() => setShowUpgradeModal(true)}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white shadow-lg hover:shadow-xl transition-all ${
            upgradeTier === TIERS.TEAMS
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
          }`}
        >
          <Crown className="h-4 w-4" />
          Upgrade to {tierDetails.name}
        </button>
        
        <p className="text-xs text-gray-400 mt-3">
          Starting at {tierDetails.priceLabel}
        </p>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={feature}
        requiredTier={upgradeTier}
      />
    </div>
  );
}

export function ProBadge({ tier = TIERS.PRO, size = 'sm', className = '' }) {
  const tierDetails = TIER_DETAILS[tier];
  
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span className={`
      inline-flex items-center gap-1 font-bold rounded-full
      ${tier === TIERS.TEAMS 
        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
        : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
      }
      ${sizeClasses[size]}
      ${className}
    `}>
      <Crown className={size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {tierDetails.name}
    </span>
  );
}

export function UsageIndicator({ feature, showLabel = true, className = '' }) {
  const { getUsage, getLimit, isAtLimit } = useSubscription();
  
  const usage = getUsage(feature);
  const limit = getLimit(feature);
  const atLimit = isAtLimit(feature);
  
  if (limit === 'unlimited') {
    return null;
  }

  const percentage = limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;
  
  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{FEATURES[feature]?.label || feature}</span>
          <span className={atLimit ? 'text-red-600 font-medium' : ''}>
            {usage} / {limit}
          </span>
        </div>
      )}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            atLimit 
              ? 'bg-red-500' 
              : percentage > 80 
                ? 'bg-yellow-500' 
                : 'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function FeatureCheck({ feature, children, fallback = null }) {
  const { canUse } = useSubscription();
  return canUse(feature) ? children : fallback;
}