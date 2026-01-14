import { useEffect, useState } from 'react';

export default function AnimatedPage({ children, className = '', animation = 'slide-up' }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to ensure smooth animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const animations = {
    'slide-up': 'translate-y-4',
    'slide-down': '-translate-y-4',
    'slide-left': 'translate-x-4',
    'slide-right': '-translate-x-4',
    'scale': 'scale-95',
    'fade': ''
  };

  const initialTransform = animations[animation] || animations['slide-up'];

  return (
    <div
      className={`${className} transition-all duration-300 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0 translate-x-0 scale-100'
          : `opacity-0 ${initialTransform}`
      }`}
    >
      {children}
    </div>
  );
}

// Staggered list animation wrapper
export function AnimatedList({ children, className = '', staggerDelay = 50 }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className={className}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <div
              key={index}
              className={`transition-all duration-300 ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${index * staggerDelay}ms` }}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  );
}
