import React, { useState } from 'react';
import {
  X,
  Zap,
  Bot,
  Calendar,
  Sparkles,
  Link,
  Users,
  Check,
  Crown,
  Mail
} from 'lucide-react';
import { useUpgrade } from '../context/UpgradeContext';
import SubscriptionUpgradeModal from './SubscriptionUpgradeModal';

const UpgradeModal = () => {
  const { modalOpen, modalFeature, closeUpgradeModal, currentTier, usage, refreshUsage, getRecommendedTier, handleUpgrade } = useUpgrade();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Don't render if modal is not open
  if (!modalOpen && !showPaymentModal) return null;

  const featureInfo = {
    branding: {
      title: 'Custom Branding',
      description: 'Make your booking pages match your brand',
      features: [
        'Custom logo on booking pages',
        'Custom brand colors',
        'Hide "Powered by ScheduleSync"',
        'Professional appearance',
      ],
      requiredTier: 'pro',
      icon: Sparkles,
      color: 'purple'
    },
    buffer_times: {
      title: 'Buffer Times',
      description: 'Add buffer time before and after meetings',
      features: [
        'Pre-meeting buffer time',
        'Post-meeting buffer time',
        'Prevent back-to-back meetings',
        'Better work-life balance',
      ],
      requiredTier: 'starter',
      icon: Calendar,
      color: 'blue'
    },
    email_templates: {
      title: 'Email Templates',
      description: 'Customize confirmation, reminder, and cancellation emails',
      features: [
        'Custom confirmation emails',
        'Custom reminder emails',
        'Cancellation notifications',
        'Personalized messaging',
      ],
      requiredTier: 'starter',
      icon: Mail,
      color: 'blue'
    },
    smart_rules: {
      title: 'Smart Rules',
      description: 'Automate your scheduling with intelligent rules',
      features: [
        'Natural language rules',
        'Automatic scheduling logic',
        'Custom availability rules',
        'AI-powered automation',
      ],
      requiredTier: 'pro',
      icon: Zap,
      color: 'purple'
    },
    email_assistant: {
      title: 'Email Assistant',
      description: 'AI-powered email intent detection and reply generation',
      features: [
        'Detect scheduling intent',
        'Generate smart replies',
        'Include booking links',
        'Save hours on emails',
      ],
      requiredTier: 'pro',
      icon: Bot,
      color: 'purple'
    },
    ai_queries: {
      title: 'Unlock Unlimited AI',
      description: 'Get unlimited AI queries to supercharge your scheduling.',
      icon: Bot,
      color: 'purple'
    },
    bookings: {
      title: 'Unlock Unlimited Bookings',
      description: 'Get unlimited bookings to grow without limits.',
      icon: Calendar,
      color: 'blue'
    },
    event_types: {
      title: 'Create More Event Types',
      description: 'Upgrade to create unlimited event types for all your needs.',
      icon: Sparkles,
      color: 'pink'
    },
    magic_links: {
      title: 'Unlock More Quick Links',
      description: 'Get more quick links to share your availability.',
      icon: Link,
      color: 'indigo'
    },
    teams: {
      title: 'Team Features',
      description: 'Create teams, add members, and manage group scheduling.',
      features: [
        'Create teams',
        'Add team members',
        'Round-robin scheduling',
        'Collective booking',
      ],
      requiredTier: 'team',
      icon: Users,
      color: 'green'
    },
    autonomous: {
      title: 'Autonomous Mode',
      description: 'Let AI automatically confirm bookings based on your rules',
      features: [
        'AI auto-confirmation',
        'Custom booking rules',
        'VIP/blocked domains',
        'Hands-free scheduling',
      ],
      requiredTier: 'team',
      icon: Bot,
      color: 'green'
    },
    templates: {
      title: 'Email Templates',
      description: 'Create custom email templates for confirmations, reminders, and follow-ups.',
      requiredTier: 'starter',
      icon: Zap,
      color: 'blue'
    },
    default: {
      title: 'Upgrade Your Plan',
      description: 'Get more features and higher limits.',
      icon: Zap,
      color: 'purple'
    }
  };

  const info = featureInfo[modalFeature] || featureInfo.default;
  const Icon = info.icon;
  const recommendedTier = getRecommendedTier ? getRecommendedTier(modalFeature) : 'pro';

  // Plan details for display
  const planDetails = {
    starter: {
      name: 'Starter',
      price: 8,
      color: 'blue',
      icon: Sparkles,
      features: [
        'Advanced AI features',
        'More bookings',
        'More event types',
        'Buffer times',
        'Email templates'
      ]
    },
    pro: {
      name: 'Pro',
      price: 15,
      color: 'purple',
      icon: Crown,
      features: [
        'Unlimited AI queries',
        'Unlimited bookings',
        'Unlimited event types',
        'Smart rules',
        'Email assistant'
      ]
    },
    team: {
      name: 'Team',
      price: 25,
      color: 'green',
      icon: Users,
      features: [
        'Everything in Pro',
        'Team collaboration',
        'Round-robin scheduling',
        'Autonomous mode',
        'Priority support'
      ]
    }
  };

  const targetPlan = planDetails[recommendedTier] || planDetails.pro;
  const TargetIcon = targetPlan.icon;

  // Open the payment modal
  const handleUpgradeClick = async () => {
    setLoading(true);
    try {
      if (handleUpgrade) {
        await handleUpgrade(recommendedTier);
      } else {
        closeUpgradeModal();
        setShowPaymentModal(true);
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = (plan) => {
    setShowPaymentModal(false);
    // Refresh usage data to update tier
    if (refreshUsage) refreshUsage();
    alert(`Successfully upgraded to ${plan.name}!`);
  };

  // If showing payment modal, render SubscriptionUpgradeModal
  if (showPaymentModal) {
    return (
      <SubscriptionUpgradeModal
        isOpen={true}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        currentTier={currentTier}
      />
    );
  }

  const colorClasses = {
    blue: 'from-blue-500 to-cyan-600',
    purple: 'from-purple-500 to-pink-500',
    green: 'from-green-500 to-emerald-600',
    pink: 'from-pink-500 to-rose-600',
    indigo: 'from-indigo-500 to-purple-600'
  };

  const borderColorClasses = {
    blue: 'border-blue-300 bg-blue-50',
    purple: 'border-purple-300 bg-purple-50',
    green: 'border-green-300 bg-green-50'
  };

  // Main upgrade prompt modal
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${colorClasses[info.color] || colorClasses.purple} p-6 relative`}>
          <button
            onClick={closeUpgradeModal}
            className="absolute top-4 right-4 p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
            <Icon className="h-8 w-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">{info.title}</h2>
          <p className="text-white/90">{info.description}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Recommended Plan */}
          {currentTier !== recommendedTier && currentTier !== 'enterprise' && (
            <div className={`border-2 rounded-xl p-4 mb-6 ${borderColorClasses[targetPlan.color]}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TargetIcon className={`h-5 w-5 text-${targetPlan.color}-600`} />
                  <span className="font-bold text-gray-900">{targetPlan.name} Plan</span>
                </div>
                <span className={`text-2xl font-bold text-${targetPlan.color}-600`}>
                  ${targetPlan.price}
                  <span className="text-sm font-normal">{targetPlan.priceNote || '/mo'}</span>
                </span>
              </div>
              <ul className="space-y-2">
                {targetPlan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className={`h-4 w-4 text-${targetPlan.color}-600`} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Feature-specific benefits */}
          {info.features && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">What you'll get:</h4>
              <ul className="space-y-2">
                {info.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Already on highest tier */}
          {(currentTier === 'team' || currentTier === 'enterprise') && recommendedTier !== 'team' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">You have access!</h3>
              <p className="text-gray-600">This feature is included in your current plan.</p>
            </div>
          )}

          {/* Action buttons */}
          {currentTier !== recommendedTier && currentTier !== 'enterprise' && (
            <div className="flex gap-3">
              <button
                onClick={closeUpgradeModal}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
              >
                Maybe Later
              </button>
              <button
                onClick={handleUpgradeClick}
                disabled={loading}
                className={`flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all hover:shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r ${colorClasses[targetPlan.color]}`}
              >
                {loading ? (
                  'Processing...'
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Upgrade to {targetPlan.name}
                  </>
                )}
              </button>
            </div>
          )}

          {(currentTier === recommendedTier || currentTier === 'enterprise') && (
            <button
              onClick={closeUpgradeModal}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
