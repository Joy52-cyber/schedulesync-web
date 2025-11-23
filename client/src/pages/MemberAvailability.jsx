import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Clock,
  Calendar,
  Loader2,
  Plus,
  Trash2,
  Info,
  AlertCircle,
  CheckCircle,
  X,
  Check,
  Zap,
  TrendingUp,
  Shield,
  Globe,
} from 'lucide-react';
import api from '../utils/api';
import TimezoneSelector from '../components/TimezoneSelector';

export default function MemberAvailability() {
  const { teamId, memberId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);

  // Timezone State
  const [timezone, setTimezone] = useState('America/New_York');

  // Advanced Settings
  const [bufferTime, setBufferTime] = useState(0);
  const [leadTimeHours, setLeadTimeHours] = useState(0);
  const [horizonDays, setHorizonDays] = useState(30);
  const [dailyCap, setDailyCap] = useState(null);

  const [workingHours, setWorkingHours] = useState({
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '17:00' },
    sunday: { enabled: false, start: '09:00', end: '17:00' },
  });

  const [blockedTimes, setBlockedTimes] = useState([]);
  const [notification, setNotification] = useState(null);

  const days = [
    { key: 'monday', label: 'Mon', full: 'Monday' },
    { key: 'tuesday', label: 'Tue', full: 'Tuesday' },
    { key: 'wednesday', label: 'Wed', full: 'Wednesday' },
    { key: 'thursday', label: 'Thu', full: 'Thursday' },
    { key: 'friday', label: 'Fri', full: 'Friday' },
    { key: 'saturday', label: 'Sat', full: 'Saturday' },
    { key: 'sunday', label: 'Sun', full: 'Sunday' },
  ];

  const bufferOptions = [
    { value: 0, label: 'None', desc: 'Back-to-back OK' },
    { value: 5, label: '5min', desc: 'Quick break' },
    { value: 10, label: '10min', desc: 'Short buffer' },
    { value: 15, label: '15min', desc: 'Standard' },
    { value: 30, label: '30min', desc: 'Extended' },
    { value: 60, label: '1hr', desc: 'Full hour' },
  ];

  const leadTimeOptions = [
    { value: 0, label: 'None', desc: 'Instant booking' },
    { value: 2, label: '2hrs', desc: 'Same day OK' },
    { value: 4, label: '4hrs', desc: 'Half day notice' },
    { value: 24, label: '24hrs', desc: '1 day notice' },
    { value: 48, label: '48hrs', desc: '2 days notice' },
    { value: 168, label: '1wk', desc: 'Weekly planning' },
  ];

  const horizonOptions = [
    { value: 7, label: '1wk', desc: 'Short term' },
    { value: 14, label: '2wks', desc: 'Biweekly' },
    { value: 30, label: '1mo', desc: 'Monthly' },
    { value: 60, label: '2mo', desc: 'Quarterly' },
    { value: 90, label: '3mo', desc: 'Long term' },
    { value: 180, label: '6mo', desc: 'Extended' },
  ];

  const dailyCapOptions = [
    { value: null, label: 'Unlimited', desc: 'No limit' },
    { value: 1, label: '1', desc: 'One per day' },
    { value: 2, label: '2', desc: 'Two max' },
    { value: 3, label: '3', desc: 'Three max' },
    { value: 5, label: '5', desc: 'Five max' },
    { value: 10, label: '10', desc: 'Ten max' },
  ];

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 2000);
  };

  const convertISOToDateTimeLocal = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    loadMemberSettings();
  }, [memberId]);

  const loadMemberSettings = async () => {
    try {
      setLoading(true);

      // 1. Load Availability
      const response = await api.availability.getSettings(teamId, memberId);
      const availData = response.data;

      setMember(availData.member);
      setBufferTime(availData.member.buffer_time || 0);
      setLeadTimeHours(availData.member.lead_time_hours || 0);
      setHorizonDays(availData.member.booking_horizon_days || 30);
      setDailyCap(availData.member.daily_booking_cap || null);

      if (availData.member.working_hours) {
        setWorkingHours(availData.member.working_hours);
      }

      const formattedBlockedTimes = (availData.blocked_times || []).map(
        (block) => ({
          ...block,
          start_time: convertISOToDateTimeLocal(block.start_time),
          end_time: convertISOToDateTimeLocal(block.end_time),
        })
      );
      setBlockedTimes(formattedBlockedTimes);

      // 2. Load Timezone
      try {
        const tzRes = await api.timezone.getMemberTimezone(memberId);
        if (tzRes.data.timezone) setTimezone(tzRes.data.timezone);
      } catch (e) {
        console.warn('Timezone load failed (Backend 404 likely). Using default.');
      }
    } catch (error) {
      console.error('Error loading availability:', error);
      showNotification('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const validBlockedTimes = blockedTimes
        .filter((block) => block.start_time && block.end_time)
        .map((block) => ({
          start_time: new Date(block.start_time).toISOString(),
          end_time: new Date(block.end_time).toISOString(),
          reason: block.reason || null,
        }));

      // 1. Save Availability
      await api.availability.updateSettings(teamId, memberId, {
        buffer_time: bufferTime,
        lead_time_hours: leadTimeHours,
        booking_horizon_days: horizonDays,
        daily_booking_cap: dailyCap,
        working_hours: workingHours,
        blocked_times: validBlockedTimes,
      });

      // 2. Save Timezone
      await api.timezone.updateMemberTimezone(memberId, timezone);

      showNotification('✅ Availability & Timezone saved!');
    } catch (error) {
      console.error('Error saving availability:', error);
      showNotification('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day) => {
    setWorkingHours({
      ...workingHours,
      [day]: { ...workingHours[day], enabled: !workingHours[day].enabled },
    });
  };

  const updateDayTime = (day, field, value) => {
    setWorkingHours({
      ...workingHours,
      [day]: { ...workingHours[day], [field]: value },
    });
  };

  const addBlockedTime = () => {
    setBlockedTimes([
      ...blockedTimes,
      { id: `temp-${Date.now()}`, start_time: '', end_time: '', reason: '' },
    ]);
  };

  const removeBlockedTime = (index) => {
    setBlockedTimes(blockedTimes.filter((_, i) => i !== index));
  };

  const updateBlockedTime = (index, field, value) => {
    const updated = [...blockedTimes];
    updated[index][field] = value;
    setBlockedTimes(updated);
  };

  const setAllDays = () => {
    const all = { ...workingHours };
    Object.keys(all).forEach((d) => (all[d].enabled = true));
    setWorkingHours(all);
  };

  const setWeekdaysOnly = () => {
    const wk = { ...workingHours };
    wk.saturday.enabled = false;
    wk.sunday.enabled = false;
    Object.keys(wk).forEach((d) => {
      if (d !== 'saturday' && d !== 'sunday') wk[d].enabled = true;
    });
    setWorkingHours(wk);
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-4 sm:p-8">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl font-semibold ${
              notification.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-green-600 text-white'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <CheckCircle className="h-5 w-5" />
            )}
            {notification.message}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>

        {/* Timezone Selector */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-600" /> Timezone Settings
          </h2>
          <TimezoneSelector value={timezone} onChange={setTimezone} />
        </div>

        {/* Availability Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Buffer Time */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center gap-3">
              <Clock className="h-6 w-6 text-white" />
              <div>
                <h2 className="text-lg font-bold text-white">Buffer Time</h2>
                <p className="text-blue-100 text-sm">Gap between meetings</p>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {bufferOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setBufferTime(option.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      bufferTime === option.value
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <p className="font-bold text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lead Time */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-4 flex items-center gap-3">
              <Zap className="h-6 w-6 text-white" />
              <div>
                <h2 className="text-lg font-bold text-white">Lead Time</h2>
                <p className="text-green-100 text-sm">
                  Minimum notice required
                </p>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {leadTimeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setLeadTimeHours(option.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      leadTimeHours === option.value
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-green-300'
                    }`}
                  >
                    <p className="font-bold text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Horizon */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-6 py-4 flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-white" />
              <div>
                <h2 className="text-lg font-bold text-white">Booking Window</h2>
                <p className="text-purple-100 text-sm">
                  How far in advance guests can book
                </p>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {horizonOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setHorizonDays(option.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      horizonDays === option.value
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <p className="font-bold text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Cap */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex items-center gap-3">
              <Shield className="h-6 w-6 text-white" />
              <div>
                <h2 className="text-lg font-bold text-white">Daily Limit</h2>
                <p className="text-orange-100 text-sm">
                  Prevent burnout by capping meetings
                </p>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {dailyCapOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => setDailyCap(option.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      dailyCap === option.value
                        ? 'border-orange-500 bg-orange-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-orange-300'
                    }`}
                  >
                    <p className="font-bold text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-white" />
              <div>
                <h2 className="text-sm font-bold text-white">Working Hours</h2>
                <p className="text-indigo-100 text-xs">When you're available</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={setAllDays}
                className="px-2.5 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg text-xs font-medium"
              >
                All Days
              </button>
              <button
                onClick={setWeekdaysOnly}
                className="px-2.5 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg text-xs font-medium"
              >
                Weekdays
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {days.map((day) => (
                <div
                  key={day.key}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={workingHours[day.key].enabled}
                      onChange={() => toggleDay(day.key)}
                      className="w-5 h-5 text-blue-600"
                    />
                    <span className="font-medium w-24">{day.full}</span>
                  </div>

                  {workingHours[day.key].enabled ? (
                    <div className="flex items-center gap-3">
                      {/* Start time container */}
                      <div className="flex items-center justify-center h-11 px-3 rounded-lg bg-gray-100 border border-gray-200">
                        <input
                          type="time"
                          value={workingHours[day.key].start}
                          onChange={(e) =>
                            updateDayTime(day.key, 'start', e.target.value)
                          }
                          className="h-full border-none outline-none bg-transparent text-sm font-medium"
                        />
                      </div>
                      <span className="text-gray-500">–</span>
                      {/* End time container */}
                      <div className="flex items-center justify-center h-11 px-3 rounded-lg bg-gray-100 border border-gray-200">
                        <input
                          type="time"
                          value={workingHours[day.key].end}
                          onChange={(e) =>
                            updateDayTime(day.key, 'end', e.target.value)
                          }
                          className="h-full border-none outline-none bg-transparent text-sm font-medium"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">Unavailable</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Blocked Times */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-600" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Blocked times
                </h2>
                <p className="text-xs text-gray-500">
                  Periods when you are never bookable (vacation, breaks,
                  events).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={addBlockedTime}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add block
            </button>
          </div>

          <div className="p-4 space-y-3">
            {blockedTimes.length === 0 && (
              <p className="text-xs text-gray-500">
                No blocked times yet. Add one to keep certain periods
                unavailable.
              </p>
            )}

            {blockedTimes.map((block, index) => (
              <div
                key={block.id || index}
                className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3"
              >
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">
                      Start
                    </label>
                    <input
                      type="datetime-local"
                      value={block.start_time || ''}
                      onChange={(e) =>
                        updateBlockedTime(index, 'start_time', e.target.value)
                      }
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">
                      End
                    </label>
                    <input
                      type="datetime-local"
                      value={block.end_time || ''}
                      onChange={(e) =>
                        updateBlockedTime(index, 'end_time', e.target.value)
                      }
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={block.reason || ''}
                    onChange={(e) =>
                      updateBlockedTime(index, 'reason', e.target.value)
                    }
                    placeholder="Vacation, lunch, focus time..."
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeBlockedTime(index)}
                  className="self-start sm:self-auto px-2 py-2 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
