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
    if (!newSlot || !newSlot.start || !newSlot.end) {
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
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading booking...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The booking link is invalid or has expired.'}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {successMessage && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-lg animate-fadeIn">
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Header */}
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

          {/* Body */}
          <div className="p-8">
            {booking.status === 'cancelled' && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
                <p className="text-red-800 font-semibold">⚠️ This booking has been cancelled</p>
                <p className="text-red-700 text-sm mt-1">
                  This meeting is no longer scheduled. If you need to book another time, use the button below.
                </p>
              </div>
            )}

            {!booking.can_modify && booking.status === 'confirmed' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded-lg">
                <p className="text-yellow-800">⏰ This booking is in the past and cannot be modified</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Date & Time */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6">
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

              {/* Google Meet Link */}
              {booking.meet_link && booking.status === 'confirmed' && (
  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-6">
    <div className="flex items-start gap-4">
      <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
        <span className="text-3xl">🎥</span>
      </div>
      <div className="flex-1">
        <p className="font-bold text-gray-900 mb-3 text-lg">Video Conference</p>
        <a
          href={booking.meet_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:shadow-xl hover:scale-105 transition-all font-semibold"
        >
          <span>Join Google Meet</span>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <p className="text-xs text-gray-600 mt-3">
          💡 This link will be active for the duration of your meeting
        </p>
      </div>
    </div>
  </div>
)}
              {/* Guest & Organizer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center text-gray-600 mb-2">
                    <span className="text-xl mr-2">👤</span>
                    <span className="font-semibold">Guest</span>
                  </div>
                  <p className="text-gray-900 font-medium">{booking.attendee_name}</p>
                  <p className="text-gray-600 text-sm">{booking.attendee_email}</p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
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

              {/* Notes */}
              {booking.notes && (
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center text-gray-600 mb-2">
                    <span className="text-xl mr-2">📝</span>
                    <span className="font-semibold">Notes</span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              {booking.can_modify && booking.status === 'confirmed' && (
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowReschedule(true)}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <span className="mr-2">🔄</span>
                    Reschedule Meeting
                  </button>
                  <button
                    onClick={() => setShowCancel(true)}
                    className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center border border-gray-300"
                  >
                    <span className="mr-2">❌</span>
                    Cancel Meeting
                  </button>
                </div>
              )}

              {/* Rebook Button */}
              {booking.status === 'cancelled' && booking.member_booking_token && (
                <div className="pt-6 border-t border-gray-200">
                  <button
                    onClick={() => window.location.href = `/book/${booking.member_booking_token}`}
                    className="block w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-center"
                  >
                    📅 Book Another Time
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reschedule Modal */}
        {showReschedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10 rounded-t-3xl">
                <h2 className="text-xl font-bold text-gray-900">Reschedule Booking</h2>
                <button
                  onClick={() => setShowReschedule(false)}
                  disabled={actionLoading}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6 text-gray-500" />
                </button>
              </div>

              <div className="p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-sm text-blue-900 font-medium">
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

        {/* Cancel Modal */}
        {showCancel && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Cancel Booking</h2>
                <button
                  onClick={() => setShowCancel(false)}
                  disabled={actionLoading}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6 text-gray-500" />
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-red-900 mb-1">
                  Are you sure you want to cancel?
                </p>
                <p className="text-xs text-red-700">
                  This will notify {booking.organizer_name || 'the organizer'} and cannot be undone.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cancellation Reason
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows="3"
                  placeholder="Please provide a reason for cancelling..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-500 focus:outline-none resize-none"
                  disabled={actionLoading}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancel(false)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
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

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ManageBooking;