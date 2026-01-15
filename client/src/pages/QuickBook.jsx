import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import api from '../utils/api';

export default function QuickBook() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading, confirming, confirmed, error
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [host, setHost] = useState(null);

  const username = searchParams.get('user');
  const time = searchParams.get('time');
  const threadId = searchParams.get('thread');

  useEffect(() => {
    if (!username || !time) {
      setStatus('error');
      setError('Invalid booking link');
      return;
    }

    confirmBooking();
  }, []);

  const confirmBooking = async () => {
    setStatus('confirming');

    try {
      const response = await api.post('/public/quick-book', {
        username,
        time,
        threadId
      });

      setBooking(response.data.booking);
      setHost(response.data.host);
      setStatus('confirmed');

    } catch (err) {
      console.error('Quick book error:', err);
      setError(err.response?.data?.error || 'Failed to confirm booking');
      setStatus('error');
    }
  };

  const selectedTime = time ? new Date(decodeURIComponent(time)) : null;

  if (status === 'loading' || status === 'confirming') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Confirming your booking...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Booking Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>

          {username && (
            <button
              onClick={() => navigate(`/${username}`)}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
            >
              View All Available Times
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-md w-full">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-8 text-center">
          <CheckCircle className="w-16 h-16 text-white mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Booking Confirmed!</h1>
          <p className="text-green-100 mt-2">You're all set</p>
        </div>

        {/* Booking Details */}
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <Calendar className="w-6 h-6 text-purple-600" />
              <div>
                <p className="font-semibold text-gray-900">
                  {selectedTime?.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <Clock className="w-6 h-6 text-purple-600" />
              <div>
                <p className="font-semibold text-gray-900">
                  {selectedTime?.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
                <p className="text-sm text-gray-500">{booking?.duration || 30} minutes</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <User className="w-6 h-6 text-purple-600" />
              <div>
                <p className="font-semibold text-gray-900">Meeting with {host?.name}</p>
                <p className="text-sm text-gray-500">{host?.email}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-purple-50 rounded-xl">
            <p className="text-sm text-purple-700">
              ✉️ A confirmation email has been sent to all participants.
            </p>
          </div>

          {booking?.manage_token && (
            <div className="mt-4 text-center">
              <a
                href={`/manage/${booking.manage_token}`}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                Need to reschedule or cancel?
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
