import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Clock,
  Plus,
  Link as LinkIcon,
  BarChart3,
  Sparkles
} from 'lucide-react';
import api from '../utils/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    revenue: 0,
    activeTeams: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Use api instance which includes auth token
      const response = await api.get('/dashboard/stats');
      setStats(response.data.stats);
      setRecentBookings(response.data.recentBookings || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-600" />
          </div>
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {/* Total Bookings */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +12%
              </span>
            </div>
            <h3 className="text-gray-600 text-sm font-medium mb-1">Total Bookings</h3>
            <p className="text-3xl font-bold text-gray-900">{stats.totalBookings}</p>
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                This week
              </span>
            </div>
            <h3 className="text-gray-600 text-sm font-medium mb-1">Upcoming</h3>
            <p className="text-3xl font-bold text-gray-900">{stats.upcomingBookings}</p>
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-green-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +8%
              </span>
            </div>
            <h3 className="text-gray-600 text-sm font-medium mb-1">Revenue</h3>
            <p className="text-3xl font-bold text-gray-900">${stats.revenue}</p>
          </div>

          {/* Active Teams */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-orange-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-medium mb-1">Active Teams</h3>
            <p className="text-3xl font-bold text-gray-900">{stats.activeTeams}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => navigate('/my-booking-link')}
            className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-2xl p-6 shadow-lg hover:shadow-2xl hover:scale-105 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <LinkIcon className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-lg">My Booking Link</h3>
                <p className="text-blue-100 text-sm">Share your link</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/teams')}
            className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all border-2 border-gray-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-lg text-gray-900">Manage Teams</h3>
                <p className="text-gray-600 text-sm">View all teams</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/bookings')}
            className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all border-2 border-gray-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-lg text-gray-900">View Bookings</h3>
                <p className="text-gray-600 text-sm">All appointments</p>
              </div>
            </div>
          </button>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Bookings</h2>
            <button
              onClick={() => navigate('/bookings')}
              className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
            >
              View all →
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No bookings yet</p>
              <button
                onClick={() => navigate('/my-booking-link')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Share your booking link to get started
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.slice(0, 5).map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{booking.attendee_name}</p>
                      <p className="text-sm text-gray-600">{booking.attendee_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(booking.start_time).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(booking.start_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}