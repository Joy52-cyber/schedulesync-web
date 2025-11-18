import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Mail, FileText, X, AlertCircle, Filter, Search, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('upcoming');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelModal, setCancelModal] = useState({ show: false, booking: null });
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

 useEffect(() => {
  const token = localStorage.getItem('token');
  if (token) {
    console.log('📋 Bookings: Loading data with token');
    loadBookings();
  } else {
    console.error('❌ Bookings: No token found');
  }
}, []);
  const loadTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/teams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeams(response.data.teams);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (timeFilter !== 'all') params.append('time_filter', timeFilter);
      if (teamFilter !== 'all') params.append('team_id', teamFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await axios.get(`${API_URL}/bookings/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setBookings(response.data.bookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    try {
      setCancelling(true);
      const token = localStorage.getItem('token');
      
      await axios.patch(
        `${API_URL}/bookings/${cancelModal.booking.id}/cancel`,
        { cancellation_reason: cancelReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Reload bookings
      await loadBookings();
      
      // Close modal
      setCancelModal({ show: false, booking: null });
      setCancelReason('');
      
      alert('Booking cancelled successfully!');
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      booking.attendee_name?.toLowerCase().includes(search) ||
      booking.attendee_email?.toLowerCase().includes(search) ||
      booking.team_name?.toLowerCase().includes(search)
    );
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      })
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            Bookings
          </h1>
          <p className="mt-2 text-gray-600">Manage your scheduled meetings</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-1" />
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Time Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Time
              </label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
                <option value="all">All</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="h-4 w-4 inline mr-1" />
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Team Filter */}
          {teams.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Team
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTeamFilter('all')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    teamFilter === 'all'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
                  }`}
                >
                  All Teams
                </button>
                {teams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => setTeamFilter(team.id.toString())}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      teamFilter === team.id.toString()
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
                    }`}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bookings List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-600">
              {searchQuery ? 'Try adjusting your search or filters' : 'You don\'t have any bookings yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map(booking => {
              const dateTime = formatDateTime(booking.start_time);
              const isPast = new Date(booking.start_time) < new Date();
              const canCancel = booking.status === 'confirmed' && !isPast;

              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">
                              {booking.attendee_name}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getStatusColor(booking.status)}`}>
                              {getStatusIcon(booking.status)}
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{booking.team_name}</p>
                        </div>

                        {/* Cancel Button */}
                        {canCancel && (
                          <button
                            onClick={() => setCancelModal({ show: true, booking })}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 text-sm font-medium"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                        )}
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Date & Time */}
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{dateTime.date}</p>
                            <p className="text-sm text-gray-600">{dateTime.time}</p>
                          </div>
                        </div>

                        {/* Email */}
                        <div className="flex items-start gap-3">
                          <Mail className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Email</p>
                            <p className="text-sm text-gray-600">{booking.attendee_email}</p>
                          </div>
                        </div>

                        {/* Organizer */}
                        <div className="flex items-start gap-3">
                          <User className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Organizer</p>
                            <p className="text-sm text-gray-600">{booking.organizer_name || booking.member_name || 'N/A'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {booking.notes && (
                        <div className="mt-4 flex items-start gap-3">
                          <FileText className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{booking.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Results Count */}
        {!loading && filteredBookings.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            Showing {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Cancel Booking</h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to cancel this meeting with <strong>{cancelModal.booking?.attendee_name}</strong>?
                </p>
              </div>
            </div>

            {/* Cancellation Reason */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for cancellation (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let them know why you're cancelling..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCancelModal({ show: false, booking: null });
                  setCancelReason('');
                }}
                disabled={cancelling}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Cancelling...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Cancel Booking
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}