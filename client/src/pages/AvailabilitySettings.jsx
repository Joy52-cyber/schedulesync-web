import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Clock, Calendar, Loader2, Plus, Trash2, 
  Info, AlertCircle, CheckCircle, X, Check
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
    { key: 'monday', label: 'Mon', full: 'Monday' },
    { key: 'tuesday', label: 'Tue', full: 'Tuesday' },
    { key: 'wednesday', label: 'Wed', full: 'Wednesday' },
    { key: 'thursday', label: 'Thu', full: 'Thursday' },
    { key: 'friday', label: 'Fri', full: 'Friday' },
    { key: 'saturday', label: 'Sat', full: 'Saturday' },
    { key: 'sunday', label: 'Sun', full: 'Sunday' },
  ];

  const bufferOptions = [
    { value: 0, label: 'None' },
    { value: 5, label: '5min' },
    { value: 10, label: '10min' },
    { value: 15, label: '15min' },
    { value: 30, label: '30min' },
    { value: 60, label: '1hr' },
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
      showNotification('Failed to load', 'error');
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

      showNotification('Saved!');
      setTimeout(() => navigate(-1), 1000);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Notification */}
      {notification && (
        <div className="fixed top-3 right-3 z-50 animate-slide-in">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
            notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}>
            {notification.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            {notification.message}
          </div>
        </div>
      )}

      {/* Compact Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-3 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">Availability Settings</h1>
              <p className="text-xs text-gray-600">{member?.name}</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Compact Content */}
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* Compact Buffer Time */}
        <div className="bg-white rounded-lg border">
          <div className="bg-blue-600 px-4 py-2 rounded-t-lg flex items-center gap-2">
            <Clock className="h-4 w-4 text-white" />
            <h2 className="text-sm font-semibold text-white">Buffer Time</h2>
          </div>
          <div className="p-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900">Adds gaps between consecutive meetings</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {bufferOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setBufferTime(option.value)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    bufferTime === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Compact Working Hours */}
        <div className="bg-white rounded-lg border">
          <div className="bg-purple-600 px-4 py-2 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-white" />
              <h2 className="text-sm font-semibold text-white">Working Hours</h2>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const all = { ...workingHours };
                  Object.keys(all).forEach(d => all[d].enabled = true);
                  setWorkingHours(all);
                }}
                className="px-2 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded text-xs"
              >
                All
              </button>
              <button
                onClick={() => {
                  const wk = { ...workingHours };
                  wk.saturday.enabled = false;
                  wk.sunday.enabled = false;
                  Object.keys(wk).forEach(d => { if (d !== 'saturday' && d !== 'sunday') wk[d].enabled = true; });
                  setWorkingHours(wk);
                }}
                className="px-2 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded text-xs"
              >
                M-F
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {days.map((day) => (
                <div
                  key={day.key}
                  className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                    workingHours[day.key].enabled
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <button
                    onClick={() => toggleDay(day.key)}
                    className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-all ${
                      workingHours[day.key].enabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                      workingHours[day.key].enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}>
                      {workingHours[day.key].enabled && <Check className="h-5 w-5 text-green-600" />}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{day.label}</p>
                  </div>
                  {workingHours[day.key].enabled ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={workingHours[day.key].start}
                        onChange={(e) => updateDayTime(day.key, 'start', e.target.value)}
                        className="px-2 py-1 border rounded text-xs w-20"
                      />
                      <span className="text-gray-400 text-xs">→</span>
                      <input
                        type="time"
                        value={workingHours[day.key].end}
                        onChange={(e) => updateDayTime(day.key, 'end', e.target.value)}
                        className="px-2 py-1 border rounded text-xs w-20"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">Off</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compact Blocked Times */}
        <div className="bg-white rounded-lg border">
          <div className="bg-orange-600 px-4 py-2 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white" />
              <h2 className="text-sm font-semibold text-white">Blocked Times</h2>
            </div>
            <button
              onClick={addBlockedTime}
              className="px-2 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded text-xs font-medium flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          <div className="p-4">
            {blockedTimes.length === 0 ? (
              <div className="text-center py-6 bg-orange-50 rounded-lg border border-dashed border-orange-300">
                <p className="text-xs text-gray-600 mb-2">No blocked times</p>
                <button
                  onClick={addBlockedTime}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700"
                >
                  Add Block
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {blockedTimes.map((block, index) => (
                  <div key={block.id} className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="datetime-local"
                        value={block.start_time}
                        onChange={(e) => updateBlockedTime(index, 'start_time', e.target.value)}
                        className="px-2 py-1 border rounded text-xs"
                      />
                      <input
                        type="datetime-local"
                        value={block.end_time}
                        onChange={(e) => updateBlockedTime(index, 'end_time', e.target.value)}
                        className="px-2 py-1 border rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={block.reason || ''}
                        onChange={(e) => updateBlockedTime(index, 'reason', e.target.value)}
                        className="px-2 py-1 border rounded text-xs"
                      />
                    </div>
                    <button
                      onClick={() => removeBlockedTime(index)}
                      className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded"
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

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}