import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Video,
  Filter,
  Search,
  Eye,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical,
  Copy,
  ExternalLink,
  Ban,
  RefreshCw,
} from 'lucide-react';
import { bookings } from '../utils/api';

export default function Bookings() {
  const navigate = useNavigate();

  const [bookingsList, setBookingsList] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Load bookings on mount
  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const response = await bookings.list();
      setBookingsList(response.data.bookings || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters whenever list / search / status / date changes
  useEffect(() => {
    let filtered = [...bookingsList];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.attendee_name?.toLowerCase().includes(term) ||
          b.attendee_email?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((b) => new Date(b.start_time) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((b) => new Date(b.start_time) <= toDate);
    }

    setFilteredBookings(filtered);
  }, [bookingsList, searchTerm, statusFilter, dateFrom, dateTo]);

  const getStatusBadge = (status) => {
    const map = {
      confirmed: { bg: 'bg-green-100', text: 'text-green-800', Icon: CheckCircle },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', Icon: XCircle },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', Icon: AlertCircle },
    };

    const badge = map[status] || map.pending;
    const { Icon } = badge;

    return (
      <span
        className={`${badge.bg} ${badge.text} px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap`}
      >
        <Icon className="h-3 w-3" />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  const handleCancelBooking = async (booking) => {
    if (!confirm(`Cancel booking with ${booking.attendee_name}?`)) return;

    setCancellingId(booking.id);
    try {
      // Use the API utility instead of raw fetch for correct base URL
      await bookings.cancelByToken(booking.manage_token, 'Cancelled by organizer');

      // Refresh bookings
      await loadBookings();
      console.log('✅ Booking cancelled and list refreshed');
      setActionMenuOpen(null);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const handleCopyManageLink = (booking) => {
    const link = `${window.location.origin}/manage/${booking.manage_token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(booking.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isPastBooking = (booking) => {
    return new Date(booking.start_time) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Bookings</h1>
          <p className="text-gray-600">Manage all your scheduled appointments</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
              />
            </div>

            {/* Status filter */}
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-sm sm:text-base appearance-none"
              >
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-sm sm:text-base"
                placeholder="From date"
              />
              {!dateFrom && (
                <span className="absolute left-12 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                  From date
                </span>
              )}
            </div>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-sm sm:text-base"
                placeholder="To date"
              />
              {!dateTo && (
                <span className="absolute left-12 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                  To date
                </span>
              )}
            </div>
          </div>

          {/* Clear Filters */}
          {(searchTerm || statusFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              Clear all filters
            </button>
          )}
        </div>

        {/* Booking list */}
        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-gray-100">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm || statusFilter !== 'all' || dateFrom || dateTo
                ? 'No bookings match your filters'
                : 'No bookings yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-2 border-gray-100 overflow-hidden ${
                  isPastBooking(booking) ? 'opacity-75' : ''
                }`}
              >
                <div className="p-6">
                  {/* Top row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {booking.attendee_name || 'No name'}
                        </h3>
                        <p className="text-sm text-gray-600">{booking.attendee_email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {getStatusBadge(booking.status)}
                      
                      {/* Actions dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuOpen(actionMenuOpen === booking.id ? null : booking.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-600" />
                        </button>
                        
                        {actionMenuOpen === booking.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setActionMenuOpen(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-20">
                              <button
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setActionMenuOpen(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View Details
                              </button>
                              
                              {booking.manage_token && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleCopyManageLink(booking);
                                      setActionMenuOpen(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Copy className="h-4 w-4" />
                                    {copiedId === booking.id ? 'Copied!' : 'Copy Manage Link'}
                                  </button>
                                  
                                  <a
                                    href={`/manage/${booking.manage_token}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    onClick={() => setActionMenuOpen(null)}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    Open Manage Page
                                  </a>
                                </>
                              )}
                              
                              {booking.status === 'confirmed' && !isPastBooking(booking) && (
                                <>
                                  <hr className="my-2" />
                                  <button
                                    onClick={() => handleCancelBooking(booking)}
                                    disabled={cancellingId === booking.id}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                  >
                                    {cancellingId === booking.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Ban className="h-4 w-4" />
                                    )}
                                    Cancel Booking
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Date / time / link */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">
                        {new Date(booking.start_time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">
                        {new Date(booking.start_time).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </span>
                    </div>

                    {booking.meet_link && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Video className="h-4 w-4" />
                        <a
                          href={booking.meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          Join Meeting
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {booking.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 italic line-clamp-2">{booking.notes}</p>
                    </div>
                  )}
                  
                  {/* Past booking indicator */}
                  {isPastBooking(booking) && booking.status === 'confirmed' && (
                    <div className="mt-4 text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      This booking has passed
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking details modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Booking Details</h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Modal content */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
                <User className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="font-semibold text-gray-900">{selectedBooking.attendee_name}</p>
                  <p className="text-sm text-gray-600">{selectedBooking.attendee_email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-xl">
                <Calendar className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedBooking.start_time).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedBooking.start_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}{' '}
                    -{' '}
                    {new Date(selectedBooking.end_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </p>
                </div>
              </div>

              {selectedBooking.meet_link && (
                <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl">
                  <Video className="h-6 w-6 text-green-600 mt-1" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-1">Video Conference</p>
                    <a
                      href={selectedBooking.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm break-all"
                    >
                      {selectedBooking.meet_link}
                    </a>
                  </div>
                </div>
              )}

              {selectedBooking.notes && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-semibold text-gray-900 mb-2">Notes</p>
                  <p className="text-gray-700">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-4 space-y-3">
                {selectedBooking.manage_token && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCopyManageLink(selectedBooking)}
                      className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold flex items-center justify-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      {copiedId === selectedBooking.id ? 'Copied!' : 'Copy Link'}
                    </button>
                    <a
                      href={`/manage/${selectedBooking.manage_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Manage
                    </a>
                  </div>
                )}
                
                {selectedBooking.status === 'confirmed' && !isPastBooking(selectedBooking) && (
                  <button
                    onClick={() => handleCancelBooking(selectedBooking)}
                    disabled={cancellingId === selectedBooking.id}
                    className="w-full bg-red-50 text-red-600 px-6 py-3 rounded-xl hover:bg-red-100 font-semibold flex items-center justify-center gap-2"
                  >
                    {cancellingId === selectedBooking.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}