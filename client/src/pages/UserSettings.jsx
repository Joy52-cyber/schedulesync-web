import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { 
  User, 
  Mail, 
  Globe, 
  Calendar, 
  Save, 
  Check, 
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Unlink,
  Upload,
  Bot,
  Key,
  TestTube,
  Download,
  BookOpen,
  Shield,
  Clock,
  Copy,
  Sparkles,
  Zap,
  X,
  Link2,
  FileText,
  CreditCard,
} from 'lucide-react';
import api, { 
  auth, 
  timezone as timezoneApi, 
  reminders as remindersApi, 
  calendar as calendarApi,
  chatgptIntegration,
} from '../utils/api';

import SubscriptionSettings from '../components/SubscriptionSettings';


export default function UserSettings() {
  const [searchParams] = useSearchParams();
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    timezone: 'America/New_York',
  });

  const [personalTeamId, setPersonalTeamId] = useState(null);

  // 🔔 Reminder settings
  const [reminderSettings, setReminderSettings] = useState({
    enabled: true,
    hoursBefore: 24,
    sendToHost: true,
    sendToGuest: true,
  });
  const [remindersLoading, setRemindersLoading] = useState(false);

  // 📅 Calendar connections
  const [calendarStatus, setCalendarStatus] = useState({
    google: { connected: false, email: null, lastSync: null },
    microsoft: { connected: false, email: null, lastSync: null },
  });
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // 🤖 ChatGPT Integration State
  const [chatgptToken, setChatgptToken] = useState('');
  const [chatgptTokenExpiry, setChatgptTokenExpiry] = useState('');
  const [chatgptSetupStatus, setChatgptSetupStatus] = useState(null);
  const [chatgptLoading, setChatgptLoading] = useState(false);
  const [chatgptTokenCopied, setChatgptTokenCopied] = useState(false);
  const [refreshingChatgptToken, setRefreshingChatgptToken] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Update active tab when URL changes
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      const userRes = await auth.me();
      const userData = userRes.data.user;
      
      setProfile({
        name: userData.name,
        email: userData.email,
        timezone: userData.timezone || 'America/New_York',
      });

      // Find personal team (for reminders)
      const teamsRes = await api.get('/teams');
      const personalTeam = teamsRes.data.teams.find((t) =>
        t.name.includes('Personal Bookings')
      );
      
      if (personalTeam) {
        setPersonalTeamId(personalTeam.id);

        // Load reminder settings
        try {
          setRemindersLoading(true);
          const remRes = await remindersApi.getSettings(personalTeam.id);
          const s = remRes.data?.settings || remRes.data || {};

          setReminderSettings({
            enabled: s.enabled ?? true,
            hoursBefore: s.hours_before ?? 24,
            sendToHost: s.send_to_host ?? true,
            sendToGuest: s.send_to_guest ?? true,
          });
        } catch (err) {
          console.error('Error loading reminder settings:', err);
        } finally {
          setRemindersLoading(false);
        }
      }

      // Load calendar status
      await loadCalendarStatus();

      // Load ChatGPT token if on integrations tab
      if (activeTab === 'integrations') {
        await loadChatGptToken();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarStatus = async () => {
    try {
      setCalendarLoading(true);
      const response = await calendarApi.getStatus();
      const status = response.data;

      setCalendarStatus({
        google: {
          connected: status.google?.connected || false,
          email: status.google?.email || null,
          lastSync: status.google?.last_sync || null,
        },
        microsoft: {
          connected: status.microsoft?.connected || false,
          email: status.microsoft?.email || null,
          lastSync: status.microsoft?.last_sync || null,
        },
      });
    } catch (error) {
      console.error('Error loading calendar status:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  // ChatGPT Integration Functions
  const loadChatGptToken = async () => {
    setChatgptLoading(true);
    try {
      const response = await chatgptIntegration.getToken();
      if (response.data.jwt_token) {
        setChatgptToken(response.data.jwt_token);
        setChatgptTokenExpiry(response.data.expires_in || '90 days');
        setChatgptSetupStatus(response.data.setup_status);
      }
    } catch (error) {
      console.error('ChatGPT token load error:', error);
    } finally {
      setChatgptLoading(false);
    }
  };

  const handleCopyChatGptToken = async () => {
    try {
      await navigator.clipboard.writeText(chatgptToken);
      setChatgptTokenCopied(true);
      notify.success('ChatGPT token copied to clipboard! 🤖');
      setTimeout(() => setChatgptTokenCopied(false), 2000);
    } catch (error) {
      console.error('Error copying ChatGPT token:', error);
      notify.error('Could not copy token. Please select and copy manually.');
    }
  };

  const handleRefreshChatGptToken = async () => {
    setRefreshingChatgptToken(true);
    try {
      const response = await chatgptIntegration.refreshToken();
      if (response.data.jwt_token) {
        setChatgptToken(response.data.jwt_token);
        setChatgptTokenExpiry(response.data.expires_in || '90 days');
        notify.success('ChatGPT token refreshed successfully! 🔄');
      }
    } catch (error) {
      console.error('Error refreshing ChatGPT token:', error);
      notify.error('Could not refresh ChatGPT token');
    } finally {
      setRefreshingChatgptToken(false);
    }
  };

  const handleTestChatGptConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await chatgptIntegration.testConnection();
      if (response.data.connection_status === 'READY') {
        notify.success('✅ ChatGPT connection ready! All tests passed.');
      } else {
        notify.warning('⚠️ Some issues found. Check your ScheduleSync setup.');
        console.log('Test results:', response.data.tests);
      }
    } catch (error) {
      console.error('Error testing ChatGPT connection:', error);
      notify.error('❌ Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDownloadSchema = async () => {
    try {
      const response = await fetch('/api/user/chatgpt-openapi-schema');
      const schema = await response.json();
      
      const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schedulesync-chatgpt-api-schema.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      notify.success('📄 API schema downloaded!');
    } catch (error) {
      console.error('Error downloading schema:', error);
      notify.error('Could not download API schema');
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const response = await calendarApi.connectGoogle();
      const authUrl = response.data.url;
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error connecting Google:', error);
      alert('Failed to connect Google Calendar');
    }
  };

  const handleConnectMicrosoft = async () => {
    try {
      const response = await api.oauth.getMicrosoftUrl();
      const authUrl = response.data.url;
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error connecting Microsoft:', error);
      alert('Failed to connect Microsoft Calendar');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Disconnect Google Calendar? This will stop syncing your events.')) return;
    
    try {
      await calendarApi.disconnectGoogle();
      await loadCalendarStatus();
      alert('Google Calendar disconnected successfully!');
    } catch (error) {
      console.error('Error disconnecting Google:', error);
      alert('Failed to disconnect Google Calendar');
    }
  };

  const handleSyncCalendar = async () => {
    try {
      setSyncing(true);
      await calendarApi.syncEvents();
      await loadCalendarStatus();
      alert('Calendar synced successfully!');
    } catch (error) {
      console.error('Error syncing calendar:', error);
      alert('Failed to sync calendar');
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save timezone
      await timezoneApi.update(profile.timezone);

      // Save reminder settings
      if (personalTeamId) {
        await remindersApi.updateSettings(personalTeamId, {
          enabled: reminderSettings.enabled,
          hours_before: reminderSettings.hoursBefore,
          send_to_host: reminderSettings.sendToHost,
          send_to_guest: reminderSettings.sendToGuest,
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const handleTabChange = async (newTab) => {
    setActiveTab(newTab);
    
    // Load ChatGPT data when switching to integrations tab
    if (newTab === 'integrations' && !chatgptToken) {
      await loadChatGptToken();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Manage your profile, calendars, integrations and notifications</p>
        </div>
        {activeTab !== 'calendars' && activeTab !== 'integrations' && activeTab !== 'email-templates' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 rounded-full hover:bg-blue-700 transition-all flex items-center justify-center gap-2 font-bold text-sm shadow-sm disabled:opacity-70 w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            <button
              onClick={() => handleTabChange('profile')}
              className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <User size={18} /> Profile
            </button>
            <button
              onClick={() => handleTabChange('calendars')}
              className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'calendars'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar size={18} /> Calendars
            </button>
            <button
              onClick={() => handleTabChange('integrations')}
              className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'integrations'
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Link2 size={18} /> Integrations
              {chatgptToken && (
                <div className="ml-auto w-2 h-2 bg-green-500 rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => handleTabChange('notifications')}
              className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'notifications'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Mail size={18} /> Notifications
            </button>
            <button
              onClick={() => handleTabChange('email-templates')}
              className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'email-templates'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileText size={18} /> Templates
            </button>
            
            <Link 
              to="/billing" 
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors text-gray-600 hover:bg-gray-50 whitespace-nowrap"
            >
              <CreditCard size={18} className="text-gray-400" />
              <span>Billing</span>
            </Link>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px] overflow-hidden">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="p-4 sm:p-8 max-w-xl">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Profile Details</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Timezone
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <select
                      value={profile.timezone}
                      onChange={(e) =>
                        setProfile({ ...profile, timezone: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Europe/London">London</option>
                      <option value="Asia/Singapore">Singapore</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                      <option value="Australia/Sydney">Sydney</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INTEGRATIONS TAB */}
          {activeTab === 'integrations' && (
            <div className="p-4 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Integrations</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Connect external services to enhance your scheduling workflow
                </p>
              </div>

              <div className="space-y-6 max-w-4xl">
                {/* ChatGPT Integration */}
                <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border-2 border-indigo-200 p-4 sm:p-6 shadow-lg">
                  {/* Header - Mobile Responsive */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <Bot className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                          ChatGPT Integration
                          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-600">Connect ScheduleSync to ChatGPT</p>
                      </div>
                    </div>
                    
                    {/* Ready Badge - Responsive */}
                    {chatgptSetupStatus?.has_booking_setup && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg border border-green-200 self-start sm:self-auto">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Ready for ChatGPT</span>
                      </div>
                    )}
                  </div>

                  {/* JWT Token Section */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/50 p-4 sm:p-5 mb-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Key className="h-5 w-5 text-indigo-600" />
                        Your API Token
                      </h3>
                      <button
                        onClick={handleRefreshChatGptToken}
                        disabled={refreshingChatgptToken}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-1 transition-all disabled:opacity-50 self-start sm:self-auto"
                      >
                        {refreshingChatgptToken ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Refresh
                      </button>
                    </div>

                    {chatgptLoading ? (
                      <div className="flex items-center gap-2 p-4">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        <span className="text-sm text-gray-600">Loading token...</span>
                      </div>
                    ) : chatgptToken ? (
                      <div className="space-y-3">
                        <div className="bg-gray-900 text-gray-100 p-3 sm:p-4 rounded-lg font-mono text-xs break-all border overflow-x-auto">
                          {chatgptToken}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 sm:gap-4">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires: {chatgptTokenExpiry}
                            </span>
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Bearer Token
                            </span>
                          </div>
                          <button
                            onClick={handleCopyChatGptToken}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-sm w-full sm:w-auto"
                          >
                            {chatgptTokenCopied ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy Token
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Bot className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">ChatGPT integration not available</p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Mobile Responsive */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-5">
                    <button
                      onClick={handleTestChatGptConnection}
                      disabled={testingConnection || !chatgptToken}
                      className="px-4 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
                    >
                      {testingConnection ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <TestTube className="h-4 w-4" />
                          Test Connection
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDownloadSchema}
                      disabled={!chatgptToken}
                      className="px-4 py-2.5 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
                    >
                      <Download className="h-4 w-4" />
                      Download Schema
                    </button>

                    <button
                      onClick={() => setShowInstructions(true)}
                      className="px-4 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
                    >
                      <BookOpen className="h-4 w-4" />
                      Setup Guide
                    </button>
                  </div>

                  {/* Quick Setup Steps */}
                  <div className="p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-white/50">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Quick Setup
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">1</div>
                        <span className="text-gray-700">Copy token</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">2</div>
                        <span className="text-gray-700">Create GPT</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">3</div>
                        <span className="text-gray-700">Import schema</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">✓</div>
                        <span className="text-gray-700">Done!</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coming Soon Integrations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="border-2 border-gray-200 rounded-xl p-4 sm:p-6 opacity-60">
                    <div className="flex items-center gap-3 sm:gap-4 mb-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-700 text-sm sm:text-base">Slack Integration</h3>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-semibold">Coming Soon</span>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500">Schedule meetings directly from Slack channels</p>
                  </div>

                  <div className="border-2 border-gray-200 rounded-xl p-4 sm:p-6 opacity-60">
                    <div className="flex items-center gap-3 sm:gap-4 mb-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-700 text-sm sm:text-base">Microsoft Teams</h3>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-semibold">Coming Soon</span>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500">Enterprise-grade Teams integration</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CALENDAR CONNECTIONS TAB */}
          {activeTab === 'calendars' && (
            <div className="p-4 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Calendar Connections</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Connect your calendars to prevent double bookings.
                </p>
              </div>

              {calendarLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="space-y-4 max-w-2xl">
                  {/* Google Calendar Card */}
                  <div className="border-2 border-gray-200 rounded-xl p-4 sm:p-6 hover:border-blue-300 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-base sm:text-lg">Google Calendar</h3>
                          {calendarStatus.google.connected ? (
                            <div className="space-y-1 mt-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-600 font-medium">Connected</span>
                              </div>
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">{calendarStatus.google.email}</p>
                              <p className="text-xs text-gray-400">
                                Last synced: {formatLastSync(calendarStatus.google.lastSync)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not connected</p>
                          )}
                        </div>
                      </div>

                      {/* Buttons - Stack on mobile */}
                      <div className="flex flex-col gap-2 w-full sm:w-auto">
                        {calendarStatus.google.connected ? (
                          <>
                            <button
                              onClick={handleSyncCalendar}
                              disabled={syncing}
                              className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
                            >
                              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                              Sync Now
                            </button>
                            <button
                              onClick={handleDisconnectGoogle}
                              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium flex items-center justify-center gap-2 w-full sm:w-auto"
                            >
                              <Unlink className="h-4 w-4" />
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleConnectGoogle}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 w-full sm:w-auto"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Microsoft Calendar Card */}
                  <div className="border-2 border-gray-200 rounded-xl p-4 sm:p-6 hover:border-blue-300 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-base sm:text-lg">Microsoft Outlook</h3>
                          {calendarStatus.microsoft.connected ? (
                            <div className="space-y-1 mt-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-600 font-medium">Connected</span>
                              </div>
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">{calendarStatus.microsoft.email}</p>
                              <p className="text-xs text-gray-400">
                                Last synced: {formatLastSync(calendarStatus.microsoft.lastSync)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not connected</p>
                          )}
                        </div>
                      </div>

                      {/* Button - Responsive */}
                      <div className="w-full sm:w-auto">
                        {calendarStatus.microsoft.connected ? (
                          <button
                            className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed w-full sm:w-auto"
                            disabled
                          >
                            Connected
                          </button>
                        ) : (
                          <button
                            onClick={handleConnectMicrosoft}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 w-full sm:w-auto"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info Box - MOVED after Microsoft Outlook */}
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">How calendar sync works:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• We check your calendar for conflicts before showing available slots</li>
                          <li>• Your calendar data stays private - we only check busy/free status</li>
                          <li>• Sync happens automatically every 15 minutes</li>
                          <li>• You can manually sync anytime using "Sync Now"</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Calendly Import Card */}
                  <div className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6 hover:border-purple-400 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 text-base sm:text-lg">Import from Calendly</h3>
                            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-semibold">
                              NEW
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-purple-700 mb-2">
                            Migrate your event types, availability, and booking history
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-purple-600">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Events
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Availability
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Bookings
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Button - Responsive */}
                      <button
                        onClick={() => window.location.href = '/import/calendly'}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        <Upload className="h-4 w-4" />
                        Start Import
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="p-4 sm:p-8 max-w-xl space-y-8">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Email reminders
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Control reminder emails sent before each meeting.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReminderSettings((prev) => ({
                      ...prev,
                      enabled: !prev.enabled,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    reminderSettings.enabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      reminderSettings.enabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {remindersLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading reminder settings…
                </div>
              )}

              <div
                className={`space-y-6 mt-4 ${
                  !reminderSettings.enabled ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                {/* Timing */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    When should we send the reminder?
                  </label>
                  <select
                    value={reminderSettings.hoursBefore}
                    onChange={(e) =>
                      setReminderSettings((prev) => ({
                        ...prev,
                        hoursBefore: Number(e.target.value),
                      }))
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                  >
                    <option value={1}>1 hour before</option>
                    <option value={3}>3 hours before</option>
                    <option value={6}>6 hours before</option>
                    <option value={24}>24 hours before</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-400">
                    Applies to all upcoming meetings booked through your personal link.
                  </p>
                </div>

                {/* Recipients */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Who should receive reminders?
                  </h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={reminderSettings.sendToHost}
                        onChange={(e) =>
                          setReminderSettings((prev) => ({
                            ...prev,
                            sendToHost: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Send to me (host)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={reminderSettings.sendToGuest}
                        onChange={(e) =>
                          setReminderSettings((prev) => ({
                            ...prev,
                            sendToGuest: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Send to guest</span>
                    </label>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-50 bg-blue-50/50 px-4 py-3 text-xs text-blue-800 flex gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>
                    Reminders will only be sent for future bookings that have a valid
                    guest email and are not cancelled.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* EMAIL TEMPLATES TAB */}
          {activeTab === 'email-templates' && (
            <div className="p-4 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Email Templates</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Customize the emails sent to you and your guests
                </p>
              </div>
              
              <div className="max-w-2xl">
                {/* Feature Overview */}
                <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border-2 border-blue-200 p-4 sm:p-6 mb-6">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                        Personalize Your Booking Emails
                      </h3>
                      <p className="text-gray-600 text-xs sm:text-sm mb-4">
                        Create custom email templates for booking confirmations, reminders, 
                        cancellations, and more.
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-2 sm:px-3 py-1 bg-white rounded-full text-xs font-medium text-blue-700 border border-blue-200">
                          ✅ Confirmations
                        </span>
                        <span className="px-2 sm:px-3 py-1 bg-white rounded-full text-xs font-medium text-purple-700 border border-purple-200">
                          ⏰ Reminders
                        </span>
                        <span className="px-2 sm:px-3 py-1 bg-white rounded-full text-xs font-medium text-red-700 border border-red-200">
                          ❌ Cancellations
                        </span>
                        <span className="px-2 sm:px-3 py-1 bg-white rounded-full text-xs font-medium text-green-700 border border-green-200">
                          🔄 Reschedules
                        </span>
                      </div>

                      <a
                        href="/email-templates"
                        className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm text-sm"
                      >
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                        Manage Templates
                      </a>
                    </div>
                  </div>
                </div>

                {/* Quick Tips */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">Tips for great email templates:</p>
                      <ul className="space-y-1 text-xs">
                        <li>• Use variables like <code className="bg-amber-100 px-1 rounded">{'{{attendee_name}}'}</code> to personalize</li>
                        <li>• Keep subject lines clear with key info</li>
                        <li>• Include a link for guests to manage booking</li>
                        <li>• Preview templates before setting as default</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Setup Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">
            <button onClick={() => setShowInstructions(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="h-5 w-5 text-gray-500" />
            </button>

            <div className="mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600" />
                ChatGPT Setup Guide
              </h3>
              <p className="text-gray-600 text-sm">Follow these steps to connect ScheduleSync to ChatGPT</p>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Step 1 */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
                  <div className="flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Copy Your JWT Token</h4>
                    <p className="text-gray-600 text-sm mb-3">Use the token from the section above. Click "Copy Token" to copy it.</p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs sm:text-sm text-yellow-800"><strong>Note:</strong> This token expires in 90 days.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                  <div className="flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Create ChatGPT Custom GPT</h4>
                    <p className="text-gray-600 text-sm mb-3">Go to ChatGPT and create a new custom GPT.</p>
                    <a href="https://chat.openai.com/gpts/discovery" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm">
                      <ExternalLink className="h-4 w-4" />
                      Open ChatGPT GPTs
                    </a>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                  <div className="flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Configure Your GPT</h4>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-gray-700">Name:</label>
                        <div className="bg-gray-50 p-2 rounded font-mono text-xs sm:text-sm">AI Meeting Booker</div>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-gray-700">Description:</label>
                        <div className="bg-gray-50 p-2 rounded font-mono text-xs sm:text-sm">The fastest way to a confirmed meeting</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">4</div>
                  <div className="flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Add API Actions</h4>
                    <p className="text-gray-600 text-sm mb-3">Import our API schema and configure authentication.</p>
                    <ol className="list-decimal list-inside space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                      <li>Click "Actions" in your GPT configuration</li>
                      <li>Click "Create new action"</li>
                      <li>Download and import our API schema</li>
                      <li>Set Authentication to "Bearer"</li>
                      <li>Paste your JWT token as the Bearer token</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">✓</div>
                  <div className="flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Test Your Integration</h4>
                    <p className="text-gray-600 text-sm mb-3">Try these commands in your ChatGPT:</p>
                    <div className="space-y-2">
                      {[
                        '"What\'s my booking link?"',
                        '"Create a temp link for John"',
                        '"Find meeting times for next week"',
                      ].map((command, idx) => (
                        <div key={idx} className="bg-gray-50 p-2 rounded font-mono text-xs sm:text-sm">{command}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
                  Need help? Test your connection above or contact support.
                </div>
                <button
                  onClick={() => setShowInstructions(false)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors w-full sm:w-auto"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}