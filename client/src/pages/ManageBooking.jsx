import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar,
  Clock,
  User,
  Mail,
  Video,
  XCircle,
  RefreshCw,
  CheckCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react';

export default function ManageBooking() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadBooking();
  }, [token]);

  const loadBooking = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/bookings/manage/${token}`);
      const data = await response.json();
      setBooking(data.booking);
    } catch (error) {
      console.error('Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
      setProcessing(true);
      await fetch(`${import.meta.env.VITE_API_URL}/api/bookings/manage/${token}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Cancelled by guest' })
      });
      await loadBooking();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReschedule = () => {
    // Use member_booking_token to create a new booking
    if (booking.member_booking_token) {
      navigate(`/book/${booking.member_booking_token}`);
    } else {
      alert('Unable to reschedule. Please contact the organizer.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md border-2 border-gray-100">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h2>
          <p className="text-gray-600 mb-6">This booking link is invalid or has expired</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transition-all font-semibold"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === 'cancelled';
  const isPast = new Date(booking.start_time) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Manage Booking</h1>
          <p className="text-gray-600">View and manage your scheduled meeting</p>
        </div>

        {/* Booking Details Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-gray-100 mb-6">
          
          {/* Status Header */}
          <div className={`p-6 ${
            isCancelled 
              ? 'bg-red-500' 
              : isPast 
                ? 'bg-gray-500' 
                : 'bg-gradient-to-r from-blue-500 to-purple-600'
          }`}>
            <div className="flex items-center justify-center gap-2 text-white">
              {isCancelled ? (
                <>
                  <XCircle className="h-6 w-6" />
                  <span className="text-xl font-bold">Cancelled</span>
                </>
              ) : isPast ? (
                <>
                  <CheckCircle className="h-6 w-6" />
                  <span className="text-xl font-bold">Completed</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-6 w-6" />
                  <span className="text-xl font-bold">Confirmed</span>
                </>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="p-8 space-y-6">
            
            {/* Date & Time */}
            <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl">
              <Calendar className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">Date & Time</p>
                <p className="text-gray-700">
                  {new Date(booking.start_time).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-gray-700">
                  {new Date(booking.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })} - {new Date(booking.end_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>
            </div>

            {/* Organizer */}
            <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-xl">
              <User className="h-6 w-6 text-purple-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">Meeting With</p>
                <p className="text-gray-700">{booking.organizer_name}</p>
                <p className="text-gray-600 text-sm">{booking.organizer_email}</p>
              </div>
            </div>

            {/* Guest Info */}
            <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl">
              <Mail className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">Your Information</p>
                <p className="text-gray-700">{booking.attendee_name}</p>
                <p className="text-gray-600 text-sm">{booking.attendee_email}</p>
              </div>
            </div>

            {/* Meeting Link */}
            {booking.meet_link && !isCancelled && (
              <div className="flex items-start gap-4 p-4 bg-yellow-50 rounded-xl">
                <Video className="h-6 w-6 text-yellow-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-2">Video Conference</p>
                  
                    href={booking.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-medium break-all"
                  >
                    {booking.meet_link}
                  </a>
                </div>
              </div>
            )}

            {/* Notes */}
            {booking.notes && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="font-semibold text-gray-900 mb-2">Notes:</p>
                <p className="text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isCancelled && !isPast && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleReschedule}
              disabled={processing}
              className="bg-blue-600 text-white px-6 py-4 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-5 w-5" />
              Reschedule
            </button>
            <button
              onClick={handleCancel}
              disabled={processing}
              className="bg-red-600 text-white px-6 py-4 rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5" />
                  Cancel Booking
                </>
              )}
            </button>
          </div>
        )}

        {/* Back Button */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}