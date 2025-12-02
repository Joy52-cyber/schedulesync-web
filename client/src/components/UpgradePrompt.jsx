import React, { useState } from 'react';
import PricingModal from './PricingModal';

// Simple upgrade prompt that can be used anywhere
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
          icon: '🤖',
          title: 'ChatGPT limit reached',
          message: 'Upgrade to Pro for unlimited ChatGPT queries',
          cta: 'Upgrade to Pro - $15/month'
        };
      case 'booking_limit':
        return {
          icon: '📅',
          title: 'Monthly booking limit reached',
          message: 'Upgrade for 500+ bookings per month',
          cta: 'Upgrade Now'
        };
      case 'team_feature':
        return {
          icon: '👥',
          title: 'Team features locked',
          message: 'Upgrade to add team members and collaboration',
          cta: 'Upgrade to Team'
        };
      case 'general':
      default:
        return {
          icon: '⭐',
          title: 'Unlock Pro features',
          message: 'Get unlimited ChatGPT, more bookings, and priority support',
          cta: 'Upgrade to Pro'
        };
    }
  };

  const content = getTriggerContent(trigger);

  if (compact) {
    return (
      <>
        <div className={`inline-flex items-center gap-2 ${className}`}>
          <span className="text-sm text-gray-600">{content.icon} Limit reached</span>
          <button
            onClick={() => setShowPricing(true)}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
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
      <div className={`p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg ${className}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">{content.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">{content.title}</h3>
              <p className="text-sm text-gray-600 mb-3">{content.message}</p>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowPricing(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  {content.cta}
                </button>
                
                <span className="text-xs text-gray-500">
                  Join 500+ users already upgraded
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

// Toast notification for instant upgrade prompts
export const showUpgradeToast = (trigger = 'general') => {
  const content = {
    chatgpt_limit: '🤖 ChatGPT limit reached! Upgrade for unlimited queries →',
    booking_limit: '📅 Booking limit reached! Upgrade for 500+ bookings →', 
    general: '⭐ Upgrade to Pro for unlimited access →'
  };

  // Simple toast implementation (you can replace with your toast library)
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 cursor-pointer';
  toast.innerHTML = content[trigger] || content.general;
  
  toast.onclick = () => {
    // Trigger pricing modal (you'll need to implement this)
    window.dispatchEvent(new CustomEvent('showPricingModal'));
    toast.remove();
  };
  
  document.body.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
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