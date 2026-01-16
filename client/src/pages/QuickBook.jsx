import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, CheckCircle, Loader2, AlertCircle, Download, Mail, Sparkles } from 'lucide-react';
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

  const formatDate = (date) => {
    return date?.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date?.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const generateCalendarUrl = (type) => {
    if (!selectedTime || !booking) return '#';

    const startTime = selectedTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(selectedTime.getTime() + (booking.duration || 30) * 60000);
    const endTime = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const title = encodeURIComponent(`Meeting with ${host?.name}`);
    const details = encodeURIComponent(`Meeting scheduled via TruCal`);

    if (type === 'google') {
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}`;
    }
    // Could add Outlook, iCal support here
    return '#';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-2xl w-full transform transition-all duration-500 hover:scale-[1.01]">
        {/* Premium Success Header with Gradient */}
        <div className="relative bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 p-12 text-center overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <div className="absolute top-10 left-10 w-20 h-20 border-2 border-white/20 rounded-full"></div>
            <div className="absolute bottom-10 right-10 w-32 h-32 border-2 border-white/20 rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10">
            {/* Animated checkmark */}
            <div className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-white/20 backdrop-blur-sm rounded-full animate-bounce-slow">
              <CheckCircle className="w-12 h-12 text-white drop-shadow-lg" strokeWidth={2.5} />
            </div>

            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
              <h1 className="text-4xl font-bold text-white drop-shadow-lg">All Set!</h1>
              <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
            </div>

            <p className="text-xl text-white/90 font-medium">Your meeting is confirmed</p>
          </div>
        </div>

        {/* Premium Content Section */}
        <div className="p-8">
          {/* Meeting Details Card */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 mb-6 border border-purple-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Meeting Details
            </h2>

            <div className="space-y-4">
              {/* Date */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Date</p>
                  <p className="text-lg font-semibold text-gray-900">{formatDate(selectedTime)}</p>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Time</p>
                  <p className="text-lg font-semibold text-gray-900">{formatTime(selectedTime)}</p>
                  <p className="text-sm text-gray-500 mt-1">Duration: {booking?.duration || 30} minutes</p>
                </div>
              </div>

              {/* Host */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Meeting with</p>
                  <p className="text-lg font-semibold text-gray-900">{host?.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{host?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Add to Calendar Section */}
          <div className="bg-white border-2 border-purple-100 rounded-2xl p-6 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-purple-600" />
              Add to Calendar
            </h3>
            <div className="flex flex-wrap gap-3">
              <a
                href={generateCalendarUrl('google')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <Calendar className="w-4 h-4" />
                Google Calendar
              </a>
            </div>
          </div>

          {/* Email Confirmation Notice */}
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-900">Confirmation email sent!</p>
                <p className="text-xs text-purple-700 mt-1">
                  Check your inbox for meeting details and calendar invite.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {booking?.manage_token && (
              <a
                href={`/manage/${booking.manage_token}`}
                className="flex-1 px-6 py-3 bg-white border-2 border-purple-200 text-purple-700 rounded-xl font-semibold hover:bg-purple-50 hover:border-purple-300 transition-all text-center"
              >
                Reschedule or Cancel
              </a>
            )}

            {username && (
              <button
                onClick={() => navigate(`/${username}`)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Book Another Time
              </button>
            )}
          </div>

          {/* Powered by TruCal */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">
              Powered by{' '}
              <span className="font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                TruCal
              </span>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-bounce-slow {
          animation: bounce 2s infinite;
        }
      `}</style>
    </div>
  );
}
