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
  Ticket,
  X,
  ExternalLink,
} from 'lucide-react';

import api, {
  auth,
  timezone as timezoneApi,
  singleUseLinks,
} from '../utils/api';
import AISchedulerChat from '../components/AISchedulerChat';
import TimezoneSelector from '../components/TimezoneSelector';

export default function Dashboard() {
  const navigate = useNavigate();

  // ---------- CORE DASHBOARD STATE ----------
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    activeTeams: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [timezone, setTimezone] = useState('');
  const [user, setUser] = useState(null);

  // Booking link
  const [bookingLink, setBookingLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Single-use links
  const [singleUseLinksData, setSingleUseLinksData] = useState([]);
  const [generatingSingleUse, setGeneratingSingleUse] = useState(false);
  const [newSingleUseToken, setNewSingleUseToken] = useState('');
  const [showSingleUseModal, setShowSingleUseModal] = useState(false);
  const [copiedSingleUse, setCopiedSingleUse] = useState('');

  // ---------- INITIAL LOAD ----------
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadUserTimezone(),
      loadUserProfile(),
      loadSingleUseLinks(),
    ]);
    setLoading(false);
  };

  const loadDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(
        response.data.stats || {
          totalBookings: 0,
          upcomingBookings: 0,
          activeTeams: 0,
        }
      );
      setRecentBookings(response.data.recentBookings || []);
    } catch (error) {
      console.error('Dashboard load error:', error);
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

      if (u?.booking_token) {
        setBookingLink(`${window.location.origin}/book/${u.booking_token}`);
      } else {
        setBookingLink('');
      }
    } catch (error) {
      console.error('Profile load error:', error);
    }
  };

  const loadSingleUseLinks = async () => {
    try {
      const response = await singleUseLinks.getRecent();
      setSingleUseLinksData(response.data.links || []);
    } catch (error) {
      console.error('Load single-use links error:', error);
    }
  };

  // ---------- HANDLERS ----------
  const handleCreateLink = async () => {
    setGeneratingLink(true);
    try {
      await api.get('/my-booking-link');
      await loadUserProfile();
    } catch (error) {
      console.error('Generate link error:', error);
      alert('Could not generate booking link. Please try again.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateSingleUse = async () => {
    setGeneratingSingleUse(true);
    try {
      const response = await singleUseLinks.generate();
      const token = response.data.token;
      setNewSingleUseToken(token);
      setShowSingleUseModal(true);
      await loadSingleUseLinks();
    } catch (error) {
      console.error('Generate single-use link error:', error);
      alert('Could not generate single-use link. Please try again.');
    } finally {
      setGeneratingSingleUse(false);
    }
  };

  const handleCopySingleUse = (token) => {
    const link = `${window.location.origin}/book/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedSingleUse(token);
    setTimeout(() => setCopiedSingleUse(''), 2000);
  };

  const handleTimezoneChange = async (newTimezone) => {
    try {
      setTimezone(newTimezone);
      await timezoneApi.update(newTimezone); // api.js: update(tz) => { timezone: tz }
    } catch (error) {
      console.error('Failed to update timezone:', error);
    }
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

  const getSingleUseLinkStatus = (link) => {
    const now = new Date();
    const expiresAt = new Date(link.expires_at);

    if (link.used) {
      return {
        label: 'Used',
        color: 'bg-gray-100 text-gray-600',
        icon: CheckCircle2,
      };
    }
    if (expiresAt < now) {
      return {
        label: 'Expired',
        color: 'bg-red-100 text-red-600',
        icon: XCircle,
      };
    }

    const hoursRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60));
    return {
      label: `Active (${hoursRemaining}h left)`,
      color: 'bg-green-100 text-green-600',
      icon: Sparkles,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            Loading your dashboard...
          </p>
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

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* HEADER */}
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

            {/* TOP-RIGHT: MANAGE AVAILABILITY BUTTON */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/availability')}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold flex items-center gap-2 shadow-sm"
              >
                <Clock className="h-4 w-4" />
                Manage Availability
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="w-full relative">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-6">
            {/* Timezone card - more compact */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <Globe className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    Your Timezone
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Used for all your calendar events
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-60">
                <TimezoneSelector
                  value={timezone}
                  onChange={handleTimezoneChange}
                  showLabel={false}
                />
              </div>
            </div>


            {/* Booking link card */}
            {bookingLink ? (
              <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="w-full">
                    <label className="text-sm font-bold text-blue-900 mb-2 block">
                      Your Booking Link
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
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
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

            {/* SINGLE-USE LINKS CARD */}
            <div className="bg-purple-50/50 rounded-2xl border border-purple-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Single-Use Links
                  </h3>
                  <p className="text-sm text-purple-700 mt-1">
                    One-time use only. Expires in 24 hours. Perfect for specific
                    clients.
                  </p>
                </div>
              </div>

              <button
                onClick={handleGenerateSingleUse}
                disabled={generatingSingleUse}
                className="w-full mb-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generatingSingleUse ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Ticket className="h-5 w-5" />
                    Generate New Single-Use Link
                  </>
                )}
              </button>

              {singleUseLinksData.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">
                    Recent Links:
                  </p>
                  {singleUseLinksData.slice(0, 5).map((link) => {
                    const status = getSingleUseLinkStatus(link);
                    const StatusIcon = status.icon;
                    const isActive =
                      !link.used && new Date(link.expires_at) > new Date();

                    return (
                      <div
                        key={link.token}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className={`px-2 py-1 rounded-md ${status.color} text-xs font-semibold flex items-center gap-1`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </div>
                          <code className="text-xs text-gray-600 font-mono truncate">
                            {link.token.substring(0, 16)}...
                          </code>
                        </div>

                        {isActive && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopySingleUse(link.token)}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors flex items-center gap-1"
                            >
                              {copiedSingleUse === link.token ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Copy
                                </>
                              )}
                            </button>
                            <a
                              href={`${window.location.origin}/book/${link.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition-colors flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((stat, idx) => (
                <div
                  key={idx}
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

            {/* Recent bookings */}
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
                  <div className="text-center py-10">
                    <p className="text-gray-500 font-medium">
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

      {/* SINGLE-USE LINK MODAL */}
      {showSingleUseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setShowSingleUseModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4">
                <Ticket className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                🎫 Single-Use Link Generated!
              </h3>
              <p className="text-gray-600">
                This link can only be used once and expires in 24 hours.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                Your Link:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}/book/${newSingleUseToken}`}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono text-sm"
                />
                <button
                  onClick={() => handleCopySingleUse(newSingleUseToken)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  {copiedSingleUse === newSingleUseToken ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 font-semibold mb-1">
                  ⏰ Expires
                </p>
                <p className="text-sm font-bold text-purple-900">
                  24 hours
                </p>
              </div>
              <div className="bg-pink-50 rounded-lg p-3 text-center">
                <p className="text-xs text-pink-600 font-semibold mb-1">
                  🎯 Usage
                </p>
                <p className="text-sm font-bold text-pink-900">
                  One time
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 font-semibold mb-1">
                  🔒 Secure
                </p>
                <p className="text-sm font-bold text-blue-900">
                  Private
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowSingleUseModal(false)}
              className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* AI chat widget */}
      <AISchedulerChat />
    </div>
  );
}
