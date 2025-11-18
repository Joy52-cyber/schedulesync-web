import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Zap,
  Mail,
  Link2,
  Plus,
} from 'lucide-react';
import api from '../utils/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    todayBookings: 0,
    upcomingBookings: 0,
    thisWeekBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
  });
  const [todayBookings, setTodayBookings] = useState([]);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamStats, setTeamStats] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load teams and bookings in parallel
      const [teamsResponse, bookingsResponse] = await Promise.all([
        api.get('/teams'),
        api.get('/bookings'),
      ]);

      const teamsData = teamsResponse.data.teams || [];
      const bookingsData = bookingsResponse.data.bookings || [];

      setTeams(teamsData);

      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const today = bookingsData.filter(b => {
        const bookingDate = new Date(b.start_time);
        return bookingDate >= todayStart && bookingDate < todayEnd;
      });

      const thisWeek = bookingsData.filter(b => {
        const bookingDate = new Date(b.start_time);
        return bookingDate >= weekStart && bookingDate < weekEnd;
      });

      const upcoming = bookingsData.filter(b => {
        const bookingDate = new Date(b.start_time);
        return bookingDate >= now && b.status !== 'cancelled';
      }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      setStats({
        totalBookings: bookingsData.length,
        todayBookings: today.length,
        upcomingBookings: upcoming.length,
        thisWeekBookings: thisWeek.length,
        completedBookings: bookingsData.filter(b => 
          new Date(b.start_time) < now && b.status === 'confirmed'
        ).length,
        cancelledBookings: bookingsData.filter(b => b.status === 'cancelled').length,
      });

      setTodayBookings(today.slice(0, 5));
      setUpcomingBookings(upcoming.slice(0, 5));

      // Calculate team stats
      const teamStatsMap = {};
      teamsData.forEach(team => {
        teamStatsMap[team.id] = {
          teamId: team.id,
          teamName: team.name,
          bookingMode: team.booking_mode || 'individual',
          totalBookings: 0,
          upcomingBookings: 0,
          completedBookings: 0,
        };
      });

      bookingsData.forEach(booking => {
        if (teamStatsMap[booking.team_id]) {
          teamStatsMap[booking.team_id].totalBookings++;
          if (new Date(booking.start_time) >= now && booking.status !== 'cancelled') {
            teamStatsMap[booking.team_id].upcomingBookings++;
          }
          if (new Date(booking.start_time) < now && booking.status === 'confirmed') {
            teamStatsMap[booking.team_id].completedBookings++;
          }
        }
      });

      setTeamStats(Object.values(teamStatsMap).sort((a, b) => b.totalBookings - a.totalBookings));

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getBookingModeLabel = (mode) => {
    const modes = {
      individual: '👤 Individual',
      round_robin: '🔄 Round-robin',
      first_available: '⚡ First Available',
      collective: '👥 Collective',
    };
    return modes[mode] || '👤 Individual';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's your scheduling overview</p>
        </div>
        <button
          onClick={() => navigate('/my-booking-link')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Link2 className="h-5 w-5" />
          My Booking Link
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Bookings */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 rounded-lg p-3">
              <Calendar className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 opacity-75" />
          </div>
          <h3 className="text-3xl font-bold mb-1">{stats.todayBookings}</h3>
          <p className="text-blue-100 text-sm font-medium">Today's Bookings</p>
        </div>

        {/* This Week */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 rounded-lg p-3">
              <Clock className="h-6 w-6" />
            </div>
            <Zap className="h-5 w-5 opacity-75" />
          </div>
          <h3 className="text-3xl font-bold mb-1">{stats.thisWeekBookings}</h3>
          <p className="text-purple-100 text-sm font-medium">This Week</p>
        </div>

        {/* Total Bookings */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 rounded-lg p-3">
              <CheckCircle className="h-6 w-6" />
            </div>
            <Users className="h-5 w-5 opacity-75" />
          </div>
          <h3 className="text-3xl font-bold mb-1">{stats.totalBookings}</h3>
          <p className="text-green-100 text-sm font-medium">Total Bookings</p>
        </div>

        {/* Upcoming */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 rounded-lg p-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 opacity-75" />
          </div>
          <h3 className="text-3xl font-bold mb-1">{stats.upcomingBookings}</h3>
          <p className="text-orange-100 text-sm font-medium">Upcoming</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Bookings Widget */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Today's Schedule
            </h2>
            <button
              onClick={() => navigate('/bookings')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {todayBookings.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings today</h3>
              <p className="text-gray-600 text-sm mb-4">Your schedule is clear for today</p>
              <button
                onClick={() => navigate('/my-booking-link')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Link2 className="h-4 w-4" />
                Share Booking Link
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todayBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => navigate('/bookings')}
                >
                  <div className="bg-blue-100 rounded-lg p-3 flex-shrink-0">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {booking.attendee_name}
                      </h3>
                      {booking.status === 'cancelled' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          Cancelled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{booking.attendee_email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">
                      {formatTime(booking.start_time)}
                    </p>
                    <p className="text-xs text-gray-500">{booking.team_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/teams')}
              className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:shadow-md transition-all text-left group"
            >
              <div className="bg-blue-600 rounded-lg p-2">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  Manage Teams
                </p>
                <p className="text-xs text-gray-600">
                  {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => navigate('/bookings')}
              className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg hover:shadow-md transition-all text-left group"
            >
              <div className="bg-purple-600 rounded-lg p-2">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                  View All Bookings
                </p>
                <p className="text-xs text-gray-600">
                  {stats.upcomingBookings} upcoming
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => navigate('/my-booking-link')}
              className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg hover:shadow-md transition-all text-left group"
            >
              <div className="bg-green-600 rounded-lg p-2">
                <Link2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                  My Booking Link
                </p>
                <p className="text-xs text-gray-600">Share with clients</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming This Week & Team Performance */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming This Week */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              Upcoming This Week
            </h2>
            <button
              onClick={() => navigate('/bookings')}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">No upcoming bookings this week</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => navigate('/bookings')}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-center flex-shrink-0">
                      <p className="text-xs font-medium text-gray-500">
                        {formatDate(booking.start_time).split(',')[0]}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Date(booking.start_time).getDate()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {booking.attendee_name}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {formatTime(booking.start_time)} • {booking.team_name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Team Performance
            </h2>
            <button
              onClick={() => navigate('/teams')}
              className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
            >
              Manage
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {teamStats.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-sm mb-3">No teams yet</p>
              <button
                onClick={() => navigate('/teams')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Create Team
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {teamStats.map((team) => (
                <div key={team.teamId} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{team.teamName}</h3>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                      {getBookingModeLabel(team.bookingMode)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-xl font-bold text-blue-600">{team.totalBookings}</p>
                      <p className="text-xs text-gray-600">Total</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-xl font-bold text-green-600">{team.upcomingBookings}</p>
                      <p className="text-xs text-gray-600">Upcoming</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2">
                      <p className="text-xl font-bold text-purple-600">{team.completedBookings}</p>
                      <p className="text-xs text-gray-600">Done</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">📈 Your Performance</h2>
            <div className="space-y-2 text-indigo-100">
              <p className="text-sm">
                • <strong className="text-white">{stats.completedBookings}</strong> meetings completed
              </p>
              <p className="text-sm">
                • <strong className="text-white">{stats.cancelledBookings}</strong> cancellations (
                {stats.totalBookings > 0 
                  ? Math.round((stats.cancelledBookings / stats.totalBookings) * 100) 
                  : 0}% rate)
              </p>
              <p className="text-sm">
                • <strong className="text-white">{teams.length}</strong> active {teams.length === 1 ? 'team' : 'teams'}
              </p>
            </div>
          </div>
          <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
            <TrendingUp className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}