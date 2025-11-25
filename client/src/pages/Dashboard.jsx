import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, teams, bookings, singleUseLinks } from '../utils/api';
import { 
  Calendar, 
  Users, 
  Clock, 
  TrendingUp, 
  Link2, 
  Copy, 
  Check, 
  ExternalLink,
  Sparkles,
  Shield,
  Timer,
  X
} from 'lucide-react';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    teamMembers: 0,
    activeTeams: 0
  });
  const [bookingToken, setBookingToken] = useState('');
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Single-use links state
  const [singleUseLinksData, setSingleUseLinksData] = useState([]);
  const [generatingSingleUse, setGeneratingSingleUse] = useState(false);
  const [newSingleUseToken, setNewSingleUseToken] = useState('');
  const [showSingleUseModal, setShowSingleUseModal] = useState(false);
  const [copiedSingleUse, setCopiedSingleUse] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load user profile
      const profileResponse = await api.get('/profile');
      setUser(profileResponse.data.user);

      // Load team data
      const teamsResponse = await teams.list();
      const userTeams = teamsResponse.data.teams || [];

      // Load bookings
      const bookingsResponse = await bookings.list();
      const userBookings = bookingsResponse.data.bookings || [];

      // Calculate stats
      const now = new Date();
      const upcomingCount = userBookings.filter(b => new Date(b.start_time) > now).length;

      setStats({
        totalBookings: userBookings.length,
        upcomingBookings: upcomingCount,
        teamMembers: userTeams.reduce((sum, t) => sum + (t.member_count || 0), 0),
        activeTeams: userTeams.length
      });

      // Get recent bookings (last 5)
      const sortedBookings = userBookings
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);
      setRecentBookings(sortedBookings);

      // Get booking token from personal team
      const personalTeam = userTeams.find(t => t.owner_id === profileResponse.data.user.id);
      if (personalTeam && personalTeam.members && personalTeam.members.length > 0) {
        setBookingToken(personalTeam.members[0].booking_token);
      }

      // Load single-use links
      await loadSingleUseLinks();

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSingleUseLinks = async () => {
    try {
      const response = await singleUseLinks.getRecent();
      setSingleUseLinksData(response.data.links || []);
    } catch (error) {
      console.error('Error loading single-use links:', error);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/book/${bookingToken}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateSingleUse = async () => {
    try {
      setGeneratingSingleUse(true);
      const response = await singleUseLinks.generate();
      setNewSingleUseToken(response.data.token);
      setShowSingleUseModal(true);
      await loadSingleUseLinks(); // Refresh the list
    } catch (error) {
      console.error('Error generating single-use link:', error);
      alert('Failed to generate single-use link. Please try again.');
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

  const getSingleUseLinkStatus = (link) => {
    if (link.used) {
      return { status: 'used', label: 'Used', color: 'gray' };
    }
    
    const now = new Date();
    const expiresAt = new Date(link.expires_at);
    
    if (expiresAt < now) {
      return { status: 'expired', label: 'Expired', color: 'red' };
    }
    
    const hoursRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60));
    return { 
      status: 'active', 
      label: `Active (${hoursRemaining}h left)`, 
      color: 'green' 
    };
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name}! 👋
          </h1>
          <p className="text-gray-600 mt-2">
            Here's what's happening with your schedule
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalBookings}
                </p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.upcomingBookings}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Team Members</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.teamMembers}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Teams</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.activeTeams}
                </p>
              </div>
              <div className="bg-pink-100 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-pink-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Booking Links Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Link2 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Your Booking Links</h2>
          </div>

          {/* Permanent Link */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔗 Permanent Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={`${window.location.origin}/book/${bookingToken}`}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={() => window.open(`${window.location.origin}/book/${bookingToken}`, '_blank')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 my-6"></div>

          {/* Single-Use Links */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                🎫 Single-Use Links
              </label>
              <button
                onClick={handleGenerateSingleUse}
                disabled={generatingSingleUse}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingSingleUse ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate New
                  </>
                )}
              </button>
            </div>

            {singleUseLinksData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No single-use links yet. Generate one to get started!
              </div>
            ) : (
              <div className="space-y-3">
                {singleUseLinksData.slice(0, 5).map((link) => {
                  const statusInfo = getSingleUseLinkStatus(link);
                  const isActive = statusInfo.status === 'active';

                  return (
                    <div
                      key={link.token}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs text-gray-600 truncate">
                            {link.token.substring(0, 16)}...
                          </code>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              statusInfo.color === 'green'
                                ? 'bg-green-100 text-green-700'
                                : statusInfo.color === 'gray'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Created {formatDate(link.created_at)}
                        </p>
                      </div>

                      {isActive && (
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleCopySingleUse(link.token)}
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 cursor-pointer text-sm px-2 py-1"
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
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 cursor-pointer text-sm px-2 py-1"
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
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Bookings</h2>
          
          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No bookings yet. Share your link to get started!
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{booking.title || 'Meeting'}</p>
                    <p className="text-sm text-gray-600">
                      {booking.guest_name} ({booking.guest_email})
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      new Date(booking.start_time) > new Date()
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {new Date(booking.start_time) > new Date() ? 'Upcoming' : 'Past'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Single-Use Link Success Modal */}
      {showSingleUseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                ✨ Single-Use Link Generated!
              </h3>
              <button
                onClick={() => setShowSingleUseModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your secure booking link:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}/book/${newSingleUseToken}`}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={() => handleCopySingleUse(newSingleUseToken)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  {copiedSingleUse === newSingleUseToken ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
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
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <Timer className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Expires in 24h</p>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded-lg">
                <Sparkles className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                <p className="text-xs text-gray-600">One-time use</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <Shield className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Secure</p>
              </div>
            </div>

            <button
              onClick={() => setShowSingleUseModal(false)}
              className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;