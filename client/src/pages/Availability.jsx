// client/src/pages/Availability.jsx
import { useState, useEffect } from 'react';
import {
  Globe,
  Save,
  Check,
  Loader2,
  Trash2,
  Copy,
} from 'lucide-react';
import api, { auth, timezone as timezoneApi } from '../utils/api';

const WEEKDAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

export default function Availability() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    timezone: 'America/New_York',
  });

  const [memberId, setMemberId] = useState(null);

  const [availability, setAvailability] = useState({
    workingHours: {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' },
    },
    bufferTime: 0,
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Find personal team
      const teamsRes = await api.get('/teams');
      const personalTeam = teamsRes.data.teams.find((t) =>
        t.name.includes('Personal Bookings')
      );

      if (personalTeam) {
        // Load member + availability
        const membersRes = await api.get(`/teams/${personalTeam.id}/members`);
        const me = membersRes.data.members.find(
          (m) => m.user_id === userData.id
        );

        if (me) {
          setMemberId(me.id);
          const availRes = await api.get(`/team-members/${me.id}/availability`);
          if (availRes.data.member?.working_hours) {
            setAvailability({
              workingHours: availRes.data.member.working_hours,
              bufferTime: availRes.data.member.buffer_time || 0,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading availability data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1) Save timezone (api.js: update(tz) => { timezone: tz })
      await timezoneApi.update(profile.timezone);

      // 2) Save availability (working hours + buffer) if we have a member
      if (memberId) {
        await api.put(`/team-members/${memberId}/availability`, {
          working_hours: availability.workingHours,
          buffer_time: availability.bufferTime,
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (day, field, value) => {
    setAvailability((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: {
          ...prev.workingHours[day],
          [field]: value,
        },
      },
    }));
  };

  const copyToWeekdays = (sourceDay) => {
    const source = availability.workingHours[sourceDay];
    const newHours = { ...availability.workingHours };

    Object.keys(newHours).forEach((day) => {
      if (day !== 'saturday' && day !== 'sunday') {
        newHours[day] = { ...source };
      }
    });

    setAvailability((prev) => ({
      ...prev,
      workingHours: newHours,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Availability</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Set when people can book appointments with you. These rules power
              your personal booking link.
            </p>
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

        {/* Main content */}
        <div className="space-y-6 lg:space-y-8">
          {/* Timezone card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-gray-400" />
              Timezone
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Your availability is stored in this timezone and automatically
              converted for guests.
            </p>

            <div className="relative max-w-xs">
              <Globe className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <select
                value={profile.timezone}
                onChange={(e) =>
                  setProfile({ ...profile, timezone: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
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

            <p className="mt-3 text-xs text-gray-400">
              Logged in as{' '}
              <span className="font-medium">{profile.email}</span>
            </p>
          </div>

          {/* Working hours card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Weekly working hours
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Choose when you’re generally available for meetings.
                </p>
              </div>

              {/* Copy Monday to weekdays */}
              <button
                type="button"
                onClick={() => copyToWeekdays('monday')}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Copy className="h-3 w-3" />
                Copy Monday to weekdays
              </button>
            </div>

            <div className="divide-y divide-gray-100 -mx-4">
              {WEEKDAYS.map((day) => {
                const settings = availability.workingHours[day.key];
                const isWeekend =
                  day.key === 'saturday' || day.key === 'sunday';

                return (
                  <div
                    key={day.key}
                    className={`flex flex-col sm:flex-row sm:items-center py-3 px-4 transition-colors ${
                      isWeekend ? 'bg-gray-50/40' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Day + toggle */}
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

                    {/* Time inputs */}
                    <div className="flex-1">
                      {settings.enabled ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            value={settings.start}
                            onChange={(e) =>
                              updateDay(day.key, 'start', e.target.value)
                            }
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32"
                          />
                          <span className="text-gray-400">–</span>
                          <input
                            type="time"
                            value={settings.end}
                            onChange={(e) =>
                              updateDay(day.key, 'end', e.target.value)
                            }
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32"
                          />
                          <button
                            onClick={() =>
                              updateDay(day.key, 'enabled', false)
                            }
                            className="ml-1 text-gray-400 hover:text-red-500 p-1"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">
                          Unavailable
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Buffer Settings */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 mb-3">
                Additional options
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-700">
                  Buffer before/after meetings:
                </span>
                <div className="relative w-28">
                  <input
                    type="number"
                    value={availability.bufferTime}
                    min={0}
                    onChange={(e) =>
                      setAvailability((prev) => ({
                        ...prev,
                        bufferTime: parseInt(e.target.value || '0', 10),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-xs">
                    min
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  We’ll make sure there’s breathing room between bookings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
