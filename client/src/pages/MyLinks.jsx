import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link2,
  Copy,
  Check,
  Ticket,
  Plus,
  ExternalLink,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import api from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

export default function MyLinks() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [user, setUser] = useState(null);
  const [bookingLink, setBookingLink] = useState('');
  const [bookingToken, setBookingToken] = useState('');
  const [copied, setCopied] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  
  // Single-use links
  const [singleUseLinks, setSingleUseLinks] = useState([]);
  const [generatingSingleUse, setGeneratingSingleUse] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserProfile(),
        loadBookingLink(),
        loadSingleUseLinks()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data.user || response.data;
      setUser(userData);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadBookingLink = async () => {
    try {
      // Note: api.js already has baseURL = '/api', so don't add /api again
      const response = await api.get('/my-booking-link');
      
      // Backend returns: { success, bookingUrl, bookingToken, team }
      if (response.data.bookingUrl) {
        setBookingLink(response.data.bookingUrl);
        setBookingToken(response.data.bookingToken);
      }
    } catch (error) {
      console.error('Failed to load booking link:', error);
      // Silent fail - user may not have a link yet
    }
  };

  const loadSingleUseLinks = async () => {
    try {
      const response = await api.singleUseLinks.getRecent();
      setSingleUseLinks(response.data.links || []);
    } catch (error) {
      console.error('Load single-use links error:', error);
    }
  };

  const handleCreateLink = async () => {
    setGeneratingLink(true);
    try {
      // This endpoint creates a personal booking team if it doesn't exist
      const response = await api.get('/my-booking-link');
      
      if (response.data.bookingUrl) {
        setBookingLink(response.data.bookingUrl);
        setBookingToken(response.data.bookingToken);
        notify.success('Booking link ready! 🎉');
      }
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
    setCopied('permanent');
    notify.success('Link copied to clipboard! 📋');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleGenerateSingleUse = async () => {
    setGeneratingSingleUse(true);
    try {
      await api.singleUseLinks.generate({ 
        name: linkName.trim() || null 
      });
      
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
    setCopied(token);
    notify.success('Single-use link copied! 📋');
    setTimeout(() => setCopied(''), 2000);
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
    return { label: `Active (${hoursRemaining}h left)`, color: 'bg-green-100 text-green-600', icon: Clock };
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your links...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Links</h1>
          <p className="text-gray-600">Manage your booking links and share them with clients</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Permanent Booking Link */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-blue-900 flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Link2 className="h-5 w-5 text-blue-600" />
              </div>
              My Booking Link
            </h2>
            <p className="text-blue-700 text-sm mb-4">
              Share this link anywhere - email signatures, social media, websites
            </p>
            
            {bookingLink ? (
              <div className="space-y-4">
                <div className="bg-white border border-blue-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Your personal booking page</p>
                  <p className="font-mono text-sm text-blue-700 break-all">
                    {bookingLink}
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleCopyLink}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm ${
                      copied === 'permanent'
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {copied === 'permanent' ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Link
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => window.open(bookingLink, '_blank')}
                    className="px-4 py-3 bg-white text-blue-600 border border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
                    title="Preview booking page"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Unlimited uses, never expires</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="text-sm text-orange-800 mb-3">
                    You don't have a personal booking link yet. Create one to start accepting bookings!
                  </p>
                  <button
                    onClick={handleCreateLink}
                    disabled={generatingLink}
                    className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {generatingLink ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Create My Booking Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Single-Use Links */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-purple-900 flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Ticket className="h-5 w-5 text-purple-600" />
              </div>
              Single-Use Links
            </h2>
            <p className="text-purple-700 text-sm mb-4">
              Generate one-time links for specific clients or meetings
            </p>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Name this link (optional) - e.g., 'Client ABC'"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    <Plus className="h-5 w-5" />
                    Generate Single-Use Link
                  </>
                )}
              </button>
              
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <Clock className="h-4 w-4" />
                <span>Expires in 24 hours, one-time use only</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Single-Use Links */}
        {singleUseLinks.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Recent Single-Use Links</h3>
              <button
                onClick={loadSingleUseLinks}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {singleUseLinks.map((link) => {
                const status = getSingleUseLinkStatus(link);
                const StatusIcon = status.icon;
                const isActive = !link.used && new Date(link.expires_at) > new Date();

                return (
                  <div
                    key={link.token}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      isActive 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`px-3 py-1 rounded-lg ${status.color} text-sm font-medium flex items-center gap-2`}>
                        <StatusIcon className="h-4 w-4" />
                        {status.label}
                      </div>
                      
                      {link.name ? (
                        <span className="font-medium text-gray-900 truncate">
                          {link.name}
                        </span>
                      ) : (
                        <code className="text-sm text-gray-600 font-mono truncate">
                          {link.token.substring(0, 16)}...
                        </code>
                      )}

                      <span className="text-sm text-gray-500 flex-shrink-0">
                        {new Date(link.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {isActive && (
                      <button
                        onClick={() => handleCopySingleUse(link.token)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                          copied === link.token
                            ? 'bg-green-600 text-white'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                      >
                        {copied === link.token ? (
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state for single-use links */}
        {singleUseLinks.length === 0 && (
          <div className="mt-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center">
            <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-700 mb-1">No single-use links yet</h3>
            <p className="text-sm text-gray-500">
              Generate your first single-use link above for specific clients
            </p>
          </div>
        )}
      </div>
    </div>
  );
}