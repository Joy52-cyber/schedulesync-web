import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useUpgrade } from '../context/UpgradeContext';
import {
  Sparkles,
  Send,
  X,
  Minus,
  Maximize2,
  Loader2,
  Calendar,
  Clock,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  Trash2,
  RotateCcw,
  Zap,
  Copy,
  Check,
  Link,
  Globe,
  Users,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  ChevronRight,
  BarChart3,
  CalendarDays,
  UserCircle,
  RefreshCw
} from 'lucide-react';
import api from '../utils/api';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Track and retrieve frequent user actions
const getFrequentActions = () => {
  try {
    const actions = JSON.parse(localStorage.getItem('aiChat_actionHistory') || '{}');
    return Object.entries(actions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([action]) => action);
  } catch {
    return [];
  }
};

const trackAction = (action) => {
  try {
    const actions = JSON.parse(localStorage.getItem('aiChat_actionHistory') || '{}');
    actions[action] = (actions[action] || 0) + 1;
    localStorage.setItem('aiChat_actionHistory', JSON.stringify(actions));
  } catch {
    // Ignore storage errors
  }
};

// Get recent pages visited
const getRecentPages = () => {
  try {
    return JSON.parse(localStorage.getItem('aiChat_recentPages') || '[]').slice(0, 5);
  } catch {
    return [];
  }
};

const trackPageVisit = (path) => {
  try {
    const pages = JSON.parse(localStorage.getItem('aiChat_recentPages') || '[]');
    const filtered = pages.filter(p => p !== path);
    filtered.unshift(path);
    localStorage.setItem('aiChat_recentPages', JSON.stringify(filtered.slice(0, 10)));
  } catch {
    // Ignore storage errors
  }
};

// Check if user has no upcoming meetings
const hasNoUpcomingMeetings = async () => {
  try {
    const response = await api.get('/bookings/upcoming?limit=1');
    return !response.data?.bookings?.length;
  } catch {
    return false;
  }
};

// Check for frequent reschedules pattern
const hasFrequentReschedules = () => {
  try {
    const history = JSON.parse(localStorage.getItem('aiChat_history') || '[]');
    const rescheduleCount = history.filter(msg =>
      msg.role === 'user' &&
      msg.content?.toLowerCase().includes('reschedule')
    ).length;
    return rescheduleCount >= 3;
  } catch {
    return false;
  }
};

// Extract quick actions from AI response
const extractQuickActions = (message) => {
  const actions = [];
  const patterns = [
    { regex: /(?:you can|try|would you like to)\s+(create|schedule|book|share|check)/gi, action: '$1' },
    { regex: /\[([^\]]+)\]\(\/([^)]+)\)/g, type: 'link' },
    { regex: /(?:ask me to|say)\s+"([^"]+)"/gi, type: 'suggestion' }
  ];

  // Extract action suggestions
  const actionMatches = message.match(/(?:you can|try|would you like to|want me to)\s+(\w+\s+\w+)/gi);
  if (actionMatches) {
    actionMatches.slice(0, 3).forEach(match => {
      const action = match.replace(/^(you can|try|would you like to|want me to)\s+/i, '').trim();
      if (action.length > 3 && action.length < 30) {
        actions.push({ label: action, type: 'action' });
      }
    });
  }

  // Extract quoted suggestions
  const quoteMatches = message.match(/"([^"]{5,40})"/g);
  if (quoteMatches) {
    quoteMatches.slice(0, 2).forEach(match => {
      actions.push({ label: match.replace(/"/g, ''), type: 'suggestion' });
    });
  }

  return actions.slice(0, 4);
};

// Extract user goal/intent from message
const extractGoal = (message) => {
  const lower = message.toLowerCase();
  if (lower.includes('book') || lower.includes('schedule') || lower.includes('meeting')) return 'scheduling';
  if (lower.includes('available') || lower.includes('free') || lower.includes('busy')) return 'availability';
  if (lower.includes('link') || lower.includes('share') || lower.includes('url')) return 'links';
  if (lower.includes('team') || lower.includes('member')) return 'teams';
  if (lower.includes('cancel') || lower.includes('reschedule')) return 'modifications';
  if (lower.includes('rule') || lower.includes('block') || lower.includes('buffer')) return 'rules';
  if (lower.includes('template') || lower.includes('email')) return 'communications';
  if (lower.includes('stat') || lower.includes('analytic') || lower.includes('how many')) return 'analytics';
  return 'general';
};

// Get total queries made (for new user detection)
const getTotalQueries = () => {
  try {
    return parseInt(localStorage.getItem('aiChat_totalQueries') || '0');
  } catch {
    return 0;
  }
};

const incrementQueryCount = () => {
  try {
    const count = getTotalQueries() + 1;
    localStorage.setItem('aiChat_totalQueries', count.toString());
    return count;
  } catch {
    return 0;
  }
};

// ============================================================================
// RESPONSE CARD COMPONENTS
// ============================================================================

const BookingSummaryCard = ({ data }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return {
      day: days[date.getDay()],
      date: date.getDate(),
      hasBooking: data?.bookings?.some(b => {
        const bookingDate = new Date(b.date || b.start_time);
        return bookingDate.toDateString() === date.toDateString();
      }),
      isToday: i === 0
    };
  });

  return (
    <div className="mt-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-5 w-5 text-blue-600" />
        <span className="font-semibold text-gray-800">Your Week at a Glance</span>
      </div>
      <div className="flex justify-between gap-1">
        {weekDays.map((d, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-xs text-gray-500">{d.day}</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mt-1 ${
              d.isToday
                ? 'bg-purple-600 text-white'
                : d.hasBooking
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600'
            }`}>
              {d.date}
            </div>
            {d.hasBooking && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1" />}
          </div>
        ))}
      </div>
      {data?.bookings?.length > 0 && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          {data.bookings.length} meeting{data.bookings.length > 1 ? 's' : ''} this week
        </p>
      )}
    </div>
  );
};

const AnalyticsCard = ({ data }) => {
  const stats = data?.stats || data || {};
  const items = [
    { label: 'Total Bookings', value: stats.total_bookings || stats.total || 0, icon: Calendar },
    { label: 'This Month', value: stats.this_month || stats.monthly || 0, icon: TrendingUp },
    { label: 'Completion Rate', value: `${stats.completion_rate || stats.rate || 95}%`, icon: CheckCircle },
    { label: 'Avg Duration', value: `${stats.avg_duration || 30}m`, icon: Clock }
  ];

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {items.map((item, i) => (
        <div key={i} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <item.icon className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500">{item.label}</span>
          </div>
          <p className="text-lg font-bold text-gray-800">{item.value}</p>
        </div>
      ))}
    </div>
  );
};

const MeetingListCard = ({ data }) => {
  const meetings = data?.bookings || data?.meetings || [];

  if (!meetings.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {meetings.slice(0, 4).map((meeting, i) => {
        const startTime = new Date(meeting.start_time || meeting.date || new Date());
        return (
          <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex flex-col items-center justify-center">
              <span className="text-xs text-purple-600 font-medium">
                {startTime.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className="text-lg font-bold text-purple-700">
                {startTime.getDate()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{meeting.title || 'Meeting'}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>{startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                {meeting.attendee_email && (
                  <>
                    <UserCircle className="h-3 w-3 ml-2" />
                    <span className="truncate">{meeting.attendee_email}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Calendar Preview Card - Shows week availability at a glance
const CalendarPreviewCard = ({ data }) => {
  const availability = data?.availability || [];

  if (!availability.length) return null;

  const getStatusColor = (day) => {
    if (day.isWeekend) return 'bg-gray-100 text-gray-400';
    if (day.bookingCount === 0) return 'bg-green-100 text-green-700 border-green-300';
    if (day.bookingCount >= 5) return 'bg-red-100 text-red-700 border-red-300';
    return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  };

  return (
    <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-5 w-5 text-blue-600" />
        <span className="font-semibold text-gray-800">Week Availability</span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {availability.map((day, i) => (
          <div key={i} className="text-center">
            <span className="text-xs text-gray-500 block mb-1">{day.dayName}</span>
            <div className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-sm font-medium border ${getStatusColor(day)}`}>
              {new Date(day.date).getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 text-xs text-gray-600 pt-2 border-t border-blue-200">
        <span className="flex items-center gap-1">✅ Free</span>
        <span className="flex items-center gap-1">🟡 Busy</span>
        <span className="flex items-center gap-1">🔴 Full</span>
      </div>

      {/* Available slots for today */}
      {data?.slots?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-xs font-medium text-gray-700 mb-2">Available slots:</p>
          <div className="flex flex-wrap gap-1">
            {data.slots.slice(0, 6).map((slot, i) => {
              const start = new Date(slot.start);
              return (
                <span key={i} className="text-xs px-2 py-1 bg-white rounded-full border border-gray-200">
                  {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              );
            })}
            {data.slots.length > 6 && (
              <span className="text-xs px-2 py-1 text-gray-500">+{data.slots.length - 6} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ResponseCard = ({ type, data }) => {
  switch (type) {
    case 'booking_summary':
    case 'week_view':
      return <BookingSummaryCard data={data} />;
    case 'analytics':
    case 'stats':
      return <AnalyticsCard data={data} />;
    case 'meeting_list':
    case 'bookings':
    case 'upcoming':
      return <MeetingListCard data={data} />;
    case 'availability':
    case 'calendar':
    case 'available':
    case 'no_slots':
      return <CalendarPreviewCard data={data} />;
    default:
      return null;
  }
};

// ============================================================================
// PROACTIVE NOTIFICATIONS COMPONENT
// ============================================================================

const ProactiveNotifications = ({ onSuggestion, onDismiss }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkNotifications = async () => {
      const notifs = [];

      // Check for new user
      if (getTotalQueries() < 3) {
        notifs.push({
          id: 'new_user',
          icon: Lightbulb,
          color: 'purple',
          title: 'Welcome!',
          message: 'I can help you book meetings, share links, and more.',
          action: 'Take a quick tour',
          query: 'Show me what you can do'
        });
      }

      // Check for no upcoming meetings
      const noMeetings = await hasNoUpcomingMeetings();
      if (noMeetings && getTotalQueries() >= 3) {
        notifs.push({
          id: 'no_meetings',
          icon: Calendar,
          color: 'blue',
          title: 'No upcoming meetings',
          message: 'Share your booking link to get booked!',
          action: 'Get sharing tips',
          query: 'How should I share my booking link?'
        });
      }

      // Check for frequent reschedules
      if (hasFrequentReschedules()) {
        notifs.push({
          id: 'reschedules',
          icon: RefreshCw,
          color: 'orange',
          title: 'Frequent reschedules?',
          message: 'Adding buffer time between meetings might help.',
          action: 'Create buffer rule',
          query: 'Create a rule to add 15 min buffer after meetings'
        });
      }

      setNotifications(notifs.slice(0, 2));
      setLoading(false);
    };

    checkNotifications();
  }, []);

  if (loading || notifications.length === 0) return null;

  const colorClasses = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green: 'bg-green-50 border-green-200 text-green-700'
  };

  return (
    <div className="space-y-2 mb-3">
      {notifications.map((notif) => (
        <div key={notif.id} className={`rounded-xl p-3 border ${colorClasses[notif.color]} relative`}>
          <button
            onClick={() => {
              setNotifications(prev => prev.filter(n => n.id !== notif.id));
              if (onDismiss) onDismiss(notif.id);
            }}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" />
          </button>
          <div className="flex items-start gap-3">
            <notif.icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">{notif.title}</p>
              <p className="text-xs opacity-80 mb-2">{notif.message}</p>
              <button
                onClick={() => onSuggestion(notif.query)}
                className="text-xs font-medium flex items-center gap-1 hover:underline"
              >
                {notif.action} <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// QUICK ACTIONS BAR COMPONENT
// ============================================================================

const QuickActionsBar = ({ actions, onAction }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => onAction(action.label)}
          className="text-xs px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full transition-colors flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" />
          {action.label}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AISchedulerChat() {
  console.log('AISchedulerChat component is rendering!');

  // Get current page location for context-aware suggestions
  const location = useLocation();

  // Use global UpgradeContext - this syncs with Dashboard
  const {
    currentTier,
    hasProFeature,
    hasTeamFeature,
    loading: tierLoading,
    refreshUsage,
    usage: globalUsage
  } = useUpgrade();

  // User name for personalized greeting
  const [userName, setUserName] = useState('');

  // Derive usage from global context (syncs with Dashboard automatically)
  const usage = {
    ai_queries_used: globalUsage?.ai_queries_used ?? 0,
    ai_queries_limit: globalUsage?.ai_queries_limit ?? 10,
    loading: tierLoading
  };

  const isUnlimited = (usage.ai_queries_limit ?? 0) >= 1000;

  // Timezone state
  const [currentTimezone, setCurrentTimezone] = useState('');

  // Response personality - stored in localStorage
  const [personality, setPersonality] = useState(() => {
    return localStorage.getItem('aiChat_personality') || 'friendly';
  });

  // Conversation context for memory
  const [conversationContext, setConversationContext] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('aiChat_context') || '{}');
    } catch {
      return { lastTopic: null, pendingActions: [], userGoals: [] };
    }
  });

  // Quick actions extracted from last response
  const [quickActions, setQuickActions] = useState([]);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');

  // Show proactive help
  const [showProactiveHelp, setShowProactiveHelp] = useState(true);

  const commonTimezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Manila', label: 'Manila (PHT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZDT)' },
  ];

  const getTimezoneLabel = (tz) => {
    const found = commonTimezones.find(t => t.value === tz);
    return found ? found.label : tz;
  };

  // ============================================================================
  // TIME-AWARE DYNAMIC SUGGESTIONS
  // ============================================================================

  const getTimeAwareSuggestions = () => {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const frequentActions = getFrequentActions();

    let timeSuggestions = [];

    // Morning (5-11): Focus on today's agenda
    if (hour >= 5 && hour < 12) {
      timeSuggestions = [
        { action: 'today', label: "Today's agenda", icon: Calendar, color: 'blue' },
        { action: 'upcoming', label: 'Next meeting', icon: Clock, color: 'green' }
      ];
    }
    // Afternoon (12-17): Productivity focus
    else if (hour >= 12 && hour < 17) {
      timeSuggestions = [
        { action: 'analytics', label: 'My stats', icon: BarChart3, color: 'purple' },
        { action: 'availability', label: 'My availability', icon: Clock, color: 'blue' }
      ];
    }
    // Evening (17-22): Planning focus
    else if (hour >= 17 && hour < 22) {
      timeSuggestions = [
        { action: 'tomorrow', label: "Tomorrow's schedule", icon: Calendar, color: 'blue' },
        { action: 'week', label: 'This week', icon: CalendarDays, color: 'green' }
      ];
    }
    // Night: Light suggestions
    else {
      timeSuggestions = [
        { action: 'link', label: 'My booking link', icon: Link, color: 'purple' }
      ];
    }

    // Friday: Add next week prep
    if (dayOfWeek === 5) {
      timeSuggestions.push({ action: 'next_week', label: 'Prep next week', icon: CalendarDays, color: 'orange' });
    }

    // Monday: Add weekly overview
    if (dayOfWeek === 1) {
      timeSuggestions.push({ action: 'week', label: 'Week overview', icon: TrendingUp, color: 'green' });
    }

    // Add frequent actions (but avoid duplicates with time suggestions)
    const existingActions = new Set(timeSuggestions.map(s => s.action));
    const frequentSuggestions = frequentActions
      .filter(action => !existingActions.has(action))
      .slice(0, 2)
      .map(action => {
        const actionMap = {
          'link': { label: 'Booking link', icon: Link, color: 'purple' },
          'upcoming': { label: 'Upcoming', icon: Calendar, color: 'blue' },
          'analytics': { label: 'Stats', icon: BarChart3, color: 'green' },
          'quick': { label: 'Quick link', icon: Zap, color: 'pink' },
          'teams': { label: 'Teams', icon: Users, color: 'orange' }
        };
        return actionMap[action] ? { action, ...actionMap[action] } : null;
      }).filter(Boolean);

    return [...timeSuggestions, ...frequentSuggestions].slice(0, 4);
  };

  // Page context-aware suggestions
  const getPageContextSuggestions = () => {
    const path = location.pathname;
    const timeAware = getTimeAwareSuggestions();

    if (path === '/dashboard' || path === '/') {
      // Filter out link-related items from timeAware to avoid duplicates
      const filteredTimeAware = timeAware.filter(s => !['link', 'quick'].includes(s.action)).slice(0, 2);
      return [
        { action: 'link', label: 'My Booking Link', icon: Link, color: 'purple' },
        ...(hasProFeature() ? [{ action: 'quick', label: 'Quick Link', icon: Zap, color: 'pink' }] : []),
        ...filteredTimeAware
      ].slice(0, 4);
    }

    if (path === '/bookings') {
      return [
        { action: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'blue' },
        { action: 'reschedule', label: 'Reschedule', icon: Clock, color: 'green' },
        { action: 'analytics', label: 'Stats', icon: FileText, color: 'purple' },
        { action: 'link', label: 'My link', icon: Link, color: 'pink' }
      ];
    }

    if (path === '/links' || path === '/my-links' || path === '/quick-links') {
      return [
        { action: 'quick', label: 'New Quick Link', icon: Zap, color: 'pink' },
        { action: 'link', label: 'My Booking Link', icon: Link, color: 'purple' },
        { action: 'list_quick_links', label: 'List Links', icon: FileText, color: 'blue' },
        { action: 'share', label: 'Share tips', icon: Send, color: 'green' }
      ];
    }

    if (path === '/event-types') {
      return [
        { action: 'event_types', label: 'List events', icon: Calendar, color: 'blue' },
        { action: 'create_event', label: 'Create new', icon: Sparkles, color: 'purple' },
        { action: 'link', label: 'My link', icon: Link, color: 'green' }
      ];
    }

    if (path === '/schedule' || path === '/calendar') {
      return [
        { action: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'blue' },
        { action: 'book', label: 'Book meeting', icon: Calendar, color: 'green' },
        { action: 'availability', label: 'My availability', icon: Clock, color: 'purple' }
      ];
    }

    if (path === '/settings') {
      return [
        { action: 'timezone', label: 'Timezone', icon: Globe, color: 'green' },
        { action: 'availability', label: 'Availability', icon: Clock, color: 'blue' },
        { action: 'link', label: 'Booking Link', icon: Link, color: 'purple' }
      ];
    }

    if (path === '/rules' || path === '/smart-rules') {
      return [
        { action: 'list_rules', label: 'My rules', icon: FileText, color: 'blue' },
        { action: 'create_rule', label: 'Create rule', icon: Sparkles, color: 'purple' },
        { action: 'block_friday', label: 'Block Friday', icon: Calendar, color: 'pink' },
        { action: 'add_buffer', label: 'Add buffer', icon: Clock, color: 'green' }
      ];
    }

    if (path === '/templates') {
      return [
        { action: 'list_templates', label: 'My templates', icon: Mail, color: 'blue' },
        { action: 'create_template', label: 'Create template', icon: Sparkles, color: 'purple' },
        { action: 'link', label: 'My link', icon: Link, color: 'green' }
      ];
    }

    if (path === '/email-analyzer') {
      return [
        { action: 'email_help', label: 'How it works', icon: Mail, color: 'blue' },
        { action: 'link', label: 'My booking link', icon: Link, color: 'purple' }
      ];
    }

    if (path === '/teams' || path.startsWith('/team')) {
      return [
        { action: 'teams', label: 'Team Links', icon: Users, color: 'orange' },
        { action: 'team_stats', label: 'Team stats', icon: FileText, color: 'blue' },
        { action: 'team_help', label: 'Team features', icon: Sparkles, color: 'purple' }
      ];
    }

    if (path === '/billing') {
      return [
        { action: 'plan_info', label: 'Compare plans', icon: FileText, color: 'purple' },
        { action: 'link', label: 'Booking Link', icon: Link, color: 'blue' }
      ];
    }

    // Default: Use time-aware suggestions
    return [
      ...timeAware.slice(0, 2),
      { action: 'link', label: 'My link', icon: Link, color: 'purple' },
      { action: 'analytics', label: 'Stats', icon: FileText, color: 'green' }
    ].slice(0, 4);
  };

  const getPageName = (path) => {
    if (path.includes('/dashboard') || path === '/') return 'Dashboard';
    if (path.includes('/bookings')) return 'Bookings';
    if (path.includes('/event-types')) return 'Event Types';
    if (path.includes('/teams')) return 'Teams';
    if (path.includes('/rules') || path.includes('/smart-rules')) return 'Smart Rules';
    if (path.includes('/my-links') || path.includes('/links')) return 'Booking Links';
    if (path.includes('/templates')) return 'Templates';
    if (path.includes('/settings')) return 'Settings';
    if (path.includes('/billing')) return 'Billing';
    if (path.includes('/email-analyzer')) return 'Email Analyzer';
    return null;
  };

  // ============================================================================
  // PERSONALITY-AWARE GREETINGS
  // ============================================================================

  const getGreetingMessage = (name = '') => {
    const hour = new Date().getHours();
    let timeGreeting = "Hi";
    if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
    else if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    else if (hour >= 17 && hour < 22) timeGreeting = "Good evening";

    const firstName = name ? name.split(' ')[0] : '';
    const greeting = firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;

    const pageName = getPageName(location.pathname);
    let contextHint = '';
    if (pageName) {
      contextHint = `\n\nI see you're on the ${pageName} page. `;
    }

    // Personality-based greeting styles
    const greetings = {
      friendly: `${greeting}! I'm your scheduling assistant.${contextHint}\n\nI can help you book meetings, share your links, check your schedule, and more.\n\nWhat would you like to do?`,
      professional: `${greeting}. I'm here to assist with your scheduling needs.${contextHint}\n\nI can help with meeting bookings, link management, and schedule inquiries.\n\nHow may I assist you?`,
      concise: `${greeting}!${contextHint}\n\nReady to help with bookings, links, or schedules. What do you need?`
    };

    return greetings[personality] || greetings.friendly;
  };

  const createGreeting = (name = '') => ({
    role: 'assistant',
    content: getGreetingMessage(name || userName),
    timestamp: new Date(),
    isGreeting: true
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [showTimezoneSelector, setShowTimezoneSelector] = useState(false);

  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('aiChat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          const mappedHistory = parsed.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));

          const hasGreeting = mappedHistory.some(msg =>
            msg.isGreeting ||
            (msg.role === 'assistant' && msg.content.includes("scheduling assistant"))
          );

          if (hasGreeting) {
            return mappedHistory;
          }
        }
      }
    } catch (e) {
      console.error('Error loading chat history:', e);
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(() => {
    const saved = localStorage.getItem('aiChat_pendingBooking');
    return saved ? JSON.parse(saved) : null;
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ============================================================================
  // RESPONSE STREAMING
  // ============================================================================

  const streamResponse = useCallback(async (fullText, onComplete) => {
    setIsStreaming(true);
    setStreamedText('');

    const words = fullText.split(' ');
    let currentText = '';

    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? ' ' : '') + words[i];
      setStreamedText(currentText);
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    setIsStreaming(false);
    setStreamedText('');
    if (onComplete) onComplete(fullText);
  }, []);

  // ============================================================================
  // ENHANCED ERROR HANDLING
  // ============================================================================

  const handleError = (error) => {
    const status = error?.response?.status;

    if (status === 429) {
      return {
        message: "I'm getting a lot of requests right now! Please wait 10-15 seconds and try again.\n\nWhile you wait, you can:\n- Copy your booking link from the sidebar\n- Check your calendar directly\n- Browse your event types",
        suggestions: [
          { label: 'Copy booking link', action: 'link' },
          { label: 'View bookings page', action: 'navigate', path: '/bookings' }
        ]
      };
    }

    if (status === 500 || status === 502 || status === 503) {
      return {
        message: "Oops, something went wrong on my end. Let me try that again, or you could rephrase your question.\n\nHere are some things that usually work:\n- Be more specific about dates/times\n- Ask one thing at a time\n- Try a simpler request first",
        suggestions: [
          { label: 'Try again', action: 'retry' },
          { label: 'Show my bookings', action: 'upcoming' }
        ]
      };
    }

    if (status === 401 || status === 403) {
      return {
        message: "It looks like your session may have expired. Please refresh the page to continue.",
        suggestions: [
          { label: 'Refresh page', action: 'refresh' }
        ]
      };
    }

    return {
      message: "Hmm, something went wrong. Mind trying that again?",
      suggestions: []
    };
  };

  // ============================================================================
  // ENHANCED CONTEXT PAYLOAD BUILDER
  // ============================================================================

  const buildContextPayload = () => {
    try {
      return {
        personality,
        timezone: currentTimezone,
        tier: currentTier,
        recentPages: getRecentPages(),
        frequentActions: getFrequentActions(),
        lastTopic: conversationContext?.lastTopic || '',
        pendingActions: conversationContext?.pendingActions || [],
        userGoals: conversationContext?.userGoals || [],
        queryCount: getTotalQueries(),
        currentPage: location?.pathname || '/'
      };
    } catch (error) {
      console.error('Error building context payload:', error);
      // Return same structure with safe defaults
      return {
        personality,
        timezone: currentTimezone,
        tier: currentTier,
        recentPages: [],
        frequentActions: [],
        lastTopic: '',
        pendingActions: [],
        userGoals: [],
        queryCount: 0,
        currentPage: location?.pathname || '/'
      };
    }
  };

  // ============================================================================
  // API AND DATA FETCHING
  // ============================================================================

  const fetchTimezone = async () => {
    try {
      const response = await api.timezone.get();
      let tz = '';
      if (typeof response.data === 'string') {
        try {
          const parsed = JSON.parse(response.data);
          tz = parsed.timezone || response.data;
        } catch {
          tz = response.data;
        }
      } else if (response.data && typeof response.data === 'object') {
        tz = response.data.timezone || '';
      }
      setCurrentTimezone(tz);
    } catch (error) {
      console.error('Failed to fetch timezone:', error);
    }
  };

  const fetchUserName = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data?.name) {
        setUserName(response.data.name);
        // Update greeting if chat just started
        if (chatHistory.length <= 1 && chatHistory[0]?.isGreeting) {
          const newGreeting = createGreeting(response.data.name);
          setChatHistory([newGreeting]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user name:', error);
    }
  };

  const handleTimezoneChange = async (newTimezone) => {
    setLoading(true);
    try {
      await api.timezone.update(newTimezone);
      setCurrentTimezone(newTimezone);
      setShowTimezoneSelector(false);

      const tzLabel = getTimezoneLabel(newTimezone);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `Done! Your timezone has been updated to **${tzLabel}** (${newTimezone}).\n\nAll your bookings and availability will now use this timezone.`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Failed to update timezone:', error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `Oops, I couldn't update your timezone. Please try again or go to Settings to change it manually.`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleQuickAction = (action) => {
    // Track the action for frequent actions
    trackAction(action);

    const actions = {
      'link': "What's my booking link?",
      'quick': 'Create a quick link',
      'new_quick_link': 'Create a quick link',
      'list_quick_links': 'Show my quick links',
      'upcoming': 'Show my upcoming meetings',
      'today': "What meetings do I have today?",
      'tomorrow': "What's on my schedule tomorrow?",
      'week': "Show my schedule for this week",
      'next_week': "What's coming up next week?",
      'timezone': 'Change my timezone',
      'teams': 'Show my team links',
      'share': 'How should I share my booking link?',
      'book': 'Help me book a meeting',
      'availability': "What's my availability this week?",
      'check_free': 'Am I free tomorrow at 2pm?',
      'cancel': 'Cancel a meeting',
      'reschedule': 'Reschedule a meeting',
      'create_rule': 'Help me create a smart rule',
      'list_rules': 'Show my active rules',
      'block_friday': 'Create a rule: no meetings on Friday',
      'add_buffer': 'Create a rule: add 15 min buffer after meetings',
      'rules_help': 'How do smart rules work?',
      'email_help': 'How does the email analyzer work?',
      'team_help': 'What can I do with teams?',
      'team_stats': 'Show team booking distribution',
      'plan_info': 'Compare the different plans',
      'analytics': 'Show my booking stats',
      'event_types': 'What event types do I have?',
      'create_event': 'Help me create a new event type',
      'list_templates': 'Show my email templates',
      'create_template': 'Help me create a new email template',
      'find_meetings': 'Find meetings with someone'
    };
    setMessage(actions[action] || action);
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Track page visits
  useEffect(() => {
    trackPageVisit(location.pathname);
  }, [location.pathname]);

  // Save conversation context
  useEffect(() => {
    localStorage.setItem('aiChat_context', JSON.stringify(conversationContext));
  }, [conversationContext]);

  // Save personality preference
  useEffect(() => {
    localStorage.setItem('aiChat_personality', personality);
  }, [personality]);

  useEffect(() => {
    if (!tierLoading && chatHistory.length === 0) {
      const greeting = createGreeting();
      setChatHistory([greeting]);
      localStorage.setItem('aiChat_history', JSON.stringify([greeting]));
    }
  }, [tierLoading]);

  useEffect(() => {
    if (!tierLoading && chatHistory.length > 0) {
      const hasGreeting = chatHistory.some(msg => msg.isGreeting);
      if (!hasGreeting) {
        const greeting = createGreeting();
        setChatHistory(prev => [greeting, ...prev]);
      }
    }
  }, [currentTier, tierLoading]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('aiChat_history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  useEffect(() => {
    if (pendingBooking) {
      localStorage.setItem('aiChat_pendingBooking', JSON.stringify(pendingBooking));
    } else {
      localStorage.removeItem('aiChat_pendingBooking');
    }
  }, [pendingBooking]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, streamedText]);

  useEffect(() => {
    if (isOpen) {
      // Refresh global usage when chat opens
      if (refreshUsage) refreshUsage();
      fetchTimezone();
      fetchUserName();
      setShowProactiveHelp(true);
    }
  }, [isOpen]);

  // Listen for custom event to open the chat from Dashboard button
  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
    };

    window.addEventListener('openAIChat', handleOpenChat);

    return () => {
      window.removeEventListener('openAIChat', handleOpenChat);
    };
  }, []);

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  const parseTimezoneFromMessage = (msg) => {
    if (!msg || typeof msg !== 'string') return null;
    const lowerMsg = msg.toLowerCase();
    const timezonePatterns = [
      { pattern: /eastern|new york|est|edt/i, value: 'America/New_York' },
      { pattern: /central|chicago|cst|cdt/i, value: 'America/Chicago' },
      { pattern: /mountain|denver|mst|mdt/i, value: 'America/Denver' },
      { pattern: /pacific|los angeles|pst|pdt/i, value: 'America/Los_Angeles' },
      { pattern: /london|uk|gmt|bst/i, value: 'Europe/London' },
      { pattern: /paris|cet|cest|france/i, value: 'Europe/Paris' },
      { pattern: /singapore|sgt/i, value: 'Asia/Singapore' },
      { pattern: /tokyo|japan|jst/i, value: 'Asia/Tokyo' },
      { pattern: /shanghai|china|cst(?!.*central)/i, value: 'Asia/Shanghai' },
      { pattern: /manila|philippines|pht/i, value: 'Asia/Manila' },
      { pattern: /dubai|gst|uae/i, value: 'Asia/Dubai' },
      { pattern: /sydney|australia|aedt|aest/i, value: 'Australia/Sydney' },
      { pattern: /auckland|new zealand|nzdt|nzst/i, value: 'Pacific/Auckland' },
    ];

    for (const { pattern, value } of timezonePatterns) {
      if (pattern.test(lowerMsg)) return value;
    }
    return null;
  };

  const handleSend = async () => {
    try {
      // Add type checking for message
      if (!message || typeof message !== 'string' || !message.trim() || loading) return;

      if (!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `Looks like you've used all ${usage.ai_queries_limit} AI queries this month!\n\nUpgrade to Pro for unlimited queries – I'll be here whenever you need me!\n\n[Upgrade to Pro](/billing)`,
          timestamp: new Date()
        }]);
        return;
      }

      const userMessage = message.trim();
      const lowerMessage = userMessage.toLowerCase();

      // Update conversation context with user's goal
      try {
        const goal = extractGoal(userMessage);
        setConversationContext(prev => ({
          ...prev,
          lastTopic: goal,
          userGoals: [...new Set([...prev.userGoals, goal])].slice(-5)
        }));
        trackAction(goal);
      } catch (contextError) {
        console.error('Error updating context:', contextError);
        // Continue anyway
      }

      // Increment query count
      try {
        incrementQueryCount();
      } catch (countError) {
        console.error('Error incrementing query count:', countError);
      }

      // Hide proactive help after first message
      setShowProactiveHelp(false);

      // Check for timezone requests
      const isTimezoneRequest =
        lowerMessage.includes('timezone') ||
        lowerMessage.includes('time zone') ||
        lowerMessage.includes('change my time') ||
        lowerMessage.includes('set my time') ||
        lowerMessage.includes('update my time') ||
        lowerMessage === 'tz' ||
        lowerMessage.match(/^(my )?(current )?time\s*zone?$/i);

      if (isTimezoneRequest) {
        setMessage('');
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
        const parsedTimezone = parseTimezoneFromMessage(userMessage);

        if (parsedTimezone) {
          await handleTimezoneChange(parsedTimezone);
        } else {
          const currentTzLabel = getTimezoneLabel(currentTimezone);
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `Your current timezone is **${currentTzLabel}** (${currentTimezone || 'Not set'}).\n\nSelect your new timezone below:`,
            timestamp: new Date(),
            showTimezoneSelector: true
          }]);
          setShowTimezoneSelector(true);
        }
        return;
      }

      if (lowerMessage.includes('what') && (lowerMessage.includes('timezone') || lowerMessage.includes('time zone'))) {
        setMessage('');
        setChatHistory(prev => [...prev,
          { role: 'user', content: userMessage, timestamp: new Date() },
          { role: 'assistant', content: `Your current timezone is **${getTimezoneLabel(currentTimezone)}** (${currentTimezone || 'Not set'}).\n\nWant to change it? Just say "Change my timezone".`, timestamp: new Date() }
        ]);
        return;
      }

      // Check for team feature requests
      if (!hasTeamFeature() && (
        lowerMessage.includes('create a team') ||
        lowerMessage.includes('team scheduling') ||
        lowerMessage.includes('book with team') ||
        lowerMessage.includes('team booking link') ||
        lowerMessage.includes('round robin') ||
        lowerMessage.includes('collective booking')
      )) {
        setChatHistory(prev => [...prev,
          { role: 'user', content: userMessage, timestamp: new Date() },
          { role: 'assistant', content: `I'd love to help with team scheduling!\n\nThis is a Team plan feature ($25/month).\n\n[Check out the Team plan](/billing)`, timestamp: new Date() }
        ]);
        setMessage('');
        return;
      }

      // Check for pro feature requests
      if (!hasProFeature() && (lowerMessage.includes('send reminder') || lowerMessage.includes('send email') || lowerMessage.includes('email template'))) {
        setChatHistory(prev => [...prev,
          { role: 'user', content: userMessage, timestamp: new Date() },
          { role: 'assistant', content: `Great idea to send emails!\n\nEmail features are part of Pro ($15/month).\n\n[Upgrade to Pro](/billing)`, timestamp: new Date() }
        ]);
        setMessage('');
        return;
      }

      setMessage('');
      setChatHistory(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);

      setLoading(true);
      setIsTyping(true);

      let contextMessage = userMessage;
      if (pendingBooking) {
        contextMessage = `[Current pending booking: "${pendingBooking.title}" on ${pendingBooking.date} at ${pendingBooking.time} for ${pendingBooking.duration} minutes with ${pendingBooking.attendee_email}]\n\nUser says: ${userMessage}`;
      }

      // Build enhanced context payload
      const contextPayload = buildContextPayload();

      // Make API call with error handling
      let response, responseData;
      try {
        response = await api.ai.schedule(contextMessage, chatHistory, contextPayload);
        responseData = response?.data || {};
      } catch (apiError) {
        console.error('API call failed:', apiError);
        throw apiError; // Re-throw to be caught by outer catch
      }

      // Refresh global usage after AI query - updates both Dashboard and AI Chat
      try {
        if (refreshUsage) refreshUsage();
      } catch (refreshError) {
        console.error('Error refreshing usage:', refreshError);
        // Continue anyway
      }

      // Extract quick actions from response
      const aiMessage = responseData?.message || responseData?.response || '';
      try {
        const extractedActions = extractQuickActions(aiMessage);
        setQuickActions(extractedActions);
      } catch (actionError) {
        console.error('Error extracting actions:', actionError);
        // Continue anyway
      }

      // Detect response type for rich cards
      let responseType = responseData?.type;
      if (!responseType) {
        try {
          const lowerMessage = aiMessage.toLowerCase();
          if (lowerMessage.includes('booking') || lowerMessage.includes('meeting')) {
            if (Array.isArray(responseData?.data?.bookings) && responseData.data.bookings.length > 0) {
              responseType = 'meeting_list';
            }
          }
          if (lowerMessage.includes('stat') || lowerMessage.includes('total')) {
            if (responseData?.data?.stats) responseType = 'analytics';
          }
          // Detect availability responses
          if (lowerMessage.includes('availability') || lowerMessage.includes('available slots') ||
              lowerMessage.includes('week at a glance')) {
            if (responseData?.data?.availability || responseData?.data?.slots) responseType = 'availability';
          }
        } catch (typeError) {
          console.error('Error detecting response type:', typeError);
        }
      }

      if (responseData?.type === 'update_pending' && responseData?.data?.updatedBooking) {
        try {
          setPendingBooking(responseData.data.updatedBooking);
          setChatHistory(prev => [...prev, { role: 'assistant', content: responseData.message || '', timestamp: new Date(), data: responseData.data }]);
        } catch (updateError) {
          console.error('Error updating pending booking:', updateError);
        }
      } else if (responseData?.type === 'confirmation' && responseData?.data?.bookingData) {
        try {
          const bookingData = responseData.data.bookingData;
          setPendingBooking({
            title: bookingData?.title || 'Meeting',
            date: bookingData?.date,
            time: bookingData?.time,
            attendees: bookingData?.attendees || [bookingData?.attendee_email],
            attendee_email: bookingData?.attendee_email || bookingData?.attendees?.[0],
            duration: bookingData?.duration || 30,
            notes: bookingData?.notes || '',
            team_id: bookingData?.team_id || null,
            team_name: bookingData?.team_name || null
          });
          setChatHistory(prev => [...prev, { role: 'assistant', content: responseData.message || '', timestamp: new Date(), data: responseData.data }]);
        } catch (confirmError) {
          console.error('Error setting confirmation booking:', confirmError);
        }
      } else {
        const finalMessage = aiMessage || 'Got it! Let me know if you need anything else.';

        // Use streaming for longer responses
        if (finalMessage.length > 100) {
          setIsTyping(false);
          try {
            await streamResponse(finalMessage, (text) => {
              setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: text,
                timestamp: new Date(),
                data: responseData.data,
                responseType: responseType
              }]);
            });
          } catch (streamError) {
            console.error('Streaming error:', streamError);
            // Fallback to non-streaming
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: finalMessage,
              timestamp: new Date(),
              data: responseData.data,
              responseType: responseType
            }]);
          }
        } else {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: finalMessage,
            timestamp: new Date(),
            data: responseData.data,
            responseType: responseType
          }]);
        }
      }

    } catch (error) {
      console.error('AI chat error:', error);
      if (refreshUsage) {
        try {
          refreshUsage();
        } catch (e) {
          console.error('Error refreshing usage:', e);
        }
      }

      try {
        const errorInfo = handleError(error);
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: errorInfo.message,
          timestamp: new Date(),
          errorSuggestions: errorInfo.suggestions
        }]);
      } catch (e) {
        console.error('Error handling error:', e);
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: "Something went wrong. Please try again.",
          timestamp: new Date()
        }]);
      }
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  // Safe wrapper for handleSend to prevent page crashes from event handlers
  const safeHandleSend = async () => {
    try {
      await handleSend();
    } catch (error) {
      console.error('Critical error in handleSend:', error);
      setLoading(false);
      setIsTyping(false);
      // Show user-friendly error without crashing
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: "I encountered an error. Please try again or refresh the page.",
        timestamp: new Date()
      }]);
    }
  };

  const handleConfirmBooking = async () => {
    if (!pendingBooking) return;
    setLoading(true);
    try {
      const startDateTime = new Date(`${pendingBooking.date}T${pendingBooking.time}`);
      const endDateTime = new Date(startDateTime.getTime() + pendingBooking.duration * 60000);
      const allAttendees = pendingBooking.attendees || [pendingBooking.attendee_email];

      await api.post('/chatgpt/book-meeting', {
        title: pendingBooking.title || 'Meeting',
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        attendees: allAttendees,
        attendee_email: allAttendees[0],
        attendee_name: allAttendees[0].split('@')[0],
        notes: pendingBooking.notes || '',
        team_id: pendingBooking.team_id || null
      });

      const formattedDate = startDateTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const formattedTime = startDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `You're all set!\n\n**${pendingBooking.title || 'Meeting'}**\n${formattedDate} at ${formattedTime}\n${allAttendees.join(', ')}${pendingBooking.team_name ? `\n${pendingBooking.team_name}` : ''}\n\nI've sent calendar invites to everyone. Anything else?`,
        timestamp: new Date(),
        isConfirmation: true
      }]);
      setPendingBooking(null);
      if (refreshUsage) refreshUsage();
    } catch (error) {
      console.error('Booking error:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Oops, I couldn't create that booking. ${error.response?.data?.error || 'Want to try again?'}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = () => {
    setPendingBooking(null);
    setChatHistory(prev => [...prev, { role: 'assistant', content: "No problem, I've cancelled that. What else can I help with?", timestamp: new Date() }]);
  };

  const handleClearChat = () => {
    const newGreeting = createGreeting();
    setChatHistory([newGreeting]);
    setPendingBooking(null);
    setShowTimezoneSelector(false);
    setQuickActions([]);
    setConversationContext({ lastTopic: null, pendingActions: [], userGoals: [] });
    localStorage.removeItem('aiChat_pendingBooking');
    localStorage.removeItem('aiChat_context');
    setTimeout(() => localStorage.setItem('aiChat_history', JSON.stringify([newGreeting])), 100);
  };

  const handleDeleteMessage = (indexToDelete) => {
    const newHistory = chatHistory.filter((_, index) => index !== indexToDelete);
    if (newHistory.length === 0 || !newHistory.some(msg => msg.isGreeting)) {
      setChatHistory([createGreeting()]);
    } else {
      setChatHistory(newHistory);
    }
  };

  const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const renderMessage = (content) => content.replace(/\*\*/g, '');

  // ============================================================================
  // SUB-COMPONENTS
  // ============================================================================

  const LinkWithCopy = ({ url, label }) => (
    <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2 mt-2">
      <Link className="h-4 w-4 text-purple-600 flex-shrink-0" />
      <span className="text-xs text-purple-700 truncate flex-1 font-mono">{label || url}</span>
      <button onClick={(e) => { e.stopPropagation(); handleCopyLink(url); }} className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-all flex-shrink-0 ${copiedUrl === url ? 'bg-green-500 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
        {copiedUrl === url ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
      </button>
    </div>
  );

  const LinksGrid = ({ links, labelKey = 'name' }) => (
    <div className="space-y-2 mt-3">
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{link[labelKey] || link.title || link.name}</p>
            <p className="text-xs text-gray-500 font-mono truncate">{link.short_url || `/book/...`}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleCopyLink(link.url); }} className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded transition-all flex-shrink-0 ${copiedUrl === link.url ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {copiedUrl === link.url ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
          </button>
        </div>
      ))}
    </div>
  );

  const TimezoneSelector = () => (
    <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
        {commonTimezones.map((tz) => (
          <button key={tz.value} onClick={() => handleTimezoneChange(tz.value)} disabled={loading} className={`text-left text-xs p-2 rounded-lg border transition-colors ${currentTimezone === tz.value ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-white border-gray-200 hover:border-purple-300 hover:bg-purple-50'}`}>
            <div className="flex items-center gap-2">
              <Globe className="h-3 w-3 text-gray-500" />
              <span className="font-medium">{tz.label}</span>
            </div>
            <span className="text-gray-500 ml-5">{tz.value}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderMessageContent = (msg) => {
    const content = renderMessage(msg.content);
    const data = msg.data;

    // Render rich response cards based on type
    const richCard = msg.responseType ? <ResponseCard type={msg.responseType} data={data} /> : null;

    // Render error suggestions
    const errorSuggestions = msg.errorSuggestions?.length > 0 ? (
      <div className="flex flex-wrap gap-2 mt-3">
        {msg.errorSuggestions.map((sug, i) => (
          <button
            key={i}
            onClick={() => {
              if (sug.action === 'retry') handleSend();
              else if (sug.action === 'refresh') window.location.reload();
              else if (sug.action === 'navigate') window.location.href = sug.path;
              else handleQuickAction(sug.action);
            }}
            className="text-xs px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full transition-colors"
          >
            {sug.label}
          </button>
        ))}
      </div>
    ) : null;

    if (data?.url && data?.type) {
      const shortLabel = data.short_url || (data.type === 'magic' ? `/m/${data.token?.substring(0, 8)}...` : `/book/${data.token?.substring(0, 8) || '...'}...`);
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><LinkWithCopy url={data.url} label={shortLabel} />{richCard}{errorSuggestions}</>;
    }
    if (data?.teams?.length > 0 && data.teams[0]?.url) {
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><LinksGrid links={data.teams} labelKey="name" />{richCard}{errorSuggestions}</>;
    }
    if (data?.members?.length > 0 && data.members[0]?.url) {
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><LinksGrid links={data.members} labelKey="name" />{richCard}{errorSuggestions}</>;
    }
    if (data?.event_types?.length > 0 && data.event_types[0]?.booking_url) {
      const linksWithUrl = data.event_types.map(et => ({ ...et, url: et.booking_url, short_url: `/${data.username}/${et.slug}` }));
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><LinksGrid links={linksWithUrl} labelKey="title" />{richCard}{errorSuggestions}</>;
    }
    if (msg.showTimezoneSelector) {
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><TimezoneSelector />{errorSuggestions}</>;
    }
    return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p>{richCard}{errorSuggestions}</>;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[99999] group"
      >
        {/* Mobile: Icon only */}
        <div className="sm:hidden h-14 w-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all">
          <Sparkles className="h-7 w-7 text-white" />
        </div>

        {/* Desktop: Icon + Text */}
        <div className="hidden sm:flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-3 rounded-full shadow-2xl hover:shadow-purple-500/30 hover:scale-105 transition-all">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-left pr-2">
            <p className="font-bold text-sm">TruCal Assistant</p>
            <p className="text-xs text-purple-200">Ask me anything</p>
          </div>
        </div>

        {/* Notification dot */}
        <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[99998] w-full sm:w-auto">
      <div className={`w-full sm:w-96 bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border-2 sm:border-purple-200 overflow-hidden transition-all flex flex-col ${isMinimized ? 'h-16' : 'h-[80vh] sm:h-[600px]'} max-h-screen`}>

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">TruCal Assistant</h3>
              <p className="text-xs text-purple-200">{currentTier === 'free' ? 'Free' : currentTier === 'pro' ? 'Pro' : 'Team'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUnlimited && (
              <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
                <Zap className="h-3 w-3 text-yellow-300" />
                <span className="text-xs text-white font-medium">Unlimited</span>
              </div>
            )}
            <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              {isMinimized ? <Maximize2 className="h-4 w-4 text-white" /> : <Minus className="h-4 w-4 text-white" />}
            </button>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50">
              {!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit && (
                <div className="rounded-lg p-4 mb-4 bg-purple-50 border border-purple-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-purple-100">
                      <Zap className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold mb-2 text-purple-800 text-sm">
                        Upgrade for unlimited AI
                      </p>
                      <button onClick={() => window.location.href = '/billing'} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4 rounded-lg font-semibold text-sm">Get Pro – $15/mo</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Proactive Notifications */}
              {showProactiveHelp && chatHistory.length <= 1 && (isUnlimited || usage.ai_queries_used < usage.ai_queries_limit) && (
                <ProactiveNotifications
                  onSuggestion={(query) => {
                    setMessage(query);
                    setShowProactiveHelp(false);
                  }}
                  onDismiss={() => setShowProactiveHelp(false)}
                />
              )}

              {chatHistory.length <= 1 && (isUnlimited || usage.ai_queries_used < usage.ai_queries_limit) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {getPageContextSuggestions().slice(0, 4).map((suggestion, index) => {
                    const IconComponent = suggestion.icon;
                    const colorClasses = {
                      purple: 'text-purple-600',
                      blue: 'text-blue-600',
                      green: 'text-green-600',
                      pink: 'text-pink-600',
                      orange: 'text-orange-600'
                    };
                    return (
                      <button
                        key={index}
                        onClick={() => handleQuickAction(suggestion.action)}
                        className="flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                      >
                        <IconComponent className={`h-4 w-4 ${colorClasses[suggestion.color] || 'text-purple-600'}`} />
                        <span className="text-sm font-medium">{suggestion.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {chatHistory.length > 2 && (
                <div className="flex justify-center mb-4 gap-2 p-2 bg-gray-100 rounded-lg">
                  <button onClick={handleClearChat} className="text-xs text-red-600 bg-red-50 hover:bg-red-100 flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200"><Trash2 className="h-3 w-3" /> Clear</button>
                  <button onClick={handleClearChat} className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center gap-1 px-3 py-2 rounded-lg border border-blue-200"><RotateCcw className="h-3 w-3" /> Start Over</button>
                </div>
              )}

              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 relative ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-md' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'}`}>
                    {msg.role === 'user' ? <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{renderMessage(msg.content)}</p> : renderMessageContent(msg)}
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>{formatTime(msg.timestamp)}</p>
                    {i > 0 && !msg.isGreeting && (
                      <button onClick={() => handleDeleteMessage(i)} className={`absolute -top-2 -right-2 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs ${msg.role === 'user' ? 'bg-red-500 text-white' : 'bg-gray-400 hover:bg-red-500 text-white'}`}>×</button>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming text display */}
              {isStreaming && streamedText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm">
                    <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{streamedText}<span className="animate-pulse">|</span></p>
                  </div>
                </div>
              )}

              {(loading || isTyping) && !isStreaming && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-gray-500 ml-1">Typing...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Bar */}
            {quickActions.length > 0 && !loading && (
              <div className="px-3 sm:px-4 py-2 bg-gray-50 border-t border-gray-100">
                <QuickActionsBar
                  actions={quickActions}
                  onAction={(label) => setMessage(label)}
                />
              </div>
            )}

            {/* Pending Booking */}
            {pendingBooking && (
              <div className="p-3 sm:p-4 bg-purple-50 border-t border-purple-200">
                <div className="bg-white rounded-xl p-3 sm:p-4 border-2 border-purple-300 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800 text-sm sm:text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-purple-600" />Ready to book?</h4>
                    <button onClick={() => setPendingBooking(null)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-3 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <input type="text" value={pendingBooking.title} onChange={(e) => setPendingBooking({...pendingBooking, title: e.target.value})} className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm" placeholder="Meeting title" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <input type="date" value={pendingBooking.date} onChange={(e) => setPendingBooking({...pendingBooking, date: e.target.value})} className="bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm" />
                      <input type="time" value={pendingBooking.time} onChange={(e) => setPendingBooking({...pendingBooking, time: e.target.value})} className="bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2"><Mail className="h-4 w-4 text-gray-400" /><span className="text-sm font-medium">Attendees</span></div>
                      <div className="space-y-2 pl-6">
                        {(pendingBooking.attendees || [pendingBooking.attendee_email]).map((email, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input type="email" value={email} onChange={(e) => { const newAttendees = [...(pendingBooking.attendees || [pendingBooking.attendee_email])]; newAttendees[index] = e.target.value; setPendingBooking({...pendingBooking, attendees: newAttendees, attendee_email: newAttendees[0]}); }} className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm" placeholder="email@example.com" />
                            {pendingBooking.attendees?.length > 1 && <button onClick={() => { const newAttendees = (pendingBooking.attendees || []).filter((_, i) => i !== index); setPendingBooking({...pendingBooking, attendees: newAttendees, attendee_email: newAttendees[0]}); }} className="text-red-500 p-1"><X className="h-4 w-4" /></button>}
                          </div>
                        ))}
                        <button onClick={() => setPendingBooking({...pendingBooking, attendees: [...(pendingBooking.attendees || [pendingBooking.attendee_email]), '']})} className="text-purple-600 text-sm">+ Add someone</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <select value={pendingBooking.duration} onChange={(e) => setPendingBooking({...pendingBooking, duration: parseInt(e.target.value)})} className="bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm">
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleConfirmBooking} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" /> Book it!</>}</button>
                    <button onClick={handleCancelBooking} disabled={loading} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"><XCircle className="h-4 w-4" /> Never mind</button>
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!loading && message && typeof message === 'string' && message.trim() && (isUnlimited || usage?.ai_queries_used < usage?.ai_queries_limit)) {
                        safeHandleSend();
                      }
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  disabled={loading || (!isUnlimited && usage?.ai_queries_used >= usage?.ai_queries_limit)}
                />
                <button
                  onClick={safeHandleSend}
                  disabled={loading || !message || typeof message !== 'string' || !message.trim() || (!isUnlimited && usage?.ai_queries_used >= usage?.ai_queries_limit)}
                  className="p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl transition-colors"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
