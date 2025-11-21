import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  Check,
  Loader2,
  ArrowLeft
} from 'lucide-react';

export default function MemberAvailability() {
  const { teamId, memberId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [availability, setAvailability] = useState({
    timezone: 'America/New_York',
    schedule: [
      { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Wednesday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Friday', enabled: true, start: '09:00', end: '17:00' },
      { day: 'Saturday', enabled: false, start: '09:00', end: '17:00' },
      { day: 'Sunday', enabled: false, start: '09:00', end: '17:00' }
    ]
  });

  useEffect(() => {
    loadAvailability();
  }, [teamId, memberId]);

  const loadAvailability = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/teams/${teamId}/members/${memberId}/availability`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (data.availability) {
        setAvailability(data.availability);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await fetch(
        `${import.meta.env.VITE_API_URL}/api/teams/${teamId}/members/${memberId}/availability`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(availability)
        }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving availability:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = (index, field, value) => {
    const newSchedule = [...availability.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setAvailability({ ...availability, schedule: newSchedule });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/teams/${teamId}/members`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Availability Settings</h1>
          <p className="text-gray-600">Configure your weekly availability schedule</p>
        </div>

        {/* Availability Form */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-gray-100">
          
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Weekly Schedule
            </h2>
          </div>

          <div className="p-8 space-y-6">
            
            {/* Timezone */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Timezone</label>
              <select
                value={availability.timezone}
                onChange={(e) => setAvailability({ ...availability, timezone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              >
                <option value="America/New_York">Eastern Time (US)</option>
                <option value="America/Chicago">Central Time (US)</option>
                <option value="America/Denver">Mountain Time (US)</option>
                <option value="America/Los_Angeles">Pacific Time (US)</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>

            {/* Schedule Grid */}
            <div className="space-y-3">
              {availability.schedule.map((day, index) => (
                <div
                  key={day.day}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    day.enabled 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    
                    {/* Day Toggle */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(e) => updateSchedule(index, 'enabled', e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="font-bold text-gray-900">{day.day}</span>
                    </label>

                    {/* Start Time */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Start</label>
                      <input
                        type="time"
                        value={day.start}
                        onChange={(e) => updateSchedule(index, 'start', e.target.value)}
                        disabled={!day.enabled}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* End Time */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">End</label>
                      <input
                        type="time"
                        value={day.end}
                        onChange={(e) => updateSchedule(index, 'end', e.target.value)}
                        disabled={!day.enabled}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Duration Display */}
                    <div className="text-sm text-gray-600">
                      {day.enabled && (
                        <>
                          <Clock className="h-4 w-4 inline mr-1" />
                          {calculateDuration(day.start, day.end)} hrs
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold text-lg disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="h-5 w-5" />
                Saved!
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                Save Availability
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function calculateDuration(start, end) {
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  const duration = (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;
  return duration.toFixed(1);
}