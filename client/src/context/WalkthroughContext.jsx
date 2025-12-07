import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Walkthrough from '../components/Walkthrough';

// Walkthrough steps configuration
const WALKTHROUGH_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to ScheduleSync! 🎉',
    description: 'Let\'s take a quick tour to help you get started with AI-powered scheduling. This will only take about 2 minutes.',
    target: null,
    icon: 'Calendar',
    position: 'center'
  },
  {
    id: 'ai-assistant',
    title: 'Meet Your AI Assistant',
    description: 'Click the chat bubble in the bottom-right corner to talk to your AI scheduler. Just say "Book a meeting with john@email.com tomorrow at 2pm" and it handles everything!',
    target: '[data-walkthrough="ai-chat"]',
    icon: 'Bot',
    position: 'top-left',
    fallbackPosition: 'center'
  },
  {
    id: 'availability',
    title: 'Set Your Availability',
    description: 'Define when you\'re free for meetings. Click "Availability" to set your working hours, buffer times, and booking limits.',
    target: '[data-walkthrough="availability-btn"]',
    icon: 'Clock',
    position: 'bottom',
    fallbackPosition: 'center'
  },
  {
    id: 'event-types',
    title: 'Create Event Types',
    description: 'Set up different meeting types like "30-min Call", "1-hour Consultation", or "Quick Chat". Each gets its own booking link!',
    target: '[data-walkthrough="events-nav"]',
    icon: 'Sparkles',
    position: 'right',
    fallbackPosition: 'center'
  },
  {
    id: 'booking-link',
    title: 'Share Your Booking Link',
    description: 'Copy your personal booking link and share it anywhere. People can book directly on your calendar!',
    target: '[data-walkthrough="my-links-nav"]',
    icon: 'Link',
    position: 'right',
    fallbackPosition: 'center'
  },
  {
    id: 'calendar-sync',
    title: 'Connect Your Calendar',
    description: 'Sync with Google or Outlook to automatically check for conflicts. Go to Settings → Calendar to connect.',
    target: '[data-walkthrough="settings-nav"]',
    icon: 'Globe',
    position: 'right',
    fallbackPosition: 'center'
  },
  {
    id: 'teams',
    title: 'Team Scheduling (Team Plan)',
    description: 'Create teams for round-robin booking, collective availability, or weighted distribution. Perfect for sales teams!',
    target: '[data-walkthrough="teams-nav"]',
    icon: 'Users',
    position: 'right',
    fallbackPosition: 'center'
  },
  {
    id: 'email-templates',
    title: 'Customize Email Templates',
    description: 'Personalize confirmation and reminder emails. Add your branding, custom messages, and AI-generated content.',
    target: '[data-walkthrough="email-nav"]',
    icon: 'Mail',
    position: 'right',
    fallbackPosition: 'center'
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🚀',
    description: 'You now know the basics of ScheduleSync. Start by setting your availability and creating your first event type. Need help? Just ask the AI assistant!',
    target: null,
    icon: 'CheckCircle',
    position: 'center',
    isLast: true
  }
];

const WalkthroughContext = createContext(null);

export function WalkthroughProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(true); // Default true to prevent flash
  const [showPrompt, setShowPrompt] = useState(false);

  // Check if user has completed walkthrough
  useEffect(() => {
    const completed = localStorage.getItem('schedulesync_walkthrough_completed');
    const dismissed = localStorage.getItem('schedulesync_walkthrough_dismissed');
    const isNewUser = !completed && !dismissed;
    
    setHasCompleted(completed === 'true' || dismissed === 'true');
    
    // Show prompt for new users after a short delay
    if (isNewUser) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const startWalkthrough = useCallback(() => {
    setShowPrompt(false);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endWalkthrough = useCallback((completed = false) => {
    setIsActive(false);
    setCurrentStep(0);
    if (completed) {
      localStorage.setItem('schedulesync_walkthrough_completed', 'true');
      setHasCompleted(true);
    }
  }, []);

  const dismissWalkthrough = useCallback(() => {
    setIsActive(false);
    setShowPrompt(false);
    localStorage.setItem('schedulesync_walkthrough_dismissed', 'true');
    setHasCompleted(true);
  }, []);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem('schedulesync_walkthrough_dismissed', 'true');
    setHasCompleted(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < WALKTHROUGH_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endWalkthrough(true);
    }
  }, [currentStep, endWalkthrough]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step) => {
    if (step >= 0 && step < WALKTHROUGH_STEPS.length) {
      setCurrentStep(step);
    }
  }, []);

  // Reset walkthrough (for testing)
  const resetWalkthrough = useCallback(() => {
    localStorage.removeItem('schedulesync_walkthrough_completed');
    localStorage.removeItem('schedulesync_walkthrough_dismissed');
    setHasCompleted(false);
    setShowPrompt(true);
  }, []);

  const value = {
    isActive,
    currentStep,
    totalSteps: WALKTHROUGH_STEPS.length,
    hasCompleted,
    showPrompt,
    currentStepData: WALKTHROUGH_STEPS[currentStep],
    startWalkthrough,
    endWalkthrough,
    dismissWalkthrough,
    dismissPrompt,
    nextStep,
    prevStep,
    goToStep,
    resetWalkthrough
  };

  return (
    <WalkthroughContext.Provider value={value}>
      {children}
      <Walkthrough
        isActive={isActive}
        currentStep={currentStep}
        totalSteps={WALKTHROUGH_STEPS.length}
        currentStepData={WALKTHROUGH_STEPS[currentStep]}
        onNext={nextStep}
        onPrev={prevStep}
        onDismiss={dismissWalkthrough}
        onComplete={() => endWalkthrough(true)}
      />
    </WalkthroughContext.Provider>
  );
}

export function useWalkthrough() {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return context;
}

export default WalkthroughContext;