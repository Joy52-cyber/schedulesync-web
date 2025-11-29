import { useState, useEffect } from 'react';
import {
  Globe,
  Save,
  Check,
  Loader2,
  Trash2,
  Copy,
  Plus,
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
  const [memberId, setMemberId] = useState(null);

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    timezone: 'America/New_York',
  });

  const [availability, setAvailability] = useState({
    workingHours: {
      monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      saturday: { enabled: false, slots: [{ start: '09:00', end: '17:00' }] },
      sunday: { enabled: false, slots: [{ start: '09:00', end: '17:00' }] },
    },
    bufferTime: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userRes = await auth.me();
      const user = userRes.data.user;

      setProfile({
        name: user.name,
        email: user.email,
        timezone: user.timezone || 'America/New_York',
      });

      const teamsRes = await api.get('/teams');
      const personalTeam = teamsRes.data.teams.find((t) =>
        t.name.includes('Personal Bookings')
      );

      if (personalTeam) {
        const membersRes = await api.get(`/teams/${personalTeam.id}/members`);
        const me = membersRes.data.members.find(
          (m) => m.user_id === user.id
        );

        if (me) {
          setMemberId(me.id);
          const availRes = await api.get(`/team-members/${me.id}/availability`);
          const m = availRes.data.member;

          if (m?.working_hours) {
            const normalizedHours = {};

            Object.keys(m.working_hours).forEach((day) => {
              const dayData = m.working_hours[day];

              if (dayData?.slots) {
                normalizedHours[day] = dayData;
              } else {
                normalizedHours[day] = {
                  enabled: dayData?.enabled ?? false,
                  slots: [
                    {
                      start: dayData?.start || '09:00',
                      end: dayData?.end || '17:00',
                    },
                  ],
                };
              }
            });

            // Ensure all weekdays exist (prevents undefined)
            WEEKDAYS.forEach(({ key }) => {
              if (!normalizedHours[key]) {
                normalizedHours[key] = availability.workingHours[key];
              }
            });

            setAvailability({
              workingHours: normalizedHours,
              bufferTime: m.buffer_time || 0,
            });
          }
        }
      }
    } catch (err) {
      console.error('Error loading availability:', err);
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
          buffer_time: availability.bufferTime,
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving availability:', err);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day) => {
    setAvailability((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: {
          ...prev.workingHours[day],
          enabled: !prev.workingHours[day].enabled,
        },
      },
    }));
  };

  const updateSlot = (day, index, field, value) => {
    const newSlots = [...availability.workingHours[day].slots];
    newSlots[index] = { ...newSlots[index], [field]: value };

    setAvailability((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: { ...prev.workingHours[day], slots: newSlots },
      },
    }));
  };

  const addSlot = (day) => {
    const newSlots = [
      ...availability.workingHours[day].slots,
      { start: '09:00', end: '17:00' },
    ];

    setAvailability((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: { ...prev.workingHours[day], slots: newSlots },
      },
    }));
  };

  const removeSlot = (day, index) => {
    const newSlots = availability.workingHours[day].slots.filter(
      (_, i) => i !== index
    );

    setAvailability((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: { ...prev.workingHours[day], slots: newSlots },
      },
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
            <p className="text-gray-500 text-sm mt-1 max-w-xl">
              Configure your weekly schedule. You can add multiple time blocks
              per day (e.g., 9am–12pm and 2pm–5pm).
            </p>
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

        {/* Timezone Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-gray-400" /> Timezone
            </h2>
            <p className="text-xs text-gray-500 max-w-md">
              Your availability is stored in this timezone and automatically
              converted for guests.
            </p>
          </div>
          <div className="w-full sm:w-72 relative">
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
            </select>
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Weekly working hours
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Set your start and end times for each day.
              </p>
            </div>
            <button
              onClick={() => copyMondayToWeekdays()}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Copy className="h-3 w-3" /> Copy Monday to weekdays
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {WEEKDAYS.map((day) => {
              const settings = availability.workingHours[day.key];
              const isWeekend = ['saturday', 'sunday'].includes(day.key);

              return (
                <div
                  key={day.key}
                  className={`flex flex-col md:flex-row items-start gap-4 px-6 py-4 ${
                    isWeekend ? 'bg-gray-50/50' : ''
                  }`}
                >
                  {/* Day Toggle / Label (fixed column so days don't move) */}
                  <div className="flex items-center gap-3 w-32 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={() => toggleDay(day.key)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-gray-900">
                      {day.label}
                    </span>
                  </div>

                  {/* Slots area */}
                  <div className="flex-1 w-full">
                    {!settings.enabled ? (
                      <span className="text-sm text-gray-400 italic">
                        Unavailable
                      </span>
                    ) : (
                      <div className="space-y-3 w-full">
                        {settings.slots.map((slot, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3"
                          >
                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-sm">
                              <input
                                type="time"
                                value={slot.start}
                                onChange={(e) =>
                                  updateSlot(
                                    day.key,
                                    index,
                                    'start',
                                    e.target.value
                                  )
                                }
                                className="border-none outline-none text-sm font-medium text-gray-700 w-24"
                              />
                              <span className="text-gray-400">-</span>
                              <input
                                type="time"
                                value={slot.end}
                                onChange={(e) =>
                                  updateSlot(
                                    day.key,
                                    index,
                                    'end',
                                    e.target.value
                                  )
                                }
                                className="border-none outline-none text-sm font-medium text-gray-700 w-24"
                              />
                            </div>

                            {/* Delete for every slot */}
                            <button
                              type="button"
                              onClick={() => removeSlot(day.key, index)}
                              className="p-1.5 hover:bg-red-50 text-red-500 rounded-md transition-colors"
                              title="Remove slot"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}

                        {/* Add slot button (always creates a new slot BELOW existing ones) */}
                        <button
                          type="button"
                          onClick={() => addSlot(day.key)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add time block</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // helper defined after JSX for clarity
  function copyMondayToWeekdays() {
    const srcSlots = [...availability.workingHours.monday.slots];
    const updated = { ...availability.workingHours };

    Object.keys(updated).forEach((dayKey) => {
      if (!['saturday', 'sunday'].includes(dayKey)) {
        updated[dayKey] = {
          enabled: true,
          slots: JSON.parse(JSON.stringify(srcSlots)),
        };
      }
    });

    setAvailability((prev) => ({ ...prev, workingHours: updated }));
  }
}
