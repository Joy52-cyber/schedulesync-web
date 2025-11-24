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
  Plus,
  Copy,
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import api, { auth, timezone as timezoneApi } from '../utils/api';

const WEEKDAYS = [
  { key: 'sunday', label: 'S' },
  { key: 'monday', label: 'M' },
  { key: 'tuesday', label: 'T' },
  { key: 'wednesday', label: 'W' },
  { key: 'thursday', label: 'T' },
  { key: 'friday', label: 'F' },
  { key: 'saturday', label: 'S' },
];

const DEFAULT_WORKING_HOURS = {
  monday: { enabled: true, start: '09:00', end: '17:00' },
  tuesday: { enabled: true, start: '09:00', end: '17:00' },
  wednesday: { enabled: true, start: '09:00', end: '17:00' },
  thursday: { enabled: true, start: '09:00', end: '17:00' },
  friday: { enabled: true, start: '09:00', end: '17:00' },
  saturday: { enabled: false, start: '09:00', end: '17:00' },
  sunday: { enabled: false, start: '09:00', end: '17:00' },
};

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
  const [availability, setAvailability] = useState({
    workingHours: DEFAULT_WORKING_HOURS,
    bufferTime: 0
  });

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
        const membersRes = await api.get(`/teams/${personalTeam.id}/members`);
        const me = membersRes.data.members.find(m => m.user_id === userData.id);
        
        if (me) {
          setMemberId(me.id);
          const availRes = await api.get(`/team-members/${me.id}/availability`);
          if (availRes.data.member?.working_hours) {
            // Merge with defaults so all days exist
            setAvailability({
              workingHours: {
                ...DEFAULT_WORKING_HOURS,
                ...availRes.data.member.working_hours,
              },
              bufferTime: availRes.data.member.buffer_time || 0
            });
          }
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
      await timezoneApi.update({ timezone: profile.timezone });
      
      if (memberId) {
        await api.put(`/team-members/${memberId}/availability`, {
          working_hours: availability.workingHours,
          buffer_time: availability.bufferTime
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
          ...(prev.workingHours[day] || DEFAULT_WORKING_HOURS[day]),
          [field]: value
        }
      }
    }));
  };

  // Copy a day's schedule to all weekdays
  const copyToAll = (sourceDay) => {
    const source = availability.workingHours[sourceDay] || DEFAULT_WORKING_HOURS[sourceDay];
    const newHours = { ...availability.workingHours };

    Object.keys(newHours).forEach(day => {
      if (day !== 'saturday' && day !== 'sunday') { // Only copy to weekdays by default
        newHours[day] = { ...source };
      }
    });

    setAvailability(prev => ({
      ...prev,
      workingHours: newHours
    }));
  };

  // Quick actions
  const resetWeekdaysToDefault = () => {
    setAvailability(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        ...DEFAULT_WORKING_HOURS,
      }
    }));
  };

  const clearAllAvailability = () => {
    const cleared = {};
    Object.keys(DEFAULT_WORKING_HOURS).forEach(day => {
      cleared[day] = {
        ...DEFAULT_WORKING_HOURS[day],
        enabled: false,
      };
    });

    setAvailability(prev => ({
      ...prev,
      workingHours: cleared
    }));
  };

  const getAvailabilitySummary = () => {
    const enabledDays = Object.entries(availability.workingHours || {}).filter(
      ([_, v]) => v?.enabled
    );
    if (!enabledDays.length) return 'No regular working hours set yet.';
    if (enabledDays.length === 5 &&
        enabledDays.every(([d]) => ['monday','tuesday','wednesday','thursday','friday'].includes(d))) {
      const sample = availability.workingHours.monday || DEFAULT_WORKING_HOURS.monday;
      return `Mon–Fri · ${sample.start}–${sample.end}`;
    }
    return `${enabledDays.length} day(s) with availability configured.`;
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
              <div className="flex items-start justify-between mb-6 border-b border-gray-100 pb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Working hours</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Set when you are typically available for meetings.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {getAvailabilitySummary()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <MoreHorizontal className="text-gray-400 cursor-pointer hover:text-gray-600" />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetWeekdaysToDefault}
                      className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Reset weekdays 9–5
                    </button>
                    <button
                      type="button"
                      onClick={clearAllAvailability}
                      className="text-xs px-3 py-1.5 rounded-full border border-red-100 text-red-500 hover:bg-red-50"
                    >
                      Mark all unavailable
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                {WEEKDAYS.map((day) => {
                  const settings =
                    availability.workingHours[day.key] ||
                    DEFAULT_WORKING_HOURS[day.key];

                  const isWeekend =
                    day.key === 'saturday' || day.key === 'sunday';

                  return (
                    <div
                      key={day.key}
                      className={`group flex flex-col sm:flex-row sm:items-center py-3 rounded-lg -mx-4 px-4 transition-colors ${
                        settings.enabled
                          ? 'bg-blue-50/40 border border-blue-100'
                          : 'border border-transparent hover:border-gray-100 hover:bg-gray-50'
                      } ${isWeekend ? 'mt-2' : ''}`}
                    >
                      {/* Day Checkbox + Label */}
                      <div className="w-32 flex items-center gap-3 mb-2 sm:mb-0">
                        <input
                          type="checkbox"
                          checked={settings.enabled}
                          onChange={(e) =>
                            updateDay(day.key, 'enabled', e.target.checked)
                          }
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span
                          className={`text-xs font-semibold uppercase px-2 py-1 rounded-full ${
                            settings.enabled
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {day.label}
                        </span>
                        <span className="hidden sm:inline text-xs text-gray-500">
                          {day.key.charAt(0).toUpperCase() + day.key.slice(1)}
                        </span>
                      </div>

                      {/* Time Inputs */}
                      <div className="flex-1">
                        {settings.enabled ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="time"
                              value={settings.start}
                              onChange={(e) =>
                                updateDay(day.key, 'start', e.target.value)
                              }
                              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32 bg-white"
                            />
                            <span className="text-gray-400">–</span>
                            <input
                              type="time"
                              value={settings.end}
                              onChange={(e) =>
                                updateDay(day.key, 'end', e.target.value)
                              }
                              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32 bg-white"
                            />
                            <button
                              onClick={() =>
                                updateDay(day.key, 'enabled', false)
                              }
                              className="ml-2 text-gray-400 hover:text-red-500 p-1"
                              title="Mark this day as unavailable"
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

                      {/* Hover Actions */}
                      <div className="w-24 flex justify-end gap-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity mt-2 sm:mt-0">
                        <button
                          title="Add interval (coming soon)"
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <Plus size={18} />
                        </button>
                        <button
                          title="Copy to weekdays"
                          onClick={() => copyToAll(day.key)}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <Copy size={18} />
                        </button>
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
                <div className="flex flex-wrap items-center gap-4">
                  <label className="text-sm text-gray-700">
                    Buffer before/after meetings:
                  </label>
                  <div className="relative w-28">
                    <input
                      type="number"
                      min={0}
                      value={availability.bufferTime}
                      onChange={(e) =>
                        setAvailability({
                          ...availability,
                          bufferTime: parseInt(e.target.value || '0', 10),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500 text-xs">
                      min
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    A small gap helps prevent back-to-back meetings.
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
