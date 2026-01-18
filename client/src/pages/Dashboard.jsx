import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Globe,
  Loader2,
  Bot,
  Settings,
  Star,
  Plus,
  Copy,
  BarChart3,
  Sparkles,
  Share2,
  Check,
  Video,
  AlertTriangle,
  X,
} from 'lucide-react';

import api, {
  auth,
  timezone as timezoneApi,
  chatgptIntegration,
} from '../utils/api';
// import PreferencesInsights from '../components/PreferencesInsights'; // UNUSED
// import RescheduleSuggestions from '../components/RescheduleSuggestions'; // UNUSED
import ActionItemsWidget from '../components/ActionItemsWidget';
import GroupScheduler from '../components/GroupScheduler';
import SmartSuggestions from '../components/SmartSuggestions';
import DashboardIntelligence from '../components/DashboardIntelligence';
import { useNotification } from '../contexts/NotificationContext';
// import SubscriptionUpgradeModal from '../components/SubscriptionUpgradeModal'; // UNUSED
// import { useWalkthrough } from '../context/WalkthroughContext'; // UNUSED
// import { WalkthroughPrompt } from '../components/Walkthrough'; // UNUSED
// import UpgradeCard from '../components/UpgradeCard'; // UNUSED

export default function Dashboard() {
  const navigate = useNavigate();
  const notify = useNotification();
  // const { showPrompt, startWalkthrough, dismissPrompt } = useWalkthrough(); // UNUSED

  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    activeTeams: 0,
    todayBookings: 0,
    weeklyBookings: 0,
    confirmationRate: 95,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [upcomingWeek, setUpcomingWeek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('');
  const [user, setUser] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const [limitStatus, setLimitStatus] = useState({
    tier: 'free',
    current_bookings: 0,
    limits: { soft: 50, grace: 60, hard: 70 },
    status: { withinLimit: true },
    upgrade_recommended: false
  });

  const [chatgptConfigured, setChatgptConfigured] = useState(false);
  const [bookingFilter, setBookingFilter] = useState('upcoming');
  const [conflicts, setConflicts] = useState({ hasConflicts: false, count: 0, conflicts: [] });
  const [showConflictBanner, setShowConflictBanner] = useState(true);
  const [showGroupScheduler, setShowGroupScheduler] = useState(false);

  useEffect(() => {
    console.log('[Dashboard] Component mounted, starting to load data...');
    loadAllData();
  }, []);

  const loadAllData = async () => {
    console.log('[Dashboard] loadAllData started, setting loading=true');
    setLoading(true);
    try {
      console.log('[Dashboard] Starting Promise.all with 7 API calls...');
      await Promise.all([
        loadDashboardData().catch(err => console.error('[Dashboard] ❌ Dashboard data failed:', err)),
        loadEventTypes().catch(err => console.error('[Dashboard] ❌ Event types failed:', err)),
        loadUserTimezone().catch(err => console.error('[Dashboard] ❌ Timezone failed:', err)),
        loadUserProfile().catch(err => console.error('[Dashboard] ❌ Profile failed:', err)),
        loadLimitStatus().catch(err => console.error('[Dashboard] ❌ Limits failed:', err)),
        checkChatGptStatus().catch(err => console.error('[Dashboard] ❌ ChatGPT status failed:', err)),
        loadConflicts().catch(err => console.error('[Dashboard] ❌ Conflicts failed:', err)),
      ]);
      console.log('[Dashboard] ✅ All API calls completed');
    } catch (error) {
      console.error('[Dashboard] ❌ Fatal error loading dashboard:', error);
    } finally {
      console.log('[Dashboard] Setting loading=false, should render content now');
      setLoading(false);
    }
  };

  const loadConflicts = async () => {
    try {
      const response = await api.get('/conflicts/upcoming');
      setConflicts(response.data);
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    }
  };

  const loadDashboardData = async () => {
    console.log('[Dashboard] 📊 Loading dashboard stats...');
    try {
      const response = await api.get('/dashboard/stats');
      console.log('[Dashboard] ✅ Dashboard stats loaded:', response.data);
      const data = response.data;
      setStats({
        totalBookings: data.stats?.totalBookings || 0,
        upcomingBookings: data.stats?.upcomingBookings || 0,
        activeTeams: data.stats?.activeTeams || 0,
        todayBookings: data.stats?.todayBookings || data.stats?.totalBookings || 0,
        weeklyBookings: data.stats?.weeklyBookings || data.stats?.totalBookings || 0,
        confirmationRate: data.stats?.confirmationRate || 95,
      });
      setRecentBookings(data.recentBookings || []);
      
      // Calculate this week's calendar
      const today = new Date();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const week = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - today.getDay() + i);

        week.push({
          day: days[i],
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: 0,
          isToday: date.toDateString() === today.toDateString(),
          dayOfWeek: i // 0=Sun, 6=Sat
        });
      }

      // Count bookings per day
      (data.recentBookings || []).forEach(booking => {
        const bookingDate = new Date(booking.start_time);
        const dayIndex = bookingDate.getDay();
        if (week[dayIndex] && bookingDate >= new Date(today.setHours(0,0,0,0))) {
          week[dayIndex].count++;
        }
      });

      // Filter to Mon-Fri by default, show weekends only if they have bookings
      const filteredWeek = week.filter(day => {
        const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
        if (isWeekend) {
          return day.count > 0; // Show weekends only if there are bookings
        }
        return true; // Always show Mon-Fri
      });

      setUpcomingWeek(filteredWeek);
    } catch (error) {
      console.error('Dashboard load error:', error);
      notify.error('Failed to load dashboard data');
    }
  };

  const loadEventTypes = async () => {
    try {
      const response = await api.eventTypes.getAll();
      const types = response.data.eventTypes || response.data || [];
      setEventTypes(types.slice(0, 5));
    } catch (error) {
      console.error('Event types load error:', error);
      setEventTypes([]);
    }
  };

  const loadUserTimezone = async () => {
    try {
      const response = await timezoneApi.get();
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
      
      setTimezone(tz);
    } catch (error) {
      console.error('Timezone load error:', error);
      setTimezone('America/Los_Angeles');
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await auth.me();
      const u = response.data.user || null;
      setUser(u);
      
      const usageResponse = await api.user.usage();
      setUser(prevUser => ({
        ...prevUser,
        usage: {
          ai_queries_used: usageResponse.data.ai_queries_used,
          ai_queries_limit: usageResponse.data.ai_queries_limit,
        }
      }));
      
    } catch (error) {
      console.error('Profile load error:', error);
      notify.error('Failed to load profile');
    }
  };

  const loadLimitStatus = async () => {
    try {
      const response = await api.user.limits();
      setLimitStatus(response.data);
    } catch (error) {
      console.error('Limit status load error:', error);
    }
  };

  const checkChatGptStatus = async () => {
    try {
      const response = await chatgptIntegration.getToken();
      setChatgptConfigured(!!response.data.jwt_token);
    } catch (error) {
      setChatgptConfigured(false);
    }
  };

  const handleShareCalendar = () => {
    if (!user?.username) {
      notify.error('Please set your username in Settings first');
      navigate('/settings');
      return;
    }
    const link = `${window.location.origin}/${user.username}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    notify.success('Booking link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getTimezoneName = (tz) => {
    const timezoneNames = {
      'America/New_York': 'Eastern Time (ET)',
      'America/Chicago': 'Central Time (CT)',
      'America/Denver': 'Mountain Time (MT)',
      'America/Los_Angeles': 'Pacific Time (PT)',
      'Europe/London': 'London (GMT)',
      'Europe/Paris': 'Paris (CET)',
      'Asia/Singapore': 'Singapore (SGT)',
      'Asia/Tokyo': 'Tokyo (JST)',
      'Asia/Shanghai': 'Shanghai (CST)',
      'Asia/Manila': 'Manila (PHT)',
      'Australia/Sydney': 'Sydney (AEDT)',
    };
    return timezoneNames[tz] || tz || 'Not set';
  };

  const getStatusIcon = (status) => {
    const icons = {
      confirmed: <CheckCircle2 className="h-4 w-4" />,
      pending: <AlertCircle className="h-4 w-4" />,
      cancelled: <XCircle className="h-4 w-4" />,
    };
    return icons[status] || icons.confirmed;
  };

  const getStatusColor = (status) => {
    const colors = {
      confirmed: 'bg-green-100 text-green-700 border-green-200',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || colors.confirmed;
  };

  const colorMap = {
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    pink: 'bg-pink-500',
    orange: 'bg-orange-500',
  };

  const getEventColor = (index) => {
    const colors = ['purple', 'blue', 'green', 'pink', 'orange'];
    return colors[index % colors.length];
  };

  const LimitWarningBanner = () => {
    const { current_bookings, limits, status, tier } = limitStatus;
    
    if (tier !== 'free' || status.withinLimit) return null;

    if (status.overGraceLimit || status.hardBlocked) {
      return (
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 rounded-xl mb-6 border-2 border-red-400 animate-pulse">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">⛔ Account Limited</h3>
              <p className="text-red-100">
                You've exceeded your booking limit. New bookings are blocked.
              </p>
            </div>
            <button 
              onClick={() => navigate('/billing')}
              className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      );
    }

    if (status.inGracePeriod) {
      return (
        <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white p-4 rounded-xl mb-6 border-2 border-orange-400">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">⚠️ Over Booking Limit</h3>
              <p className="text-orange-100">
                Grace period active. {limits.grace - current_bookings} bookings remaining.
              </p>
            </div>
            <button 
              onClick={() => navigate('/billing')}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg font-bold"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const ConflictWarningBanner = () => {
    if (!conflicts.hasConflicts || !showConflictBanner) return null;

    const firstConflict = conflicts.conflicts[0];
    const firstConflictTime = new Date(firstConflict.booking1.startTime).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return (
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-4 rounded-xl mb-6 border-2 border-red-300 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">⚠️ Scheduling Conflicts Detected</h3>
              <p className="text-red-100 mb-2">
                You have {conflicts.count} double-booked time {conflicts.count === 1 ? 'slot' : 'slots'} in the next 7 days.
              </p>
              <div className="bg-white/10 rounded-lg p-3 mb-3">
                <p className="text-sm font-semibold mb-1">Next conflict: {firstConflictTime}</p>
                <p className="text-xs text-red-100">
                  "{firstConflict.booking1.title}" conflicts with "{firstConflict.booking2.title}"
                </p>
              </div>
              <button
                onClick={() => navigate('/bookings')}
                className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 transition-colors text-sm"
              >
                View & Resolve Conflicts
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowConflictBanner(false)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const currentTier = limitStatus?.tier || user?.subscription_tier || user?.tier || 'free';
  const usage = user?.usage || { ai_queries_used: 0, ai_queries_limit: 10 };

  console.log('[Dashboard] 🎨 Rendering dashboard. Loading:', loading, 'Stats:', stats, 'User:', user?.name);

  // EMERGENCY: If still loading, show loading screen
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // STEP 1: Add back basic UI structure (header, layout, animated blobs)
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg relative z-10">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-xl">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm">
                  Welcome back{user?.name ? `, ${user.name}` : ''}!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const event = new CustomEvent('openAIChat');
                  window.dispatchEvent(event);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-2xl hover:shadow-purple-200/50 transition-all font-semibold flex items-center gap-2 hover:-translate-y-0.5"
              >
                <Bot className="h-4 w-4" />
                TruCal Assistant
              </button>

              <button
                onClick={() => navigate('/availability')}
                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-2xl hover:shadow-green-200/50 transition-all font-semibold flex items-center gap-2 hover:-translate-y-0.5"
              >
                <Clock className="h-4 w-4" />
                Availability
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full relative z-10">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">

          <div className="space-y-6">

            {/* STEP 3: Warning Banners */}
            <LimitWarningBanner />
            <ConflictWarningBanner />

            {/* Dashboard Intelligence */}
            <DashboardIntelligence />

            {/* STEP 2: Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={handleShareCalendar}
                className="flex items-center gap-4 p-5 bg-white/80 backdrop-blur-sm border-2 border-purple-200 rounded-2xl hover:border-purple-400 hover:shadow-xl hover:shadow-purple-100/50 transition-all text-left hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  {copiedLink ? <Check className="w-6 h-6 text-white" /> : <Share2 className="w-6 h-6 text-white" />}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-lg">{copiedLink ? 'Copied!' : 'Your Booking Page'}</div>
                  <div className="text-sm text-gray-600">Share with anyone</div>
                </div>
              </button>

              <button
                onClick={() => navigate('/my-links?mode=quick')}
                className="flex items-center gap-4 p-5 bg-white/80 backdrop-blur-sm border-2 border-amber-200 rounded-2xl hover:border-amber-400 hover:shadow-xl hover:shadow-amber-100/50 transition-all text-left hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-lg">Quick Link</div>
                  <div className="text-sm text-gray-600">Create instant booking link</div>
                </div>
              </button>

              <button
                onClick={() => setShowGroupScheduler(true)}
                className="flex items-center gap-4 p-5 bg-white/80 backdrop-blur-sm border-2 border-green-200 rounded-2xl hover:border-green-400 hover:shadow-xl hover:shadow-green-100/50 transition-all text-left hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-lg">Group Meeting</div>
                  <div className="text-sm text-gray-600">Schedule with multiple people</div>
                </div>
              </button>
            </div>

            {/* STEP 4: Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:shadow-blue-200/50 transition-all hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <Calendar className="h-8 w-8 opacity-80" />
                  <div className="text-3xl font-bold">{stats.todayBookings}</div>
                </div>
                <div className="text-blue-100 text-sm font-medium">Today's Bookings</div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:shadow-purple-200/50 transition-all hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <Clock className="h-8 w-8 opacity-80" />
                  <div className="text-3xl font-bold">{stats.upcomingBookings}</div>
                </div>
                <div className="text-purple-100 text-sm font-medium">Upcoming</div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:shadow-green-200/50 transition-all hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <CheckCircle2 className="h-8 w-8 opacity-80" />
                  <div className="text-3xl font-bold">{stats.totalBookings}</div>
                </div>
                <div className="text-green-100 text-sm font-medium">Total Bookings</div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:shadow-orange-200/50 transition-all hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <Globe className="h-8 w-8 opacity-80" />
                  <div className="text-3xl font-bold">{stats.activeTeams}</div>
                </div>
                <div className="text-orange-100 text-sm font-medium">Active Teams</div>
              </div>
            </div>

            {/* STEP 4: Event Types Section */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-bold text-gray-900">Event Types</h2>
                </div>
                <button
                  onClick={() => navigate('/events/new')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-200/50 transition-all hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  Create Event Type
                </button>
              </div>

              {eventTypes.length === 0 ? (
                <div className="text-center py-10">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No event types yet</p>
                  <button
                    onClick={() => navigate('/events/new')}
                    className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
                  >
                    Create Your First Event Type
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {eventTypes.slice(0, 4).map((event) => (
                    <div
                      key={event.id}
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="group p-5 bg-gradient-to-br from-white to-purple-50/30 border-2 border-gray-200 rounded-2xl hover:border-purple-400 hover:shadow-xl hover:shadow-purple-100/50 transition-all cursor-pointer hover:-translate-y-1"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-purple-600 transition-colors">
                            {event.title}
                          </h3>
                          {event.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">{event.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{event.duration} min</span>
                        </div>
                        {event.location_type && (
                          <div className="flex items-center gap-1">
                            {event.location_type === 'video' ? (
                              <Video className="w-4 h-4" />
                            ) : (
                              <Globe className="w-4 h-4" />
                            )}
                            <span className="capitalize">{event.location_type}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {eventTypes.length > 4 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => navigate('/event-types')}
                    className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1 mx-auto"
                  >
                    View all {eventTypes.length} event types
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* STEP 5: Bookings List (using correct variable: recentBookings) */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Your Bookings</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBookingFilter('upcoming')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      bookingFilter === 'upcoming'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Upcoming
                  </button>
                  <button
                    onClick={() => setBookingFilter('past')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      bookingFilter === 'past'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Past
                  </button>
                </div>
              </div>

              {(() => {
                if (!Array.isArray(recentBookings) || recentBookings.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No bookings yet</p>
                      <p className="text-sm text-gray-400 mt-1">Share your booking page to get started!</p>
                    </div>
                  );
                }

                const filteredBookings = recentBookings.filter((b) => {
                  if (!b || !b.start_time) return false;
                  try {
                    const isPast = new Date(b.start_time) < new Date();
                    return bookingFilter === 'past' ? isPast : !isPast;
                  } catch (e) {
                    return false;
                  }
                });

                if (filteredBookings.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">
                        {bookingFilter === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filteredBookings.slice(0, 5).map((booking) => {
                      if (!booking || !booking.id) return null;

                      return (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between p-5 rounded-2xl border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-100/50 transition-all cursor-pointer hover:-translate-y-1 bg-gradient-to-br from-white to-purple-50/20"
                          onClick={() => {
                            // Navigate to manage page if token exists, otherwise go to bookings list
                            if (booking.manage_token) {
                              navigate(`/manage/${booking.manage_token}`);
                            } else {
                              navigate('/bookings');
                            }
                          }}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              booking.status === 'confirmed' ? 'bg-green-100' :
                              booking.status === 'cancelled' ? 'bg-red-100' :
                              'bg-gray-100'
                            }`}>
                              {booking.status === 'confirmed' ? (
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                              ) : booking.status === 'cancelled' ? (
                                <XCircle className="w-6 h-6 text-red-600" />
                              ) : (
                                <AlertCircle className="w-6 h-6 text-gray-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900">{booking.title || 'Meeting'}</h3>
                              <p className="text-sm text-gray-600">{booking.attendee_name || booking.attendee_email || 'Unknown'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              {booking.start_time ? new Date(booking.start_time).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              }) : 'N/A'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {booking.start_time ? new Date(booking.start_time).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              }) : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {recentBookings.length > 5 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => navigate('/bookings')}
                    className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1 mx-auto"
                  >
                    View all bookings
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* STEP 6: Action Items Widget */}
            <ActionItemsWidget />

            {/* STEP 7: This Week's Schedule */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  This Week
                </h3>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {upcomingWeek.map((day, index) => (
                  <div
                    key={index}
                    className={`text-center p-4 rounded-xl border-2 transition-all ${
                      day.isToday
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : day.count > 0
                        ? 'border-blue-200 bg-blue-50 hover:border-blue-400'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className={`text-xs font-semibold uppercase mb-1 ${
                      day.isToday ? 'text-purple-600' : 'text-gray-600'
                    }`}>
                      {day.day}
                    </div>
                    <div className={`text-sm mb-2 ${
                      day.isToday ? 'text-purple-900 font-bold' : 'text-gray-700'
                    }`}>
                      {day.date}
                    </div>
                    <div className={`text-2xl font-bold ${
                      day.isToday
                        ? 'text-purple-600'
                        : day.count > 0
                        ? 'text-blue-600'
                        : 'text-gray-400'
                    }`}>
                      {day.count}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {day.count === 1 ? 'meeting' : 'meetings'}
                    </div>
                  </div>
                ))}
              </div>

              {upcomingWeek.every(day => day.count === 0) && (
                <div className="text-center py-4 mt-2">
                  <p className="text-gray-500 text-sm">No meetings scheduled this week</p>
                </div>
              )}
            </div>

            {/* STEP 8: Smart Suggestions */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
              <SmartSuggestions
                duration={30}
                timezone={timezone}
                onSelectSlot={(slot) => {
                  console.log('Selected smart suggestion:', slot);
                  notify.success(`Selected: ${new Date(slot.start).toLocaleString()}`);
                }}
              />
            </div>

          </div>
        </div>
      </main>

      {/* Group Scheduler Modal */}
      {showGroupScheduler && (
        <GroupScheduler
          onClose={() => setShowGroupScheduler(false)}
          onBookingCreated={(booking) => {
            setShowGroupScheduler(false);
            notify.success('Group meeting scheduled successfully!');
            loadAllData();
          }}
        />
      )}
    </div>
  );
}
