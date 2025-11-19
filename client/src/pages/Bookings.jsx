import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, User, Mail, FileText, Filter, Users, Crown, UserCheck, 
  X, Loader2, AlertCircle, CheckCircle, Search, Download, Trash2, 
  XCircle, RefreshCw, ChevronDown, Eye, MoreVertical
} from 'lucide-react';
import api from '../utils/api';

export default function BookingsCompact() {
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
  const [viewMode, setViewMode] = useState('compact'); // 'compact' or 'cards'
  
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

    // Team filter
    if (filter === 'my-teams') {
      filtered = filtered.filter(b => b.isMyTeam);
    } else if (filter === 'member-teams') {
      filtered = filtered.filter(b => !b.isMyTeam);
    }

    // Status filter takes priority over time filter
    if (statusFilter === 'confirmed') {
      filtered = filtered.filter(b => b.status === 'confirmed' && new Date(b.start_time) >= now);
    } else if (statusFilter === 'cancelled') {
      // Show ALL cancelled bookings regardless of time
      filtered = filtered.filter(b => b.status === 'cancelled');
    } else if (statusFilter === 'completed') {
      // Show completed bookings (past meetings that were confirmed)
      filtered = filtered.filter(b => new Date(b.start_time) < now && b.status === 'confirmed');
    } else {
      // Only apply time filter if no specific status is selected
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto">
        {/* Compact Header */}
        <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Bookings</h1>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {filteredBookings.length} of {bookings.length}
                    {hasActiveFilters && ' • Filtered'}
                  </p>
                </div>

                {/* Compact Stats */}
                <div className="hidden md:flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-semibold">{counts.all} Total</p>
                  </div>
                  <div className="px-3 py-1.5 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 font-semibold">{counts.upcoming} Upcoming</p>
                  </div>
                  <div className="px-3 py-1.5 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 font-semibold">{counts.completed} Done</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {selectedBookings.size > 0 && (
                  <button
                    onClick={handleBulkCancel}
                    disabled={bulkCancelling}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium disabled:opacity-50"
                  >
                    {bulkCancelling ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        Cancel ({selectedBookings.size})
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={exportToCSV}
                  disabled={filteredBookings.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Filters */}
        {showFilters && (
          <div className="bg-white border-b shadow-sm">
            <div className="px-4 py-3 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setTimeFilter('upcoming');
                    setStatusFilter('all');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    timeFilter === 'upcoming' && statusFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Upcoming ({counts.upcoming})
                </button>
                <button
                  onClick={() => {
                    setTimeFilter('past');
                    setStatusFilter('all');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    timeFilter === 'past' && statusFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Past ({counts.past})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('confirmed');
                    setTimeFilter('all');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    statusFilter === 'confirmed'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Active ({counts.confirmed})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('cancelled');
                    setTimeFilter('all');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    statusFilter === 'cancelled'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancelled ({counts.cancelled})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('completed');
                    setTimeFilter('all');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    statusFilter === 'completed'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Completed ({counts.completed})
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="px-2 py-1 text-xs border border-gray-300 rounded-lg"
                  />
                  <span className="text-xs text-gray-500">to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="px-2 py-1 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compact Bookings Table */}
        <div className="px-4 py-3">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No bookings found</h3>
              <p className="text-sm text-gray-600 mb-4">
                {searchQuery ? `No results for "${searchQuery}"` : 'Try adjusting your filters'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <RefreshCw className="h-4 w-4" />
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              {/* Table Header */}
              <div className="bg-gray-50 border-b">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-gray-700">
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

              {/* Table Body */}
              <div className="divide-y">
                {filteredBookings.map((booking) => {
                  const statusColor = getStatusColor(booking.status, booking.start_time);
                  const statusLabel = getStatusLabel(booking.status, booking.start_time);
                  const isUpcoming = booking.status !== 'cancelled' && new Date(booking.start_time) > new Date();
                  
                  return (
                    <div
                      key={booking.id}
                      className={`grid grid-cols-12 gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                        selectedBookings.has(booking.id) ? 'bg-blue-50' : ''
                      }`}
                    >
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
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals - Same as before but more compact */}
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Cancel Booking</h3>
              <button
                onClick={() => setCancelModal({ open: false, booking: null, reason: '', submitting: false })}
                className="p-2 hover:bg-gray-100 rounded-lg"
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

              <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs space-y-1">
                <p><strong>Date:</strong> {formatDate(cancelModal.booking?.start_time)}</p>
                <p><strong>Time:</strong> {formatTime(cancelModal.booking?.start_time)}</p>
                <p><strong>Attendee:</strong> {cancelModal.booking?.attendee_name}</p>
              </div>

              <label className="block text-xs font-semibold text-gray-700 mb-2">Reason (Optional)</label>
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                rows="2"
                placeholder="Why are you cancelling?"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCancelModal({ open: false, booking: null, reason: '', submitting: false })}
                disabled={cancelModal.submitting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Keep
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelModal.submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Reschedule</h3>
              <button
                onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newTime: '', submitting: false })}
                className="p-2 hover:bg-gray-100 rounded-lg"
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">New Date</label>
                  <input
                    type="date"
                    value={rescheduleModal.newDate}
                    onChange={(e) => setRescheduleModal(prev => ({ ...prev, newDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">New Time</label>
                  <input
                    type="time"
                    value={rescheduleModal.newTime}
                    onChange={(e) => setRescheduleModal(prev => ({ ...prev, newTime: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newTime: '', submitting: false })}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleBooking}
                disabled={rescheduleModal.submitting || !rescheduleModal.newDate || !rescheduleModal.newTime}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Booking Details</h3>
              <button
                onClick={() => setDetailsModal({ open: false, booking: null })}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Attendee</p>
                  <p className="font-semibold text-gray-900">{detailsModal.booking.attendee_name}</p>
                  <p className="text-gray-600">{detailsModal.booking.attendee_email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Date & Time</p>
                  <p className="font-semibold text-gray-900">{formatDate(detailsModal.booking.start_time)}</p>
                  <p className="text-gray-600">{formatTime(detailsModal.booking.start_time)} - {formatTime(detailsModal.booking.end_time)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Team</p>
                  <p className="font-semibold text-gray-900">{detailsModal.booking.team_name}</p>
                  {detailsModal.booking.member_name && (
                    <p className="text-gray-600">{detailsModal.booking.member_name}</p>
                  )}
                </div>
              </div>

              {detailsModal.booking.notes && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Notes</p>
                    <p className="text-gray-900">{detailsModal.booking.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setDetailsModal({ open: false, booking: null })}
              className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}