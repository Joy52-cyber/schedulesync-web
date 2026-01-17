import { useState, useEffect } from 'react';
import { Users, TrendingUp, BarChart3, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

export default function TeamAssignmentStats({ teamId, onUpdateBookingMode }) {
  const notify = useNotification();

  const [stats, setStats] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (teamId) {
      loadStats();
      loadTeamDetails();
    }
  }, [teamId]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.teams.getAssignmentStats(teamId);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load team assignment stats:', err);
      setError('Failed to load assignment statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamDetails = async () => {
    try {
      const response = await api.teams.get(teamId);
      setTeam(response.data);
    } catch (err) {
      console.error('Failed to load team details:', err);
    }
  };

  const handleUpdateBookingMode = async (newMode) => {
    try {
      setUpdating(true);
      await api.teams.update(teamId, { booking_mode: newMode });
      setTeam({ ...team, booking_mode: newMode });
      notify.success(`Booking mode updated to ${newMode === 'round_robin' ? 'Round Robin' : 'First Available'}`);

      if (onUpdateBookingMode) {
        onUpdateBookingMode(newMode);
      }

      // Reload stats to show updated data
      await loadStats();
    } catch (err) {
      console.error('Failed to update booking mode:', err);
      notify.error('Failed to update booking mode');
    } finally {
      setUpdating(false);
    }
  };

  const getFairnessColor = (score) => {
    if (score < 0.3) return 'bg-green-100 text-green-800 border-green-200';
    if (score < 0.5) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score < 0.8) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getFairnessIcon = (score) => {
    if (score < 0.3) return <CheckCircle className="h-5 w-5" />;
    if (score < 0.8) return <TrendingUp className="h-5 w-5" />;
    return <AlertCircle className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const maxBookings = Math.max(...stats.members.map((m) => m.upcomingBookings), 1);

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Team Workload Distribution</h3>
            <p className="text-xs text-gray-500">{stats.memberCount} team members</p>
          </div>
        </div>

        <button
          onClick={loadStats}
          className="p-2 hover:bg-gray-100 rounded-lg transition-all"
          title="Refresh stats"
        >
          <RefreshCw className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Fairness Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Fairness Score</span>
          <div
            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 border-2 ${getFairnessColor(
              stats.fairness.fairnessScore
            )}`}
          >
            {getFairnessIcon(stats.fairness.fairnessScore)}
            {stats.fairness.description}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Standard deviation: {stats.fairness.standardDeviation.toFixed(2)} | Average:{' '}
          {stats.fairness.averageUpcoming.toFixed(1)} bookings
        </p>
      </div>

      {/* Member Workload Bars */}
      <div className="mb-6 space-y-3">
        {stats.members.map((member) => (
          <div key={member.memberId}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {member.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2)}
                </div>
                <span className="font-medium text-gray-900 text-sm truncate">{member.name}</span>
              </div>
              <div className="text-sm text-gray-600 ml-2 flex-shrink-0">
                <span className="font-semibold text-purple-600">{member.upcomingBookings}</span>{' '}
                upcoming
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 relative"
                style={{ width: `${(member.upcomingBookings / maxBookings) * 100}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>

            {/* Additional stats */}
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span>Last 30 days: {member.last30DaysBookings}</span>
              <span>•</span>
              <span>Total: {member.totalBookings}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Booking Mode Selector */}
      <div className="border-t border-gray-200 pt-5">
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Assignment Mode
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Round Robin */}
          <button
            onClick={() => handleUpdateBookingMode('round_robin')}
            disabled={updating || team?.booking_mode === 'round_robin'}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              team?.booking_mode === 'round_robin'
                ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-400 shadow-md'
                : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-sm'
            } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  team?.booking_mode === 'round_robin'
                    ? 'border-purple-600 bg-purple-600'
                    : 'border-gray-300'
                }`}
              >
                {team?.booking_mode === 'round_robin' && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">Round Robin</p>
                <p className="text-xs text-gray-600 mt-1">
                  Distributes bookings fairly across all team members
                </p>
              </div>
            </div>
          </button>

          {/* First Available */}
          <button
            onClick={() => handleUpdateBookingMode('first_available')}
            disabled={updating || team?.booking_mode === 'first_available'}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              team?.booking_mode === 'first_available'
                ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-400 shadow-md'
                : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-sm'
            } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  team?.booking_mode === 'first_available'
                    ? 'border-purple-600 bg-purple-600'
                    : 'border-gray-300'
                }`}
              >
                {team?.booking_mode === 'first_available' && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">First Available</p>
                <p className="text-xs text-gray-600 mt-1">
                  Assigns based on calendar availability (may be uneven)
                </p>
              </div>
            </div>
          </button>
        </div>

        {updating && (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-purple-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating...
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-800">
          <strong>Tip:</strong> Round Robin mode is recommended for fair workload distribution.
          Use First Available if calendar conflicts are a concern.
        </p>
      </div>
    </div>
  );
}
