import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpgrade } from '../context/UpgradeContext';
import {
  Calendar,
  Clock,
  Users,
  TrendingUp,
  MessageSquare,
  Link as LinkIcon,
  FileText,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Loader2,
  Globe,
  ChevronRight,
  Zap,
  Crown,
  CheckCircle,
  AlertCircle,
  Bell
} from 'lucide-react';
import { dashboard, auth } from '../utils/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    currentTier, 
    usage, 
    loading: usageLoading, 
    showUpgradeModal,
    isAtLimit,
    refreshUsage 
  } = useUpgrade();
  
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    activeTeams: 0,
    revenue: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [userRes, statsRes] = await Promise.all([
        auth.me(),
        dashboard.getStats()
      ]);
      
      setUser(userRes.data.user || userRes.data);
      setStats(statsRes.data.stats || {});
      setRecentBookings(statsRes.data.recentBookings || []);
      
      // Check if first time user
      const hasSeenTour = localStorage.getItem('hasSeenTour');
      if (!hasSeenTour) {
        setShowTour(true);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissTour = () => {
    setShowTour(false);
    localStorage.setItem('hasSeenTour', 'true');
  };

  const startTour = () => {
    dismissTour();
    navigate('/availability');
  };

  // Helper to check if limit is unlimited
  const isUnlimited = (limit) => !limit || limit >= 1000;

  // Format usage display
  const formatUsage = (used, limit) => {
    if (isUnlimited(limit)) {
      return '∞ Unlimited';
    }
    return `${used || 0}/${limit}`;
  };

  // Get usage percentage for progress bar
  const getUsagePercent = (used, limit) => {
    if (isUnlimited(limit)) return 0;
    return Math.min(100, ((used || 0) / limit) * 100);
  };

  // Get color based on usage level
  const getUsageColor = (used, limit) => {
    if (isUnlimited(limit)) return 'bg-green-500';
    const percent = ((used || 0) / limit) * 100;
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-gray-600 mt-1">Here's what's happening today.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/availability')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Availability
          </button>
          <button
            onClick={() => navigate('/ai-chat')}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:shadow-lg flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            ChatGPT {currentTier === 'pro' || currentTier === 'team' ? '✓' : ''}
          </button>
          {currentTier === 'team' && (
            <button
              onClick={() => navigate('/teams')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Team ✓
            </button>
          )}
        </div>
      </div>

      {/* New User Tour Banner */}
      {showTour && (
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">New to ScheduleSync? 👋</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Take a quick 2-minute tour to learn how to set up AI-powered scheduling and start booking meetings effortlessly.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={startTour}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Start Tour
              </button>
              <button
                onClick={dismissTour}
                className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-900"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Stats Widget */}
      <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Usage This Month</h2>
            <p className="text-sm text-gray-500 capitalize flex items-center gap-2">
              {currentTier} Plan
              {(currentTier === 'pro' || currentTier === 'team') && (
                <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </span>
              )}
            </p>
          </div>
          {currentTier === 'free' && (
            <button
              onClick={() => showUpgradeModal()}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:shadow-lg"
            >
              Upgrade
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* AI Queries */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">AI Queries</span>
            </div>
            <p className={`text-xl font-bold ${isUnlimited(usage.ai_queries_limit) ? 'text-green-600' : 'text-gray-900'}`}>
              {formatUsage(usage.ai_queries_used, usage.ai_queries_limit)}
            </p>
            {!isUnlimited(usage.ai_queries_limit) && (
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getUsageColor(usage.ai_queries_used, usage.ai_queries_limit)} transition-all`}
                  style={{ width: `${getUsagePercent(usage.ai_queries_used, usage.ai_queries_limit)}%` }}
                />
              </div>
            )}
          </div>

          {/* Bookings */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Bookings</span>
            </div>
            <p className={`text-xl font-bold ${isUnlimited(usage.bookings_limit) ? 'text-green-600' : 'text-gray-900'}`}>
              {formatUsage(usage.bookings_used, usage.bookings_limit)}
            </p>
            {!isUnlimited(usage.bookings_limit) && (
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getUsageColor(usage.bookings_used, usage.bookings_limit)} transition-all`}
                  style={{ width: `${getUsagePercent(usage.bookings_used, usage.bookings_limit)}%` }}
                />
              </div>
            )}
          </div>

          {/* Event Types */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Event Types</span>
            </div>
            <p className={`text-xl font-bold ${isUnlimited(usage.event_types_limit) ? 'text-green-600' : 'text-gray-900'}`}>
              {formatUsage(usage.event_types_used, usage.event_types_limit)}
            </p>
            {!isUnlimited(usage.event_types_limit) && (
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getUsageColor(usage.event_types_used, usage.event_types_limit)} transition-all`}
                  style={{ width: `${getUsagePercent(usage.event_types_used, usage.event_types_limit)}%` }}
                />
              </div>
            )}
          </div>

          {/* Magic Links */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <LinkIcon className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-gray-700">Magic Links</span>
            </div>
            <p className={`text-xl font-bold ${isUnlimited(usage.magic_links_limit) ? 'text-green-600' : 'text-gray-900'}`}>
              {formatUsage(usage.magic_links_used, usage.magic_links_limit)}
            </p>
            {!isUnlimited(usage.magic_links_limit) && (
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getUsageColor(usage.magic_links_used, usage.magic_links_limit)} transition-all`}
                  style={{ width: `${getUsagePercent(usage.magic_links_used, usage.magic_links_limit)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Team Features - Only show for non-free or as upgrade prompt */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Team Features</span>
            </div>
            {currentTier === 'team' ? (
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                <CheckCircle className="h-3 w-3 mr-1" />
                Enabled
              </span>
            ) : (
              <button
                onClick={() => showUpgradeModal('teams')}
                className="text-sm text-purple-600 font-medium hover:text-purple-700"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Banner for Free Users */}
      {currentTier === 'free' && (
        <div className="mb-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Crown className="h-6 w-6" />
                Upgrade to Pro
              </h3>
              <p className="text-purple-100 mt-1">
                Unlimited everything for just $12/month
              </p>
            </div>
            <button
              onClick={() => showUpgradeModal()}
              className="px-6 py-3 bg-white text-purple-600 font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              Upgrade Now
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-purple-400/30">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-purple-200" />
              <span className="text-sm">Unlimited AI queries</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-purple-200" />
              <span className="text-sm">Unlimited bookings</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-purple-200" />
              <span className="text-sm">Email templates</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-purple-200" />
              <span className="text-sm">Priority support</span>
            </div>
          </div>
        </div>
      )}

      {/* Need Team Features Banner for Pro Users */}
      {currentTier === 'pro' && (
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Need Team Features?</h3>
              <p className="text-gray-600 mt-1">Round-robin, collective booking & more</p>
            </div>
            <button
              onClick={() => showUpgradeModal('teams')}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
            >
              Upgrade to Team
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Timezone */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <Globe className="h-8 w-8 text-blue-600" />
            <button
              onClick={() => navigate('/settings')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Change
            </button>
          </div>
          <p className="text-sm text-gray-500">Your Timezone</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {user?.timezone?.replace('_', ' ').split('/').pop() || 'Not set'}
          </p>
        </div>

        {/* Total Bookings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="h-8 w-8 text-green-600" />
            <button
              onClick={() => navigate('/bookings')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All
            </button>
          </div>
          <p className="text-sm text-gray-500">Total Bookings</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalBookings || 0}</p>
        </div>

        {/* Upcoming */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
          <p className="text-sm text-gray-500">Upcoming</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.upcomingBookings || 0}</p>
        </div>

        {/* Active Teams - Only show for Team tier */}
        {currentTier === 'team' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 text-orange-600" />
              <button
                onClick={() => navigate('/teams')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Manage
              </button>
            </div>
            <p className="text-sm text-gray-500">Active Teams</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeTeams || 0}</p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 text-gray-400" />
              <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                Team Plan
              </span>
            </div>
            <p className="text-sm text-gray-500">Active Teams</p>
            <button
              onClick={() => showUpgradeModal('teams')}
              className="mt-2 text-sm text-purple-600 font-medium hover:text-purple-700 flex items-center gap-1"
            >
              Upgrade to unlock <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <button
          onClick={() => navigate('/events')}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-lg hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mt-4">Event Types</h3>
          <p className="text-sm text-gray-500 mt-1">Create and manage booking templates</p>
        </button>

        <button
          onClick={() => navigate('/bookings')}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-lg hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-green-600 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mt-4">Bookings</h3>
          <p className="text-sm text-gray-500 mt-1">View and manage your appointments</p>
        </button>

        <button
          onClick={() => navigate('/availability')}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-lg hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mt-4">Availability</h3>
          <p className="text-sm text-gray-500 mt-1">Set your working hours and breaks</p>
        </button>
      </div>

      {/* Recent Bookings */}
      {recentBookings.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
            <button
              onClick={() => navigate('/bookings')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            {recentBookings.slice(0, 5).map((booking) => (
              <div 
                key={booking.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => navigate(`/bookings/${booking.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">
                      {booking.attendee_name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{booking.attendee_name || 'Guest'}</p>
                    <p className="text-sm text-gray-500">{booking.attendee_email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(booking.start_time).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(booking.start_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentBookings.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No bookings yet</h3>
          <p className="text-gray-500 mb-6">
            Set up your availability and share your booking link to get started.
          </p>
          <button
            onClick={() => navigate('/availability')}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
          >
            Set Up Availability
          </button>
        </div>
      )}
    </div>
  );
}