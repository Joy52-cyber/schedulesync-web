import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Crown, 
  Zap, 
  Sparkles, 
  ArrowRight,
  Loader2,
  CreditCard,
  Shield,
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { TIERS, TIER_DETAILS, FEATURES, compareFeatures } from '../config/features';

/**
 * UpgradeModal Component
 */
export default function UpgradeModal({ 
  isOpen, 
  onClose, 
  feature = null,
  requiredTier = null,
}) {
  const { tier: currentTier, getUpgradeComparison } = useSubscription();
  const [selectedTier, setSelectedTier] = useState(requiredTier || TIERS.PRO);
  const [loading, setLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');

  if (!isOpen) return null;

  const featureConfig = feature ? FEATURES[feature] : null;
  const improvements = getUpgradeComparison(selectedTier);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      window.location.href = `/billing?upgrade=${selectedTier}&cycle=${billingCycle}`;
    } catch (error) {
      console.error('Upgrade error:', error);
      setLoading(false);
    }
  };

  const getPrice = (tier) => {
    const basePrice = TIER_DETAILS[tier].price;
    if (billingCycle === 'yearly') {
      return Math.round(basePrice * 0.8);
    }
    return basePrice;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>

          <div className="text-center">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 mb-4">
              <Sparkles className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {featureConfig 
                ? `Unlock ${featureConfig.label}`
                : 'Upgrade Your Plan'
              }
            </h2>
            {featureConfig && (
              <p className="text-gray-600 mt-2 max-w-md mx-auto">
                {featureConfig.description}
              </p>
            )}
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center mt-6">
            <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  billingCycle === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free Tier */}
            <TierCard
              tier={TIERS.FREE}
              price={0}
              billingCycle={billingCycle}
              isCurrentTier={currentTier === TIERS.FREE}
              isSelected={selectedTier === TIERS.FREE}
              onSelect={() => setSelectedTier(TIERS.FREE)}
              disabled={currentTier !== TIERS.FREE}
              highlightFeature={feature}
            />

            {/* Pro Tier */}
            <TierCard
              tier={TIERS.PRO}
              price={getPrice(TIERS.PRO)}
              billingCycle={billingCycle}
              isCurrentTier={currentTier === TIERS.PRO}
              isSelected={selectedTier === TIERS.PRO}
              onSelect={() => setSelectedTier(TIERS.PRO)}
              disabled={currentTier === TIERS.TEAMS}
              popular={true}
              highlightFeature={feature}
            />

            {/* Teams Tier */}
            <TierCard
              tier={TIERS.TEAMS}
              price={getPrice(TIERS.TEAMS)}
              billingCycle={billingCycle}
              isCurrentTier={currentTier === TIERS.TEAMS}
              isSelected={selectedTier === TIERS.TEAMS}
              onSelect={() => setSelectedTier(TIERS.TEAMS)}
              disabled={false}
              highlightFeature={feature}
            />
          </div>

          {/* What You'll Get */}
          {selectedTier !== currentTier && improvements.length > 0 && (
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                What you'll unlock with {TIER_DETAILS[selectedTier].name}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {improvements.slice(0, 8).map((improvement) => (
                  <div 
                    key={improvement.key} 
                    className={`flex items-center gap-2 text-sm ${
                      improvement.key === feature 
                        ? 'text-blue-700 font-medium bg-blue-100 px-2 py-1 rounded-lg' 
                        : 'text-gray-700'
                    }`}
                  >
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{improvement.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Cancel anytime
              </span>
              <span className="flex items-center gap-1">
                <CreditCard className="h-4 w-4" />
                Secure payment
              </span>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Maybe Later
              </button>
              <button
                onClick={handleUpgrade}
                disabled={loading || selectedTier === currentTier}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                  selectedTier === TIERS.TEAMS
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Upgrade to {TIER_DETAILS[selectedTier].name}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Tier Card
 */
function TierCard({
  tier,
  price,
  billingCycle,
  isCurrentTier,
  isSelected,
  onSelect,
  disabled,
  popular,
  highlightFeature,
}) {
  const details = TIER_DETAILS[tier];
  const featuresList = getKeyFeaturesForTier(tier);

  return (
    <div
      onClick={() => !disabled && !isCurrentTier && onSelect()}
      className={`relative rounded-2xl border-2 p-5 transition-all cursor-pointer ${
        isSelected
          ? tier === TIERS.TEAMS
            ? 'border-purple-500 bg-purple-50/50 shadow-lg shadow-purple-100'
            : 'border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-100'
          : 'border-gray-200 hover:border-gray-300'
      } ${disabled || isCurrentTier ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {isCurrentTier && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 bg-gray-500 text-white text-xs font-bold rounded-full">
            Current Plan
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        {tier === TIERS.FREE && <Zap className="h-5 w-5 text-gray-500" />}
        {tier === TIERS.PRO && <Crown className="h-5 w-5 text-blue-600" />}
        {tier === TIERS.TEAMS && <Sparkles className="h-5 w-5 text-purple-600" />}
        <h3 className="font-bold text-lg text-gray-900">{details.name}</h3>
      </div>

      <div className="mb-4">
        <span className="text-3xl font-bold text-gray-900">
          {price === 0 ? 'Free' : `$${price}`}
        </span>
        {price > 0 && (
          <span className="text-gray-500 text-sm">
            /{billingCycle === 'yearly' ? 'mo' : 'month'}
          </span>
        )}
        {billingCycle === 'yearly' && price > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Billed ${price * 12}/year
          </p>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-4">{details.description}</p>

      <ul className="space-y-2">
        {featuresList.map((f, idx) => (
          <li 
            key={idx}
            className={`flex items-start gap-2 text-sm ${
              highlightFeature && f.key === highlightFeature
                ? 'text-blue-700 font-medium'
                : 'text-gray-700'
            }`}
          >
            <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
              highlightFeature && f.key === highlightFeature
                ? 'text-blue-600'
                : 'text-green-500'
            }`} />
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      {isSelected && !isCurrentTier && (
        <div className={`absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center ${
          tier === TIERS.TEAMS ? 'bg-purple-500' : 'bg-blue-500'
        }`}>
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </div>
  );
}

function getKeyFeaturesForTier(tier) {
  switch (tier) {
    case TIERS.FREE:
      return [
        { key: 'event_types', text: '1 event type' },
        { key: 'bookings_per_month', text: '10 bookings/month' },
        { key: 'booking_page', text: 'Personal booking page' },
        { key: 'google_calendar', text: 'Google Calendar sync' },
        { key: 'email_confirmations', text: 'Email confirmations' },
      ];
    case TIERS.PRO:
      return [
        { key: 'event_types', text: 'Unlimited event types' },
        { key: 'bookings_per_month', text: 'Unlimited bookings' },
        { key: 'microsoft_calendar', text: 'Microsoft Calendar sync' },
        { key: 'buffer_times', text: 'Buffer times & daily caps' },
        { key: 'magic_links', text: 'Single-use magic links' },
        { key: 'email_reminders', text: 'Email reminders' },
        { key: 'custom_email_templates', text: 'Custom email templates' },
        { key: 'chatgpt_integration', text: 'ChatGPT integration' },
        { key: 'stripe_payments', text: 'Payment collection' },
      ];
    case TIERS.TEAMS:
      return [
        { key: 'everything_pro', text: 'Everything in Pro' },
        { key: 'team_members', text: 'Up to 10 team members' },
        { key: 'round_robin', text: 'Round-robin scheduling' },
        { key: 'team_availability', text: 'Team availability view' },
        { key: 'role_permissions', text: 'Role-based permissions' },
        { key: 'booking_horizon', text: '1 year booking horizon' },
      ];
    default:
      return [];
  }
}

export function UpgradeButton({ className = '' }) {
  const [showModal, setShowModal] = useState(false);
  const { tier, isPaid } = useSubscription();

  if (tier === TIERS.TEAMS) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-medium hover:shadow-lg transition-all ${className}`}
      >
        <Crown className="h-4 w-4" />
        {isPaid ? 'Upgrade to Teams' : 'Upgrade'}
      </button>
      <UpgradeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}