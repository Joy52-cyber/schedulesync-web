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
import BookingDetailModal from '../components/BookingDetailModal';

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Bookings</h1>
          <p className="text-gray-600">Manage all your scheduled appointments</p>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-6 mb-6 border-2 border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none hover:border-gray-300 transition-all"
              />
            </div>

            {/* Status filter */}
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-sm sm:text-base appearance-none hover:border-gray-300 transition-all"
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
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-sm sm:text-base hover:border-gray-300 transition-all"
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
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-sm sm:text-base hover:border-gray-300 transition-all"
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
              className="mt-4 text-sm text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 hover:underline transition-all"
            >
              <X className="h-4 w-4" />
              Clear all filters
            </button>
          )}
        </div>

        {/* Booking list */}
        {filteredBookings.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-12 text-center border-2 border-white/20">
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
                className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-purple-200/30 transition-all border-2 border-white/20 overflow-hidden hover:-translate-y-1 ${
                  isPastBooking(booking) ? 'opacity-75' : ''
                }`}
              >
                <div className="p-6 bg-gradient-to-br from-white to-purple-50/10">
                  {/* Top row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <User className="h-6 w-6 text-white" />
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
                          className="p-2 hover:bg-purple-100 rounded-xl transition-all shadow-sm hover:shadow-md"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-600" />
                        </button>
                        
                        {actionMenuOpen === booking.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setActionMenuOpen(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-purple-200 py-2 z-20">
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
                    <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-purple-50/30 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-sm text-gray-700 italic line-clamp-2">{booking.notes}</p>
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
      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCancel={handleCancelBooking}
        onCopyManageLink={handleCopyManageLink}
      />
    </div>
  );
}