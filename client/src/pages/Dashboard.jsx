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
  Bot,
  Settings,
} from 'lucide-react';

import api, {
  auth,
  timezone as timezoneApi,
  singleUseLinks,
  chatgptIntegration,
} from '../utils/api';
import AISchedulerChat from '../components/AISchedulerChat';
import { useNotification } from '../contexts/NotificationContext';

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
  const [bookingLink, setBookingLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [singleUseLinksData, setSingleUseLinksData] = useState([]);
  const [generatingSingleUse, setGeneratingSingleUse] = useState(false);
  const [newSingleUseToken, setNewSingleUseToken] = useState('');
  const [showSingleUseModal, setShowSingleUseModal] = useState(false);
  const [copiedSingleUse, setCopiedSingleUse] = useState('');
  const [linkName, setLinkName] = useState('');

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
      loadSingleUseLinks(),
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
      if (u?.booking_token) {
        setBookingLink(`${window.location.origin}/book/${u.booking_token}`);
      } else {
        setBookingLink('');
      }
    } catch (error) {
      console.error('Profile load error:', error);
      notify.error('Failed to load profile');
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

  // Simple check if ChatGPT is configured
  const checkChatGptStatus = async () => {
    try {
      const response = await chatgptIntegration.getToken();
      setChatgptConfigured(!!response.data.jwt_token);
    } catch (error) {
      setChatgptConfigured(false);
    }
  };

  const handleCreateLink = async () => {
    setGeneratingLink(true);
    try {
      await api.get('/my-booking-link');
      await loadUserProfile();
      notify.success('Booking link created successfully! 🎉');
    } catch (error) {
      console.error('Generate link error:', error);
      notify.error('Could not generate booking link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    notify.success('Link copied to clipboard! 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateSingleUse = async () => {
    setGeneratingSingleUse(true);
    try {
      const response = await singleUseLinks.generate({ name: linkName.trim() || null });
      const token = response.data.token;
      setNewSingleUseToken(token);
      setShowSingleUseModal(true);
      setLinkName('');
      await loadSingleUseLinks();
      notify.success('Single-use link generated! 🎫');
    } catch (error) {
      console.error('Generate single-use link error:', error);
      notify.error('Could not generate single-use link');
    } finally {
      setGeneratingSingleUse(false);
    }
  };

  const handleCopySingleUse = (token) => {
    const link = `${window.location.origin}/book/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedSingleUse(token);
    notify.success('Single-use link copied! 📋');
    setTimeout(() => setCopiedSingleUse(''), 2000);
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

  const getSingleUseLinkStatus = (link) => {
    const now = new Date();
    const expiresAt = new Date(link.expires_at);

    if (link.used) {
      return { label: 'Used', color: 'bg-gray-100 text-gray-600', icon: CheckCircle2 };
    }
    if (expiresAt < now) {
      return { label: 'Expired', color: 'bg-red-100 text-red-600', icon: XCircle };
    }
    const hoursRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60));
    return { label: `Active (${hoursRemaining}h left)`, color: 'bg-green-100 text-green-600', icon: Sparkles };
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
            {/* Read-Only Timezone Display */}
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

            {/* Side-by-Side: Booking Link + Single-Use Links */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Your Booking Link */}
              <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-5 shadow-sm h-fit">
                <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2 mb-4">
                  <LinkIcon className="h-5 w-5" />
                  Your Booking Link
                </h3>
                
                {bookingLink ? (
                  <div className="space-y-3">
                    <div className="font-mono text-sm text-blue-700 bg-white border border-blue-200 rounded-lg px-4 py-3 break-all">
                      {bookingLink}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <p className="text-xs text-blue-700 text-center">
                      ♾️ Permanent link • Unlimited uses
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm text-orange-800 mb-3">
                        You don&apos;t have a personal booking link yet.
                      </p>
                      <button
                        onClick={handleCreateLink}
                        disabled={generatingLink}
                        className="w-full px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {generatingLink ? (
                          <>
                            <Loader2 className="animate-spin h-5 w-5" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5" />
                            Create Link
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Single-Use Links */}
              <div className="bg-purple-50/50 rounded-2xl border border-purple-200 p-5 shadow-sm">
                <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2 mb-2">
                  <Ticket className="h-5 w-5" />
                  Single-Use Links
                </h3>
                <p className="text-sm text-purple-700 mb-4">
                  One-time use • Expires in 24h • Perfect for specific clients
                </p>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Name this link (optional) - e.g., 'Client ABC'"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    maxLength={50}
                  />

                  <button
                    onClick={handleGenerateSingleUse}
                    disabled={generatingSingleUse}
                    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {generatingSingleUse ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Ticket className="h-5 w-5" />
                        Generate Link
                      </>
                    )}
                  </button>
                </div>

                {singleUseLinksData.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                      Recent Links:
                    </p>
                    {singleUseLinksData.slice(0, 3).map((link) => {
                      const status = getSingleUseLinkStatus(link);
                      const StatusIcon = status.icon;
                      const isActive = !link.used && new Date(link.expires_at) > new Date();

                      return (
                        <div
                          key={link.token}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`px-2 py-1 rounded-md ${status.color} text-xs font-semibold flex items-center gap-1 flex-shrink-0`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </div>
                            
                            {link.name ? (
                              <span className="text-sm font-medium text-purple-900 truncate">
                                {link.name}
                              </span>
                            ) : (
                              <code className="text-xs text-gray-600 font-mono truncate">
                                {link.token.substring(0, 12)}...
                              </code>
                            )}
                          </div>

                          {isActive && (
                            <button
                              onClick={() => handleCopySingleUse(link.token)}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors flex items-center gap-1 flex-shrink-0"
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
                          )}
                        </div>
                      );
                    })}
                    
                    {singleUseLinksData.length > 3 && (
                      <button
                        onClick={() => navigate('/settings')}
                        className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center justify-center gap-1 py-2"
                      >
                        View all {singleUseLinksData.length} links
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
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

      {/* Single-Use Link Modal */}
      {showSingleUseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
            <button onClick={() => setShowSingleUseModal(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="h-5 w-5 text-gray-500" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4">
                <Ticket className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">🎫 Single-Use Link Generated!</h3>
              <p className="text-gray-600">This link can only be used once and expires in 24 hours.</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Your Link:</label>
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
                <p className="text-xs text-purple-600 font-semibold mb-1">⏰ Expires</p>
                <p className="text-sm font-bold text-purple-900">24 hours</p>
              </div>
              <div className="bg-pink-50 rounded-lg p-3 text-center">
                <p className="text-xs text-pink-600 font-semibold mb-1">🎯 Usage</p>
                <p className="text-sm font-bold text-pink-900">One time</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 font-semibold mb-1">🔒 Secure</p>
                <p className="text-sm font-bold text-blue-900">Private</p>
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

      <AISchedulerChat />
    </div>
  );
}