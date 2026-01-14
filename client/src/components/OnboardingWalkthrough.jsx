import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Link,
  Users,
  Bot,
  CheckCircle,
  ArrowRight,
  X,
  Sparkles,
  Clock,
  Mail
} from 'lucide-react';
import api from '../utils/api';

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to ScheduleSync!',
    description: 'Let\'s get you set up in just 2 minutes. You\'ll be booking meetings like a pro!',
    icon: Sparkles,
    color: 'purple'
  },
  {
    id: 'calendar',
    title: 'Connect Your Calendar',
    description: 'Sync with Google or Outlook to automatically show your availability and prevent double-bookings.',
    icon: Calendar,
    color: 'blue',
    action: 'Connect Calendar',
    path: '/settings?tab=calendars'
  },
  {
    id: 'event_type',
    title: 'Create Your First Event Type',
    description: 'Set up a meeting type like "30-min Call" or "Consultation" that people can book with you.',
    icon: Clock,
    color: 'green',
    action: 'Create Event Type',
    path: '/events/new'
  },
  {
    id: 'booking_page',
    title: 'Share Your Booking Page',
    description: 'Your personal booking page is ready! Share it on LinkedIn, email signatures, or anywhere.',
    icon: Link,
    color: 'orange',
    action: 'View My Page',
    path: '/my-links'
  },
  {
    id: 'ai_assistant',
    title: 'Meet Your AI Assistant',
    description: 'Try saying "Book a meeting with john@email.com tomorrow at 2pm" - it just works!',
    icon: Bot,
    color: 'pink',
    action: 'Try AI Assistant',
    openChat: true
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'You\'re ready to start scheduling smarter. Explore more features as you go!',
    icon: CheckCircle,
    color: 'emerald'
  }
];

export default function OnboardingWalkthrough({ onComplete, onSkip }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isVisible, setIsVisible] = useState(true);

  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  const handleNext = () => {
    setCompletedSteps([...completedSteps, step.id]);

    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip?.();
    localStorage.setItem('onboarding_skipped', 'true');
  };

  const handleComplete = async () => {
    setIsVisible(false);
    onComplete?.();
    localStorage.setItem('onboarding_completed', 'true');
    try {
      await api.patch('/settings/profile', { onboarding_completed: true });
    } catch (e) {
      // Ignore errors
    }
  };

  const handleAction = () => {
    if (step.openChat) {
      window.dispatchEvent(new CustomEvent('openAIChat'));
      handleNext();
    } else if (step.path) {
      navigate(step.path);
      handleNext();
    } else {
      handleNext();
    }
  };

  if (!isVisible) return null;

  const Icon = step.icon;
  const colorClasses = {
    purple: 'from-purple-500 to-pink-500',
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    orange: 'from-orange-500 to-amber-500',
    pink: 'from-pink-500 to-rose-500',
    emerald: 'from-emerald-500 to-teal-500'
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
            >
              Skip tour
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Icon */}
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorClasses[step.color]} flex items-center justify-center mb-6 mx-auto`}>
            <Icon className="w-8 h-8 text-white" />
          </div>

          {/* Title & Description */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-3">
            {step.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-8 leading-relaxed">
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {ONBOARDING_STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-2 rounded-full transition-all ${
                  i === currentStep
                    ? 'w-6 bg-purple-500'
                    : i < currentStep
                    ? 'w-2 bg-purple-300'
                    : 'w-2 bg-gray-200 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {step.action ? (
              <>
                <button
                  onClick={handleAction}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {step.action}
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Skip this step
                </button>
              </>
            ) : (
              <button
                onClick={handleNext}
                className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {currentStep === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Continue'}
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
