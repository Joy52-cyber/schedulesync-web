import React, { useState } from 'react';
import { Crown, Bot, Calendar, Users, Sparkles, ArrowRight } from 'lucide-react';
import PricingModal from './PricingModal';

// Premium upgrade prompt that can be used anywhere
const UpgradePrompt = ({
  trigger = 'chatgpt_limit',
  compact = false,
  className = ''
}) => {
  const [showPricing, setShowPricing] = useState(false);

  const getTriggerContent = (trigger) => {
    switch(trigger) {
      case 'chatgpt_limit':
        return {
          icon: Bot,
          iconColor: 'from-purple-500 to-indigo-500',
          bgGradient: 'from-purple-50 to-indigo-50',
          borderColor: 'border-purple-200',
          title: 'ChatGPT limit reached',
          message: 'Upgrade to Pro for unlimited ChatGPT queries',
          cta: 'Upgrade to Pro - $15/month'
        };
      case 'booking_limit':
        return {
          icon: Calendar,
          iconColor: 'from-blue-500 to-cyan-500',
          bgGradient: 'from-blue-50 to-cyan-50',
          borderColor: 'border-blue-200',
          title: 'Monthly booking limit reached',
          message: 'Upgrade for 500+ bookings per month',
          cta: 'Upgrade Now'
        };
      case 'team_feature':
        return {
          icon: Users,
          iconColor: 'from-green-500 to-emerald-500',
          bgGradient: 'from-green-50 to-emerald-50',
          borderColor: 'border-green-200',
          title: 'Team features locked',
          message: 'Upgrade to add team members and collaboration',
          cta: 'Upgrade to Team'
        };
      case 'general':
      default:
        return {
          icon: Sparkles,
          iconColor: 'from-amber-500 to-orange-500',
          bgGradient: 'from-amber-50 to-orange-50',
          borderColor: 'border-amber-200',
          title: 'Unlock Pro features',
          message: 'Get unlimited ChatGPT, more bookings, and priority support',
          cta: 'Upgrade to Pro'
        };
    }
  };

  const content = getTriggerContent(trigger);
  const IconComponent = content.icon;

  if (compact) {
    return (
      <>
        <div className={`inline-flex items-center gap-2 ${className}`}>
          <div className={`w-6 h-6 bg-gradient-to-br ${content.iconColor} rounded-lg flex items-center justify-center`}>
            <IconComponent className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-700">Limit reached</span>
          <button
            onClick={() => setShowPricing(true)}
            className="text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1.5 rounded-lg hover:shadow-lg transition-all font-semibold"
          >
            Upgrade
          </button>
        </div>

        <PricingModal
          isOpen={showPricing}
          onClose={() => setShowPricing(false)}
          currentPlan="free"
        />
      </>
    );
  }

  return (
    <>
      <div className={`p-5 sm:p-6 bg-gradient-to-br ${content.bgGradient} border-2 ${content.borderColor} rounded-2xl shadow-lg backdrop-blur-sm hover:shadow-xl transition-all ${className}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br ${content.iconColor} rounded-xl flex items-center justify-center shadow-lg flex-shrink-0`}>
              <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900 text-base sm:text-lg">{content.title}</h3>
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-sm text-gray-700 mb-4 leading-relaxed">{content.message}</p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <button
                  onClick={() => setShowPricing(true)}
                  className="group bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                >
                  {content.cta}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <span className="text-xs text-gray-600 font-medium px-3 py-1 bg-white/60 rounded-full">
                  Join 500+ upgraded users
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentPlan="free"
      />
    </>
  );
};

// Premium toast notification for instant upgrade prompts
export const showUpgradeToast = (trigger = 'general') => {
  const content = {
    chatgpt_limit: 'ChatGPT limit reached! Upgrade for unlimited queries',
    booking_limit: 'Booking limit reached! Upgrade for 500+ bookings',
    general: 'Upgrade to Pro for unlimited access'
  };

  // Premium toast implementation
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl z-[99999] cursor-pointer hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300 max-w-sm animate-in slide-in-from-right backdrop-blur-xl border-2 border-white/20';
  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
      </div>
      <div class="flex-1">
        <p class="font-bold text-sm">${content[trigger] || content.general}</p>
        <p class="text-xs text-white/80 mt-0.5">Click to view pricing →</p>
      </div>
    </div>
  `;

  toast.onclick = () => {
    window.dispatchEvent(new CustomEvent('showPricingModal'));
    toast.style.animation = 'slide-out-to-right 300ms ease-in';
    setTimeout(() => toast.remove(), 300);
  };

  document.body.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slide-out-to-right 300ms ease-in';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
};

// Hook for listening to upgrade events
export const useUpgradePrompt = () => {
  const [showPricing, setShowPricing] = useState(false);

  React.useEffect(() => {
    const handleShowPricing = () => setShowPricing(true);
    window.addEventListener('showPricingModal', handleShowPricing);
    return () => window.removeEventListener('showPricingModal', handleShowPricing);
  }, []);

  return { showPricing, setShowPricing };
};

export default UpgradePrompt;