import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import SmartSlotPicker from '../components/SmartSlotPicker';

const ManageBooking = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadBooking();
    
    const action = searchParams.get('action');
    if (action === 'reschedule') {
      setShowReschedule(true);
    } else if (action === 'cancel') {
      setShowCancel(true);
    }
  }, [token, searchParams]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/bookings/manage/${token}`);
      
      if (!response.ok) {
        throw new Error('Booking not found');
      }
      
      const data = await response.json();
      setBooking(data.booking);
    } catch (err) {
      console.error('Error loading booking:', err);
      setError(err.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (newSlot) => {
    try {
      setActionLoading(true);
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/bookings/manage/${token}/reschedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newStartTime: newSlot.start,
            newEndTime: newSlot.end,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reschedule');
      }

      const data = await response.json();
      setBooking(data.booking);
      setShowReschedule(false);
      setSuccessMessage('🎉 Booking rescheduled successfully! Check your email for the updated calendar invite.');
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error rescheduling:', err);
      alert(err.message || 'Failed to reschedule booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(true);
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/bookings/manage/${token}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: cancelReason }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel');
      }

      setBooking({ ...booking, status: 'cancelled' });
      setShowCancel(false);
      setSuccessMessage('✅ Booking cancelled successfully. Both parties have been notified.');
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error cancelling:', err);
      alert(err.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
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
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The booking link is invalid or has expired.'}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {successMessage && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-lg animate-fade-in">
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white bg-opacity-20 p-4 rounded-full">
                <span className="text-4xl">📅</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center mb-2">
              {booking.status === 'cancelled' ? 'Cancelled Booking' : 'Manage Your Booking'}
            </h1>
            <p className="text-center text-blue-100">
              {booking.status === 'cancelled' 
                ? 'This booking has been cancelled'
                : booking.can_modify 
                  ? 'Reschedule or cancel your meeting'
                  : 'View booking details'}
            </p>
          </div>

          <div className="p-8">
            {booking.status === 'cancelled' && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
                <p className="text-red-800 font-semibold">⚠️ This booking has been cancelled</p>
              </div>
            )}

            {!booking.can_modify && booking.status === 'confirmed' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded-lg">
                <p className="text-yellow-800">
                  ⏰ This booking is in the past and cannot be modified
                </p>
              </div>
            )}

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center text-gray-600 mb-2">
                      <span className="text-2xl mr-2">📅</span>
                      <span className="font-semibold">Date</span>
                    </div>
                    <p className="text-gray-900 font-bold text-lg ml-9">
                      {formatDate(booking.start_time)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center text-gray-600 mb-2">
                      <span className="text-2xl mr-2">🕐</span>
                      <span className="font-semibold">Time</span>
                    </div>
                    <p className="text-gray-900 font-bold text-lg ml-9">
                      {formatTime(booking.start_time)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center text-gray-600 mb-2">
                    <span className="text-xl mr-2">👤</span>
                    <span className="font-semibold">Guest</span>
                  </div>
                  <p className="text-gray-900 font-medium">{booking.attendee_name}</p>
                  <p className="text-gray-600 text-sm">{booking.attendee_email}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center text-gray-600 mb-2">
                    <span className="text-xl mr-2">🎯</span>
                    <span className="font-semibold">Meeting With</span>
                  </div>
                  <p className="text-gray-900 font-medium">{booking.organizer_name || booking.team_name}</p>
                  {booking.organizer_email && (
                    <p className="text-gray-600 text-sm">{booking.organizer_email}</p>
                  )}
                </div>
              </div>

              {booking.notes && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center text-gray-600 mb-2">
                    <span className="text-xl mr-2">📝</span>
                    <span className="font-semibold">Notes</span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
                </div>
              )}

              {booking.can_modify && booking.status === 'confirmed' && (
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowReschedule(true)}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <span className="mr-2">🔄</span>
                    Reschedule Meeting
                  </button>
                  <button
                    onClick={() => setShowCancel(true)}
                    className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center border border-gray-300"
                  >
                    <span className="mr-2">❌</span>
                    Cancel Meeting
                  </button>
                </div>
              )}

              {booking.status === 'cancelled' && booking.member_booking_token && (
                <div className="pt-6 border-t border-gray-200">
                  <button
                    onClick={() => window.location.href = `/book/${booking.member_booking_token}`}
                    className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center"
                  >
                    📅 Book Another Time
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {showReschedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">🔄 Reschedule Meeting</h2>
                  <button
                    onClick={() => setShowReschedule(false)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                    disabled={actionLoading}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-blue-100 mt-2">Select a new time for your meeting</p>
              </div>

              <div className="p-6">
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded-lg">
                  <p className="text-yellow-800">
                    <strong>Current time:</strong> {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                  </p>
                </div>
                <SmartSlotPicker
  bookingToken={booking.member_booking_token}
  onSlotSelected={handleReschedule}  // ✅ Correct prop name (with 'd')
  loading={actionLoading}
  duration={30}
/>
                
              </div>
            </div>
          </div>
        )}

        {showCancel && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
              <div className="bg-gradient-to-r from-red-600 to-pink-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">❌ Cancel Meeting</h2>
                  <button
                    onClick={() => setShowCancel(false)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                    disabled={actionLoading}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-red-100 mt-2">This action cannot be undone</p>
              </div>

              <div className="p-6">
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
                  <p className="text-red-800 text-sm">
                    Both you and the organizer will be notified of this cancellation.
                  </p>
                </div>

                <label className="block mb-4">
                  <span className="text-gray-700 font-semibold mb-2 block">
                    Reason for cancellation <span className="text-red-500">*</span>
                  </span>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Please let us know why you're cancelling..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={4}
                    disabled={actionLoading}
                  />
                </label>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancel(false)}
                    className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    disabled={actionLoading}
                  >
                    Keep Meeting
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                    disabled={actionLoading || !cancelReason.trim()}
                  >
                    {actionLoading ? 'Cancelling...' : 'Cancel Meeting'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageBooking;