import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { X, Loader2 } from 'lucide-react';
import SmartSlotPicker from '../components/SmartSlotPicker';
import { bookings } from '../utils/api';

const ManageBooking = () => {
  const { token } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
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
  }, [token]);

  useEffect(() => {
    if (!booking) return;
    
    const action = searchParams.get('action');
    
    if (booking.can_modify && booking.status === 'confirmed') {
      if (action === 'reschedule') {
        setShowReschedule(true);
        searchParams.delete('action');
        setSearchParams(searchParams, { replace: true });
      } else if (action === 'cancel') {
        setShowCancel(true);
        searchParams.delete('action');
        setSearchParams(searchParams, { replace: true });
      }
    } else if (action) {
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [booking, searchParams]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const response = await bookings.getByManagementToken(token);
      setBooking(response.data.booking);
    } catch (err) {
      console.error('Error loading booking:', err);
      setError(err.response?.data?.error || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (newSlot) => {
    console.log('🔄 Reschedule triggered with slot:', newSlot);
    
    if (!newSlot || !newSlot.start || !newSlot.end) {
      console.error('❌ Invalid slot data:', newSlot);
      alert('Please select a valid time slot');
      return;
    }

    try {
      setActionLoading(true);
      
      const response = await bookings.rescheduleByToken(token, {
        newStartTime: newSlot.start,
        newEndTime: newSlot.end,
      });

      setBooking(response.data.booking);
      setShowReschedule(false);
      setSuccessMessage('🎉 Booking rescheduled successfully! Check your email for the updated calendar invite.');
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('❌ Reschedule error:', err);
      alert(err.response?.data?.error || 'Failed to reschedule booking');
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
      
      await bookings.cancelByToken(token, { reason: cancelReason });

      setBooking({ ...booking, status: 'cancelled' });
      setShowCancel(false);
      setSuccessMessage('✅ Booking cancelled successfully. Both parties have been notified.');
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('❌ Cancel error:', err);
      alert(err.response?.data?.error || 'Failed to cancel booking');
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600">Loading booking...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
          <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">😕</div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            {error || 'The booking link is invalid or has expired.'}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="inline-block bg-blue-600 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium min-h-[44px]"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-12">
        {successMessage && (
          <div className="bg-green-50 border-l-4 border-green-500 p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg animate-fade-in">
            <p className="text-sm sm:text-base text-green-800">{successMessage}</p>
          </div>
        )}

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
          {/* Header - Responsive */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6 lg:p-8 text-white">
            <div className="flex items-center justify-center mb-3 sm:mb-4">
              <div className="bg-white bg-opacity-20 p-3 sm:p-4 rounded-full">
                <span className="text-3xl sm:text-4xl">📅</span>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-center mb-1 sm:mb-2">
              {booking.status === 'cancelled' ? 'Cancelled Booking' : 'Manage Your Booking'}
            </h1>
            <p className="text-center text-sm sm:text-base text-blue-100">
              {booking.status === 'cancelled' 
                ? 'This booking has been cancelled'
                : booking.can_modify 
                  ? 'Reschedule or cancel your meeting'
                  : 'View booking details'}
            </p>
          </div>

          {/* Body - Responsive */}
          <div className="p-4 sm:p-6 lg:p-8">
            {booking.status === 'cancelled' && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg">
                <p className="text-sm sm:text-base text-red-800 font-semibold">
                  ⚠️ This booking has been cancelled
                </p>
                <p className="text-xs sm:text-sm text-red-700 mt-1">
                  This meeting is no longer scheduled. If you need to book another time, use the button below.
                </p>
              </div>
            )}

            {!booking.can_modify && booking.status === 'confirmed' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg">
                <p className="text-sm sm:text-base text-yellow-800">
                  ⏰ This booking is in the past and cannot be modified
                </p>
              </div>
            )}

            <div className="space-y-4 sm:space-y-6">
              {/* Date & Time - Stack on mobile */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg sm:rounded-xl p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <div className="flex items-center text-gray-600 mb-2">
                      <span className="text-xl sm:text-2xl mr-2">📅</span>
                      <span className="text-sm sm:text-base font-semibold">Date</span>
                    </div>
                    <p className="text-base sm:text-lg text-gray-900 font-bold ml-7 sm:ml-9">
                      {formatDate(booking.start_time)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center text-gray-600 mb-2">
                      <span className="text-xl sm:text-2xl mr-2">🕐</span>
                      <span className="text-sm sm:text-base font-semibold">Time</span>
                    </div>
                    <p className="text-base sm:text-lg text-gray-900 font-bold ml-7 sm:ml-9">
                      {formatTime(booking.start_time)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Guest & Organizer - Stack on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center text-gray-600 mb-2">
                    <span className="text-lg sm:text-xl mr-2">👤</span>
                    <span className="text-sm sm:text-base font-semibold">Guest</span>
                  </div>
                  <p className="text-sm sm:text-base text-gray-900 font-medium truncate">
                    {booking.attendee_name}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    {booking.attendee_email}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center text-gray-600 mb-2">
                    <span className="text-lg sm:text-xl mr-2">🎯</span>
                    <span className="text-sm sm:text-base font-semibold">Meeting With</span>
                  </div>
                  <p className="text-sm sm:text-base text-gray-900 font-medium truncate">
                    {booking.organizer_name || booking.team_name}
                  </p>
                  {booking.organizer_email && (
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      {booking.organizer_email}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {booking.notes && (
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center text-gray-600 mb-2">
                    <span className="text-lg sm:text-xl mr-2">📝</span>
                    <span className="text-sm sm:text-base font-semibold">Notes</span>
                  </div>
                  <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap">
                    {booking.notes}
                  </p>
                </div>
              )}

              {/* Action Buttons - Stack on mobile */}
              {booking.can_modify && booking.status === 'confirmed' && (
                <div className="flex flex-col gap-3 pt-4 sm:pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowReschedule(true)}
                    className="w-full bg-blue-600 text-white px-4 sm:px-6 py-3 rounded-lg text-sm sm:text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center min-h-[44px]"
                  >
                    <span className="mr-2">🔄</span>
                    Reschedule Meeting
                  </button>
                  <button
                    onClick={() => setShowCancel(true)}
                    className="w-full bg-gray-100 text-gray-700 px-4 sm:px-6 py-3 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-200 active:bg-gray-300 transition-colors flex items-center justify-center border border-gray-300 min-h-[44px]"
                  >
                    <span className="mr-2">❌</span>
                    Cancel Meeting
                  </button>
                </div>
              )}

              {/* Rebook Button */}
              {booking.status === 'cancelled' && booking.member_booking_token && (
                <div className="pt-4 sm:pt-6 border-t border-gray-200">
                  <button
                    onClick={() => window.location.href = `/book/${booking.member_booking_token}`}
                    className="block w-full bg-blue-600 text-white px-4 sm:px-6 py-3 rounded-lg text-sm sm:text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors text-center min-h-[44px]"
                  >
                    📅 Book Another Time
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reschedule Modal - Full screen on mobile */}
        {showReschedule && booking.can_modify && booking.status === 'confirmed' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  Reschedule Booking
                </h2>
                <button
                  onClick={() => setShowReschedule(false)}
                  disabled={actionLoading}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                  <p className="text-xs sm:text-sm text-blue-900 font-medium">
                    <strong>Current booking:</strong> {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                  </p>
                </div>

                <SmartSlotPicker
                  bookingToken={booking.member_booking_token}
                  onSlotSelected={handleReschedule}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cancel Modal - Full screen on mobile */}
        {showCancel && booking.can_modify && booking.status === 'confirmed' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-4 sm:p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  Cancel Booking
                </h2>
                <button
                  onClick={() => setShowCancel(false)}
                  disabled={actionLoading}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Alert */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-red-900 mb-1">
                  Are you sure you want to cancel?
                </p>
                <p className="text-xs text-red-700">
                  This will notify {booking.organizer_name || 'the organizer'} and cannot be undone.
                </p>
              </div>

              {/* Reason Input */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cancellation Reason
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows="3"
                  placeholder="Please provide a reason for cancelling..."
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none resize-none"
                  disabled={actionLoading}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => setShowCancel(false)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm sm:text-base font-medium min-h-[44px]"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors text-sm sm:text-base font-medium flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {actionLoading ? (
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
      </div>
    </div>
  );
};

export default ManageBooking;