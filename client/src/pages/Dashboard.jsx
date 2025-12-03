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
} from 'lucide-react';

import api, {
  auth,
  timezone as timezoneApi,
  chatgptIntegration,
} from '../utils/api';
import AISchedulerChat from '../components/AISchedulerChat';
import { useNotification } from '../contexts/NotificationContext';
import UsageWidget from '../components/UsageWidget';
import TestWidget from '../components/TestWidget';


export default function Dashboard() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    activeTeams: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('');
  const [user, setUser] = useState(null);

  // Simple ChatGPT status check
  const [chatgptConfigured, setChatgptConfigured] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadUserTimezone(),
      loadUserProfile(),
      checkChatGptStatus(),
    ]);
    setLoading(false);
  };

  const loadDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data.stats || { totalBookings: 0, upcomingBookings: 0, activeTeams: 0 });
      setRecentBookings(response.data.recentBookings || []);
    } catch (error) {
      console.error('Dashboard load error:', error);
      notify.error('Failed to load dashboard data');
    }
  };

  const loadUserTimezone = async () => {
    try {
      const response = await timezoneApi.get();
      if (response.data.timezone) {
        setTimezone(response.data.timezone);
      }
    } catch (error) {
      console.error('Timezone load error:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await auth.me();
      const u = response.data.user || null;
      setUser(u);
    } catch (error) {
      console.error('Profile load error:', error);
      notify.error('Failed to load profile');
    }
  };

  // Simple check if ChatGPT is configured
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

  const statCards = [
    { label: 'Total Bookings', value: stats.totalBookings, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Upcoming', value: stats.upcomingBookings, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Active Teams', value: stats.activeTeams, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4">
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/availability')}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold flex items-center gap-2 shadow-sm"
              >
                <Clock className="h-4 w-4" />
                Manage Availability
              </button>

              {/* ChatGPT Status Indicator */}
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
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-6">
            
            {/* Usage Widget - NEW! */}
            <div className="mb-6">
              <UsageWidget />
            </div>

            {/* Timezone Display */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Your Timezone</h3>
                  <p className="text-sm text-gray-600">
                    {getTimezoneName(timezone)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:gap-2 transition-all"
              >
                Change
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((stat, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
                      <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                    <div className={`${stat.bg} h-14 w-14 rounded-xl flex items-center justify-center shadow-md`}>
                      <stat.icon className={`h-7 w-7 ${stat.color}`} />
                    </div>
                  </div>
                </div>
              ))}
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
        </div>
      </main>

      <AISchedulerChat />
    </div>
  );
}