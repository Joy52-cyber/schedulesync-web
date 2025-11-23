import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Clock, Calendar, Loader2, Plus, Trash2,
  Info, AlertCircle, CheckCircle, X, Check, Zap, TrendingUp, Shield
} from 'lucide-react';
import api from '../utils/api';

export default function AvailabilitySettingsEnhanced() {
  const { teamId, memberId } = useParams(); // Support both ID params
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);

  // Settings
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
      // Use availability helper or direct endpoint
      const response = await api.availability.getSettings(teamId, memberId);
      const data = response.data;

      setMember(data.member);
      setBufferTime(data.member.buffer_time || 0);
      setLeadTimeHours(data.member.lead_time_hours || 0);
      setHorizonDays(data.member.booking_horizon_days || 30);
      setDailyCap(data.member.daily_booking_cap || null);

      if (data.member.working_hours) {
        setWorkingHours(data.member.working_hours);
      }

      const formattedBlockedTimes = (data.blocked_times || []).map((block) => ({
        ...block,
        start_time: convertISOToDateTimeLocal(block.start_time),
        end_time: convertISOToDateTimeLocal(block.end_time),
      }));

      setBlockedTimes(formattedBlockedTimes);
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

      await api.availability.updateSettings(teamId, memberId, {
        buffer_time: bufferTime,
        lead_time_hours: leadTimeHours,
        booking_horizon_days: horizonDays,
        daily_booking_cap: dailyCap,
        working_hours: workingHours,
        blocked_times: validBlockedTimes,
      });

      showNotification('✅ Availability rules saved!');
      // Optional: Redirect back or stay
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
      [day]: {
        ...workingHours[day],
        enabled: !workingHours[day].enabled,
      },
    });
  };

  const updateDayTime = (day, field, value) => {
    setWorkingHours({
      ...workingHours,
      [day]: {
        ...workingHours[day],
        [field]: value,
      },
    });
  };

  const addBlockedTime = () => {
    setBlockedTimes([
      ...blockedTimes,
      {
        id: `temp-${Date.now()}`,
        start_time: '',
        end_time: '',
        reason: '',
      },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block mb-2">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-200"></div>
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
          </div>
          <p className="text-gray-600 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      {/* Notification */}
      {notification && (
        <div className="fixed top-3 right-3 z-50 animate-slide-in">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-xl text-xs font-medium ${
              notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {notification.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">
                Availability Settings
              </h1>
              <p className="text-xs text-gray-600">{member?.name} • Full control</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 text-xs font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save All
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Advanced Settings Grid */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Buffer Time */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 flex items-center gap-2">
              <Clock className="h-5 w-5 text-white" />
              <div>
                <h2 className="text-sm font-bold text-white">Buffer Time</h2>
                <p className="text-blue-100 text-xs">Gap between meetings</p>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {bufferOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setBufferTime(option.value)}
                    className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                      bufferTime === option.value
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <p className="text-sm font-bold text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lead Time */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-4 py-2.5 flex items-center gap-2">
              <Zap className="h-5 w-5 text-white" />
              <div>
                <h2 className="text-sm font-bold text-white">Lead Time</h2>
                <p className="text-green-100 text-xs">Minimum notice required</p>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {leadTimeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setLeadTimeHours(option.value)}
                    className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                      leadTimeHours === option.value
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-green-300'
                    }`}
                  >
                    <p className="text-sm font-bold text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Horizon */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-2.5 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-white" />
              <div>
                <h2 className="text-sm font-bold text-white">Booking Horizon</h2>
                <p className="text-purple-100 text-xs">How far ahead to show</p>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {horizonOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setHorizonDays(option.value)}
                    className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                      horizonDays === option.value
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <p className="text-sm font-bold text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Cap */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-4 py-2.5 flex items-center gap-2">
              <Shield className="h-5 w-5 text-white" />
              <div>
                <h2 className="text-sm font-bold text-white">Daily Cap</h2>
                <p className="text-orange-100 text-xs">Max bookings per day</p>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {dailyCapOptions.map((option) => {
                  const isUnlimited = option.value === null;
                  const baseClasses = 'min-h-[80px] w-full p-3 rounded-lg border-2 flex flex-col items-center justify-center text-center transition-all break-words';
                  const stateClasses = dailyCap === option.value
                      ? 'border-orange-500 bg-orange-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-orange-300';
                  const spanClasses = isUnlimited ? 'col-span-2 md:col-span-1' : '';

                  return (
                    <button
                      key={option.value === null ? 'unlimited' : option.value}
                      onClick={() => setDailyCap(option.value)}
                      className={`${baseClasses} ${stateClasses} ${spanClasses}`}
                    >
                      <p className="text-sm font-bold text-gray-900">{option.label}</p>
                      <p className="text-xs text-gray-600">{option.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Working Hours - FIXED UI */}
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
                onClick={() => {
                  const all = { ...workingHours };
                  Object.keys(all).forEach((d) => (all[d].enabled = true));
                  setWorkingHours(all);
                }}
                className="px-2.5 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg text-xs font-medium"
              >
                All Days
              </button>
              <button
                onClick={() => {
                  const wk = { ...workingHours };
                  wk.saturday.enabled = false;
                  wk.sunday.enabled = false;
                  Object.keys(wk).forEach((d) => {
                    if (d !== 'saturday' && d !== 'sunday') wk[d].enabled = true;
                  });
                  setWorkingHours(wk);
                }}
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
                  className={`w-full flex flex-col sm:flex-row sm:items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${
                    workingHours[day.key].enabled
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  {/* Left: toggle + label */}
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <button
                      onClick={() => toggleDay(day.key)}
                      className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-all ${
                        workingHours[day.key].enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow flex items-center justify-center ${
                          workingHours[day.key].enabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      >
                        {workingHours[day.key].enabled && (
                          <Check className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                    </button>

                    <div>
                      <p className="text-sm font-bold text-gray-900">{day.full}</p>
                      {!workingHours[day.key].enabled && (
                        <p className="text-[11px] text-gray-500 font-medium">Day off</p>
                      )}
                    </div>
                  </div>

                  {/* Right: time range (✅ FIXED UI BUG) */}
                  {workingHours[day.key].enabled && (
                    <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2 w-full">
                      
                      {/* Start Time Container */}
                      <div className="flex-1 min-w-[110px]">
                        <div className="relative flex items-center h-10 px-3 border-2 border-gray-300 rounded-lg bg-white hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                          <input
                            type="time"
                            value={workingHours[day.key].start}
                            onChange={(e) => updateDayTime(day.key, 'start', e.target.value)}
                            className="w-full h-full bg-transparent border-none outline-none text-sm font-medium text-gray-900 p-0"
                          />
                        </div>
                      </div>

                      <span className="text-gray-400 text-sm font-bold text-center w-6">–</span>

                      {/* End Time Container */}
                      <div className="flex-1 min-w-[110px]">
                         <div className="relative flex items-center h-10 px-3 border-2 border-gray-300 rounded-lg bg-white hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                          <input
                            type="time"
                            value={workingHours[day.key].end}
                            onChange={(e) => updateDayTime(day.key, 'end', e.target.value)}
                            className="w-full h-full bg-transparent border-none outline-none text-sm font-medium text-gray-900 p-0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Blocked Times */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-white" />
              <div>
                <h2 className="text-sm font-bold text-white">Blocked Times</h2>
                <p className="text-red-100 text-xs">Specific unavailable periods</p>
              </div>
            </div>
            <button
              onClick={addBlockedTime}
              className="px-2.5 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Block
            </button>
          </div>
          <div className="p-4">
            {blockedTimes.length === 0 ? (
              <div className="text-center py-8 bg-red-50 rounded-lg border-2 border-dashed border-red-300">
                <X className="h-10 w-10 text-red-300 mx-auto mb-2" />
                <p className="text-xs text-gray-600 mb-3">No blocked times</p>
                <button
                  onClick={addBlockedTime}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                >
                  Add Blocked Time
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {blockedTimes.map((block, index) => (
                  <div
                    key={block.id}
                    className="flex flex-col md:flex-row items-stretch md:items-center gap-2 p-3 bg-red-50 border-2 border-red-200 rounded-lg"
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Start
                        </label>
                        <input
                          type="datetime-local"
                          value={block.start_time}
                          onChange={(e) =>
                            updateBlockedTime(index, 'start_time', e.target.value)
                          }
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          End
                        </label>
                        <input
                          type="datetime-local"
                          value={block.end_time}
                          onChange={(e) =>
                            updateBlockedTime(index, 'end_time', e.target.value)
                          }
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Reason (optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Vacation, meeting, etc."
                          value={block.reason || ''}
                          onChange={(e) =>
                            updateBlockedTime(index, 'reason', e.target.value)
                          }
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeBlockedTime(index)}
                      className="self-end md:self-auto p-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}