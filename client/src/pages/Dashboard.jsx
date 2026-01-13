import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Globe,
  Loader2,
  Bot,
  Settings,
  TrendingUp,
  Zap,
  Mail,
  Star,
  CreditCard,
  Plus,
  Copy,
  ExternalLink,
  BarChart3,
  Sparkles,
  Share2,
  Video,
} from 'lucide-react';

import api, {
  auth,
  timezone as timezoneApi,
  chatgptIntegration,
} from '../utils/api';
import AISchedulerChat from '../components/AISchedulerChat';
import { useNotification } from '../contexts/NotificationContext';
import SubscriptionUpgradeModal from '../components/SubscriptionUpgradeModal';
import { useWalkthrough } from '../context/WalkthroughContext';
import { WalkthroughPrompt, WalkthroughButton } from '../components/Walkthrough';

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
  const [nextMeeting, setNextMeeting] = useState(null);
  const [bookingTrends, setBookingTrends] = useState([3, 5, 8, 12, 18, 15, 10]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('');
  const [user, setUser] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
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
          isToday: date.toDateString() === today.toDateString()
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
      
      setUpcomingWeek(week);
      
      // Get next meeting
      if (data.recentBookings && data.recentBookings.length > 0) {
        const upcoming = data.recentBookings
          .filter(b => new Date(b.start_time) > new Date() && b.status === 'confirmed')
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
        
        if (upcoming) {
          const minutesUntil = Math.ceil((new Date(upcoming.start_time) - new Date()) / (1000 * 60));
          setNextMeeting({
            title: `Meeting with ${upcoming.attendee_name}`,
            time: minutesUntil,
            link: upcoming.meeting_link || '#'
          });
        }
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      notify.error('Failed to load dashboard data');
    }
  };

 const loadEventTypes = async () => {
  try {
    const response = await api.eventTypes.getAll();
    const types = response.data.eventTypes || response.data || [];
    setEventTypes(types.slice(0, 5)); // Show top 5
  } catch (error) {
    console.error('Event types load error:', error);
    setEventTypes([]); // Set empty array on error
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
          chatgpt_used: usageResponse.data.ai_queries_used,
          chatgpt_limit: usageResponse.data.ai_queries_limit,
          chatgpt_queries_used: usageResponse.data.ai_queries_used,
          chatgpt_queries_limit: usageResponse.data.ai_queries_limit
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
      setLimitStatus(prev => ({
        ...prev,
        current_bookings: stats.totalBookings,
      }));
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
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
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
              <h3 className="font-bold text-lg flex items-center gap-2">
                ⛔ Account Limited - Immediate Action Required
              </h3>
              <p className="text-red-100">
                You've used {current_bookings}/{limits.grace} bookings and exceeded your grace period. 
                New bookings are blocked and AI scheduling is disabled.
              </p>
            </div>
            <button 
              onClick={() => navigate('/billing')}
              className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 transition-colors"
            >
              🚨 Upgrade Now
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
              <h3 className="font-bold text-lg flex items-center gap-2">
                ⚠️ Over Booking Limit - Grace Period Active
              </h3>
              <p className="text-orange-100">
                You've exceeded your {limits.soft} booking limit ({current_bookings}/{limits.grace}). 
                AI scheduling is now disabled. Only {limits.grace - current_bookings} bookings remaining before account suspension.
              </p>
            </div>
            <button 
              onClick={() => navigate('/billing')}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg font-bold hover:bg-orange-50 transition-colors"
            >
              ⚡ Upgrade to Pro
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
  const bookingCount = limitStatus?.current_bookings || stats.totalBookings;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
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
                  Welcome back{user?.name ? `, ${user.name}` : ''}! Here&apos;s what&apos;s happening today.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <WalkthroughButton onClick={startWalkthrough} />

              {/* AI Scheduler - MORE PROMINENT */}
              <button
                onClick={() => navigate('/ai-scheduler')}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
              >
                <Bot className="h-4 w-4" />
                AI Scheduler
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {usage.ai_queries_used}/{usage.ai_queries_limit}
                </span>
              </button>

              <button
                data-walkthrough="availability-btn"
                onClick={() => navigate('/availability')}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold flex items-center gap-2 shadow-sm"
              >
                <Clock className="h-4 w-4" />
                Availability
              </button>

              {chatgptConfigured ? (
                <button
                  onClick={() => navigate('/settings?tab=integrations')}
                  className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 transition-all text-sm font-medium flex items-center gap-2"
                >
                  <Bot className="h-4 w-4" />
                  ChatGPT ✓
                </button>
              ) : (
                <button
                  onClick={() => navigate('/settings?tab=integrations')}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all text-sm font-medium flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Setup ChatGPT
                </button>
              )}

              {(currentTier === 'pro' || currentTier === 'team') && (
                <button
                  onClick={() => navigate('/billing')}
                  className="px-3 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-all text-sm font-medium flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  {currentTier === 'pro' ? 'Pro' : 'Team'} ✓
                </button>
              )}
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

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-3 gap-6">
              
              {/* Left Column (2/3) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Event Types Grid - NEW */}
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
                      onClick={() => navigate('/events/new')}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      New Event
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
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
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
                                const link = `${window.location.origin}/${user?.username || 'user'}/${event.slug || event.id}`;
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

                      <div 
                        onClick={() => navigate('/events')}
                        className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer flex flex-col items-center justify-center text-center"
                      >
                        <ExternalLink className="w-6 h-6 text-gray-400 mb-2" />
                        <span className="text-sm font-medium text-gray-600">View All Event Types</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Analytics Preview - NEW */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-gray-600" />
                      <h2 className="text-lg font-bold text-gray-900">Booking Trends</h2>
                    </div>
                    <button 
                      onClick={() => navigate('/analytics')}
                      className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                      View Full Report
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-end justify-between h-32 gap-2 mb-6">
                    {bookingTrends.map((height, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                        <div 
                          className="w-full bg-gradient-to-t from-purple-600 to-pink-600 rounded-t-lg transition-all hover:opacity-80"
                          style={{ height: `${(height / Math.max(...bookingTrends)) * 100}%` }}
                        />
                        <span className="text-xs text-gray-500">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{eventTypes[0]?.name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">Most popular</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">2-3pm</div>
                      <div className="text-sm text-gray-500">Peak booking time</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">2.5h</div>
                      <div className="text-sm text-gray-500">Avg response time</div>
                    </div>
                  </div>
                </div>

                {/* Recent Bookings */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-gray-900">Recent Bookings</h3>
                      <button
                        onClick={() => navigate('/bookings')}
                        className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-1"
                      >
                        View All <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {recentBookings.length === 0 ? (
                      <div className="text-center py-10">
                        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No bookings yet</p>
                        <p className="text-gray-400 text-sm mt-1">Share your booking link to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentBookings.slice(0, 5).map((booking) => (
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
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column (1/3) - NEW */}
              <div className="space-y-6">
                
                {/* This Week Calendar - NEW */}
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

                {/* Next Meeting - NEW */}
                {nextMeeting && (
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-600">NEXT MEETING</span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">{nextMeeting.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">Starts in {nextMeeting.time} min</p>
                    <button 
                      onClick={() => window.open(nextMeeting.link, '_blank')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
                    >
                      <Video className="w-4 h-4" />
                      Join Now
                    </button>
                  </div>
                )}

                {/* Quick Actions - NEW */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Quick Actions
                  </h2>

                  <div className="space-y-3">
                    <button 
                      onClick={() => navigate('/magic-links/new')}
                      className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg hover:shadow-md transition-all text-left"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Single-Use Link</div>
                        <div className="text-xs text-gray-600">For VIP bookings</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => {
                        const link = `${window.location.origin}/${user?.username || 'user'}`;
                        navigator.clipboard.writeText(link);
                        notify.success('Calendar link copied!');
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-gray-50 border-2 border-gray-200 rounded-lg hover:shadow-md transition-all text-left"
                    >
                      <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                        <Share2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Share Calendar</div>
                        <div className="text-xs text-gray-600">Copy booking link</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => navigate('/ai-scheduler')}
                      className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg hover:shadow-md transition-all text-left"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">AI Schedule</div>
                        <div className="text-xs text-gray-600">Book with AI help</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Timezone - MOVED HERE */}
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3 mb-2">
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

              </div>

            </div>

            {/* Upgrade Card - Keep but move to bottom */}
            {currentTier === 'free' && !limitStatus.status?.inGracePeriod && !limitStatus.status?.overGraceLimit && eventTypes.length > 0 && (
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      🎯 Supercharge Your Scheduling
                    </h3>
                    <p className="text-purple-100 mb-4">
                      Unlimited AI assistance + unlimited bookings + advanced features for busy professionals
                    </p>
                    <ul className="text-sm text-purple-100 space-y-1 mb-4">
                      <li className="flex items-center gap-2">
                        <Zap className="h-3 w-3" />
                        ✨ Unlimited AI queries (vs {usage.ai_queries_limit || 10}/month)
                      </li>
                      <li className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        📅 Unlimited bookings (vs {limitStatus.limits?.soft || 50}/month)
                      </li>
                      <li className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        📧 Advanced email templates
                      </li>
                      <li className="flex items-center gap-2">
                        <Settings className="h-3 w-3" />
                        ⚡ Priority support
                      </li>
                    </ul>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">$12</div>
                    <div className="text-sm text-purple-200">per month</div>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/billing')}
                  className="w-full bg-white text-purple-600 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors mt-4"
                >
                  Upgrade to Pro - Only $12/month
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