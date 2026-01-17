import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Link,
  FileText,
  Zap,
  Clock,
  Mail,
  Plus,
  Search,
  Inbox
} from 'lucide-react';

const EMPTY_STATE_CONFIGS = {
  bookings: {
    icon: Calendar,
    title: 'No bookings yet',
    description: 'When someone books a meeting with you, it will appear here.',
    action: 'Share your booking page',
    actionPath: '/my-links',
    color: 'purple'
  },
  event_types: {
    icon: Clock,
    title: 'No event types',
    description: 'Create your first event type to let people book meetings with you.',
    action: 'Create Event Type',
    actionPath: '/events/new',
    color: 'blue'
  },
  teams: {
    icon: Users,
    title: 'No teams yet',
    description: 'Create a team to schedule meetings with colleagues.',
    action: 'Create Team',
    actionPath: '/teams',
    color: 'green'
  },
  quick_links: {
    icon: Link,
    title: 'No quick links',
    description: 'Quick links are temporary booking links for specific meetings.',
    action: 'Create Quick Link',
    actionPath: '/my-links',
    color: 'orange'
  },
  templates: {
    icon: Mail,
    title: 'No email templates',
    description: 'Create custom email templates for confirmations, reminders, and more.',
    action: 'Create Template',
    actionPath: '/templates',
    color: 'pink'
  },
  rules: {
    icon: Zap,
    title: 'No smart rules',
    description: 'Smart rules automate your scheduling with natural language.',
    action: 'Create Rule',
    actionPath: '/rules',
    color: 'indigo'
  },
  inbox: {
    icon: Inbox,
    title: 'No messages yet',
    description: 'Your inbox is empty. Booking requests and notifications will appear here.',
    action: null,
    color: 'blue'
  },
  search: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filters.',
    action: null,
    color: 'gray'
  }
};

export default function EmptyState({
  type,
  title,
  description,
  action,
  actionPath,
  onAction,
  icon: CustomIcon,
  className = ''
}) {
  const navigate = useNavigate();
  const config = EMPTY_STATE_CONFIGS[type] || {};

  const Icon = CustomIcon || config.icon || FileText;
  const displayTitle = title || config.title || 'Nothing here yet';
  const displayDescription = description || config.description || '';
  const displayAction = action || config.action;
  const displayPath = actionPath || config.actionPath;
  const color = config.color || 'gray';

  const colorClasses = {
    purple: 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-300/50',
    blue: 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-300/50',
    green: 'bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg shadow-green-300/50',
    orange: 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-300/50',
    pink: 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-300/50',
    indigo: 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-300/50',
    gray: 'bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-lg shadow-gray-300/50'
  };

  const bgGlowClasses = {
    purple: 'bg-gradient-to-br from-purple-200 to-pink-200 dark:from-purple-900/50 dark:to-pink-900/50',
    blue: 'bg-gradient-to-br from-blue-200 to-cyan-200 dark:from-blue-900/50 dark:to-cyan-900/50',
    green: 'bg-gradient-to-br from-green-200 to-emerald-200 dark:from-green-900/50 dark:to-emerald-900/50',
    orange: 'bg-gradient-to-br from-orange-200 to-amber-200 dark:from-orange-900/50 dark:to-amber-900/50',
    pink: 'bg-gradient-to-br from-pink-200 to-rose-200 dark:from-pink-900/50 dark:to-rose-900/50',
    indigo: 'bg-gradient-to-br from-indigo-200 to-purple-200 dark:from-indigo-900/50 dark:to-purple-900/50',
    gray: 'bg-gradient-to-br from-gray-200 to-slate-200 dark:from-gray-800/50 dark:to-slate-800/50'
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (displayPath) {
      navigate(displayPath);
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center animate-fade-in ${className}`}>
      {/* Premium Decorative Background with Multiple Layers */}
      <div className="relative mb-8">
        {/* Outer glow */}
        <div className={`absolute inset-0 ${bgGlowClasses[color]} rounded-full opacity-20 scale-[2.5] blur-3xl animate-pulse`} />
        {/* Middle glow */}
        <div className={`absolute inset-0 ${bgGlowClasses[color]} rounded-full opacity-30 scale-[1.8] blur-2xl`} />
        {/* Icon container with premium gradient */}
        <div className={`relative w-20 h-20 sm:w-24 sm:h-24 ${colorClasses[color]} rounded-3xl flex items-center justify-center transform hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-10 h-10 sm:w-12 sm:h-12 animate-bounce" style={{ animationDuration: '3s' }} />
        </div>
      </div>

      {/* Premium Text with Better Typography */}
      <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 bg-clip-text">
        {displayTitle}
      </h3>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
        {displayDescription}
      </p>

      {/* Premium Action Button */}
      {displayAction && (
        <button
          onClick={handleAction}
          className="group inline-flex items-center gap-2 px-6 py-3 sm:px-7 sm:py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300 text-sm sm:text-base"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          {displayAction}
        </button>
      )}
    </div>
  );
}
