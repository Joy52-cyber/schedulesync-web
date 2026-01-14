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
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    gray: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
  };

  const bgGlowClasses = {
    purple: 'bg-purple-200 dark:bg-purple-800',
    blue: 'bg-blue-200 dark:bg-blue-800',
    green: 'bg-green-200 dark:bg-green-800',
    orange: 'bg-orange-200 dark:bg-orange-800',
    pink: 'bg-pink-200 dark:bg-pink-800',
    indigo: 'bg-indigo-200 dark:bg-indigo-800',
    gray: 'bg-gray-200 dark:bg-gray-700'
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (displayPath) {
      navigate(displayPath);
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in ${className}`}>
      {/* Decorative background circles */}
      <div className="relative mb-6">
        <div className={`absolute inset-0 ${bgGlowClasses[color]} rounded-full opacity-30 scale-150 blur-xl`} />
        <div className={`relative w-20 h-20 ${colorClasses[color]} rounded-2xl flex items-center justify-center`}>
          <Icon className="w-10 h-10" />
        </div>
      </div>

      {/* Text */}
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {displayTitle}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        {displayDescription}
      </p>

      {/* Action */}
      {displayAction && (
        <button
          onClick={handleAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg transition-all btn-hover"
        >
          <Plus className="w-5 h-5" />
          {displayAction}
        </button>
      )}
    </div>
  );
}
