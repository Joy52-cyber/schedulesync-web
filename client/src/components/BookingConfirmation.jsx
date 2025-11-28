import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Calendar,
  Clock,
  User,
  Mail,
  Download,
  Plus,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  Video,
} from 'lucide-react';

export default function BookingConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decoded = JSON.parse(decodeURIComponent(data));
        setBookingData(decoded);
        console.log('📋 Booking data:', decoded);
      } catch (error) {
        console.error('Failed to parse booking data:', error);
      }
    }

    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, [searchParams]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const formatTimeWithZone = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(date);
  };

  const getDuration = () => {
    if (!bookingData) return '';
    const start = new Date(bookingData.start_time);
    const end = new Date(bookingData.end_time);
    const minutes = Math.round((end - start) / (1000 * 60));
    return `${minutes} minutes`;
  };

  const handleAddToGoogleCalendar = () => {
    if (!bookingData) return;

    const start = new Date(bookingData.start_time);
    const end = new Date(bookingData.end_time);

    const formatGoogleDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Meeting with ${bookingData.organizer_name || 'Team'}`,
      dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
      details: bookingData.notes || `Meeting scheduled via ScheduleSync`,
      location: bookingData.meet_link || 'Google Meet (link in calendar invite)',
    });

    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
  };

  const handleAddToOutlook = () => {
    if (!bookingData) return;

    const start = new Date(bookingData.start_time);
    const end = new Date(bookingData.end_time);

    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: `Meeting with ${bookingData.organizer_name || 'Team'}`,
      startdt: start.toISOString(),
      enddt: end.toISOString(),
      body: bookingData.notes || `Meeting scheduled via ScheduleSync`,
      location: bookingData.meet_link || 'Google Meet (link in calendar invite)',
    });

    window.open(`https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`, '_blank');
  };

  const handleCopyDetails = () => {
    if (!bookingData) return;

    const text = `
Meeting Confirmation

Date: ${formatDate(bookingData.start_time)}
Time: ${formatTime(bookingData.start_time)} - ${formatTime(bookingData.end_time)}
Duration: ${getDuration()}
With: ${bookingData.organizer_name || 'Team'}
${bookingData.meet_link ? `\nGoogle Meet: ${bookingData.meet_link}` : ''}
${bookingData.notes ? `\nNotes: ${bookingData.notes}` : ''}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Booking Data</h2>
          <p className="text-gray-600 mb-6">We couldn't find your booking information.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animationDelay: `${Math.random() * 3}s`,
                backgroundColor: ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'][Math.floor(Math.random() * 5)],
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 relative z-10">
        {/* Success Header */}
        <div className="text-center mb-8 animate-fadeInUp">
          <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl animate-scaleIn">
            <CheckCircle className="h-14 w-14 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            You're All Set! 🎉
          </h1>
          <p className="text-xl text-gray-600">
            Your meeting has been confirmed
          </p>
        </div>

        {/* Google Meet Link - Featured */}
        {bookingData.meet_link && (
          <div className="bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl shadow-2xl p-8 mb-6 text-white animate-fadeInUp" style={{animationDelay: '0.05s'}}>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4">
                <Video className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Your Meeting Link</h2>
              <p className="text-blue-100 mb-6">Join via Google Meet at the scheduled time</p>
              {/* ✅ FIX: Added the missing <a tag */}
              <a
                href={bookingData.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white text-purple-600 px-8 py-4 rounded-xl hover:shadow-2xl hover:scale-105 transition-all font-bold text-lg"
              >
                <Video className="h-6 w-6" />
                <span>Join Google Meet</span>
                <ExternalLink className="h-5 w-5" />
              </a>
              <p className="text-sm text-blue-100 mt-4">
                💡 This link is also in your calendar invite and email
              </p>
            </div>
          </div>
        )}

        {/* Main Booking Details Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 animate-fadeInUp" style={{animationDelay: '0.1s'}}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Meeting Details</h2>
              <p className="text-sm text-gray-600">
                Confirmation sent to {bookingData.attendee_email}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Date & Time */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Date
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDate(bookingData.start_time)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Time
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatTime(bookingData.start_time)} - {formatTime(bookingData.end_time)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {getDuration()} • {formatTimeWithZone(bookingData.start_time)}
                  </p>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Organizer
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {bookingData.organizer_name || 'Team Member'}
                  </p>
                  {bookingData.team_name && (
                    <p className="text-sm text-gray-600 mt-1">
                      {bookingData.team_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Your Email
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {bookingData.attendee_name}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {bookingData.attendee_email}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {bookingData.notes && (
            <div className="mt-6 pt-6 border-t-2 border-gray-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Meeting Notes
                  </p>
                  <p className="text-gray-900">
                    {bookingData.notes}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Add to Calendar Buttons */}
          <div className="bg-white rounded-2xl shadow-lg p-6 animate-fadeInUp" style={{animationDelay: '0.2s'}}>
            <div className="flex items-center gap-2 mb-4">
              <Plus className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-gray-900">Add to Calendar</h3>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleAddToGoogleCalendar}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    className="h-6 w-6"
                  />
                  <span className="font-medium text-gray-900">Google Calendar</span>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </button>

              <button
                onClick={handleAddToOutlook}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <svg className="h-6 w-6" viewBox="0 0 23 23" fill="none">
                    <path d="M0 0h10.93v10.93H0z" fill="#F35325" />
                    <path d="M12.07 0H23v10.93H12.07z" fill="#81BC06" />
                    <path d="M0 12.07h10.93V23H0z" fill="#05A6F0" />
                    <path d="M12.07 12.07H23V23H12.07z" fill="#FFBA08" />
                  </svg>
                  <span className="font-medium text-gray-900">Outlook Calendar</span>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-lg p-6 animate-fadeInUp" style={{animationDelay: '0.3s'}}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">Quick Actions</h3>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleCopyDetails}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  {copied ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <Copy className="h-5 w-5 text-gray-600 group-hover:text-purple-600" />
                  )}
                  <span className="font-medium text-gray-900">
                    {copied ? 'Copied!' : 'Copy Details'}
                  </span>
                </div>
              </button>

              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-gray-600 group-hover:text-purple-600" />
                  <span className="font-medium text-gray-900">Print / Save as PDF</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* What's Next Card */}
        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl border-2 border-blue-200 p-6 mb-6 animate-fadeInUp" style={{animationDelay: '0.4s'}}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">What Happens Next?</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Check Your Email</p>
                <p className="text-sm text-gray-600">
                  We've sent a calendar invite with a Google Meet link to{' '}
                  <span className="font-semibold">{bookingData.attendee_email}</span>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Add to Your Calendar</p>
                <p className="text-sm text-gray-600">
                  Use the buttons above to add this meeting to your preferred calendar app
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-pink-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Join at Scheduled Time</p>
                <p className="text-sm text-gray-600">
                  {bookingData.meet_link 
                    ? 'Click the Google Meet link above or in your calendar to join'
                    : 'Click the Google Meet link in your calendar invite to join the meeting'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center animate-fadeInUp" style={{animationDelay: '0.5s'}}>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-xl hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 transition-all font-medium shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.5);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes confettiFall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out;
        }

        .confetti-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 9999;
        }

        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          top: -10px;
          animation: confettiFall 3s linear forwards;
        }

        @media print {
          .confetti-container {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}