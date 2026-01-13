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
  Mail,
  Video,
} from 'lucide-react';

import api, {
  auth,
  timezone as timezoneApi,
  chatgptIntegration,
} from '../utils/api';
import AISchedulerChat from '../components/AISchedulerChat';
import PreferencesInsights from '../components/PreferencesInsights';
import { useNotification } from '../contexts/NotificationContext';
import SubscriptionUpgradeModal from '../components/SubscriptionUpgradeModal';
import { useWalkthrough } from '../context/WalkthroughContext';
import { WalkthroughPrompt } from '../components/Walkthrough';

export default function Dashboard() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { showPrompt, startWalkthrough, dismissPrompt } = useWalkthrough();

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

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadEventTypes(),
      loadUserTimezone(),
      loadUserProfile(),
      loadLimitStatus(),
      checkChatGptStatus(),
    ]);
    setLoading(false);
  };

  const loadDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/stats');
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
    notify.success('Calendar link copied!');
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
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
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
              >
                <Bot className="h-4 w-4" />
                AI Scheduler
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {usage.ai_queries_limit >= 999999 || usage.ai_queries_limit === null ? '∞' : `${usage.ai_queries_used}/${usage.ai_queries_limit}`}
                </span>
              </button>

              <button
                onClick={() => navigate('/availability')}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold flex items-center gap-2 shadow-sm"
              >
                <Clock className="h-4 w-4" />
                Availability
              </button>
            </div>
          </div>
        </div>
      </header>
   
      <main className="w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-6">
            
            {showPrompt && (
              <WalkthroughPrompt 
                onStart={startWalkthrough} 
                onDismiss={dismissPrompt} 
              />
            )}
            
            <LimitWarningBanner />

            {/* QUICK ACTIONS - NOW AT TOP */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={handleShareCalendar}
                className="flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all text-left"
              >
                <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                  {copiedLink ? <Check className="w-6 h-6 text-white" /> : <Share2 className="w-6 h-6 text-white" />}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{copiedLink ? 'Copied!' : 'Share Calendar'}</div>
                  <div className="text-sm text-gray-500">Copy your booking link</div>
                </div>
              </button>

              <button 
                onClick={() => navigate('/my-links')}
                className="flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-amber-300 hover:shadow-md transition-all text-left"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">Quick Link</div>
                  <div className="text-sm text-gray-500">Create instant booking link</div>
                </div>
              </button>

              <button
                onClick={() => navigate('/events/new')}
                className="flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all text-left"
              >
                <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">New Event Type</div>
                  <div className="text-sm text-gray-500">Create a booking type</div>
                </div>
              </button>

              {currentTier !== 'free' && (
                <button
                  onClick={() => navigate('/templates')}
                  className="flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left"
                >
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Email Templates</div>
                    <div className="text-sm text-gray-500">Customize your emails</div>
                  </div>
                </button>
              )}
            </div>

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-3 gap-6">
              
              {/* Left Column (2/3) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Event Types Grid */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-600" />
                      <h2 className="text-lg font-bold text-gray-900">Event Types</h2>
                      <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                        {eventTypes.length}
                      </span>
                    </div>
                    <button 
                      onClick={() => navigate('/events')}
                      className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                      View All <ChevronRight className="w-4 h-4" />
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
                      {eventTypes.map((event, idx) => (
                        <div 
                          key={event.id}
                          className="group p-4 border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => navigate(`/events/${event.id}`)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${colorMap[getEventColor(idx)]}`} />
                              <div>
                                <h3 className="font-bold text-gray-900">{event.name}</h3>
                                <p className="text-sm text-gray-500">{event.duration} min</p>
                              </div>
                            </div>
                            <button 
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/events/${event.id}/edit`);
                              }}
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{event.booking_count || 0} bookings</span>
                            <button 
                              className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!user?.username) {
                                  notify.error('Please set your username in Settings');
                                  return;
                                }
                                const link = `${window.location.origin}/${user.username}/${event.slug || event.id}`;
                                navigator.clipboard.writeText(link);
                                notify.success('Link copied!');
                              }}
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* MERGED: Bookings Section (Stats + List) */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-gray-600" />
                      <h2 className="text-lg font-bold text-gray-900">Bookings</h2>
                    </div>
                    <button
                      onClick={() => navigate('/bookings')}
                      className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                      View All <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                      <div className="text-3xl font-bold text-gray-900">{stats.totalBookings}</div>
                      <div className="text-sm text-gray-500">Total</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                      <div className="text-3xl font-bold text-blue-600">{stats.upcomingBookings}</div>
                      <div className="text-sm text-gray-500">Upcoming</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-xl">
                      <div className="text-3xl font-bold text-green-600">{stats.confirmationRate}%</div>
                      <div className="text-sm text-gray-500">Confirmed</div>
                    </div>
                  </div>

                  {/* Bookings List */}
                  {recentBookings.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No bookings yet</p>
                      <p className="text-gray-400 text-sm mt-1">Share your booking link to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentBookings.slice(0, 3).map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 transition-all cursor-pointer"
                          onClick={() => navigate('/bookings')}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                              {booking.attendee_name?.charAt(0)?.toUpperCase() || 'G'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-gray-900 font-bold truncate">{booking.attendee_name}</p>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(booking.status)}`}>
                                  {getStatusIcon(booking.status)} {booking.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600 text-sm">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(booking.start_time).toLocaleDateString()}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span>{new Date(booking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                                {booking.meet_link && new Date(booking.start_time) > new Date() && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <a
                                      href={booking.meet_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                      <Video className="h-3 w-3" />
                                      Join
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {recentBookings.length > 3 && (
                        <button
                          onClick={() => navigate('/bookings')}
                          className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2"
                        >
                          View all {recentBookings.length} bookings →
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column (1/3) */}
              <div className="space-y-6">
                
                {/* This Week Calendar */}
                {upcomingWeek.length > 0 && (
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      This Week
                    </h2>

                    <div className="space-y-3">
                      {upcomingWeek.map((day, idx) => (
                        <div 
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            day.isToday 
                              ? 'bg-purple-50 border-2 border-purple-300' 
                              : 'bg-gray-50'
                          }`}
                        >
                          <div>
                            <div className={`font-semibold ${day.isToday ? 'text-purple-900' : 'text-gray-900'}`}>
                              {day.day}
                            </div>
                            <div className="text-xs text-gray-500">{day.date}</div>
                          </div>
                          <div className={`text-2xl font-bold ${day.isToday ? 'text-purple-600' : 'text-gray-600'}`}>
                            {day.count}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timezone */}
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Globe className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm">Your Timezone</h3>
                      <p className="text-xs text-gray-600">
                        {(() => {
                          let tz = timezone;
                          if (typeof tz === 'string' && tz.includes('{')) {
                            try {
                              const parsed = JSON.parse(tz);
                              tz = parsed.timezone;
                            } catch {}
                          } else if (tz && typeof tz === 'object' && tz.timezone) {
                            tz = tz.timezone;
                          }
                          return getTimezoneName(tz);
                        })()}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/settings')}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* AI Preferences Insights */}
                <PreferencesInsights />

              </div>

            </div>

            {/* Upgrade Card */}
            {currentTier === 'free' && !limitStatus.status?.inGracePeriod && !limitStatus.status?.overGraceLimit && eventTypes.length > 0 && (
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      Upgrade to Pro
                    </h3>
                    <p className="text-purple-100 mb-4">
                      Unlimited bookings, AI queries, and advanced features
                    </p>
                    <ul className="text-sm text-purple-100 space-y-1">
                      <li>✨ Unlimited AI queries</li>
                      <li>📅 Unlimited bookings</li>
                      <li>📧 Advanced email templates</li>
                    </ul>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">$12</div>
                    <div className="text-sm text-purple-200">/month</div>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/billing')}
                  className="w-full bg-white text-purple-600 py-3 rounded-lg font-semibold hover:bg-gray-100 mt-4"
                >
                  Upgrade Now
                </button>
              </div>
            )}

          </div>
        </div>
      </main>

      <SubscriptionUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={currentTier}
      />

      <AISchedulerChat />
    </div>
  );
}