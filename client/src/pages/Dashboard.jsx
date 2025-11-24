// client/src/pages/Dashboard.jsx
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
  ChevronRight,
  Globe,
  Copy,
  Check,
  Link as LinkIcon,
  Loader2,
  X,
} from 'lucide-react';
import api, { auth, timezone as timezoneApi } from '../utils/api';
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

  // Current user (for team/member availability)
  const [user, setUser] = useState(null);

  // Booking Link State
  const [bookingLink, setBookingLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Availability Pop-up State
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadUserTimezone(),
      loadUserProfile(),
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
      const u = response.data.user || null;

      setUser(u);

      if (u?.booking_token) {
        const link = `${window.location.origin}/book/${u.booking_token}`;
        setBookingLink(link);
      } else {
        setBookingLink('');
      }
    } catch (error) {
      console.error('Could not load user profile for link', error);
    }
  };

  const handleCreateLink = async () => {
    setGeneratingLink(true);
    try {
      await api.get('/my-booking-link');
      await loadUserProfile();
    } catch (error) {
      console.error('Failed to generate link:', error);
      alert('Could not generate link. Please try again.');
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
      case 'confirmed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-green-100 text-green-700 border-green-200';
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
    },
    {
      label: 'Upcoming',
      value: stats.upcomingBookings,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
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
                  Welcome back! Here&apos;s what&apos;s happening today.
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
      <main className="w-full relative">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-6">
            {/* Timezone Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Your Timezone
                  </h3>
                  <p className="text-xs text-gray-500">
                    Used for all your calendar events
                  </p>
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

            {/* Booking Link Card */}
            {bookingLink ? (
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

                  {/* ACTION BUTTONS */}
                  <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-6">
                    <button
                      onClick={handleCopyLink}
                      className="whitespace-nowrap flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </button>

                    {/* AVAILABILITY BUTTON - Opens the Modal */}
                    <button
                      onClick={() => setShowAvailabilityModal(true)}
                      className="whitespace-nowrap flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-700 border border-blue-200 rounded-xl font-semibold hover:bg-blue-50 transition-colors w-full md:w-auto"
                    >
                      <Users className="h-4 w-4" />
                      Availability
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 rounded-2xl border border-orange-200 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-100 rounded-full">
                    <LinkIcon className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-orange-900">
                      Setup Required
                    </h3>
                    <p className="text-sm text-orange-800">
                      You don&apos;t have a personal booking link yet.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCreateLink}
                  disabled={generatingLink}
                  className="w-full sm:w-auto px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generatingLink ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                  {generatingLink ? 'Generating...' : 'Create Booking Link'}
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

            {/* Recent Bookings List */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">
                    Recent Bookings
                  </h3>
                  <button
                    onClick={() => navigate('/bookings')}
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-1"
                  >
                    View All <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {recentBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4 font-medium">
                      No bookings yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentBookings.slice(0, 5).map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                            {booking.attendee_name?.charAt(0) || 'G'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-gray-900 font-bold">
                                {booking.attendee_name}
                              </p>
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(
                                  booking.status
                                )}`}
                              >
                                {getStatusIcon(booking.status)}{' '}
                                {booking.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 text-sm">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(
                                  booking.start_time
                                ).toLocaleDateString()}
                              </span>
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

      {/* Availability Modal */}
      {showAvailabilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex items-center justify-between">
              <div className="text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Quick Availability Check
                </h2>
                <p className="text-blue-100 text-sm">
                  Your standard working hours
                </p>
              </div>
              <button
                onClick={() => setShowAvailabilityModal(false)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(
                    (day) => (
                      <div
                        key={day}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <span className="font-semibold text-gray-700">
                          {day}
                        </span>
                        <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">
                          9:00 AM - 5:00 PM
                        </span>
                      </div>
                    )
                  )}
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mt-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    This is a quick view. To make complex changes or add
                    date-specific overrides, visit the full settings page.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAvailabilityModal(false)}
                className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
              >
                Close
              </button>

              <button
                onClick={() => {
                  setShowAvailabilityModal(false);
                  if (user?.team_id && user?.id) {
                    navigate(
                      `/teams/${user.team_id}/members/${user.id}/availability`
                    );
                  } else {
                    console.error(
                      'Missing team_id or user id for availability route'
                    );
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                Edit Full Schedule <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Widget */}
      <AISchedulerChat />
    </div>
  );
}
