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
  Settings,
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

  const days = [
    { key: 'monday', label: 'Monday', emoji: '📅' },
    { key: 'tuesday', label: 'Tuesday', emoji: '📅' },
    { key: 'wednesday', label: 'Wednesday', emoji: '📅' },
    { key: 'thursday', label: 'Thursday', emoji: '📅' },
    { key: 'friday', label: 'Friday', emoji: '📅' },
    { key: 'saturday', label: 'Saturday', emoji: '📅' },
    { key: 'sunday', label: 'Sunday', emoji: '📅' },
  ];

  const bufferOptions = [
    { value: 0, label: 'No buffer' },
    { value: 5, label: '5 minutes' },
    { value: 10, label: '10 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
  ];

  // Helper: Convert ISO timestamp to datetime-local format
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

      // Convert ISO timestamps to datetime-local format
      const formattedBlockedTimes = (data.blocked_times || []).map(block => ({
        ...block,
        start_time: convertISOToDateTimeLocal(block.start_time),
        end_time: convertISOToDateTimeLocal(block.end_time),
      }));

      setBlockedTimes(formattedBlockedTimes);
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Filter out empty blocked times and convert to ISO
      const validBlockedTimes = blockedTimes
        .filter(block => block.start_time && block.end_time)
        .map(block => ({
          start_time: new Date(block.start_time).toISOString(),
          end_time: new Date(block.end_time).toISOString(),
          reason: block.reason || null,
        }));

      console.log('💾 Saving availability:', {
        buffer_time: bufferTime,
        working_hours: workingHours,
        blocked_times: validBlockedTimes
      });

      await api.put(`/team-members/${memberId}/availability`, {
        buffer_time: bufferTime,
        working_hours: workingHours,
        blocked_times: validBlockedTimes,
      });

      console.log('✅ Availability settings saved');
      navigate(-1);
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Failed to save settings. Please try again.');
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Availability Settings</h1>
          <p className="text-gray-600 text-sm mt-0.5">
            Configure working hours and buffer time for {member?.name}
          </p>
        </div>
      </div>

      {/* Buffer Time */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Buffer Time</h2>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Buffer time adds a gap between consecutive meetings to give you time to prepare or take breaks.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {bufferOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setBufferTime(option.value)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                bufferTime === option.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Working Hours */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Working Hours</h2>
        </div>

        <div className="space-y-2">
          {days.map((day) => (
            <div
              key={day.key}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                workingHours[day.key].enabled
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              {/* Day Toggle */}
              <button
                onClick={() => toggleDay(day.key)}
                className={`flex-shrink-0 w-12 h-6 rounded-full transition-colors relative ${
                  workingHours[day.key].enabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    workingHours[day.key].enabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>

              {/* Day Label */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {day.emoji} {day.label}
                </p>
              </div>

              {/* Time Inputs */}
              {workingHours[day.key].enabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={workingHours[day.key].start}
                    onChange={(e) => updateDayTime(day.key, 'start', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-gray-500 text-sm">to</span>
                  <input
                    type="time"
                    value={workingHours[day.key].end}
                    onChange={(e) => updateDayTime(day.key, 'end', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              )}

              {!workingHours[day.key].enabled && (
                <span className="text-sm text-gray-500">Unavailable</span>
              )}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              const allEnabled = { ...workingHours };
              Object.keys(allEnabled).forEach((day) => {
                allEnabled[day].enabled = true;
              });
              setWorkingHours(allEnabled);
            }}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Enable All Days
          </button>
          <button
            onClick={() => {
              const weekdaysOnly = { ...workingHours };
              weekdaysOnly.saturday.enabled = false;
              weekdaysOnly.sunday.enabled = false;
              setWorkingHours(weekdaysOnly);
            }}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Weekdays Only
          </button>
        </div>
      </div>

      {/* Blocked Times (Coming Soon) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-bold text-gray-900">Blocked Times</h2>
          </div>
          <button
            onClick={addBlockedTime}
            className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Block
          </button>
        </div>

        {blockedTimes.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            No blocked times. Add specific times when you're unavailable.
          </div>
        ) : (
          <div className="space-y-2">
            {blockedTimes.map((block, index) => (
              <div key={block.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <input
                  type="datetime-local"
                  value={block.start_time}
                  onChange={(e) => updateBlockedTime(index, 'start_time', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="datetime-local"
                  value={block.end_time}
                  onChange={(e) => updateBlockedTime(index, 'end_time', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={block.reason}
                  onChange={(e) => updateBlockedTime(index, 'reason', e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={() => removeBlockedTime(index)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}