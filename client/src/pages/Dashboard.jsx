import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  ChevronRight,
  MoreHorizontal,
  Globe,
  Copy, 
  Check,
  Link as LinkIcon,
  Loader2
} from 'lucide-react';
import api from '../utils/api'; // We use raw api for the fix
import { auth, timezone as timezoneApi } from '../utils/api'; // Use typed helpers for others
import AISchedulerChat from '../components/AISchedulerChat';
import TimezoneSelector from '../components/TimezoneSelector';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    activeTeams: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('');
  
  // Booking Link State
  const [bookingLink, setBookingLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadUserTimezone(),
      loadUserProfile()
    ]);
    setLoading(false);
  };

  const loadDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data.stats);
      setRecentBookings(response.data.recentBookings || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const loadUserTimezone = async () => {
    try {
      const response = await timezoneApi.get();
      if (response.data.timezone) {
        setTimezone(response.data.timezone);
      }
    } catch (error) {
      console.error('Error loading timezone:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
        const response = await auth.me(); 
        if (response.data.user?.booking_token) {
            const link = `${window.location.origin}/book/${response.data.user.booking_token}`;
            setBookingLink(link);
        } else {
            setBookingLink(''); // Ensure it's empty if not found
        }
    } catch (error) {
        console.error("Could not load user profile for link", error);
    }
  };

  // ✅ FORCE CREATE LINK FUNCTION
  const handleCreateLink = async () => {
    setGeneratingLink(true);
    try {
        // This endpoint auto-generates the personal team/link if missing
        await api.get('/my-booking-link');
        // Reload profile to get the new token
        await loadUserProfile();
    } catch (error) {
        console.error("Failed to generate link:", error);
        alert("Could not generate link. Please try again.");
    } finally {
        setGeneratingLink(false);
    }
  };

  const handleTimezoneChange = async (newTimezone) => {
    try {
      setTimezone(newTimezone);
      await timezoneApi.update({ timezone: newTimezone });
    } catch (error) {
      console.error('Failed to update timezone:', error);
    }
  };

  const handleCopyLink = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return <CheckCircle2 className="h-4 w-4" />;
      case 'pending': return <AlertCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-green-100 text-green-700 border-green-200';
    }
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
    {
      label: 'Total Bookings',
      value: stats.totalBookings,
      icon: Calendar,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      change: '+12%',
    },
    {
      label: 'Upcoming',
      value: stats.upcomingBookings,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      badge: 'This week',
    },
    {
      label: 'Active Teams',
      value: stats.activeTeams,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Header */}
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
                  Welcome back! Here's what's happening today.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/bookings')}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Calendar
              </button>
              <button
                onClick={() => navigate('/my-booking-link')}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                New
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-6">

            {/* Timezone Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Globe className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Your Timezone</h3>
                        <p className="text-xs text-gray-500">Used for all your calendar events</p>
                    </div>
                </div>
                <div className="w-full sm:w-72">
                    <TimezoneSelector 
                        value={timezone} 
                        onChange={handleTimezoneChange} 
                        showLabel={false} 
                    />
                </div>
            </div>

            {/* BOOKING LINK CARD - NOW HANDLES MISSING LINK */}
            {bookingLink ? (
                // CASE A: Link Exists
                <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="w-full">
                            <label className="text-sm font-bold text-blue-900 mb-2 block">
                                Your Main Booking Link:
                            </label>
                            <div className="font-mono text-sm text-blue-700 bg-white border border-blue-200 rounded-lg px-4 py-3 w-full break-all">
                                {bookingLink}
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-6">
                            <button
                                onClick={handleCopyLink}
                                className="whitespace-nowrap flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto"
                            >
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? 'Copied!' : 'Copy Link'}
                            </button>
                            <button
                                onClick={() => navigate('/my-booking-link')}
                                className="whitespace-nowrap flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-700 border border-blue-200 rounded-xl font-semibold hover:bg-blue-50 transition-colors w-full md:w-auto"
                            >
                                <Users className="h-4 w-4" />
                                Availability
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                // CASE B: Link Missing (Fixes the blank space!)
                <div className="bg-orange-50 rounded-2xl border border-orange-200 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-orange-100 rounded-full">
                         <LinkIcon className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                         <h3 className="text-lg font-bold text-orange-900">Setup Required</h3>
                         <p className="text-sm text-orange-800">You don't have a personal booking link yet.</p>
                      </div>
                   </div>
                   <button
                      onClick={handleCreateLink}
                      disabled={generatingLink}
                      className="w-full sm:w-auto px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                      {generatingLink ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                      {generatingLink ? "Generating..." : "Create Booking Link"}
                   </button>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((stat, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:shadow-xl transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-gray-600 text-sm font-medium">
                        {stat.label}
                      </p>
                      <p className={`text-3xl font-bold ${stat.color}`}>
                        {stat.value}
                      </p>
                      {stat.change && (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full inline-flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {stat.change}
                        </span>
                      )}
                      {stat.badge && (
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full inline-block ${stat.bg} ${stat.color}`}
                        >
                          {stat.badge}
                        </span>
                      )}
                    </div>
                    <div
                      className={`${stat.bg} h-14 w-14 rounded-xl flex items-center justify-center shadow-md`}
                    >
                      <stat.icon className={`h-7 w-7 ${stat.color}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Weekly Overview - Only show if there are bookings */}
            {stats.totalBookings > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Weekly Overview
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Your activity this week
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full inline-flex items-center gap-1 border border-blue-200">
                      <TrendingUp className="h-3 w-3" />
                      +
                      {stats.upcomingBookings > 0
                        ? Math.round(
                            (stats.upcomingBookings / stats.totalBookings) *
                              100,
                          )
                        : 0}
                      % activity
                    </span>
                  </div>

                  <div className="h-px bg-gray-200" />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs font-medium">
                          This Week
                        </p>
                        <p className="text-gray-900 font-bold text-xl">
                          {stats.upcomingBookings} bookings
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                      <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs font-medium">
                          Total
                        </p>
                        <p className="text-gray-900 font-bold text-xl">
                          {stats.totalBookings} meetings
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                      <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <BarChart3 className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs font-medium">
                          Active Teams
                        </p>
                        <p className="text-gray-900 font-bold text-xl">
                          {stats.activeTeams}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Chart Visualization - Only show if there are bookings */}
                  {recentBookings.length > 0 && (
                    <div className="pt-4 space-y-3">
                      <p className="text-sm font-semibold text-gray-700 mb-3">
                        Recent Activity
                      </p>
                      {recentBookings.slice(0, 5).map((booking) => {
                        const date = new Date(booking.start_time);
                        const dayName = date.toLocaleDateString('en-US', {
                          weekday: 'long',
                        });
                        return (
                          <div key={booking.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600 font-medium">
                                {dayName}
                              </span>
                              <span className="text-gray-900 font-semibold">
                                {date.toLocaleDateString()}
                              </span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Welcome Message for New Users - Show when no bookings */}
            {stats.totalBookings === 0 && (
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">
                        Welcome to ScheduleSync!
                      </h3>
                      <p className="text-white/90 text-sm">
                        Get started by sharing your booking link
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                      <p className="text-white/80 text-xs font-medium mb-1">
                        Step 1
                      </p>
                      <p className="text-white font-bold">Set your availability</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                      <p className="text-white/80 text-xs font-medium mb-1">
                        Step 2
                      </p>
                      <p className="text-white font-bold">Get your booking link</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                      <p className="text-white/80 text-xs font-medium mb-1">
                        Step 3
                      </p>
                      <p className="text-white font-bold">Share with clients</p>
                    </div>
                  </div>
                  {/* Button removed here because it's now at the top */}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => navigate('/bookings')}
                className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl hover:shadow-2xl transition-all group text-left"
              >
                <div className="space-y-3">
                  <div className="h-14 w-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Calendar className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="text-white font-bold text-xl">My Bookings</h4>
                  <p className="text-white/90 text-sm">
                    View and manage all your scheduled meetings
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-white/90 text-sm font-semibold">
                      View All
                    </span>
                    <ChevronRight className="h-5 w-5 text-white group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/teams')}
                className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl hover:shadow-2xl transition-all group text-left"
              >
                <div className="space-y-3">
                  <div className="h-14 w-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="text-white font-bold text-xl">Manage Teams</h4>
                  <p className="text-white/90 text-sm">
                    Add or edit team members and their availability
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-white/90 text-sm font-semibold">
                      Manage
                    </span>
                    <ChevronRight className="h-5 w-5 text-white group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/my-booking-link')}
                className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl hover:shadow-2xl transition-all group text-left"
              >
                <div className="space-y-3">
                  <div className="h-14 w-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Sparkles className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="text-white font-bold text-xl">My Booking Link</h4>
                  <p className="text-white/90 text-sm">
                    Share your link and let others book time
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-white/90 text-sm font-semibold">
                      Get Link
                    </span>
                    <ChevronRight className="h-5 w-5 text-white group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            </div>

            {/* Recent Bookings List (Bottom) */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Recent Bookings
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Your latest scheduled meetings
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/bookings')}
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-1"
                  >
                    View All
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {recentBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Calendar className="h-10 w-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 mb-4 font-medium">
                      No bookings yet
                    </p>
                    <button
                      onClick={() => navigate('/my-booking-link')}
                      className="text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Share your booking link to get started
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentBookings.slice(0, 5).map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                            {booking.attendee_name?.charAt(0) || 'G'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-gray-900 font-bold">
                                {booking.attendee_name || 'Guest'}
                              </p>
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(
                                  booking.status || 'confirmed',
                                )}`}
                              >
                                {getStatusIcon(booking.status || 'confirmed')}
                                {booking.status || 'confirmed'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-gray-600 text-sm">
                              <span className="truncate max-w-[140px] sm:max-w-none">
                                {booking.attendee_email}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(
                                  booking.start_time,
                                ).toLocaleDateString()}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(
                                  booking.start_time,
                                ).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-100 rounded-lg">
                          <MoreHorizontal className="h-5 w-5 text-gray-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* AI Chat Widget */}
      <AISchedulerChat />
    </div>
  );
}