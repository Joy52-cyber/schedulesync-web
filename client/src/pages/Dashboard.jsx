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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 text-sm mt-0.5">Welcome back! Here's your scheduling overview</p>
        </div>
        <button
          onClick={() => navigate('/my-booking-link')}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Link2 className="h-4 w-4" />
          My Booking Link
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Bookings */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/20 rounded-lg p-2">
              <Calendar className="h-4 w-4" />
            </div>
            <TrendingUp className="h-4 w-4 opacity-75" />
          </div>
          <h3 className="text-2xl font-bold mb-0.5">{stats.todayBookings}</h3>
          <p className="text-blue-100 text-xs font-medium">Today's Bookings</p>
        </div>

        {/* This Week */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/20 rounded-lg p-2">
              <Clock className="h-4 w-4" />
            </div>
            <Zap className="h-4 w-4 opacity-75" />
          </div>
          <h3 className="text-2xl font-bold mb-0.5">{stats.thisWeekBookings}</h3>
          <p className="text-purple-100 text-xs font-medium">This Week</p>
        </div>

        {/* Total Bookings */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/20 rounded-lg p-2">
              <CheckCircle className="h-4 w-4" />
            </div>
            <Users className="h-4 w-4 opacity-75" />
          </div>
          <h3 className="text-2xl font-bold mb-0.5">{stats.totalBookings}</h3>
          <p className="text-green-100 text-xs font-medium">Total Bookings</p>
        </div>

        {/* Upcoming */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/20 rounded-lg p-2">
              <AlertCircle className="h-4 w-4" />
            </div>
            <ArrowRight className="h-4 w-4 opacity-75" />
          </div>
          <h3 className="text-2xl font-bold mb-0.5">{stats.upcomingBookings}</h3>
          <p className="text-orange-100 text-xs font-medium">Upcoming</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Today's Bookings Widget */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              Today's Schedule
            </h2>
            <button
              onClick={() => navigate('/bookings')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {todayBookings.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No bookings today</h3>
              <p className="text-gray-600 text-xs mb-3">Your schedule is clear for today</p>
              <button
                onClick={() => navigate('/my-booking-link')}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
              >
                <Link2 className="h-3 w-3" />
                Share Booking Link
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {todayBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => navigate('/bookings')}
                >
                  <div className="bg-blue-100 rounded-lg p-2 flex-shrink-0">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {booking.attendee_name}
                      </h3>
                      {booking.status === 'cancelled' && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          Cancelled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate">{booking.attendee_email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm text-gray-900">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/teams')}
              className="w-full flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:shadow-md transition-all text-left group"
            >
              <div className="bg-blue-600 rounded-lg p-1.5">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                  Manage Teams
                </p>
                <p className="text-xs text-gray-600">
                  {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => navigate('/bookings')}
              className="w-full flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg hover:shadow-md transition-all text-left group"
            >
              <div className="bg-purple-600 rounded-lg p-1.5">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900 group-hover:text-purple-600 transition-colors">
                  View All Bookings
                </p>
                <p className="text-xs text-gray-600">
                  {stats.upcomingBookings} upcoming
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => navigate('/my-booking-link')}
              className="w-full flex items-center gap-2 p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg hover:shadow-md transition-all text-left group"
            >
              <div className="bg-green-600 rounded-lg p-1.5">
                <Link2 className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900 group-hover:text-green-600 transition-colors">
                  My Booking Link
                </p>
                <p className="text-xs text-gray-600">Share with clients</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming This Week & Team Performance */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Upcoming This Week */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Upcoming This Week
            </h2>
            <button
              onClick={() => navigate('/bookings')}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600 text-xs">No upcoming bookings this week</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => navigate('/bookings')}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="text-center flex-shrink-0">
                      <p className="text-xs font-medium text-gray-500">
                        {formatDate(booking.start_time).split(',')[0]}
                      </p>
                      <p className="text-base font-bold text-gray-900">
                        {new Date(booking.start_time).getDate()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Team Performance
            </h2>
            <button
              onClick={() => navigate('/teams')}
              className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
            >
              Manage
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {teamStats.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600 text-xs mb-2">No teams yet</p>
              <button
                onClick={() => navigate('/teams')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
              >
                <Plus className="h-3 w-3" />
                Create Team
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {teamStats.map((team) => (
                <div key={team.teamId} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm text-gray-900">{team.teamName}</h3>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {getBookingModeLabel(team.bookingMode)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 rounded-lg p-1.5">
                      <p className="text-lg font-bold text-blue-600">{team.totalBookings}</p>
                      <p className="text-xs text-gray-600">Total</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-1.5">
                      <p className="text-lg font-bold text-green-600">{team.upcomingBookings}</p>
                      <p className="text-xs text-gray-600">Upcoming</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-1.5">
                      <p className="text-lg font-bold text-purple-600">{team.completedBookings}</p>
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
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md p-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold mb-2">📈 Your Performance</h2>
            <div className="space-y-1 text-indigo-100">
              <p className="text-xs">
                • <strong className="text-white">{stats.completedBookings}</strong> meetings completed
              </p>
              <p className="text-xs">
                • <strong className="text-white">{stats.cancelledBookings}</strong> cancellations (
                {stats.totalBookings > 0 
                  ? Math.round((stats.cancelledBookings / stats.totalBookings) * 100) 
                  : 0}% rate)
              </p>
              <p className="text-xs">
                • <strong className="text-white">{teams.length}</strong> active {teams.length === 1 ? 'team' : 'teams'}
              </p>
            </div>
          </div>
          <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}