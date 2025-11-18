import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, User, Mail, FileText, Filter, Users, Crown, UserCheck } from 'lucide-react';
import api from '../utils/api';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'my-teams', 'member-teams'
  const [timeFilter, setTimeFilter] = useState('upcoming'); // 'all', 'upcoming', 'past'

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [bookings, filter, timeFilter]);

  const loadBookings = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ Bookings: No token found');
      return;
    }

    try {
      console.log('📋 Bookings: Loading data with token');
      setLoading(true);
      
      // Get bookings
      const bookingsResponse = await api.get('/bookings');
      
      // Get teams to determine ownership
      const teamsResponse = await api.get('/teams');
      const myTeamIds = new Set(teamsResponse.data.teams.map(t => t.id));
      
      // Get current user
      const storedUser = localStorage.getItem('user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      
      // Enhance bookings with ownership info
      const enhancedBookings = bookingsResponse.data.bookings.map(booking => ({
        ...booking,
        isMyTeam: myTeamIds.has(booking.team_id),
        isAssignedToMe: booking.user_id === currentUser?.id
      }));

      setBookings(enhancedBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bookings];

    // Apply team filter
    if (filter === 'my-teams') {
      filtered = filtered.filter(b => b.isMyTeam);
    } else if (filter === 'member-teams') {
      filtered = filtered.filter(b => !b.isMyTeam);
    }

    // Apply time filter
    const now = new Date();
    if (timeFilter === 'upcoming') {
      filtered = filtered.filter(b => new Date(b.start_time) >= now);
    } else if (timeFilter === 'past') {
      filtered = filtered.filter(b => new Date(b.start_time) < now);
    }

    setFilteredBookings(filtered);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTeamBadge = (booking) => {
    if (booking.isMyTeam) {
      return (
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          <Crown className="h-3 w-3" />
          My Team
        </div>
      );
    } else if (booking.isAssignedToMe) {
      return (
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <UserCheck className="h-3 w-3" />
          Assigned to Me
        </div>
      );
    } else {
      return (
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
          <Users className="h-3 w-3" />
          Team Member
        </div>
      );
    }
  };

  const getStatusBadge = (status, startTime) => {
    const isPast = new Date(startTime) < new Date();
    
    if (status === 'cancelled') {
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Cancelled</span>;
    }
    
    if (isPast) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Completed</span>;
    }
    
    return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Upcoming</span>;
  };

  // Get bookings filtered by current team selection (memoized for performance)
  const teamFilteredBookings = useMemo(() => {
    console.log('🔄 Recalculating team filtered bookings, filter:', filter);
    if (filter === 'my-teams') {
      const filtered = bookings.filter(b => b.isMyTeam);
      console.log('  → My Teams bookings:', filtered.length);
      return filtered;
    } else if (filter === 'member-teams') {
      const filtered = bookings.filter(b => !b.isMyTeam);
      console.log('  → Member Teams bookings:', filtered.length);
      return filtered;
    }
    console.log('  → All bookings:', bookings.length);
    return bookings;
  }, [bookings, filter]);

  // Count bookings by category (memoized to recalculate when dependencies change)
  const counts = useMemo(() => {
    const myTeamsCount = bookings.filter(b => b.isMyTeam).length;
    const memberTeamsCount = bookings.filter(b => !b.isMyTeam).length;
    const upcomingCount = teamFilteredBookings.filter(b => new Date(b.start_time) >= new Date()).length;
    const pastCount = teamFilteredBookings.filter(b => new Date(b.start_time) < new Date()).length;
    
    console.log('📊 Counts updated:', {
      filter,
      myTeamsCount,
      memberTeamsCount,
      upcomingCount,
      pastCount,
      totalFiltered: teamFilteredBookings.length
    });
    
    return {
      myTeamsCount,
      memberTeamsCount,
      upcomingCount,
      pastCount,
    };
  }, [bookings, teamFilteredBookings, filter]);

  const { myTeamsCount, memberTeamsCount, upcomingCount, pastCount } = counts;

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
          <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600 mt-1">View and manage all your bookings</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* Team Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
              <Users className="h-4 w-4" />
              Team Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  filter === 'all'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div className="text-center">
                  <div className="text-base font-bold">{bookings.length}</div>
                  <div className="text-xs opacity-90">All Bookings</div>
                </div>
              </button>
              <button
                onClick={() => setFilter('my-teams')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  filter === 'my-teams'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Crown className="h-4 w-4" />
                    <span className="text-base font-bold">{myTeamsCount}</span>
                  </div>
                  <div className="text-xs opacity-90">My Teams</div>
                </div>
              </button>
              <button
                onClick={() => setFilter('member-teams')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  filter === 'member-teams'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <UserCheck className="h-4 w-4" />
                    <span className="text-base font-bold">{memberTeamsCount}</span>
                  </div>
                  <div className="text-xs opacity-90">Member Of</div>
                </div>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Time Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
              <Clock className="h-4 w-4" />
              Time Period
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTimeFilter('upcoming')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  timeFilter === 'upcoming'
                    ? 'bg-gradient-to-br from-green-600 to-green-700 text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div className="text-center">
                  <div className="text-base font-bold">{upcomingCount}</div>
                  <div className="text-xs opacity-90">Upcoming</div>
                </div>
              </button>
              <button
                onClick={() => setTimeFilter('past')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  timeFilter === 'past'
                    ? 'bg-gradient-to-br from-green-600 to-green-700 text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div className="text-center">
                  <div className="text-base font-bold">{pastCount}</div>
                  <div className="text-xs opacity-90">Past</div>
                </div>
              </button>
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  timeFilter === 'all'
                    ? 'bg-gradient-to-br from-green-600 to-green-700 text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div className="text-center">
                  <div className="text-base font-bold">{teamFilteredBookings.length}</div>
                  <div className="text-xs opacity-90">All Time</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 mt-0.5">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900 mb-1">Why am I seeing these bookings?</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• <strong className="font-semibold">My Teams</strong> - Teams you created and own</p>
              <p>• <strong className="font-semibold">Member Of</strong> - Teams where you're added as a member and can receive bookings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings found</h3>
          <p className="text-gray-600 mb-1">
            {filter === 'my-teams' && timeFilter === 'upcoming' && 'No upcoming bookings in teams you own'}
            {filter === 'my-teams' && timeFilter === 'past' && 'No past bookings in teams you own'}
            {filter === 'my-teams' && timeFilter === 'all' && 'No bookings yet in teams you own'}
            {filter === 'member-teams' && timeFilter === 'upcoming' && 'No upcoming bookings in teams where you\'re a member'}
            {filter === 'member-teams' && timeFilter === 'past' && 'No past bookings in teams where you\'re a member'}
            {filter === 'member-teams' && timeFilter === 'all' && 'No bookings yet in teams where you\'re a member'}
            {filter === 'all' && timeFilter === 'upcoming' && 'No upcoming bookings'}
            {filter === 'all' && timeFilter === 'past' && 'No past bookings'}
            {filter === 'all' && timeFilter === 'all' && 'No bookings yet'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Try changing the filters above to see different bookings
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 rounded-lg p-3">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {booking.attendee_name}
                      </h3>
                      {getStatusBadge(booking.status, booking.start_time)}
                    </div>
                    <p className="text-sm text-gray-600">{booking.attendee_email}</p>
                  </div>
                </div>
                {getTeamBadge(booking)}
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    <span className="font-medium">{booking.team_name}</span>
                    {booking.member_name && (
                      <span className="text-gray-500"> • {booking.member_name}</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{formatDate(booking.start_time)}</span>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                  </span>
                </div>
              </div>

              {booking.notes && (
                <div className="flex items-start gap-2 text-gray-700 bg-gray-50 rounded-lg p-3">
                  <FileText className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="text-sm flex-1">
                    <span className="font-medium block mb-1">Notes:</span>
                    <span className="text-gray-600">{booking.notes}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}