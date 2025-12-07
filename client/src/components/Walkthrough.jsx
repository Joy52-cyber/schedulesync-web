import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  Calendar,
  Bot,
  Clock,
  Users,
  Link,
  Settings,
  Sparkles,
  CheckCircle,
  Zap,
  Mail,
  Globe
} from 'lucide-react';

// Inject walkthrough CSS once
const WALKTHROUGH_STYLES = `
  @keyframes walkthrough-pulse {
    0%, 100% { 
      box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.9),
                  0 0 20px 8px rgba(168, 85, 247, 0.4),
                  0 0 40px 16px rgba(236, 72, 153, 0.2);
    }
    50% { 
      box-shadow: 0 0 0 6px rgba(168, 85, 247, 1),
                  0 0 30px 12px rgba(168, 85, 247, 0.6),
                  0 0 60px 24px rgba(236, 72, 153, 0.3);
    }
  }
  
  @keyframes walkthrough-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  
  .walkthrough-spotlight-pulse {
    animation: walkthrough-pulse 1.5s ease-in-out infinite;
  }
  
  .walkthrough-highlighted {
    position: relative !important;
    z-index: 9999 !important;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(236, 72, 153, 0.15)) !important;
    border-radius: 12px !important;
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.5) !important;
  }
`;

// Inject styles on first import
if (typeof document !== 'undefined') {
  const styleId = 'walkthrough-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = WALKTHROUGH_STYLES;
    document.head.appendChild(styleEl);
  }
}

// Icon mapping
const ICONS = {
  Calendar,
  Bot,
  Clock,
  Users,
  Link,
  Settings,
  Sparkles,
  CheckCircle,
  Zap,
  Mail,
  Globe
};

// Tooltip positioning helper
function getTooltipPosition(targetEl, position) {
  if (!targetEl) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const rect = targetEl.getBoundingClientRect();
  const tooltipWidth = 340;
  const tooltipHeight = 220;
  const padding = 16;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let style = {};

  switch (position) {
    case 'top':
      style = {
        top: `${Math.max(padding, rect.top - tooltipHeight - padding)}px`,
        left: `${Math.min(viewportWidth - tooltipWidth - padding, Math.max(padding, rect.left + rect.width / 2 - tooltipWidth / 2))}px`,
      };
      break;
    case 'bottom':
      style = {
        top: `${Math.min(viewportHeight - tooltipHeight - padding, rect.bottom + padding)}px`,
        left: `${Math.min(viewportWidth - tooltipWidth - padding, Math.max(padding, rect.left + rect.width / 2 - tooltipWidth / 2))}px`,
      };
      break;
    case 'left':
      style = {
        top: `${Math.min(viewportHeight - tooltipHeight - padding, Math.max(padding, rect.top + rect.height / 2 - tooltipHeight / 2))}px`,
        left: `${Math.max(padding, rect.left - tooltipWidth - padding)}px`,
      };
      break;
    case 'right':
      style = {
        top: `${Math.min(viewportHeight - tooltipHeight - padding, Math.max(padding, rect.top + rect.height / 2 - tooltipHeight / 2))}px`,
        left: `${Math.min(viewportWidth - tooltipWidth - padding, rect.right + padding)}px`,
      };
      break;
    case 'top-left':
      style = {
        top: `${Math.max(padding, rect.top - tooltipHeight - padding)}px`,
        left: `${Math.max(padding, rect.left)}px`,
      };
      break;
    default:
      style = {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
  }

  return style;
}

// Spotlight/highlight component with enhanced emphasis
function Spotlight({ targetEl, position }) {
  const [style, setStyle] = useState(null);
  const [arrowStyle, setArrowStyle] = useState(null);

  useEffect(() => {
    if (!targetEl) {
      setStyle(null);
      setArrowStyle(null);
      return;
    }

    const updatePosition = () => {
      const rect = targetEl.getBoundingClientRect();
      const padding = 12;
      setStyle({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });

      // Calculate arrow position based on tooltip position
      const arrowSize = 32;
      let arrow = {};
      switch (position) {
        case 'bottom':
          arrow = {
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2 - arrowSize / 2,
            transform: 'rotate(180deg)',
          };
          break;
        case 'top':
          arrow = {
            top: rect.top - arrowSize - 8,
            left: rect.left + rect.width / 2 - arrowSize / 2,
            transform: 'rotate(0deg)',
          };
          break;
        case 'left':
          arrow = {
            top: rect.top + rect.height / 2 - arrowSize / 2,
            left: rect.left - arrowSize - 8,
            transform: 'rotate(90deg)',
          };
          break;
        case 'right':
          arrow = {
            top: rect.top + rect.height / 2 - arrowSize / 2,
            left: rect.right + 8,
            transform: 'rotate(-90deg)',
          };
          break;
        default:
          arrow = null;
      }
      setArrowStyle(arrow);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [targetEl, position]);

  if (!style) return null;

  return (
    <>
      {/* Dark overlay with cutout */}
      <div
        className="fixed rounded-2xl pointer-events-none z-[9998] transition-all duration-300"
        style={{
          ...style,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)'
        }}
      />
      
      {/* Pulsing glow ring */}
      <div
        className="fixed rounded-2xl pointer-events-none z-[9998] transition-all duration-300 walkthrough-spotlight-pulse"
        style={style}
      />
      
      {/* Inner highlight border */}
      <div
        className="fixed rounded-2xl border-2 border-white/50 pointer-events-none z-[9998] transition-all duration-300"
        style={style}
      />
      
      {/* "Look here" label */}
      <div
        className="fixed z-[9999] pointer-events-none animate-bounce"
        style={{
          top: style.top - 36,
          left: style.left + style.width / 2,
          transform: 'translateX(-50%)'
        }}
      >
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Look here!
        </div>
      </div>
      
      {/* Animated arrow pointer */}
      {arrowStyle && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={arrowStyle}
        >
          <svg 
            width="32" 
            height="32" 
            viewBox="0 0 32 32" 
            className="animate-bounce text-purple-500 drop-shadow-lg"
          >
            <path 
              d="M16 4 L16 24 M8 16 L16 24 L24 16" 
              stroke="currentColor" 
              strokeWidth="4" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      )}
    </>
  );
}

// Main Walkthrough Component
export default function Walkthrough({ 
  isActive, 
  currentStep, 
  totalSteps,
  currentStepData,
  onNext, 
  onPrev, 
  onDismiss,
  onComplete 
}) {
  const [targetEl, setTargetEl] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});

  // Apply/remove highlight styles to target element
  useEffect(() => {
    if (!targetEl) return;

    // Add walkthrough highlight class
    targetEl.classList.add('walkthrough-highlighted');
    targetEl.style.position = 'relative';
    targetEl.style.zIndex = '9999';
    targetEl.style.transform = 'scale(1.05)';
    targetEl.style.transition = 'transform 0.3s ease';

    return () => {
      // Clean up styles when step changes
      targetEl.classList.remove('walkthrough-highlighted');
      targetEl.style.position = '';
      targetEl.style.zIndex = '';
      targetEl.style.transform = '';
      targetEl.style.transition = '';
    };
  }, [targetEl]);

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const findTarget = () => {
      if (currentStepData.target) {
        const el = document.querySelector(currentStepData.target);
        setTargetEl(el);
        
        if (el) {
          const position = getTooltipPosition(el, currentStepData.position);
          setTooltipStyle(position);
          
          // Scroll element into view if needed
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Fallback to center if element not found
          setTargetEl(null);
          setTooltipStyle({
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          });
        }
      } else {
        setTargetEl(null);
        setTooltipStyle({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        });
      }
    };

    // Small delay to let DOM settle
    const timer = setTimeout(findTarget, 150);
    
    // Recalculate on resize/scroll
    window.addEventListener('resize', findTarget);
    window.addEventListener('scroll', findTarget);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', findTarget);
      window.removeEventListener('scroll', findTarget);
    };
  }, [isActive, currentStepData, currentStep]);

  if (!isActive || !currentStepData) return null;

  const Icon = ICONS[currentStepData.icon] || Sparkles;
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  const content = (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 z-[9997] transition-opacity duration-300"
        onClick={onDismiss}
      />

      {/* Spotlight on target element */}
      <Spotlight targetEl={targetEl} position={currentStepData?.position} />

      {/* Tooltip */}
      <div
        className="fixed z-[9999] w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-300"
        style={tooltipStyle}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg leading-tight">{currentStepData.title}</h3>
                <p className="text-purple-200 text-xs mt-0.5">
                  Step {currentStep + 1} of {totalSteps}
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-white/70 hover:text-white transition-colors ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            {currentStepData.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="px-5 pb-3 flex justify-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep 
                  ? 'w-6 bg-purple-600' 
                  : idx < currentStep 
                    ? 'w-1.5 bg-purple-300' 
                    : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onDismiss}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Skip tour
          </button>
          
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            
            <button
              onClick={isLast ? onComplete : onNext}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-1 text-sm"
            >
              {isLast ? (
                <>
                  Get Started
                  <Zap className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}

// Walkthrough Prompt Banner for Dashboard
export function WalkthroughPrompt({ onStart, onDismiss }) {
  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6 shadow-lg mb-6 animate-in slide-in-from-top duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-xl mb-1">New to ScheduleSync? 👋</h3>
            <p className="text-purple-100 text-sm">
              Take a quick 2-minute tour to learn how to set up AI-powered scheduling and start booking meetings effortlessly.
            </p>
          </div>
        </div>
        <button onClick={onDismiss} className="text-white/70 hover:text-white flex-shrink-0">
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex items-center gap-3 mt-4 ml-16">
        <button
          onClick={onStart}
          className="px-5 py-2.5 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Start Tour
        </button>
        <button
          onClick={onDismiss}
          className="px-5 py-2.5 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

// "Take a Tour" button for header/settings
export function WalkthroughButton({ onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 transition-colors text-sm font-medium flex items-center gap-2 ${className}`}
    >
      <Sparkles className="h-4 w-4" />
      Take a Tour
    </button>
  );
}