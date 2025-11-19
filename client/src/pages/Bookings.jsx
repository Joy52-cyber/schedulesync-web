import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, User, Mail, FileText, Filter, Users, Crown, UserCheck, 
  X, Loader2, AlertCircle, CheckCircle, Search, Download, Trash2, 
  XCircle, RefreshCw, ChevronDown, Sparkles, TrendingUp, CalendarDays,
  MapPin, Phone, MessageSquare, Eye
} from 'lucide-react';
import api from '../utils/api';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [filter, setFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('upcoming');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'
  
  // Modal states
  const [cancelModal, setCancelModal] = useState({ 
    open: false, 
    booking: null, 
    reason: '', 
    submitting: false 
  });
  
  const [rescheduleModal, setRescheduleModal] = useState({ 
    open: false, 
    booking: null, 
    newDate: '', 
    newTime: '', 
    submitting: false 
  });

  const [detailsModal, setDetailsModal] = useState({
    open: false,
    booking: null
  });

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      const bookingsResponse = await api.get('/bookings');
      const teamsResponse = await api.get('/teams');
      const myTeamIds = new Set(teamsResponse.data.teams.map(t => t.id));
      
      const storedUser = localStorage.getItem('user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      
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

  // ========== FILTERED BOOKINGS ==========
  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];
    const now = new Date();

    if (filter === 'my-teams') {
      filtered = filtered.filter(b => b.isMyTeam);
    } else if (filter === 'member-teams') {
      filtered = filtered.filter(b => !b.isMyTeam);
    }

    if (timeFilter === 'upcoming') {
      filtered = filtered.filter(b => new Date(b.start_time) >= now);
    } else if (timeFilter === 'past') {
      filtered = filtered.filter(b => new Date(b.start_time) < now);
    }

    if (statusFilter === 'confirmed') {
      filtered = filtered.filter(b => b.status === 'confirmed' && new Date(b.start_time) >= now);
    } else if (statusFilter === 'cancelled') {
      filtered = filtered.filter(b => b.status === 'cancelled');
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(b => new Date(b.start_time) < now && b.status === 'confirmed');
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.attendee_name?.toLowerCase().includes(query) ||
        b.attendee_email?.toLowerCase().includes(query) ||
        b.notes?.toLowerCase().includes(query) ||
        b.team_name?.toLowerCase().includes(query) ||
        b.member_name?.toLowerCase().includes(query)
      );
    }

    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      filtered = filtered.filter(b => new Date(b.start_time) >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(b => new Date(b.start_time) <= endDate);
    }

    filtered.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    return filtered;
  }, [bookings, filter, timeFilter, statusFilter, searchQuery, dateRange]);

  // ========== COUNTS ==========
  const counts = useMemo(() => {
    const now = new Date();
    const teamFiltered = filter === 'my-teams' 
      ? bookings.filter(b => b.isMyTeam)
      : filter === 'member-teams'
      ? bookings.filter(b => !b.isMyTeam)
      : bookings;

    return {
      all: bookings.length,
      myTeams: bookings.filter(b => b.isMyTeam).length,
      memberTeams: bookings.filter(b => !b.isMyTeam).length,
      upcoming: teamFiltered.filter(b => new Date(b.start_time) >= now && b.status !== 'cancelled').length,
      past: teamFiltered.filter(b => new Date(b.start_time) < now).length,
      confirmed: teamFiltered.filter(b => b.status === 'confirmed' && new Date(b.start_time) >= now).length,
      cancelled: teamFiltered.filter(b => b.status === 'cancelled').length,
      completed: teamFiltered.filter(b => new Date(b.start_time) < now && b.status === 'confirmed').length,
    };
  }, [bookings, filter]);

  // ========== BULK ACTIONS ==========
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(filteredBookings.map(b => b.id));
      setSelectedBookings(allIds);
    } else {
      setSelectedBookings(new Set());
    }
  };

  const handleSelectBooking = (bookingId) => {
    setSelectedBookings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

  const handleBulkCancel = async () => {
    if (selectedBookings.size === 0) return;
    
    if (!confirm(`Cancel ${selectedBookings.size} booking(s)? This cannot be undone.`)) {
      return;
    }

    try {
      setBulkCancelling(true);
      const cancelPromises = Array.from(selectedBookings).map(bookingId =>
        api.post(`/bookings/${bookingId}/cancel`, { reason: 'Bulk cancellation' })
      );
      await Promise.all(cancelPromises);
      setSelectedBookings(new Set());
      await loadBookings();
    } catch (error) {
      console.error('❌ Bulk cancel error:', error);
      alert('Some bookings failed to cancel. Please try again.');
    } finally {
      setBulkCancelling(false);
    }
  };

  // ========== EXPORT TO CSV ==========
  const exportToCSV = () => {
    const headers = ['Date', 'Time', 'Attendee Name', 'Attendee Email', 'Team', 'Member', 'Status', 'Notes'];
    const rows = filteredBookings.map(b => [
      formatDate(b.start_time),
      formatTime(b.start_time),
      b.attendee_name,
      b.attendee_email,
      b.team_name || '',
      b.member_name || '',
      b.status,
      b.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // ========== CLEAR FILTERS ==========
  const clearFilters = () => {
    setSearchQuery('');
    setDateRange({ start: '', end: '' });
    setStatusFilter('all');
    setTimeFilter('upcoming');
    setFilter('all');
  };

  const hasActiveFilters = searchQuery || dateRange.start || dateRange.end || 
    statusFilter !== 'all' || timeFilter !== 'upcoming' || filter !== 'all';

  // ========== SINGLE BOOKING ACTIONS ==========
  const handleCancelBooking = async () => {
    try {
      setCancelModal(prev => ({ ...prev, submitting: true }));
      await api.post(`/bookings/${cancelModal.booking.id}/cancel`, {
        reason: cancelModal.reason
      });
      setBookings(prev => prev.map(b => 
        b.id === cancelModal.booking.id ? { ...b, status: 'cancelled' } : b
      ));
      setCancelModal({ open: false, booking: null, reason: '', submitting: false });
      await loadBookings();
    } catch (error) {
      console.error('❌ Cancel error:', error);
      alert('Failed to cancel booking. Please try again.');
      setCancelModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleRescheduleBooking = async () => {
    try {
      if (!rescheduleModal.newDate || !rescheduleModal.newTime) {
        alert('Please select both date and time');
        return;
      }

      setRescheduleModal(prev => ({ ...prev, submitting: true }));
      const newStartTime = new Date(`${rescheduleModal.newDate}T${rescheduleModal.newTime}`);
      const newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + 30);
      
      await api.post(`/bookings/${rescheduleModal.booking.id}/reschedule`, {
        newStartTime: newStartTime.toISOString(),
        newEndTime: newEndTime.toISOString()
      });
      
      setRescheduleModal({ open: false, booking: null, newDate: '', newTime: '', submitting: false });
      await loadBookings();
    } catch (error) {
      console.error('❌ Reschedule error:', error);
      alert('Failed to reschedule booking. Please try again.');
      setRescheduleModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // ========== FORMATTING ==========
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status, startTime) => {
    const isPast = new Date(startTime) < new Date();
    if (status === 'cancelled') return 'red';
    if (isPast) return 'gray';
    return 'green';
  };

  const getStatusLabel = (status, startTime) => {
    const isPast = new Date(startTime) < new Date();
    if (status === 'cancelled') return 'Cancelled';
    if (isPast) return 'Completed';
    return 'Confirmed';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">
                Bookings
              </h1>
              <p className="text-gray-600 mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-gray-200 text-sm font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  {filteredBookings.length} of {bookings.length}
                  {hasActiveFilters && ' • Filtered'}
                </span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {selectedBookings.size > 0 && (
                <button
                  onClick={handleBulkCancel}
                  disabled={bulkCancelling}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/30 font-medium disabled:opacity-50"
                >
                  {bulkCancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Cancel ({selectedBookings.size})
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={exportToCSV}
                disabled={filteredBookings.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all shadow-md shadow-green-600/30 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                Export
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:shadow-md transition-all font-medium"
                >
                  <XCircle className="h-4 w-4" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/30">
            <div className="flex items-center justify-between mb-3">
              <CalendarDays className="h-8 w-8 opacity-80" />
              <TrendingUp className="h-5 w-5 opacity-60" />
            </div>
            <p className="text-3xl font-bold mb-1">{counts.all}</p>
            <p className="text-blue-100 text-sm font-medium">Total Bookings</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl shadow-green-500/30">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="h-8 w-8 opacity-80" />
              <Clock className="h-5 w-5 opacity-60" />
            </div>
            <p className="text-3xl font-bold mb-1">{counts.upcoming}</p>
            <p className="text-green-100 text-sm font-medium">Upcoming</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl shadow-purple-500/30">
            <div className="flex items-center justify-between mb-3">
              <Users className="h-8 w-8 opacity-80" />
              <Sparkles className="h-5 w-5 opacity-60" />
            </div>
            <p className="text-3xl font-bold mb-1">{counts.completed}</p>
            <p className="text-purple-100 text-sm font-medium">Completed</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl shadow-orange-500/30">
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="h-8 w-8 opacity-80" />
              <XCircle className="h-5 w-5 opacity-60" />
            </div>
            <p className="text-3xl font-bold mb-1">{counts.cancelled}</p>
            <p className="text-orange-100 text-sm font-medium">Cancelled</p>
          </div>
        </div>

        {/* Search & Quick Filters */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 mb-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, notes, or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTimeFilter('upcoming')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  timeFilter === 'upcoming'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Upcoming ({counts.upcoming})
              </button>
              <button
                onClick={() => setTimeFilter('past')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  timeFilter === 'past'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Past ({counts.past})
              </button>
              <button
                onClick={() => setStatusFilter('confirmed')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  statusFilter === 'confirmed'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active ({counts.confirmed})
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  statusFilter === 'cancelled'
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancelled ({counts.cancelled})
              </button>

              {/* Advanced Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="ml-auto px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                More Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Advanced Filters Dropdown */}
            {showFilters && (
              <div className="pt-4 border-t border-gray-200 animate-fadeIn">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Team Type</label>
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                    >
                      <option value="all">All Teams</option>
                      <option value="my-teams">My Teams ({counts.myTeams})</option>
                      <option value="member-teams">Member Of ({counts.memberTeams})</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-md border-2 border-dashed border-gray-300">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full mb-6">
              <Search className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No bookings found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery 
                ? `No results for "${searchQuery}"`
                : hasActiveFilters 
                ? 'Try adjusting your filters to see more results'
                : 'No bookings match your current filters'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                <RefreshCw className="h-4 w-4" />
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Select All Bar */}
            {filteredBookings.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBookings.size === filteredBookings.length}
                    onChange={handleSelectAll}
                    className="w-5 h-5 text-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 border-2 border-gray-300"
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    Select All ({filteredBookings.length} bookings)
                  </span>
                </label>
              </div>
            )}

            {/* Booking Cards */}
            {filteredBookings.map((booking) => {
              const statusColor = getStatusColor(booking.status, booking.start_time);
              const statusLabel = getStatusLabel(booking.status, booking.start_time);
              
              return (
                <div
                  key={booking.id}
                  className={`bg-white rounded-2xl shadow-md border-2 transition-all hover:shadow-xl ${
                    selectedBookings.has(booking.id)
                      ? 'border-blue-500 ring-4 ring-blue-100'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedBookings.has(booking.id)}
                        onChange={() => handleSelectBooking(booking.id)}
                        className="mt-1.5 w-5 h-5 text-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 border-2 border-gray-300"
                      />

                      {/* Date Badge */}
                      <div className="flex-shrink-0 w-16 text-center">
                        <div className={`bg-gradient-to-br ${
                          statusColor === 'green' 
                            ? 'from-green-500 to-emerald-600' 
                            : statusColor === 'red'
                            ? 'from-red-500 to-red-600'
                            : 'from-gray-400 to-gray-500'
                        } rounded-xl p-3 text-white shadow-lg`}>
                          <p className="text-xs font-medium opacity-90">
                            {new Date(booking.start_time).toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                          <p className="text-2xl font-bold">
                            {new Date(booking.start_time).getDate()}
                          </p>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-bold text-gray-900">
                                {booking.attendee_name}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                statusColor === 'green' 
                                  ? 'bg-green-100 text-green-700' 
                                  : statusColor === 'red'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {statusLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1.5">
                                <Mail className="h-4 w-4" />
                                {booking.attendee_email}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                {formatTime(booking.start_time)}
                              </span>
                            </div>
                          </div>

                          {/* Team Badge */}
                          {booking.isMyTeam ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-lg text-xs font-bold">
                              <Crown className="h-3.5 w-3.5" />
                              My Team
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold">
                              <Users className="h-3.5 w-3.5" />
                              Member
                            </span>
                          )}
                        </div>

                        {/* Team Info */}
                        <div className="flex items-center gap-2 mb-3 text-sm">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg font-medium text-gray-700">
                            <Users className="h-3.5 w-3.5" />
                            {booking.team_name}
                          </span>
                          {booking.member_name && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg font-medium text-gray-700">
                              <User className="h-3.5 w-3.5" />
                              {booking.member_name}
                            </span>
                          )}
                        </div>

                        {/* Notes */}
                        {booking.notes && (
                          <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl p-4 mb-4">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-gray-700 mb-1">Notes</p>
                                <p className="text-sm text-gray-600">{booking.notes}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {booking.status !== 'cancelled' && new Date(booking.start_time) > new Date() && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => setDetailsModal({ open: true, booking })}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:shadow-md transition-all font-medium"
                            >
                              <Eye className="h-4 w-4" />
                              Details
                            </button>
                            <button
                              onClick={() => setRescheduleModal({ open: true, booking, newDate: '', newTime: '', submitting: false })}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Reschedule
                            </button>
                            <button
                              onClick={() => setCancelModal({ open: true, booking, reason: '', submitting: false })}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:shadow-lg transition-all font-medium"
                            >
                              <XCircle className="h-4 w-4" />
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals (Cancel, Reschedule, Details) */}
      {/* Same modal code as before but with updated styling */}
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Cancel Booking</h3>
              <button
                onClick={() => setCancelModal({ open: false, booking: null, reason: '', submitting: false })}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      Cancel this booking?
                    </p>
                    <p className="text-xs text-red-700">
                      {cancelModal.booking?.attendee_name} will be notified via email.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-sm space-y-2">
                <p className="text-gray-700">
                  <strong>Date:</strong> {formatDate(cancelModal.booking?.start_time)}
                </p>
                <p className="text-gray-700">
                  <strong>Time:</strong> {formatTime(cancelModal.booking?.start_time)}
                </p>
                <p className="text-gray-700">
                  <strong>Attendee:</strong> {cancelModal.booking?.attendee_name}
                </p>
              </div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                rows="3"
                placeholder="Why are you cancelling?"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-red-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal({ open: false, booking: null, reason: '', submitting: false })}
                disabled={cancelModal.submitting}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelModal.submitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelModal.submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Booking'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Reschedule Booking</h3>
              <button
                onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newTime: '', submitting: false })}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      Choose a new time
                    </p>
                    <p className="text-xs text-blue-700">
                      {rescheduleModal.booking?.attendee_name} will be notified.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-sm">
                <p className="text-gray-700">
                  <strong>Current:</strong> {formatDate(rescheduleModal.booking?.start_time)} at {formatTime(rescheduleModal.booking?.start_time)}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Date *
                  </label>
                  <input
                    type="date"
                    value={rescheduleModal.newDate}
                    onChange={(e) => setRescheduleModal(prev => ({ ...prev, newDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Time *
                  </label>
                  <input
                    type="time"
                    value={rescheduleModal.newTime}
                    onChange={(e) => setRescheduleModal(prev => ({ ...prev, newTime: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newTime: '', submitting: false })}
                disabled={rescheduleModal.submitting}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleBooking}
                disabled={rescheduleModal.submitting || !rescheduleModal.newDate || !rescheduleModal.newTime}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {rescheduleModal.submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rescheduling...
                  </>
                ) : (
                  'Reschedule'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}