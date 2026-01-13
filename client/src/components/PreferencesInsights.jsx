import { useState, useEffect } from 'react';
import { Brain, Clock, Calendar, TrendingUp, Loader2, Sparkles } from 'lucide-react';
import api from '../utils/api';

export default function PreferencesInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await api.get('/preferences');
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  const prefs = data?.preferences;
  const stats = data?.stats;

  if (!prefs || stats?.total_bookings_analyzed < 3) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Brain className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">AI Learning Your Preferences</h3>
            <p className="text-sm text-gray-600 mt-1">
              After a few more bookings, we'll show insights about your scheduling habits.
            </p>
            <p className="text-xs text-purple-600 mt-2">
              {stats?.total_bookings_analyzed || 0} / 3 bookings analyzed
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Your Scheduling Personality</h3>
          <p className="text-xs text-gray-500">
            Based on {stats?.total_bookings_analyzed} bookings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Preferred Duration */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Preferred Duration</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            {prefs.preferred_meeting_duration} min
          </p>
        </div>

        {/* Active Hours */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Most Active</span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {prefs.preferred_hours_start}:00 - {prefs.preferred_hours_end}:00
          </p>
        </div>

        {/* Busiest Day */}
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-medium">Busiest Day</span>
          </div>
          <p className="text-xl font-bold text-purple-900 capitalize">
            {prefs.busiest_day}
          </p>
        </div>

        {/* Quietest Day */}
        <div className="bg-pink-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-pink-600 mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-medium">Quietest Day</span>
          </div>
          <p className="text-xl font-bold text-pink-900 capitalize">
            {prefs.quietest_day}
          </p>
        </div>
      </div>

      {/* Avg Meetings */}
      {prefs.avg_meetings_per_day > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-600">
            You average <span className="font-bold text-gray-900">{prefs.avg_meetings_per_day}</span> meetings per day
          </p>
        </div>
      )}
    </div>
  );
}
