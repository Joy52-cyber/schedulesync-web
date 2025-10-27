import { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Clock, 
  Star,
  Plus,
  LinkIcon,
  Eye
} from 'lucide-react';
import { calendar, analytics } from '../utils/api';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ 
    totalBookings: 0, 
    upcomingBookings: 0, 
    totalTeams: 0,
    teamMembers: 0 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsRes, analyticsRes] = await Promise.all([
        calendar.getEvents(),
        analytics.get()
      ]);
      setEvents(eventsRes.data.events || []);
      setStats(analyticsRes.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          Welcome back, User! <span className="text-4xl">👋</span>
        </h1>
        <p className="text-gray-600 text-lg mt-2">Here's what's happening with your schedule today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Your Teams Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-5xl font-bold text-gray-900 mb-2">{stats.totalTeams}</p>
              <p className="text-gray-600 font-medium">Your Teams</p>
            </div>
            <div className="bg-gradient-to-br from-purple-400 to-purple-600 p-4 rounded-2xl shadow-lg">
              <Users className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>

        {/* Total Bookings Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-5xl font-bold text-gray-900 mb-2">{stats.totalBookings}</p>
              <p className="text-gray-600 font-medium">Total Bookings</p>
            </div>
            <div className="bg-gradient-to-br from-cyan-400 to-blue-500 p-4 rounded-2xl shadow-lg">
              <CalendarIcon className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>

        {/* Upcoming Meetings Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-5xl font-bold text-gray-900 mb-2">{stats.upcomingBookings}</p>
              <p className="text-gray-600 font-medium">Upcoming Meetings</p>
            </div>
            <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-4 rounded-2xl shadow-lg">
              <Clock className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>

        {/* Team Members Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-5xl font-bold text-gray-900 mb-2">{stats.teamMembers || 0}</p>
              <p className="text-gray-600 font-medium">Team Members</p>
            </div>
            <div className="bg-gradient-to-br from-orange-400 to-red-500 p-4 rounded-2xl shadow-lg">
              <Star className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Create Team Button */}
        <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl font-semibold shadow-md hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg">
          <Plus className="h-6 w-6" />
          Create Team
        </button>

        {/* Set Availability Button */}
        <button className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-4 rounded-xl font-semibold hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-center gap-3 text-lg">
          <Clock className="h-6 w-6" />
          Set Availability
        </button>

        {/* View Bookings Button */}
        <button className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-4 rounded-xl font-semibold hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-center gap-3 text-lg">
          <Eye className="h-6 w-6" />
          View Bookings
        </button>

        {/* Connect Calendar Button */}
        <button className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-4 rounded-xl font-semibold hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-center gap-3 text-lg">
          <LinkIcon className="h-6 w-6" />
          Connect Calendar
        </button>
      </div>
    </div>
  );
}