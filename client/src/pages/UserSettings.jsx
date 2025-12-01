// client/src/pages/UserSettings.jsx
import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import api, { auth, timezone as timezoneApi, reminders as remindersApi, calendar as calendarApi } from '../utils/api';


export default function UserSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
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

  useEffect(() => {
    loadData();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your profile, calendars and notifications</p>
        </div>
        {activeTab !== 'calendars' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-full hover:bg-blue-700 transition-all flex items-center gap-2 font-bold text-sm shadow-sm disabled:opacity-70"
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
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <User size={18} /> Profile
            </button>
            <button
              onClick={() => setActiveTab('calendars')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'calendars'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar size={18} /> Calendar Connections
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'notifications'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Mail size={18} /> Notifications
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px]">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="p-8 max-w-xl">
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

          {/* CALENDAR CONNECTIONS TAB */}
          {activeTab === 'calendars' && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Calendar Connections</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Connect your calendars to prevent double bookings and improve scheduling suggestions.
                </p>
              </div>

              {calendarLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="space-y-4 max-w-2xl">
                  {/* Google Calendar Card */}
                  <div className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">Google Calendar</h3>
                          {calendarStatus.google.connected ? (
                            <div className="space-y-1 mt-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-600 font-medium">Connected</span>
                              </div>
                              <p className="text-xs text-gray-500">{calendarStatus.google.email}</p>
                              <p className="text-xs text-gray-400">
                                Last synced: {formatLastSync(calendarStatus.google.lastSync)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not connected</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {calendarStatus.google.connected ? (
                          <>
                            <button
                              onClick={handleSyncCalendar}
                              disabled={syncing}
                              className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                              Sync Now
                            </button>
                            <button
                              onClick={handleDisconnectGoogle}
                              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium flex items-center gap-2"
                            >
                              <Unlink className="h-4 w-4" />
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleConnectGoogle}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Microsoft Calendar Card */}
                  <div className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">Microsoft Outlook</h3>
                          {calendarStatus.microsoft.connected ? (
                            <div className="space-y-1 mt-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-600 font-medium">Connected</span>
                              </div>
                              <p className="text-xs text-gray-500">{calendarStatus.microsoft.email}</p>
                              <p className="text-xs text-gray-400">
                                Last synced: {formatLastSync(calendarStatus.microsoft.lastSync)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not connected</p>
                          )}
                        </div>
                      </div>

                      <div>
                        {calendarStatus.microsoft.connected ? (
                          <button
                            className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
                            disabled
                          >
                            Connected
                          </button>
                        ) : (
                          <button
                            onClick={handleConnectMicrosoft}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CALENDAR CONNECTIONS TAB */}
{activeTab === 'calendars' && (
  <div className="p-8">
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900">Calendar Connections</h2>
      <p className="text-sm text-gray-500 mt-1">
        Connect your calendars to prevent double bookings and improve scheduling suggestions.
      </p>
    </div>

    {calendarLoading ? (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    ) : (
      <div className="space-y-4 max-w-2xl">
        {/* Google Calendar Card */}
        {/* ... existing Google card ... */}

        {/* Microsoft Calendar Card */}
        {/* ... existing Microsoft card ... */}

        {/* ✅ ADD THIS NEW CALENDLY CARD */}
        <div className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 hover:border-purple-400 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900 text-lg">Import from Calendly</h3>
                  <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-semibold">
                    NEW
                  </span>
                </div>
                <p className="text-sm text-purple-700 mb-2">
                  Migrate your event types, availability, and booking history in 2 minutes
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-purple-600">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Event Types
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Availability
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Past Bookings
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => window.location.href = '/import/calendly'}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              Start Import
            </button>
          </div>
        </div>

        {/* Info Box */}
        {/* ... existing info box ... */}
      </div>
    )}
  </div>
)}

                  {/* Info Box */}
                  <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">How calendar sync works:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• We check your calendar for conflicts before showing available time slots</li>
                          <li>• Your calendar data stays private - we only check for busy/free status</li>
                          <li>• Sync happens automatically every 15 minutes</li>
                          <li>• You can manually sync anytime using the "Sync Now" button</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="p-8 max-w-xl space-y-8">
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <p>
                    Reminders will only be sent for future bookings that have a valid
                    guest email and are not cancelled.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}