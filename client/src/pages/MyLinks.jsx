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
  Trash2,
  Calendar,
  Hash,
  Settings2,
  X,
} from 'lucide-react';
import api from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { useUpgrade } from '../context/UpgradeContext';

export default function MyLinks() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { showUpgradeModal } = useUpgrade();

  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState('');
  
  // Magic Links
  const [magicLinks, setMagicLinks] = useState([]);
  const [generatingMagicLink, setGeneratingMagicLink] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Magic Link Form
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendeeName, setAttendeeName] = useState('');
  const [schedulingMode, setSchedulingMode] = useState('collective');
  const [usageLimit, setUsageLimit] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('7');
  
  // Team Members Selection
  const [availableTeams, setAvailableTeams] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showMemberSelector, setShowMemberSelector] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserProfile(),
        loadMagicLinks(),
        loadAvailableMembers()
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

  const loadMagicLinks = async () => {
    try {
      const response = await api.get('/magic-links');
      setMagicLinks(response.data.links || []);
    } catch (error) {
      console.error('Load magic links error:', error);
    }
  };

  const loadAvailableMembers = async () => {
    try {
      const response = await api.get('/magic-links/available-members');
      setAvailableTeams(response.data.teams || []);
      setAvailableMembers(response.data.members || []);
    } catch (error) {
      console.error('Load available members error:', error);
    }
  };

  const handleCopyLink = (link, type = 'permanent') => {
    navigator.clipboard.writeText(link);
    setCopied(type);
    notify.success('Link copied to clipboard! 📋');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleGenerateMagicLink = async () => {
    // Check if Pro feature
    const tier = user?.subscription_tier || 'free';
    if (tier === 'free') {
      showUpgradeModal('magic_links');
      return;
    }
    
    setGeneratingMagicLink(true);
    try {
      const payload = {
        name: linkName.trim() || null,
        attendee_email: attendeeEmail.trim() || null,
        attendee_name: attendeeName.trim() || null,
        member_ids: selectedMembers.map(m => m.id),
        scheduling_mode: schedulingMode,
        usage_limit: usageLimit === 'unlimited' ? null : parseInt(usageLimit),
        expires_in_days: expiresInDays === 'never' ? 'never' : parseInt(expiresInDays)
      };
      
      await api.post('/magic-links', payload);
      
      // Reset form
      setLinkName('');
      setAttendeeEmail('');
      setAttendeeName('');
      setSelectedMembers([]);
      setSchedulingMode('collective');
      setUsageLimit('1');
      setExpiresInDays('7');
      setShowAdvancedOptions(false);
      
      await loadMagicLinks();
      notify.success('Quick link created! ✨');
    } catch (error) {
      console.error('Generate quick link error:', error);
      notify.error(error.response?.data?.error || 'Could not generate quick link');
    } finally {
      setGeneratingMagicLink(false);
    }
  };

  const handleDeleteMagicLink = async (linkId) => {
    if (!confirm('Are you sure you want to delete this quick link?')) return;

    try {
      await api.delete(`/magic-links/${linkId}`);
      await loadMagicLinks();
      notify.success('Quick link deleted');
    } catch (error) {
      notify.error('Could not delete quick link');
    }
  };

  const toggleMemberSelection = (member) => {
    const isSelected = selectedMembers.some(m => m.id === member.id);
    if (isSelected) {
      setSelectedMembers(selectedMembers.filter(m => m.id !== member.id));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  // Helper to format expiration status with color-coded badges
  const formatExpiration = (expiresAt) => {
    if (!expiresAt) return { text: 'Never expires', color: 'green' };
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffDays = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Expired', color: 'red' };
    if (diffDays === 0) return { text: 'Expires today', color: 'orange' };
    if (diffDays === 1) return { text: 'Expires tomorrow', color: 'orange' };
    if (diffDays <= 3) return { text: `Expires in ${diffDays} days`, color: 'yellow' };
    return { text: `Expires in ${diffDays} days`, color: 'gray' };
  };

  const getMagicLinkStatus = (link) => {
    const now = new Date();

    // Check if used/exhausted first
    if (link.is_used && link.usage_limit === 1) {
      return { label: 'Used', color: 'bg-gray-100 text-gray-600', icon: CheckCircle2 };
    }
    if (link.is_exhausted || (link.usage_limit && link.usage_count >= link.usage_limit)) {
      return { label: 'Exhausted', color: 'bg-gray-100 text-gray-600', icon: CheckCircle2 };
    }

    // Check expiration (handle null = never expires)
    if (link.expires_at) {
      const expiresAt = new Date(link.expires_at);
      if (link.is_expired || expiresAt < now) {
        return { label: 'Expired', color: 'bg-red-100 text-red-600', icon: XCircle };
      }
    }

    // Active link - show expiration status
    const expiration = formatExpiration(link.expires_at);
    const usageText = link.usage_limit ? `${link.usage_count}/${link.usage_limit}` : '∞';

    // Color based on expiration urgency
    let statusColor = 'bg-green-100 text-green-600';
    if (expiration.color === 'orange') {
      statusColor = 'bg-orange-100 text-orange-600';
    } else if (expiration.color === 'yellow') {
      statusColor = 'bg-yellow-100 text-yellow-700';
    }

    return {
      label: `Active (${usageText})`,
      color: statusColor,
      icon: Clock,
      expiration: expiration
    };
  };

  const hasProFeature = () => {
    const tier = user?.subscription_tier || 'free';
    return tier === 'pro' || tier === 'team';
  };

  const hasTeamFeature = () => {
    const tier = user?.subscription_tier || 'free';
    return tier === 'team';
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Links</h1>
          <p className="text-gray-600">Share your profile link or create quick links for specific meetings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Permanent Profile Link */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-blue-900 flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Link2 className="h-5 w-5 text-blue-600" />
              </div>
              My Profile Link
            </h2>
            <p className="text-blue-700 text-sm mb-4">
              Your permanent booking page - share it anywhere
            </p>

            {user?.username ? (
              <div className="space-y-4">
                <div className="bg-white border border-blue-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Your personal booking page</p>
                  <p className="font-mono text-sm text-blue-700 break-all">
                    {`${window.location.origin}/${user.username}`}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleCopyLink(`${window.location.origin}/${user.username}`, 'permanent')}
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
                    onClick={() => window.open(`/${user.username}`, '_blank')}
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
                    Set up your username in Settings to get your personal booking link.
                  </p>
                  <button
                    onClick={() => navigate('/settings')}
                    className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Settings2 className="h-5 w-5" />
                    Go to Settings
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-purple-900 flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              Quick Links
              {!hasProFeature() && (
                <span className="ml-2 px-2 py-0.5 bg-purple-200 text-purple-700 text-xs font-bold rounded-full">PRO</span>
              )}
            </h2>
            <p className="text-purple-700 text-sm mb-4">
              Create instant booking links for specific meetings
            </p>

            <div className="space-y-4">
              {/* Link Name */}
              <input
                type="text"
                placeholder="Link name (e.g., 'Sales Demo with John')"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                maxLength={100}
              />
              
              {/* Advanced Options Toggle */}
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center gap-2 text-purple-700 hover:text-purple-900 text-sm font-medium transition-colors"
              >
                {showAdvancedOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showAdvancedOptions ? 'Hide options' : 'More options'}
              </button>
              
              {/* Advanced Options Panel */}
              {showAdvancedOptions && (
                <div className="space-y-4 p-4 bg-white/50 rounded-xl border border-purple-100">
                  
                  {/* Attendee Pre-fill */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-purple-700 mb-1">
                        <User className="h-3 w-3 inline mr-1" />
                        Pre-fill Name
                      </label>
                      <input
                        type="text"
                        placeholder="John Smith"
                        value={attendeeName}
                        onChange={(e) => setAttendeeName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-700 mb-1">
                        <Mail className="h-3 w-3 inline mr-1" />
                        Pre-fill Email
                      </label>
                      <input
                        type="email"
                        placeholder="john@company.com"
                        value={attendeeEmail}
                        onChange={(e) => setAttendeeEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  
                  {/* Team Members Selection */}
                  <div>
                    <label className="block text-xs font-medium text-purple-700 mb-2">
                      <Users className="h-3 w-3 inline mr-1" />
                      Team Members in Meeting
                    </label>
                    
                    {/* Selected Members */}
                    {selectedMembers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedMembers.map(member => (
                          <span
                            key={member.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                          >
                            {member.name}
                            <button
                              onClick={() => toggleMemberSelection(member)}
                              className="hover:text-purple-900"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Member Selector Toggle */}
                    <button
                      onClick={() => setShowMemberSelector(!showMemberSelector)}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm text-left text-purple-600 hover:bg-purple-50 flex items-center justify-between"
                    >
                      <span>
                        {selectedMembers.length === 0 
                          ? '+ Add team members' 
                          : `+ Add more members`}
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showMemberSelector ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Member Dropdown */}
                    {showMemberSelector && availableMembers.length > 0 && (
                      <div className="mt-2 max-h-64 overflow-y-auto bg-white border border-purple-200 rounded-lg divide-y divide-purple-100">
                        {availableTeams.map(team => {
                          const teamMembers = availableMembers.filter(m => m.team_id === team.id);
                          const allTeamSelected = teamMembers.every(m => selectedMembers.some(sm => sm.id === m.id));
                          const someTeamSelected = teamMembers.some(m => selectedMembers.some(sm => sm.id === m.id));
                          
                          const toggleTeamSelection = () => {
                            if (allTeamSelected) {
                              // Deselect all from this team
                              setSelectedMembers(selectedMembers.filter(sm => !teamMembers.some(tm => tm.id === sm.id)));
                            } else {
                              // Select all from this team
                              const newMembers = [...selectedMembers];
                              teamMembers.forEach(tm => {
                                if (!newMembers.some(m => m.id === tm.id)) {
                                  newMembers.push(tm);
                                }
                              });
                              setSelectedMembers(newMembers);
                            }
                          };
                          
                          return (
                            <div key={team.id}>
                              <div className="px-3 py-2 bg-purple-50 flex items-center justify-between">
                                <span className="text-xs font-bold text-purple-800">{team.name}</span>
                                <button
                                  onClick={toggleTeamSelection}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${
                                    allTeamSelected 
                                      ? 'bg-purple-600 text-white' 
                                      : someTeamSelected
                                        ? 'bg-purple-200 text-purple-700'
                                        : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                  }`}
                                >
                                  {allTeamSelected ? '✓ All' : 'Select All'}
                                </button>
                              </div>
                              {teamMembers.map(member => {
                                const isSelected = selectedMembers.some(m => m.id === member.id);
                                return (
                                  <button
                                    key={member.id}
                                    onClick={() => toggleMemberSelection(member)}
                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-purple-50 ${
                                      isSelected ? 'bg-purple-100' : ''
                                    }`}
                                  >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                      isSelected 
                                        ? 'bg-purple-600 border-purple-600' 
                                        : 'border-gray-300'
                                    }`}>
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="flex-1">{member.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {availableMembers.length === 0 && (
                      <p className="text-xs text-purple-500 mt-2">
                        No team members available. Create a team first.
                      </p>
                    )}
                  </div>
                  
                  {/* Scheduling Mode */}
                  {selectedMembers.length > 1 && (
                    <div>
                      <label className="block text-xs font-medium text-purple-700 mb-2">
                        <Settings2 className="h-3 w-3 inline mr-1" />
                        Scheduling Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSchedulingMode('collective')}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            schedulingMode === 'collective'
                              ? 'bg-purple-600 text-white'
                              : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50'
                          }`}
                        >
                          Collective
                          <p className="text-xs opacity-75">All must be free</p>
                        </button>
                        <button
                          onClick={() => setSchedulingMode('round_robin')}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            schedulingMode === 'round_robin'
                              ? 'bg-purple-600 text-white'
                              : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50'
                          }`}
                        >
                          Round Robin
                          <p className="text-xs opacity-75">Any one available</p>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Usage & Expiration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-purple-700 mb-1">
                        <Hash className="h-3 w-3 inline mr-1" />
                        Usage Limit
                      </label>
                      <select
                        value={usageLimit}
                        onChange={(e) => setUsageLimit(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="1">Single use</option>
                        <option value="5">5 bookings</option>
                        <option value="10">10 bookings</option>
                        <option value="unlimited">Unlimited</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-700 mb-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Link Expiration
                      </label>
                      <select
                        value={expiresInDays}
                        onChange={(e) => setExpiresInDays(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="1">1 day</option>
                        <option value="3">3 days</option>
                        <option value="7">7 days (recommended)</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                        <option value="never">Never expires</option>
                      </select>
                      <p className="text-xs text-purple-500 mt-1">
                        Link will automatically expire after this period
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerateMagicLink}
                disabled={generatingMagicLink}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generatingMagicLink ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Create Quick Link
                  </>
                )}
              </button>

              {!hasProFeature() && (
                <div className="p-3 bg-purple-100/50 rounded-xl text-center">
                  <p className="text-sm text-purple-700">
                    <Sparkles className="h-4 w-4 inline mr-1" />
                    Upgrade to Pro for unlimited quick links
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Quick Links */}
        {magicLinks.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Recent Quick Links</h3>
              <button
                onClick={loadMagicLinks}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {magicLinks.map((link) => {
                const status = getMagicLinkStatus(link);
                const StatusIcon = status.icon;
                // Check if link is active: not used, not exhausted, and not expired
                const isExpired = link.is_expired || (link.expires_at && new Date(link.expires_at) < new Date());
                const isExhausted = link.is_exhausted || (link.usage_limit && link.usage_count >= link.usage_limit);
                const isActive = !link.is_used && !isExpired && !isExhausted;

                return (
                  <div
                    key={link.id}
                    className={`p-4 rounded-xl border ${
                      isActive 
                        ? 'bg-purple-50 border-purple-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Link Name & Status */}
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-lg ${status.color} text-xs font-medium flex items-center gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                          {/* Expiration Badge */}
                          {status.expiration && (
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                              status.expiration.color === 'green' ? 'bg-green-100 text-green-700' :
                              status.expiration.color === 'red' ? 'bg-red-100 text-red-600 line-through' :
                              status.expiration.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                              status.expiration.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {status.expiration.text}
                            </span>
                          )}
                          {link.scheduling_mode && link.scheduling_mode !== 'collective' && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                              {link.scheduling_mode}
                            </span>
                          )}
                        </div>
                        
                        {/* Link Name */}
                        <p className="font-semibold text-gray-900 truncate">
                          {link.link_name || `Quick Link ${link.token.substring(0, 8)}...`}
                        </p>
                        
                        {/* Details Row */}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                          {link.attendee_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {link.attendee_email}
                            </span>
                          )}
                          {link.members && link.members.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {link.members.map(m => m.name).join(', ')}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(link.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <button
                            onClick={() => handleCopyLink(link.url, link.token)}
                            className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-1 ${
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
                        <button
                          onClick={() => handleDeleteMagicLink(link.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {magicLinks.length === 0 && (
          <div className="mt-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center">
            <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-700 mb-1">No quick links yet</h3>
            <p className="text-sm text-gray-500">
              Create your first quick link above for specific clients or team meetings
            </p>
          </div>
        )}
      </div>
    </div>
  );
}