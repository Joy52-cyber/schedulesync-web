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
  ChevronDown,
  ChevronUp,
  Mail,
  User,
  Users,
  Building2,
} from 'lucide-react';
import api from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { useUpgrade } from '../context/UpgradeContext';

export default function MyLinks() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { hasProFeature, hasTeamFeature, showUpgradeModal } = useUpgrade();

  const [user, setUser] = useState(null);
  const [bookingLink, setBookingLink] = useState('');
  const [bookingToken, setBookingToken] = useState('');
  const [copied, setCopied] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  
  // Single-use links
  const [singleUseLinks, setSingleUseLinks] = useState([]);
  const [generatingSingleUse, setGeneratingSingleUse] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Enhanced magic link form
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendeeName, setAttendeeName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  
  // Teams and members for dropdowns
  const [teams, setTeams] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  // Load team members when team is selected
  useEffect(() => {
    if (selectedTeamId) {
      loadTeamMembers(selectedTeamId);
    } else {
      setTeamMembers([]);
      setSelectedMemberId('');
    }
  }, [selectedTeamId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserProfile(),
        loadBookingLink(),
        loadSingleUseLinks(),
        loadTeams()
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
      const response = await api.get('/my-booking-link');
      if (response.data.bookingUrl) {
        setBookingLink(response.data.bookingUrl);
        setBookingToken(response.data.bookingToken);
      }
    } catch (error) {
      console.error('Failed to load booking link:', error);
    }
  };

  const loadSingleUseLinks = async () => {
    try {
      const response = await api.get('/magic-links');
      setSingleUseLinks(response.data.links || []);
    } catch (error) {
      console.error('Load magic links error:', error);
      // Fallback to old endpoint
      try {
        const fallback = await api.singleUseLinks?.getRecent?.();
        setSingleUseLinks(fallback?.data?.links || []);
      } catch (e) {
        console.error('Fallback also failed:', e);
      }
    }
  };

  const loadTeams = async () => {
    if (!hasTeamFeature()) return;
    setLoadingTeams(true);
    try {
      const response = await api.get('/teams');
      setTeams(response.data.teams || response.data || []);
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadTeamMembers = async (teamId) => {
    try {
      const response = await api.get(`/teams/${teamId}/members`);
      setTeamMembers(response.data.members || response.data || []);
    } catch (error) {
      console.error('Failed to load team members:', error);
      setTeamMembers([]);
    }
  };

  const handleCreateLink = async () => {
    setGeneratingLink(true);
    try {
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

  const handleGenerateMagicLink = async () => {
    // Check if Pro feature is available
    if (!hasProFeature()) {
      showUpgradeModal('magic_links');
      return;
    }

    setGeneratingSingleUse(true);
    try {
      const payload = {
        name: linkName.trim() || null,
        attendee_email: attendeeEmail.trim() || null,
        attendee_name: attendeeName.trim() || null,
        team_id: selectedTeamId || null,
        assigned_member_id: selectedMemberId || null
      };

      const response = await api.post('/magic-links', payload);
      
      // Reset form
      setLinkName('');
      setAttendeeEmail('');
      setAttendeeName('');
      setSelectedTeamId('');
      setSelectedMemberId('');
      setShowAdvancedOptions(false);
      
      await loadSingleUseLinks();
      notify.success('Magic link created! ✨');
    } catch (error) {
      console.error('Generate magic link error:', error);
      if (error.response?.status === 403) {
        notify.error('Upgrade to Pro for magic links');
        showUpgradeModal('magic_links');
      } else {
        notify.error(error.response?.data?.error || 'Could not generate magic link');
      }
    } finally {
      setGeneratingSingleUse(false);
    }
  };

  const handleCopyMagicLink = (link) => {
    const url = link.url || `${window.location.origin}/m/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopied(link.token);
    notify.success('Magic link copied! 📋');
    setTimeout(() => setCopied(''), 2000);
  };

  const getMagicLinkStatus = (link) => {
    const now = new Date();
    const expiresAt = new Date(link.expires_at);

    if (link.is_used || link.used) {
      return { label: 'Used', color: 'bg-gray-100 text-gray-600', icon: CheckCircle2 };
    }
    if (expiresAt < now) {
      return { label: 'Expired', color: 'bg-red-100 text-red-600', icon: XCircle };
    }
    const hoursRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60));
    const daysRemaining = Math.floor(hoursRemaining / 24);
    const timeLabel = daysRemaining > 0 ? `${daysRemaining}d left` : `${hoursRemaining}h left`;
    return { label: `Active (${timeLabel})`, color: 'bg-green-100 text-green-600', icon: Clock };
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

          {/* Magic Links (Single-Use) */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-purple-900 flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Ticket className="h-5 w-5 text-purple-600" />
              </div>
              Magic Links
              {hasProFeature() && (
                <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Pro</span>
              )}
            </h2>
            <p className="text-purple-700 text-sm mb-4">
              Single-use links for specific clients or meetings
            </p>

            <div className="space-y-4">
              {/* Link Name */}
              <input
                type="text"
                placeholder="Link name (optional) - e.g., 'Client ABC'"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                maxLength={50}
              />

              {/* Advanced Options Toggle */}
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 transition-colors"
              >
                {showAdvancedOptions ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {showAdvancedOptions ? 'Hide options' : 'More options'}
              </button>

              {/* Advanced Options */}
              {showAdvancedOptions && (
                <div className="space-y-3 p-4 bg-white/50 rounded-xl border border-purple-100">
                  {/* Attendee Email */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <Mail className="h-4 w-4 text-purple-500" />
                      Pre-fill attendee email
                    </label>
                    <input
                      type="email"
                      placeholder="john@company.com"
                      value={attendeeEmail}
                      onChange={(e) => setAttendeeEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </div>

                  {/* Attendee Name */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <User className="h-4 w-4 text-purple-500" />
                      Pre-fill attendee name
                    </label>
                    <input
                      type="text"
                      placeholder="John Smith"
                      value={attendeeName}
                      onChange={(e) => setAttendeeName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </div>

                  {/* Team Selection (Team plan only) */}
                  {hasTeamFeature() && teams.length > 0 && (
                    <>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                          <Building2 className="h-4 w-4 text-purple-500" />
                          Assign to team
                        </label>
                        <select
                          value={selectedTeamId}
                          onChange={(e) => setSelectedTeamId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        >
                          <option value="">-- Select team (optional) --</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Team Member Selection */}
                      {selectedTeamId && teamMembers.length > 0 && (
                        <div>
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                            <Users className="h-4 w-4 text-purple-500" />
                            Assign to team member
                          </label>
                          <select
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                          >
                            <option value="">-- Any available member --</option>
                            {teamMembers.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name} {member.email ? `(${member.email})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {/* Team upsell for non-team users */}
                  {!hasTeamFeature() && (
                    <div className="p-3 bg-purple-100/50 rounded-lg">
                      <p className="text-sm text-purple-800">
                        <Users className="h-4 w-4 inline mr-1" />
                        Upgrade to Team plan to assign links to team members
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerateMagicLink}
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
                    <Sparkles className="h-5 w-5" />
                    Create Magic Link
                  </>
                )}
              </button>
              
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <Clock className="h-4 w-4" />
                <span>Expires in 7 days, single-use only</span>
              </div>

              {/* Pro upsell */}
              {!hasProFeature() && (
                <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-800 font-medium mb-2">
                    ✨ Magic links are a Pro feature
                  </p>
                  <button
                    onClick={() => showUpgradeModal('magic_links')}
                    className="text-sm text-purple-700 underline hover:text-purple-900"
                  >
                    Upgrade for unlimited magic links →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Magic Links */}
        {singleUseLinks.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Recent Magic Links</h3>
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
                const status = getMagicLinkStatus(link);
                const StatusIcon = status.icon;
                const isActive = !(link.is_used || link.used) && new Date(link.expires_at) > new Date();

                return (
                  <div
                    key={link.token}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-3 ${
                      isActive 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`px-3 py-1 rounded-lg ${status.color} text-sm font-medium flex items-center gap-2 flex-shrink-0`}>
                        <StatusIcon className="h-4 w-4" />
                        {status.label}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {link.name && (
                          <span className="font-medium text-gray-900 block truncate">
                            {link.name}
                          </span>
                        )}
                        
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
                          {link.attendee_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {link.attendee_email}
                            </span>
                          )}
                          {link.attendee_name && !link.attendee_email && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {link.attendee_name}
                            </span>
                          )}
                          {link.team_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {link.team_name}
                            </span>
                          )}
                          {link.assigned_member_name && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {link.assigned_member_name}
                            </span>
                          )}
                          <span>{new Date(link.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <button
                        onClick={() => handleCopyMagicLink(link)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 flex-shrink-0 ${
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

        {/* Empty state for magic links */}
        {singleUseLinks.length === 0 && (
          <div className="mt-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center">
            <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-700 mb-1">No magic links yet</h3>
            <p className="text-sm text-gray-500">
              Create your first magic link above for specific clients
            </p>
          </div>
        )}
      </div>
    </div>
  );
}