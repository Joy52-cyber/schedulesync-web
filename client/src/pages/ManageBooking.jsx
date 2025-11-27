import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar,
  User,
  Mail,
  Video,
  XCircle,
  RefreshCw,
  CheckCircle,
  Loader2,
  Clock,
  AlertCircle
} from 'lucide-react';

export default function ManageBooking() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadBooking();
  }, [token]);

  const loadBooking = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/bookings/manage/${token}`
      );
      const data = await response.json();
      console.log('📋 Booking data loaded:', data);
      setBooking(data.booking);
    } catch (error) {
      console.error('Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setProcessing(true);
      await fetch(
        `${import.meta.env.VITE_API_URL}/api/bookings/manage/${token}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: cancelReason || 'Cancelled by guest' }),
        }
      );
      setShowCancelConfirm(false);
      await loadBooking();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReschedule = () => {
    // Try multiple token sources
    const bookingToken = booking.member_booking_token || booking.booking_token || booking.team_member_token;
    
    if (bookingToken) {
      // Navigate to booking page with reschedule flag
      navigate(`/book/${bookingToken}?reschedule=${token}`);
    } else {
      alert('Unable to reschedule online. Please contact the organizer directly.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDuration = () => {
    if (!booking) return '';
    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    const minutes = Math.round((end - start) / (1000 * 60));
    return `${minutes} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your booking...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md border-2 border-gray-100">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Booking Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            This booking link is invalid or has expired. Please check your email for the correct link or contact the organizer.
          </p>
          <p className="text-sm text-gray-400">
            You can safely close this page.
          </p>
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
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Manage Your Booking
          </h1>
          <p className="text-gray-600">
            View details or make changes to your scheduled meeting
          </p>
        </div>

        {/* Booking Details Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-gray-100 mb-6">
          {/* Status Header */}
          <div
            className={`p-6 ${
              isCancelled
                ? 'bg-red-500'
                : isPast
                ? 'bg-gray-500'
                : 'bg-gradient-to-r from-blue-500 to-purple-600'
            }`}
          >
            <div className="flex items-center justify-center gap-3 text-white">
              {isCancelled ? (
                <>
                  <XCircle className="h-7 w-7" />
                  <span className="text-2xl font-bold">Cancelled</span>
                </>
              ) : isPast ? (
                <>
                  <CheckCircle className="h-7 w-7" />
                  <span className="text-2xl font-bold">Completed</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-7 w-7" />
                  <span className="text-2xl font-bold">Confirmed</span>
                </>
              )}
            </div>
            {!isCancelled && !isPast && (
              <p className="text-center text-blue-100 mt-2 text-sm">
                Your meeting is scheduled and ready
              </p>
            )}
          </div>

          {/* Details */}
          <div className="p-8 space-y-5">
            {/* Date & Time */}
            <div className="flex items-start gap-4 p-5 bg-blue-50 rounded-2xl">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 mb-1">Date & Time</p>
                <p className="text-gray-700 font-medium">
                  {formatDate(booking.start_time)}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-gray-600">
                    {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                  </span>
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getDuration()}
                  </span>
                </div>
              </div>
            </div>

            {/* Organizer */}
            <div className="flex items-start gap-4 p-5 bg-purple-50 rounded-2xl">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 mb-1">Meeting With</p>
                <p className="text-gray-700 font-medium">{booking.organizer_name}</p>
                {booking.organizer_email && (
                  <p className="text-gray-500 text-sm">{booking.organizer_email}</p>
                )}
              </div>
            </div>

            {/* Guest Info */}
            <div className="flex items-start gap-4 p-5 bg-green-50 rounded-2xl">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 mb-1">Your Information</p>
                <p className="text-gray-700 font-medium">{booking.attendee_name}</p>
                <p className="text-gray-500 text-sm">{booking.attendee_email}</p>
              </div>
            </div>

            {/* Meeting Link */}
            {booking.meet_link && !isCancelled && (
              <div className="flex items-start gap-4 p-5 bg-amber-50 rounded-2xl">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Video className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 mb-2">Video Conference</p>
                  <a
                    href={booking.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                  >
                    <Video className="h-4 w-4" />
                    Join Google Meet
                  </a>
                </div>
              </div>
            )}

            {/* Notes */}
            {booking.notes && (
              <div className="p-5 bg-gray-50 rounded-2xl">
                <p className="font-bold text-gray-900 mb-2">Notes</p>
                <p className="text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions - Only show for upcoming, non-cancelled bookings */}
        {!isCancelled && !isPast && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Need to make changes?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleReschedule}
                disabled={processing}
                className="bg-blue-600 text-white px-6 py-4 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-bold disabled:opacity-50"
              >
                <RefreshCw className="h-5 w-5" />
                Reschedule Meeting
              </button>
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={processing}
                className="bg-white border-2 border-red-200 text-red-600 px-6 py-4 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2 font-bold disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" />
                Cancel Meeting
              </button>
            </div>
          </div>
        )}

        {/* Cancelled message */}
        {isCancelled && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-800 mb-1">This meeting has been cancelled</h3>
                <p className="text-red-700 text-sm">
                  If you'd like to schedule a new meeting, please contact the organizer for a new booking link.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Past meeting message */}
        {isPast && !isCancelled && (
          <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-gray-800 mb-1">This meeting has already taken place</h3>
                <p className="text-gray-600 text-sm">
                  Thank you for attending! If you need to schedule another meeting, please contact the organizer.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>You can safely close this page.</p>
          <p className="mt-2">
            Powered by <span className="font-semibold text-blue-600">ScheduleSync</span>
          </p>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Cancel Meeting?</h3>
              <p className="text-gray-600">
                Are you sure you want to cancel your meeting with {booking.organizer_name}?
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for cancellation (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let them know why you're cancelling..."
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 outline-none transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={processing}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
              >
                Keep Meeting
              </button>
              <button
                onClick={handleCancel}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}