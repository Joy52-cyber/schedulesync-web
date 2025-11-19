import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Clock, Calendar, Loader2, Plus, Trash2, 
  Info, Settings, CheckCircle, AlertCircle, Zap, Sun, Moon,
  Coffee, X, Check
} from 'lucide-react';
import api from '../utils/api';

export default function AvailabilitySettings() {
  const { memberId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);
  const [bufferTime, setBufferTime] = useState(0);
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
    { key: 'monday', label: 'Monday', emoji: '📅', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', emoji: '📅', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', emoji: '📅', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', emoji: '📅', short: 'Thu' },
    { key: 'friday', label: 'Friday', emoji: '📅', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', emoji: '🎉', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', emoji: '🌴', short: 'Sun' },
  ];

  const bufferOptions = [
    { value: 0, label: 'No buffer', icon: '⚡', desc: 'Back-to-back meetings' },
    { value: 5, label: '5 minutes', icon: '☕', desc: 'Quick break' },
    { value: 10, label: '10 minutes', icon: '🚶', desc: 'Short break' },
    { value: 15, label: '15 minutes', icon: '💭', desc: 'Standard buffer' },
    { value: 30, label: '30 minutes', icon: '🍱', desc: 'Extended break' },
    { value: 60, label: '1 hour', icon: '🧘', desc: 'Full break' },
  ];

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
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
      const response = await api.get(`/team-members/${memberId}/availability`);
      const data = response.data;

      setMember(data.member);
      setBufferTime(data.member.buffer_time || 0);
      
      if (data.member.working_hours) {
        setWorkingHours(data.member.working_hours);
      }

      const formattedBlockedTimes = (data.blocked_times || []).map(block => ({
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
        .filter(block => block.start_time && block.end_time)
        .map(block => ({
          start_time: new Date(block.start_time).toISOString(),
          end_time: new Date(block.end_time).toISOString(),
          reason: block.reason || null,
        }));

      await api.put(`/team-members/${memberId}/availability`, {
        buffer_time: bufferTime,
        working_hours: workingHours,
        blocked_times: validBlockedTimes,
      });

      showNotification('✅ Settings saved successfully!');
      setTimeout(() => navigate(-1), 1500);
    } catch (error) {
      console.error('Error saving availability:', error);
      showNotification('Failed to save settings', 'error');
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
    showNotification('Blocked time removed');
  };

  const updateBlockedTime = (index, field, value) => {
    const updated = [...blockedTimes];
    updated[index][field] = value;
    setBlockedTimes(updated);
  };

  const applyToAllDays = () => {
    const allEnabled = { ...workingHours };
    Object.keys(allEnabled).forEach((day) => {
      allEnabled[day].enabled = true;
    });
    setWorkingHours(allEnabled);
    showNotification('All days enabled');
  };

  const applyWeekdaysOnly = () => {
    const weekdaysOnly = { ...workingHours };
    weekdaysOnly.saturday.enabled = false;
    weekdaysOnly.sunday.enabled = false;
    Object.keys(weekdaysOnly).forEach((day) => {
      if (day !== 'saturday' && day !== 'sunday') {
        weekdaysOnly[day].enabled = true;
      }
    });
    setWorkingHours(weekdaysOnly);
    showNotification('Weekdays only mode applied');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading availability settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 pb-20">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-lg ${
            notification.type === 'error' 
              ? 'bg-red-500 text-white' 
              : 'bg-green-500 text-white'
          }`}>
            {notification.type === 'error' ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <CheckCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-6">
            <button
              onClick={() => navigate(-1)}
              className="p-3 hover:bg-gray-100 rounded-xl transition-all group"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Availability Settings
              </h1>
              <p className="text-gray-600 text-sm mt-1 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Configure working hours for {member?.name}
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Buffer Time */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Buffer Time</h2>
                <p className="text-blue-100 text-sm">Add breathing room between meetings</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900">
                  Buffer time automatically adds gaps between consecutive meetings to prevent burnout and give you time to prepare.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {bufferOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setBufferTime(option.value);
                    showNotification(`Buffer time set to ${option.label}`);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all group hover:scale-105 ${
                    bufferTime === option.value
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{option.icon}</div>
                  <div className={`font-bold mb-1 ${
                    bufferTime === option.value ? 'text-blue-700' : 'text-gray-900'
                  }`}>
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-600">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 backdrop-blur-lg rounded-xl flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Working Hours</h2>
                  <p className="text-purple-100 text-sm">Set your availability for each day</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyToAllDays}
                  className="px-3 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all text-sm font-medium backdrop-blur-lg"
                >
                  Enable All
                </button>
                <button
                  onClick={applyWeekdaysOnly}
                  className="px-3 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all text-sm font-medium backdrop-blur-lg"
                >
                  Weekdays Only
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {days.map((day) => (
                <div
                  key={day.key}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    workingHours[day.key].enabled
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggleDay(day.key)}
                    className={`relative flex-shrink-0 w-14 h-8 rounded-full transition-all ${
                      workingHours[day.key].enabled 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                        : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-lg ${
                      workingHours[day.key].enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}>
                      {workingHours[day.key].enabled && (
                        <Check className="h-6 w-6 text-green-600" />
                      )}
                    </div>
                  </button>

                  {/* Day Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-2xl">{day.emoji}</div>
                    <div>
                      <p className="font-bold text-gray-900">{day.label}</p>
                      <p className="text-xs text-gray-600">{day.short}</p>
                    </div>
                  </div>

                  {/* Time Inputs */}
                  {workingHours[day.key].enabled ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-yellow-600" />
                        <input
                          type="time"
                          value={workingHours[day.key].start}
                          onChange={(e) => updateDayTime(day.key, 'start', e.target.value)}
                          className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all font-mono text-sm"
                        />
                      </div>
                      <span className="text-gray-500 font-medium">→</span>
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4 text-indigo-600" />
                        <input
                          type="time"
                          value={workingHours[day.key].end}
                          onChange={(e) => updateDayTime(day.key, 'end', e.target.value)}
                          className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500 font-medium">Unavailable</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Blocked Times */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 backdrop-blur-lg rounded-xl flex items-center justify-center">
                  <Coffee className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Blocked Times</h2>
                  <p className="text-orange-100 text-sm">Mark specific times as unavailable</p>
                </div>
              </div>
              <button
                onClick={addBlockedTime}
                className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all font-medium backdrop-blur-lg flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Add Block
              </button>
            </div>
          </div>

          <div className="p-6">
            {blockedTimes.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border-2 border-dashed border-orange-300">
                <Coffee className="h-16 w-16 text-orange-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">No blocked times</p>
                <p className="text-sm text-gray-500 mb-4">Add lunch breaks, meetings, or time off</p>
                <button
                  onClick={addBlockedTime}
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold inline-flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Your First Block
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {blockedTimes.map((block, index) => (
                  <div key={block.id} className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="datetime-local"
                        value={block.start_time}
                        onChange={(e) => updateBlockedTime(index, 'start_time', e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-4 focus:ring-orange-100 focus:outline-none transition-all font-mono text-sm"
                      />
                      <input
                        type="datetime-local"
                        value={block.end_time}
                        onChange={(e) => updateBlockedTime(index, 'end_time', e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-4 focus:ring-orange-100 focus:outline-none transition-all font-mono text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={block.reason || ''}
                        onChange={(e) => updateBlockedTime(index, 'reason', e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-4 focus:ring-orange-100 focus:outline-none transition-all text-sm"
                      />
                    </div>
                    <button
                      onClick={() => removeBlockedTime(index)}
                      className="p-3 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-all"
                      title="Remove"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Save Button (Mobile) */}
      <div className="fixed bottom-6 left-0 right-0 px-4 md:hidden">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-lg"
        >
          {saving ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-6 w-6" />
              Save Settings
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}