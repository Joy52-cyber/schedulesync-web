import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, User, Mail, Filter, Users, X, Loader2, AlertCircle, 
  Search, Download, Trash2, XCircle, RefreshCw, ChevronDown, Eye
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

    if (statusFilter === 'confirmed') {
      filtered = filtered.filter(b => b.status === 'confirmed' && new Date(b.start_time) >= now);
    } else if (statusFilter === 'cancelled') {
      filtered = filtered.filter(b => b.status === 'cancelled');
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(b => new Date(b.start_time) < now && b.status === 'confirmed');
    } else {
      if (timeFilter === 'upcoming') {
        filtered = filtered.filter(b => new Date(b.start_time) >= now && b.status !== 'cancelled');
      } else if (timeFilter === 'past') {
        filtered = filtered.filter(b => new Date(b.start_time) < now);
      }
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
    if (isPast) return 'Done';
    return 'Active';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        {/* Header - Responsive */}
        <div className="bg-white border rounded-lg sticky top-0 z-20 shadow-sm mb-4">
          <div className="px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Title & Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">Bookings</h1>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {filteredBookings.length} of {bookings.length}
                    {hasActiveFilters && ' • Filtered'}
                  </p>
                </div>

                {/* Stats - Hide on small mobile */}
                <div className="hidden md:flex items-center gap-2 flex-wrap">
                  <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-blue-50 rounded-lg">
                    <p className="text-[10px] sm:text-xs text-blue-600 font-semibold whitespace-nowrap">
                      {counts.all} Total
                    </p>
                  </div>
                  <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-green-50 rounded-lg">
                    <p className="text-[10px] sm:text-xs text-green-600 font-semibold whitespace-nowrap">
                      {counts.upcoming} Upcoming
                    </p>
                  </div>
                  <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-purple-50 rounded-lg">
                    <p className="text-[10px] sm:text-xs text-purple-600 font-semibold whitespace-nowrap">
                      {counts.completed} Done
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Wrap on mobile */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedBookings.size > 0 && (
                  <button
                    onClick={handleBulkCancel}
                    disabled={bulkCancelling}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors text-xs font-medium disabled:opacity-50 min-h-[36px] sm:min-h-[40px]"
                  >
                    {bulkCancelling ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="hidden sm:inline">Cancelling...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden xs:inline">Cancel</span> ({selectedBookings.size})
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={exportToCSV}
                  disabled={filteredBookings.length === 0}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors text-xs font-medium disabled:opacity-50 min-h-[36px] sm:min-h-[40px]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors text-xs font-medium min-h-[36px] sm:min-h-[40px]"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-xs font-medium min-h-[36px] sm:min-h-[40px]"
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Filters</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters - Responsive */}
        {showFilters && (
          <div className="bg-white border rounded-lg shadow-sm mb-4">
            <div className="px-3 sm:px-4 py-3 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none min-h-[40px]"
                />
              </div>

              {/* Quick Filters - Wrap on mobile */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setTimeFilter('upcoming');
                    setStatusFilter('all');
                  }}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all min-h-[32px] whitespace-nowrap ${
                    timeFilter === 'upcoming' && statusFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                  }`}
                >
                  Upcoming ({counts.upcoming})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('confirmed');
                    setTimeFilter('all');
                  }}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all min-h-[32px] whitespace-nowrap ${
                    statusFilter === 'confirmed'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                  }`}
                >
                  Active ({counts.confirmed})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('cancelled');
                    setTimeFilter('all');
                  }}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all min-h-[32px] whitespace-nowrap ${
                    statusFilter === 'cancelled'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                  }`}
                >
                  Cancelled ({counts.cancelled})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('completed');
                    setTimeFilter('all');
                  }}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all min-h-[32px] whitespace-nowrap ${
                    statusFilter === 'completed'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                  }`}
                >
                  Completed ({counts.completed})
                </button>

                {/* Date Range - Stack on mobile */}
                <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="flex-1 sm:flex-none px-2 py-1.5 text-xs border border-gray-300 rounded-lg min-h-[32px]"
                  />
                  <span className="text-xs text-gray-500">to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="flex-1 sm:flex-none px-2 py-1.5 text-xs border border-gray-300 rounded-lg min-h-[32px]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <Search className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">No bookings found</h3>
            <p className="text-sm text-gray-600 mb-4 px-4">
              {searchQuery ? `No results for "${searchQuery}"` : 'Try adjusting your filters'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm font-medium min-h-[44px]"
              >
                <RefreshCw className="h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            {/* Desktop Table Header - Hidden on mobile */}
            <div className="hidden lg:block bg-gray-50 border-b">
              <div className="grid grid-cols-12 gap-2 px-3 py-2.5 text-xs font-semibold text-gray-700">
                <div className="col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedBookings.size === filteredBookings.length && filteredBookings.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Attendee</div>
                <div className="col-span-2">Team</div>
                <div className="col-span-2">Time</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
            </div>

            {/* Bookings Items */}
            <div className="divide-y">
              {filteredBookings.map((booking) => {
                const statusColor = getStatusColor(booking.status, booking.start_time);
                const statusLabel = getStatusLabel(booking.status, booking.start_time);
                const isUpcoming = booking.status !== 'cancelled' && new Date(booking.start_time) > new Date();
                
                return (
                  <div key={booking.id} className={selectedBookings.has(booking.id) ? 'bg-blue-50' : ''}>
                    {/* Mobile Card View */}
                    <div className="lg:hidden p-3 sm:p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedBookings.has(booking.id)}
                          onChange={() => handleSelectBooking(booking.id)}
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0"
                        />

                        {/* Main Info */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Date Badge */}
                          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-lg flex flex-col items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                            statusColor === 'green' ? 'bg-green-500' : statusColor === 'red' ? 'bg-red-500' : 'bg-gray-400'
                          }`}>
                            <span className="text-[9px] opacity-75">
                              {new Date(booking.start_time).toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                            <span className="text-base sm:text-lg">
                              {new Date(booking.start_time).getDate()}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate text-sm">
                              {booking.attendee_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {booking.attendee_email}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-xs text-gray-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(booking.start_time)}
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-600 truncate">
                                {booking.team_name}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                          statusColor === 'green' ? 'bg-green-100 text-green-700' : 
                          statusColor === 'red' ? 'bg-red-100 text-red-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {statusLabel}
                        </span>
                      </div>
                      
                      {/* Action Buttons - Mobile */}
                      {isUpcoming && (
                        <div className="flex gap-2 pt-2 border-t">
                          <button
                            onClick={() => setDetailsModal({ open: true, booking })}
                            className="flex-1 p-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 active:bg-blue-200 font-medium min-h-[36px]"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setRescheduleModal({ open: true, booking, newDate: '', newTime: '', submitting: false })}
                            className="flex-1 p-2 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 active:bg-gray-200 font-medium min-h-[36px]"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => setCancelModal({ open: true, booking, reason: '', submitting: false })}
                            className="flex-1 p-2 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:bg-red-200 font-medium min-h-[36px]"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Desktop Table Row */}
                    <div className="hidden lg:grid grid-cols-12 gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors">
                      {/* Checkbox */}
                      <div className="col-span-1 flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedBookings.has(booking.id)}
                          onChange={() => handleSelectBooking(booking.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </div>

                      {/* Date */}
                      <div className="col-span-2 flex items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-white text-xs font-bold ${
                            statusColor === 'green' ? 'bg-green-500' : statusColor === 'red' ? 'bg-red-500' : 'bg-gray-400'
                          }`}>
                            <span className="text-[8px] opacity-75">
                              {new Date(booking.start_time).toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                            <span className="text-base">
                              {new Date(booking.start_time).getDate()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-xs">{formatDate(booking.start_time)}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Attendee */}
                      <div className="col-span-2 flex flex-col justify-center">
                        <p className="font-semibold text-gray-900 truncate text-xs">{booking.attendee_name}</p>
                        <p className="text-xs text-gray-500 truncate">{booking.attendee_email}</p>
                      </div>

                      {/* Team */}
                      <div className="col-span-2 flex flex-col justify-center">
                        <p className="font-medium text-gray-900 truncate text-xs">{booking.team_name}</p>
                        {booking.member_name && (
                          <p className="text-xs text-gray-500 truncate">{booking.member_name}</p>
                        )}
                      </div>

                      {/* Time */}
                      <div className="col-span-2 flex items-center">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-medium text-gray-900 text-xs">{formatTime(booking.start_time)}</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-2 flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          statusColor === 'green' 
                            ? 'bg-green-100 text-green-700' 
                            : statusColor === 'red'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {statusLabel}
                        </span>
                        {booking.isMyTeam ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            Owner
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            Member
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex items-center justify-end gap-1">
                        {isUpcoming && (
                          <>
                            <button
                              onClick={() => setDetailsModal({ open: true, booking })}
                              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setRescheduleModal({ open: true, booking, newDate: '', newTime: '', submitting: false })}
                              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Reschedule"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setCancelModal({ open: true, booking, reason: '', submitting: false })}
                              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Cancel"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals - Cancel Modal */}
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Cancel Booking</h3>
              <button
                onClick={() => setCancelModal({ open: false, booking: null, reason: '', submitting: false })}
                className="p-2 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">Cancel this booking?</p>
                    <p className="text-xs text-red-700">{cancelModal.booking?.attendee_name} will be notified.</p>
                  </div>
                </div>
              </div>

              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Reason (Optional)</label>
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                rows="3"
                placeholder="Why are you cancelling?"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => setCancelModal({ open: false, booking: null, reason: '', submitting: false })}
                disabled={cancelModal.submitting}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 text-sm font-medium min-h-[44px]"
              >
                Keep
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelModal.submitting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 text-sm font-medium flex items-center justify-center gap-2 min-h-[44px]"
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

      {/* Reschedule Modal */}
      {rescheduleModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Reschedule</h3>
              <button
                onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newTime: '', submitting: false })}
                className="p-2 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-blue-900">
                  <strong>Current:</strong> {formatDate(rescheduleModal.booking?.start_time)} at {formatTime(rescheduleModal.booking?.start_time)}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">New Date</label>
                  <input
                    type="date"
                    value={rescheduleModal.newDate}
                    onChange={(e) => setRescheduleModal(prev => ({ ...prev, newDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">New Time</label>
                  <input
                    type="time"
                    value={rescheduleModal.newTime}
                    onChange={(e) => setRescheduleModal(prev => ({ ...prev, newTime: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newTime: '', submitting: false })}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 text-sm font-medium min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleBooking}
                disabled={rescheduleModal.submitting || !rescheduleModal.newDate || !rescheduleModal.newTime}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm font-medium flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
              >
                {rescheduleModal.submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Reschedule'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsModal.open && detailsModal.booking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Booking Details</h3>
              <button
                onClick={() => setDetailsModal({ open: false, booking: null })}
                className="p-2 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500">Attendee</p>
                  <p className="font-semibold text-gray-900 truncate">{detailsModal.booking.attendee_name}</p>
                  <p className="text-gray-600 truncate">{detailsModal.booking.attendee_email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Date & Time</p>
                  <p className="font-semibold text-gray-900">{formatDate(detailsModal.booking.start_time)}</p>
                  <p className="text-gray-600">{formatTime(detailsModal.booking.start_time)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500">Team</p>
                  <p className="font-semibold text-gray-900 truncate">{detailsModal.booking.team_name}</p>
                  {detailsModal.booking.member_name && (
                    <p className="text-gray-600 truncate">{detailsModal.booking.member_name}</p>
                  )}
                </div>
              </div>

              {detailsModal.booking.notes && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Notes</p>
                    <p className="text-gray-900">{detailsModal.booking.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setDetailsModal({ open: false, booking: null })}
              className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm font-medium min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}