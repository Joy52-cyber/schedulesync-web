import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, User, Mail, FileText, Filter, Users, Crown, UserCheck, 
  X, Loader2, AlertCircle, CheckCircle, Search, Download, Trash2, 
  XCircle, RefreshCw
} from 'lucide-react';
import api from '../utils/api';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [filter, setFilter] = useState('all'); // 'all', 'my-teams', 'member-teams'
  const [timeFilter, setTimeFilter] = useState('upcoming'); // 'all', 'upcoming', 'past'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'confirmed', 'cancelled', 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Bulk actions
  const [selectedBookings, setSelectedBookings] = useState(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  
  // Cancel modal state
  const [cancelModal, setCancelModal] = useState({ 
    open: false, 
    booking: null, 
    reason: '', 
    submitting: false 
  });
  
  // Reschedule modal state
  const [rescheduleModal, setRescheduleModal] = useState({ 
    open: false, 
    booking: null, 
    newDate: '', 
    newTime: '', 
    submitting: false 
  });

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ Bookings: No token found');
      return;
    }

    try {
      console.log('📋 Bookings: Loading data with token');
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

    // Team filter
    if (filter === 'my-teams') {
      filtered = filtered.filter(b => b.isMyTeam);
    } else if (filter === 'member-teams') {
      filtered = filtered.filter(b => !b.isMyTeam);
    }

    // Time filter
    if (timeFilter === 'upcoming') {
      filtered = filtered.filter(b => new Date(b.start_time) >= now);
    } else if (timeFilter === 'past') {
      filtered = filtered.filter(b => new Date(b.start_time) < now);
    }

    // Status filter
    if (statusFilter === 'confirmed') {
      filtered = filtered.filter(b => b.status === 'confirmed' && new Date(b.start_time) >= now);
    } else if (statusFilter === 'cancelled') {
      filtered = filtered.filter(b => b.status === 'cancelled');
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(b => new Date(b.start_time) < now && b.status === 'confirmed');
    }

    // Search query
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

    // Date range filter
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      filtered = filtered.filter(b => new Date(b.start_time) >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(b => new Date(b.start_time) <= endDate);
    }

    // Sort by date (newest first)
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
      myTeamsCount: bookings.filter(b => b.isMyTeam).length,
      memberTeamsCount: bookings.filter(b => !b.isMyTeam).length,
      upcomingCount: teamFiltered.filter(b => new Date(b.start_time) >= now && b.status !== 'cancelled').length,
      pastCount: teamFiltered.filter(b => new Date(b.start_time) < now).length,
      confirmedCount: teamFiltered.filter(b => b.status === 'confirmed' && new Date(b.start_time) >= now).length,
      cancelledCount: teamFiltered.filter(b => b.status === 'cancelled').length,
      completedCount: teamFiltered.filter(b => new Date(b.start_time) < now && b.status === 'confirmed').length,
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
      
      console.log(`✅ Cancelled ${selectedBookings.size} bookings`);
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
        b.id === cancelModal.booking.id 
          ? { ...b, status: 'cancelled' }
          : b
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
          <p className="text-gray-600 mt-1">
            {filteredBookings.length} of {bookings.length} bookings
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <XCircle className="h-4 w-4" />
              Clear Filters
            </button>
          )}
          
          <button
            onClick={exportToCSV}
            disabled={filteredBookings.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>

          {selectedBookings.size > 0 && (
            <button
              onClick={handleBulkCancel}
              disabled={bulkCancelling}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
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
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, notes, or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
              placeholder="Start date"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
              placeholder="End date"
            />
          </div>
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
                    <span className="text-base font-bold">{counts.myTeamsCount}</span>
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
                    <span className="text-base font-bold">{counts.memberTeamsCount}</span>
                  </div>
                  <div className="text-xs opacity-90">Member Of</div>
                </div>
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200"></div>

          {/* Time & Status Filters */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Time Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                <Clock className="h-4 w-4" />
                Time Period
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTimeFilter('upcoming')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeFilter === 'upcoming'
                      ? 'bg-gradient-to-br from-green-600 to-green-700 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-base font-bold">{counts.upcomingCount}</div>
                    <div className="text-xs opacity-90">Upcoming</div>
                  </div>
                </button>
                <button
                  onClick={() => setTimeFilter('past')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeFilter === 'past'
                      ? 'bg-gradient-to-br from-green-600 to-green-700 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-base font-bold">{counts.pastCount}</div>
                    <div className="text-xs opacity-90">Past</div>
                  </div>
                </button>
                <button
                  onClick={() => setTimeFilter('all')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeFilter === 'all'
                      ? 'bg-gradient-to-br from-green-600 to-green-700 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-base font-bold">
                      {filter === 'my-teams' 
                        ? counts.myTeamsCount 
                        : filter === 'member-teams' 
                        ? counts.memberTeamsCount 
                        : bookings.length}
                    </div>
                    <div className="text-xs opacity-90">All</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                <Filter className="h-4 w-4" />
                Status
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'all'
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="text-xs opacity-90">All</div>
                </button>
                <button
                  onClick={() => setStatusFilter('confirmed')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'confirmed'
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-base font-bold">{counts.confirmedCount}</div>
                    <div className="text-xs opacity-90">Active</div>
                  </div>
                </button>
                <button
                  onClick={() => setStatusFilter('cancelled')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'cancelled'
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-base font-bold">{counts.cancelledCount}</div>
                    <div className="text-xs opacity-90">Cancelled</div>
                  </div>
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'completed'
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-base font-bold">{counts.completedCount}</div>
                    <div className="text-xs opacity-90">Done</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery 
              ? `No results for "${searchQuery}"`
              : hasActiveFilters 
              ? 'Try adjusting your filters'
              : 'No bookings match your current filters'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select All */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBookings.size === filteredBookings.length && filteredBookings.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Select All ({filteredBookings.length})
              </span>
            </label>
          </div>

          {/* Booking Cards */}
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                selectedBookings.has(booking.id)
                  ? 'border-blue-500 shadow-md'
                  : 'border-gray-200 hover:shadow-md'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedBookings.has(booking.id)}
                    onChange={() => handleSelectBooking(booking.id)}
                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />

                  {/* Content */}
                  <div className="flex-1">
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

                    {/* Action Buttons */}
                    {booking.status !== 'cancelled' && new Date(booking.start_time) > new Date() && (
                      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => setRescheduleModal({ 
                            open: true, 
                            booking, 
                            newDate: '', 
                            newTime: '', 
                            submitting: false 
                          })}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          🔄 Reschedule
                        </button>
                        <button
                          onClick={() => setCancelModal({ 
                            open: true, 
                            booking, 
                            reason: '', 
                            submitting: false 
                          })}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Cancel Booking</h3>
              <button
                onClick={() => setCancelModal({ open: false, booking: null, reason: '', submitting: false })}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      Are you sure you want to cancel this booking?
                    </p>
                    <p className="text-xs text-red-700">
                      {cancelModal.booking?.attendee_name} will be notified via email.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm">
                <p className="text-gray-700">
                  <strong>Meeting:</strong> {formatDate(cancelModal.booking?.start_time)}
                </p>
                <p className="text-gray-700 mt-1">
                  <strong>Time:</strong> {formatTime(cancelModal.booking?.start_time)} - {formatTime(cancelModal.booking?.end_time)}
                </p>
                <p className="text-gray-700 mt-1">
                  <strong>Attendee:</strong> {cancelModal.booking?.attendee_name}
                </p>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cancellation Reason (Optional)
              </label>
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                rows="3"
                placeholder="Let the attendee know why you're cancelling..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal({ open: false, booking: null, reason: '', submitting: false })}
                disabled={cancelModal.submitting}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelModal.submitting}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelModal.submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    ❌ Cancel Booking
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Reschedule Booking</h3>
              <button
                onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newTime: '', submitting: false })}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      Choose a new time for this booking
                    </p>
                    <p className="text-xs text-blue-700">
                      {rescheduleModal.booking?.attendee_name} will be notified via email.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm">
                <p className="text-gray-700">
                  <strong>Current time:</strong> {formatDate(rescheduleModal.booking?.start_time)}
                </p>
                <p className="text-gray-700 mt-1">
                  {formatTime(rescheduleModal.booking?.start_time)} - {formatTime(rescheduleModal.booking?.end_time)}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Date *
                  </label>
                  <input
                    type="date"
                    value={rescheduleModal.newDate}
                    onChange={(e) => setRescheduleModal(prev => ({ ...prev, newDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Time *
                  </label>
                  <input
                    type="time"
                    value={rescheduleModal.newTime}
                    onChange={(e) => setRescheduleModal(prev => ({ ...prev, newTime: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newTime: '', submitting: false })}
                disabled={rescheduleModal.submitting}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleBooking}
                disabled={rescheduleModal.submitting || !rescheduleModal.newDate || !rescheduleModal.newTime}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {rescheduleModal.submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rescheduling...
                  </>
                ) : (
                  <>
                    🔄 Reschedule
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