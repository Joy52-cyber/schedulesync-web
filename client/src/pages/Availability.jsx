// client/src/pages/Availability.jsx
import { useState, useEffect } from 'react';
import {
  Globe,
  Save,
  Check,
  Loader2,
  Trash2,
  Copy,
  Clock,
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
      // 1) Save timezone
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/30">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
              <p className="text-gray-500 text-sm mt-1 max-w-xl">
                Decide when people can book time with you. These rules power
                your personal booking links and team scheduling.
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-full hover:bg-blue-700 transition-all flex items-center gap-2 font-semibold text-sm shadow-sm disabled:opacity-70"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
          </button>
        </div>

        {/* Main content */}
        <div className="space-y-6 lg:space-y-8">
          {/* Timezone card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-gray-400" />
                Timezone
              </h2>
              <p className="text-xs text-gray-500 mb-3 max-w-md">
                Your availability is stored in this timezone and automatically
                converted to your guests&apos; local time.
              </p>

              <p className="hidden sm:block text-xs text-gray-400">
                Logged in as{' '}
                <span className="font-medium text-gray-600">
                  {profile.email}
                </span>
              </p>
            </div>

            <div className="w-full sm:w-72">
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <select
                  value={profile.timezone}
                  onChange={(e) =>
                    setProfile({ ...profile, timezone: e.target.value })
                  }
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
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
              <p className="mt-2 text-[11px] text-gray-400 sm:hidden">
                Logged in as{' '}
                <span className="font-medium text-gray-600">
                  {profile.email}
                </span>
              </p>
            </div>
          </div>

          {/* Working hours card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Weekly working hours
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Choose when you’re generally available for meetings.
                </p>
              </div>

              <button
                type="button"
                onClick={() => copyToWeekdays('monday')}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Copy className="h-3 w-3" />
                Copy Monday to weekdays
              </button>
            </div>

            {/* Table header */}
            <div className="hidden md:grid grid-cols-[170px,1fr] text-[11px] font-semibold text-gray-500 px-4 pb-2">
              <span>Day</span>
              <div className="grid grid-cols-[120px,16px,120px,auto] items-center gap-2">
                <span>From</span>
                <span></span>
                <span>To</span>
                <span>Status</span>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden bg-gray-50/40">
              {WEEKDAYS.map((day) => {
                const settings = availability.workingHours[day.key];
                const isWeekend =
                  day.key === 'saturday' || day.key === 'sunday';

                return (
                  <div
                    key={day.key}
                    className={`flex flex-col md:grid md:grid-cols-[170px,1fr] items-stretch px-4 py-3 transition-colors ${
                      isWeekend
                        ? 'bg-gray-50'
                        : 'bg-white hover:bg-blue-50/40'
                    }`}
                  >
                    {/* Day + toggle */}
                    <div className="flex items-center gap-3 mb-2 md:mb-0">
                      <input
                        type="checkbox"
                        checked={settings.enabled}
                        onChange={(e) =>
                          updateDay(day.key, 'enabled', e.target.checked)
                        }
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {day.label}
                        </span>
                        {isWeekend && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium uppercase tracking-wide">
                            Weekend
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Time + status */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
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
                            className="ml-1 text-gray-400 hover:text-red-500 p-1"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-medium text-gray-400">
                          Unavailable for bookings
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Buffer Settings */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wide">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-xs">
                    min
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  We&apos;ll automatically protect this spacing between
                  bookings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
