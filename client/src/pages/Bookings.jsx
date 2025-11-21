import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  User, 
  Mail,
  Video,
  Filter,
  Search,
  Download,
  Eye,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

export default function Bookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [bookings, searchTerm, statusFilter]);

  const loadBookings = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/bookings`, {
        credentials: 'include'
      });
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterBookings = () => {
    let filtered = [...bookings];

    if (searchTerm) {
      filtered = filtered.filter(b => 
        b.attendee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.attendee_email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    setFilteredBookings(filtered);
  };

  const getStatusBadge = (status) => {
    const badges = {
      confirmed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertCircle }
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`${badge.bg} ${badge.text} px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Bookings</h1>
          <p className="text-gray-600">Manage all your scheduled appointments</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
              >
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-gray-100">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm || statusFilter !== 'all' ? 'No bookings match your filters' : 'No bookings yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-2 border-gray-100 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{booking.attendee_name}</h3>
                        <p className="text-sm text-gray-600">{booking.attendee_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(booking.status)}
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Eye className="h-5 w-5 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">
                        {new Date(booking.start_time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">
                        {new Date(booking.start_time).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                    {booking.meet_link && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Video className="h-4 w-4" />
                        
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

                  {booking.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 italic">"{booking.notes}"</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Booking Details</h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

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
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedBooking.start_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })} - {new Date(selectedBooking.end_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </p>
                </div>
              </div>

              {selectedBooking.meet_link && (
                <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl">
                  <Video className="h-6 w-6 text-green-600 mt-1" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-1">Video Conference</p>
                    
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
                  <p className="font-semibold text-gray-900 mb-2">Notes:</p>
                  <p className="text-gray-700">"{selectedBooking.notes}"</p>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={() => navigate(`/manage-booking/${selectedBooking.token}`)}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold"
                >
                  Manage Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}