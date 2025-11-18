import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CheckCircle, 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  FileText,
  Download,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export default function BookingConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get booking data from URL params
    const bookingData = searchParams.get('data');
    
    if (bookingData) {
      try {
        const parsedBooking = JSON.parse(decodeURIComponent(bookingData));
        setBooking(parsedBooking);
      } catch (error) {
        console.error('Error parsing booking data:', error);
      }
    }
    
    setLoading(false);
  }, [searchParams]);

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
      })
    };
  };

  const getDuration = (start, end) => {
    const minutes = Math.round((new Date(end) - new Date(start)) / 60000);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const generateICSFile = () => {
    if (!booking) return;

    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    
    // Format dates for ICS (YYYYMMDDTHHmmssZ)
    const formatICSDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ScheduleSync//Booking//EN
BEGIN:VEVENT
UID:${booking.id}@schedulesync.app
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:Meeting with ${booking.organizer_name || 'Team'}
DESCRIPTION:Booked via ScheduleSync\\n\\nOrganizer: ${booking.organizer_name || 'Team'}\\nAttendee: ${booking.attendee_name}\\n\\nNotes: ${booking.notes || 'No notes'}
LOCATION:Online
STATUS:CONFIRMED
ORGANIZER:mailto:${booking.organizer_email || 'noreply@schedulesync.app'}
ATTENDEE:mailto:${booking.attendee_email}
END:VEVENT
END:VCALENDAR`;

    // Create blob and download
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `booking-${booking.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addToGoogleCalendar = () => {
    if (!booking) return;

    const startDate = new Date(booking.start_time).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(booking.end_time).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const title = encodeURIComponent(`Meeting with ${booking.organizer_name || 'Team'}`);
    const details = encodeURIComponent(`Booked via ScheduleSync\n\nOrganizer: ${booking.organizer_name || 'Team'}\nAttendee: ${booking.attendee_name}\n\nNotes: ${booking.notes || 'No notes'}`);
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=Online`;
    
    window.open(url, '_blank');
  };

  const addToOutlookCalendar = () => {
    if (!booking) return;

    const startDate = new Date(booking.start_time).toISOString();
    const endDate = new Date(booking.end_time).toISOString();
    
    const title = encodeURIComponent(`Meeting with ${booking.organizer_name || 'Team'}`);
    const body = encodeURIComponent(`Booked via ScheduleSync\n\nOrganizer: ${booking.organizer_name || 'Team'}\nAttendee: ${booking.attendee_name}\n\nNotes: ${booking.notes || 'No notes'}`);
    
    const url = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${body}&location=Online`;
    
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking not found</h2>
          <p className="text-gray-600 mb-6">The booking information could not be loaded.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const dateTime = formatDateTime(booking.start_time);
  const duration = getDuration(booking.start_time, booking.end_time);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Success Animation */}
        <div className="text-center mb-8 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6 animate-scaleIn">
            <CheckCircle className="h-16 w-16 text-green-600 animate-checkmark" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Booking Confirmed! 🎉
          </h1>
          <p className="text-xl text-gray-600">
            Your meeting has been successfully scheduled
          </p>
        </div>

        {/* Booking Details Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mb-6 animate-slideUp">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white">
            <h2 className="text-2xl font-bold mb-2">Meeting Details</h2>
            <p className="text-blue-100">Reference: #{booking.id}</p>
          </div>

          {/* Details */}
          <div className="p-8 space-y-6">
            {/* Date & Time */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Date & Time</p>
                <p className="text-lg font-semibold text-gray-900">{dateTime.date}</p>
                <p className="text-md text-gray-700">{dateTime.time}</p>
                <p className="text-sm text-gray-500 mt-1">Duration: {duration}</p>
              </div>
            </div>

            {/* Attendee */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Your Information</p>
                <p className="text-lg font-semibold text-gray-900">{booking.attendee_name}</p>
                <p className="text-md text-gray-700">{booking.attendee_email}</p>
              </div>
            </div>

            {/* Organizer */}
            {booking.organizer_name && (
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <User className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 mb-1">Meeting With</p>
                  <p className="text-lg font-semibold text-gray-900">{booking.organizer_name}</p>
                  {booking.organizer_email && (
                    <p className="text-md text-gray-700">{booking.organizer_email}</p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {booking.notes && (
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <FileText className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-md text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add to Calendar Options */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mb-6 animate-slideUp animation-delay-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            Add to Your Calendar
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Google Calendar */}
            <button
              onClick={addToGoogleCalendar}
              className="flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-300 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all group"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.696 14.943c-1.067 2.033-3.245 3.43-5.696 3.43-3.314 0-6-2.686-6-6s2.686-6 6-6c1.517 0 2.894.567 3.953 1.496l-1.638 1.638c-.633-.613-1.511-1.003-2.315-1.003-2.21 0-4 1.79-4 4s1.79 4 4 4c1.41 0 2.633-.74 3.293-1.843H12v-2.157h5.696v1.086z"/>
              </svg>
              <span className="font-semibold text-gray-700 group-hover:text-blue-600">Google</span>
              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
            </button>

            {/* Outlook Calendar */}
            <button
              onClick={addToOutlookCalendar}
              className="flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-300 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all group"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path fill="#0078D4" d="M24 7.386V2.75A2.755 2.755 0 0021.25 0h-1.964L11.5 6.429 3.714 0H1.75A1.752 1.752 0 000 1.75v14.5A1.752 1.752 0 001.75 18h1.964L11.5 11.571 19.286 18h1.964A2.755 2.755 0 0024 15.25v-4.636L13.393 18 2.786 10.614z"/>
              </svg>
              <span className="font-semibold text-gray-700 group-hover:text-blue-600">Outlook</span>
              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
            </button>

            {/* Download ICS */}
            <button
              onClick={generateICSFile}
              className="flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-300 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all group"
            >
              <Download className="h-6 w-6 text-gray-600 group-hover:text-blue-600" />
              <span className="font-semibold text-gray-700 group-hover:text-blue-600">Download</span>
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-4 text-center">
            Choose your preferred calendar app to add this meeting
          </p>
        </div>

        {/* Email Confirmation Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 animate-slideUp animation-delay-300">
          <div className="flex items-start gap-4">
            <Mail className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Confirmation Email Sent</h4>
              <p className="text-sm text-gray-600">
                We've sent a confirmation email to <strong>{booking.attendee_email}</strong> with all the meeting details.
                Please check your inbox (and spam folder just in case).
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 animate-slideUp animation-delay-400">
          <button
            onClick={() => window.location.href = booking.booking_link || '/'}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            <RefreshCw className="h-5 w-5" />
            Book Another Meeting
          </button>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.5);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes checkmark {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }
        
        .animation-delay-200 {
          animation-delay: 0.2s;
          opacity: 0;
          animation-fill-mode: forwards;
        }
        
        .animation-delay-300 {
          animation-delay: 0.3s;
          opacity: 0;
          animation-fill-mode: forwards;
        }
        
        .animation-delay-400 {
          animation-delay: 0.4s;
          opacity: 0;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}