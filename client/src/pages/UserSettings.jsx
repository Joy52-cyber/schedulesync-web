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
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import api, { auth, timezone as timezoneApi, reminders as remindersApi } from '../utils/api';

const WEEKDAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

export default function UserSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    timezone: 'America/New_York'
  });

  const [memberId, setMemberId] = useState(null);
  const [personalTeamId, setPersonalTeamId] = useState(null);

  const [availability, setAvailability] = useState({
    workingHours: { 
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' }
    },
    bufferTime: 0
  });

  // 🔔 Reminder settings (per personal team / user)
  const [reminderSettings, setReminderSettings] = useState({
    enabled: true,
    hoursBefore: 24,
    sendToHost: true,
    sendToGuest: true,
  });
  const [remindersLoading, setRemindersLoading] = useState(false);

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
        timezone: userData.timezone || 'America/New_York'
      });

      const teamsRes = await api.get('/teams');
      const personalTeam = teamsRes.data.teams.find(t => t.name.includes("Personal Bookings"));
      
      if (personalTeam) {
        setPersonalTeamId(personalTeam.id);

        // Load member + availability
        const membersRes = await api.get(`/teams/${personalTeam.id}/members`);
        const me = membersRes.data.members.find(m => m.user_id === userData.id);
        
        if (me) {
          setMemberId(me.id);
          const availRes = await api.get(`/team-members/${me.id}/availability`);
          if (availRes.data.member?.working_hours) {
            setAvailability({
              workingHours: availRes.data.member.working_hours,
              bufferTime: availRes.data.member.buffer_time || 0
            });
          }
        }

        // Load reminder settings for this personal team
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
          // Fallback defaults already in state
        } finally {
          setRemindersLoading(false);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1) Save timezone
      await timezoneApi.update({ timezone: profile.timezone });
      
      // 2) Save availability (working hours + buffer) if we have a member
      if (memberId) {
        await api.put(`/team-members/${memberId}/availability`, {
          working_hours: availability.workingHours,
          buffer_time: availability.bufferTime
        });
      }

      // 3) Save reminder settings for personal team
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

  const updateDay = (day, field, value) => {
    setAvailability(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: {
          ...prev.workingHours[day],
          [field]: value
        }
      }
    }));
  };

  const copyToAll = (sourceDay) => {
    const source = availability.workingHours[sourceDay];
    const newHours = { ...availability.workingHours };
    Object.keys(newHours).forEach(day => {
      if (day !== 'saturday' && day !== 'sunday') {
        newHours[day] = { ...source };
      }
    });
    setAvailability({ ...availability, workingHours: newHours });
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
          <p className="text-gray-500 mt-1">Manage your profile and schedule</p>
        </div>
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
              onClick={() => setActiveTab('availability')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'availability'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar size={18} /> Availability
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
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm min-h-[600px]">
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

          {/* AVAILABILITY TAB */}
          {activeTab === 'availability' && (
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Working hours</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Set when you are typically available for meetings
                  </p>
                </div>
                <MoreHorizontal className="text-gray-400 cursor-pointer hover:text-gray-600" />
              </div>

              <div className="space-y-1">
                {WEEKDAYS.map((day) => {
                  const settings = availability.workingHours[day.key];
                  return (
                    <div
                      key={day.key}
                      className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-transparent hover:border-gray-100 hover:bg-gray-50 -mx-4 px-4 transition-colors"
                    >
                      {/* Day Checkbox */}
                      <div className="w-40 flex items-center gap-3 mb-2 sm:mb-0">
                        <input
                          type="checkbox"
                          checked={settings.enabled}
                          onChange={(e) =>
                            updateDay(day.key, 'enabled', e.target.checked)
                          }
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-gray-700">
                          {day.label}
                        </span>
                      </div>

                      {/* Time Inputs */}
                      <div className="flex-1">
                        {settings.enabled ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={settings.start}
                              onChange={(e) =>
                                updateDay(day.key, 'start', e.target.value)
                              }
                              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                              type="time"
                              value={settings.end}
                              onChange={(e) =>
                                updateDay(day.key, 'end', e.target.value)
                              }
                              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32"
                            />
                            <button
                              onClick={() => updateDay(day.key, 'enabled', false)}
                              className="ml-2 text-gray-400 hover:text-red-500 p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 font-medium px-1">
                            Unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Buffer Settings */}
              <div className="mt-10 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-4">
                  Additional Options
                </h3>
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-700">
                    Buffer before/after meetings:
                  </label>
                  <div className="relative w-24">
                    <input
                      type="number"
                      value={availability.bufferTime}
                      onChange={(e) =>
                        setAvailability({
                          ...availability,
                          bufferTime: parseInt(e.target.value || '0', 10),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-3 top-2 text-gray-500 text-xs">
                      min
                    </span>
                  </div>
                </div>
              </div>
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
