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
  X,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import api from '../utils/api'; // ← Simple import
import { useNotification } from '../contexts/NotificationContext';


export default function MyLinks() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [user, setUser] = useState(null);
  const [bookingLink, setBookingLink] = useState('');
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
    await Promise.all([
      loadUserProfile(),
      loadSingleUseLinks()
    ]);
    setLoading(false);
  };

  const loadUserProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data.user;
      setUser(userData);
      if (userData?.booking_token) {
        setBookingLink(`${window.location.origin}/book/${userData.booking_token}`);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      notify.error('Failed to load profile');
    }
  };

 const loadSingleUseLinks = async () => {
  try {
    // Change from: const response = await singleUseLinks.getRecent();
    const response = await api.singleUseLinks.getRecent(); // ← Use attached API
    setSingleUseLinks(response.data.links || []);
  } catch (error) {
    console.error('Load single-use links error:', error);
  }
};

const handleGenerateSingleUse = async () => {
  setGeneratingSingleUse(true);
  try {
    // Change from: const response = await singleUseLinks.generate({ name: linkName.trim() || null });
    const response = await api.singleUseLinks.generate({ 
      name: linkName.trim() || null 
    }); // ← Use attached API
    
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
    setCopied('permanent');
    notify.success('Link copied to clipboard! 📋');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleGenerateSingleUse = async () => {
    setGeneratingSingleUse(true);
    try {
      const response = await singleUseLinks.generate({ name: linkName.trim() || null });
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
          
          {/* Permanent Link */}
          <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-blue-900 flex items-center gap-3 mb-4">
              <Link2 className="h-6 w-6" />
              Permanent Link
            </h2>
            <p className="text-blue-700 text-sm mb-4">
              ♾️ Unlimited uses • Never expires • Perfect for email signatures and social media
            </p>
            
            {bookingLink ? (
              <div className="space-y-4">
                <div className="font-mono text-sm text-blue-700 bg-white border border-blue-200 rounded-lg px-4 py-3 break-all">
                  {bookingLink}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    {copied === 'permanent' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === 'permanent' ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => window.open(bookingLink, '_blank')}
                    className="px-6 py-3 bg-white text-blue-600 border border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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

          {/* Single-Use Links */}
          <div className="bg-purple-50/50 rounded-2xl border border-purple-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-purple-900 flex items-center gap-3 mb-2">
              <Ticket className="h-6 w-6" />
              Single-Use Links
            </h2>
            <p className="text-purple-700 text-sm mb-4">
              🎯 One-time use • Expires in 24h • Perfect for specific clients
            </p>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Name this link (optional) - e.g., 'Client ABC'"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="w-full px-4 py-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    Generate Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Single-Use Links */}
        {singleUseLinks.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Single-Use Links</h3>
            <div className="space-y-3">
              {singleUseLinks.map((link) => {
                const status = getSingleUseLinkStatus(link);
                const StatusIcon = status.icon;
                const isActive = !link.used && new Date(link.expires_at) > new Date();

                return (
                  <div
                    key={link.token}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
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
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
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
      </div>
    </div>
  );
}