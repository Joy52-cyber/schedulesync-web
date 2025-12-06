import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Zap, 
  Bot, 
  Calendar, 
  Sparkles, 
  Link, 
  Users,
  Check,
  Crown
} from 'lucide-react';
import { useUpgrade } from '../context/UpgradeContext';

const UpgradeModal = () => {
  const navigate = useNavigate();
  const { modalOpen, modalFeature, closeUpgradeModal, currentTier, usage } = useUpgrade();

  // Don't render if modal is not open
  if (!modalOpen) return null;

  const featureInfo = {
    ai_queries: {
      title: 'AI Query Limit Reached',
      description: `You've used ${usage?.ai_queries_used || 0}/${usage?.ai_queries_limit || 10} AI queries this month.`,
      icon: Bot,
      color: 'purple'
    },
    bookings: {
      title: 'Booking Limit Reached',
      description: `You've used ${usage?.bookings_used || 0}/${usage?.bookings_limit || 50} bookings this month.`,
      icon: Calendar,
      color: 'blue'
    },
    event_types: {
      title: 'Event Type Limit Reached',
      description: `You've created ${usage?.event_types_used || 0}/${usage?.event_types_limit || 2} event types.`,
      icon: Sparkles,
      color: 'pink'
    },
    magic_links: {
      title: 'Magic Link Limit Reached',
      description: `You've used ${usage?.magic_links_used || 0}/${usage?.magic_links_limit || 3} magic links this month.`,
      icon: Link,
      color: 'indigo'
    },
    teams: {
      title: 'Team Features',
      description: 'Create teams, add members, and manage group scheduling.',
      icon: Users,
      color: 'green'
    },
    default: {
      title: 'Upgrade Your Plan',
      description: 'Get unlimited access to all features.',
      icon: Zap,
      color: 'purple'
    }
  };

  const info = featureInfo[modalFeature] || featureInfo.default;
  const Icon = info.icon;
  const needsTeamPlan = modalFeature === 'teams';

  const handleUpgrade = () => {
    closeUpgradeModal();
    navigate('/billing');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${
          needsTeamPlan 
            ? 'from-green-500 to-emerald-600' 
            : 'from-purple-500 to-pink-500'
        } p-6 relative`}>
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
          {/* Plan comparison */}
          <div className="space-y-4 mb-6">
            {/* Pro Plan */}
            {!needsTeamPlan && (
              <div className={`border-2 rounded-xl p-4 ${
                currentTier === 'pro' 
                  ? 'border-green-300 bg-green-50' 
                  : 'border-purple-300 bg-purple-50'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-purple-600" />
                    <span className="font-bold text-gray-900">Pro Plan</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">$12<span className="text-sm font-normal">/mo</span></span>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-purple-600" />
                    Unlimited AI queries
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-purple-600" />
                    Unlimited bookings
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-purple-600" />
                    Unlimited event types
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-purple-600" />
                    Unlimited magic links
                  </li>
                </ul>
                {currentTier === 'pro' && (
                  <div className="mt-3 text-sm text-green-600 font-medium">
                    ✓ Current Plan
                  </div>
                )}
              </div>
            )}

            {/* Team Plan */}
            {(needsTeamPlan || currentTier === 'pro') && (
              <div className="border-2 border-green-300 bg-green-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    <span className="font-bold text-gray-900">Team Plan</span>
                  </div>
                  <span className="text-2xl font-bold text-green-600">$25<span className="text-sm font-normal">/mo</span></span>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-green-600" />
                    Everything in Pro
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-green-600" />
                    Create unlimited teams
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-green-600" />
                    Up to 10 team members
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-green-600" />
                    Round-robin & collective booking
                  </li>
                </ul>
                {currentTier === 'team' && (
                  <div className="mt-3 text-sm text-green-600 font-medium">
                    ✓ Current Plan
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={closeUpgradeModal}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={handleUpgrade}
              className={`flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all hover:shadow-lg flex items-center justify-center gap-2 ${
                needsTeamPlan
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600'
              }`}
            >
              <Zap className="h-4 w-4" />
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;