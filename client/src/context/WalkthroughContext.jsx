import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Walkthrough from '../components/Walkthrough';

// Check if mobile screen
const isMobile = () => window.innerWidth < 768;

// Desktop steps - targets sidebar elements
const DESKTOP_STEPS = [
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
    position: 'top-left'
  },
  {
    id: 'availability',
    title: 'Set Your Availability',
    description: 'Define when you\'re free for meetings. Set your working hours, buffer times, and booking limits.',
    target: '[data-walkthrough="availability-btn"]',
    icon: 'Clock',
    position: 'bottom'
  },
  {
    id: 'event-types',
    title: 'Create Event Types',
    description: 'Set up different meeting types like "30-min Call", "1-hour Consultation", or "Quick Chat". Each gets its own booking link!',
    target: '[data-walkthrough="events-nav"]',
    icon: 'Sparkles',
    position: 'right'
  },
  {
    id: 'booking-link',
    title: 'Share Your Booking Link',
    description: 'Copy your personal booking link and share it anywhere. People can book directly on your calendar!',
    target: '[data-walkthrough="my-links-nav"]',
    icon: 'Link',
    position: 'right'
  },
  {
    id: 'calendar-sync',
    title: 'Connect Your Calendar',
    description: 'Sync with Google or Outlook to automatically check for conflicts. Go to Settings → Calendar to connect.',
    target: '[data-walkthrough="settings-nav"]',
    icon: 'Globe',
    position: 'right'
  },
  {
    id: 'teams',
    title: 'Team Scheduling (Team Plan)',
    description: 'Create teams for round-robin booking, collective availability, or weighted distribution. Perfect for sales teams!',
    target: '[data-walkthrough="teams-nav"]',
    icon: 'Users',
    position: 'right'
  },
  {
    id: 'email-templates',
    title: 'Customize Email Templates',
    description: 'Personalize confirmation and reminder emails. Add your branding, custom messages, and AI-generated content.',
    target: '[data-walkthrough="email-nav"]',
    icon: 'Mail',
    position: 'right'
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

// Mobile steps - simplified, no sidebar targets (uses menu icon instead)
const MOBILE_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to ScheduleSync! 🎉',
    description: 'Let\'s take a quick tour to help you get started with AI-powered scheduling.',
    target: null,
    icon: 'Calendar',
    position: 'center'
  },
  {
    id: 'ai-assistant',
    title: 'Meet Your AI Assistant 🤖',
    description: 'Tap the purple chat bubble in the bottom-right corner. Say things like "Book a meeting with john@email.com tomorrow at 2pm" and it handles everything!',
    target: '[data-walkthrough="ai-chat"]',
    icon: 'Bot',
    position: 'top'
  },
  {
    id: 'menu',
    title: 'Open the Menu ☰',
    description: 'Tap the menu icon in the top-left to access all features: Event Types, Booking Links, Teams, Email Templates, and Settings.',
    target: '[data-walkthrough="mobile-menu"]',
    icon: 'Sparkles',
    position: 'bottom'
  },
  {
    id: 'features',
    title: 'Key Features 📋',
    description: '• Event Types - Create different meeting types\n• Booking Links - Get your booking link to share\n• Settings - Connect Google/Outlook calendar\n• Teams - Set up team scheduling (Team plan)',
    target: null,
    icon: 'CheckCircle',
    position: 'center'
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🚀',
    description: 'Start by setting your availability and creating your first event type. Need help? Just ask the AI assistant!',
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
  const [hasCompleted, setHasCompleted] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // Get steps based on screen size
  const getSteps = useCallback(() => {
    return isMobileView ? MOBILE_STEPS : DESKTOP_STEPS;
  }, [isMobileView]);

  // Check screen size on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobileView(isMobile());
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check if user has completed walkthrough
  useEffect(() => {
    const completed = localStorage.getItem('schedulesync_walkthrough_completed');
    const dismissed = localStorage.getItem('schedulesync_walkthrough_dismissed');
    const isNewUser = !completed && !dismissed;
    
    setHasCompleted(completed === 'true' || dismissed === 'true');
    
    if (isNewUser) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const startWalkthrough = useCallback(() => {
    setIsMobileView(isMobile()); // Re-check on start
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

  const steps = getSteps();

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endWalkthrough(true);
    }
  }, [currentStep, steps.length, endWalkthrough]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  }, [steps.length]);

  const resetWalkthrough = useCallback(() => {
    localStorage.removeItem('schedulesync_walkthrough_completed');
    localStorage.removeItem('schedulesync_walkthrough_dismissed');
    setHasCompleted(false);
    setShowPrompt(true);
  }, []);

  const value = {
    isActive,
    currentStep,
    totalSteps: steps.length,
    hasCompleted,
    showPrompt,
    currentStepData: steps[currentStep],
    startWalkthrough,
    endWalkthrough,
    dismissWalkthrough,
    dismissPrompt,
    nextStep,
    prevStep,
    goToStep,
    resetWalkthrough,
    isMobileView
  };

  return (
    <WalkthroughContext.Provider value={value}>
      {children}
      <Walkthrough
        isActive={isActive}
        currentStep={currentStep}
        totalSteps={steps.length}
        currentStepData={steps[currentStep]}
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