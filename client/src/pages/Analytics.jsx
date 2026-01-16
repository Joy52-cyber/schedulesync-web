import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import api from '../utils/api';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('30'); // days

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/analytics?days=${period}`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <div className="relative z-10">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      <div className="p-6 space-y-6 animate-fade-in relative z-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400">Track your booking trends and performance</p>
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Bookings"
          value={stats?.totalBookings || 0}
          change={stats?.bookingsChange || 0}
          icon={Calendar}
          color="purple"
        />
        <StatCard
          title="Completed"
          value={stats?.completedBookings || 0}
          change={stats?.completedChange || 0}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Cancelled"
          value={stats?.cancelledBookings || 0}
          change={stats?.cancelledChange || 0}
          icon={Clock}
          color="red"
          invertChange
        />
        <StatCard
          title="Unique Guests"
          value={stats?.uniqueGuests || 0}
          change={stats?.guestsChange || 0}
          icon={Users}
          color="blue"
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bookings Over Time */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl border-2 border-white/20 p-6 shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 transition-all">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Bookings Over Time
          </h3>
          <div className="h-64">
            <SimpleBarChart data={stats?.bookingsByDay || []} />
          </div>
        </div>

        {/* Popular Times */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl border-2 border-white/20 p-6 shadow-lg hover:shadow-2xl hover:shadow-blue-200/30 transition-all">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Popular Booking Times
          </h3>
          <div className="h-64">
            <HourHeatmap data={stats?.bookingsByHour || []} />
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Event Types */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl border-2 border-white/20 p-6 shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 transition-all">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Event Types</h3>
          <div className="space-y-3">
            {(stats?.topEventTypes || []).map((event, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${
                  ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'][i % 5]
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-white font-medium truncate">{event.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{event.count} bookings</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {event.percentage}%
                  </span>
                </div>
              </div>
            ))}
            {(!stats?.topEventTypes || stats.topEventTypes.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data yet</p>
            )}
          </div>
        </div>

        {/* Popular Days */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl border-2 border-white/20 p-6 shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 transition-all">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Bookings by Day</h3>
          <div className="space-y-3">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              // Adjust index: Mon=0 but DOW has Sun=0, so we need Mon=1, Sun=0
              const dowIndex = i === 6 ? 0 : i + 1;
              const count = stats?.bookingsByDayOfWeek?.[dowIndex] || 0;
              const max = Math.max(...(stats?.bookingsByDayOfWeek || [1]));
              const percentage = max > 0 ? (count / max) * 100 : 0;

              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-10 text-sm text-gray-600 dark:text-gray-400">{day}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(percentage, 10)}%` }}
                    >
                      <span className="text-xs text-white font-medium">{count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl border-2 border-white/20 p-6 shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 transition-all">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Bookings</h3>
          <div className="space-y-3">
            {(stats?.recentBookings || []).slice(0, 5).map((booking, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                    {booking.attendee_name?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-white font-medium truncate">
                    {booking.attendee_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(booking.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  booking.status === 'confirmed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {booking.status}
                </span>
              </div>
            ))}
            {(!stats?.recentBookings || stats.recentBookings.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No bookings yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon, color, invertChange = false }) {
  const isPositive = invertChange ? change < 0 : change > 0;

  const colorClasses = {
    purple: 'bg-gradient-to-br from-purple-500 to-pink-500 text-white',
    green: 'bg-gradient-to-br from-green-500 to-emerald-500 text-white',
    red: 'bg-gradient-to-br from-red-500 to-pink-500 text-white',
    blue: 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-xl border-2 border-white/20 p-6 shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 hover:-translate-y-1 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        {change !== 0 && (
          <div className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{title}</p>
    </div>
  );
}

function SimpleBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="h-full flex items-end justify-between gap-1 pt-4 pb-8">
      {data.slice(-14).map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 relative group">
          <div
            className="w-full bg-gradient-to-t from-purple-500 to-pink-500 rounded-t transition-all duration-500 min-h-[4px] hover:opacity-80"
            style={{ height: `${Math.max((day.count / max) * 100, 5)}%` }}
          />
          <span className="absolute -bottom-6 text-xs text-gray-400 whitespace-nowrap">
            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          {/* Tooltip */}
          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
            {day.count} bookings
          </div>
        </div>
      ))}
    </div>
  );
}

function HourHeatmap({ data }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const max = Math.max(...data, 1);

  return (
    <div className="h-full grid grid-cols-6 gap-2 content-center">
      {hours.map(hour => {
        const count = data[hour] || 0;
        const intensity = count / max;

        return (
          <div
            key={hour}
            className="relative rounded-lg flex items-center justify-center text-xs font-medium transition-colors aspect-square"
            style={{
              backgroundColor: intensity > 0
                ? `rgba(139, 92, 246, ${0.2 + intensity * 0.8})`
                : 'rgba(0,0,0,0.05)',
              color: intensity > 0.5 ? 'white' : '#6b7280'
            }}
            title={`${hour}:00 - ${count} bookings`}
          >
            {hour}:00
          </div>
        );
      })}
    </div>
  );
}
