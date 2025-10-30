import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  User,
  Mail,
  MessageSquare,
  CheckCircle,
  Loader2,
  LogIn,
} from 'lucide-react';
import { bookings } from '../utils/api';

export default function BookingPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 'loading' | 'auth' | 'slots' | 'confirm' | 'success'
  const [step, setStep] = useState('loading');

  const [teamInfo, setTeamInfo] = useState(null);
  const [aiSlots, setAiSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [formData, setFormData] = useState({
    attendee_name: '',
    attendee_email: '',
    notes: '',
  });
  const [memberInfo, setMemberInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 1) Load booking context
  useEffect(() => {
  const load = async () => {
    try {
      const res = await bookings.getByToken(token);
      setTeamInfo(res.data.team);
      setMemberInfo(res.data.member); // ← ADD THIS
      
      // If has external link, show choice screen, else go to auth
      if (res.data.member?.external_booking_link) {
        setStep('choice'); // ← NEW STEP
      } else {
        setStep('auth');
      }
    } catch (err) {
      console.error('Error fetching team info:', err);
      setError('Invalid or expired booking link.');
      setStep('auth');
    }
  };
  load();
}, [token]);

  // 2) Handle Google redirect (?code=...)
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code || !token) return;

    (async () => {
      try {
        setError('');
        const resp = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/api/book/auth/google`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              bookingToken: token,
            }),
          }
        );
        if (!resp.ok) {
          throw new Error('Calendar connection failed');
        }

        await fetchAiSlots(token);
        // clean URL
        navigate(`/book/${token}`, { replace: true });
      } catch (err) {
        console.error('Guest Google auth failed:', err);
        setError('Unable to connect your calendar. Please try again.');
        setStep('auth');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token]);

  // 3) Fetch AI slots
  const fetchAiSlots = async (bookingToken) => {
    try {
      setStep('slots');
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/suggest-slots`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingToken,
            duration: 60,
          }),
        }
      );
      if (!resp.ok) throw new Error('Failed to get AI slots');

      const data = await resp.json();
      const slots = data.slots || [];
      setAiSlots(slots);

      if (slots.length > 0) {
        setSelectedSlot(slots[0]);
      }

      setStep('confirm');
    } catch (err) {
      console.error('AI slot error:', err);
      setError('Failed to load AI slot suggestions. Try again.');
      setStep('slots');
    }
  };

  // 4) Trigger Google OAuth (guest)
  const handleGoogleConnect = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
    const scope = encodeURIComponent(
      'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid'
    );
    const state = encodeURIComponent(`booking:${token}`);

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;

    window.location.href = authUrl;
  };

  // 5) Final submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select a time slot.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await bookings.create({
        token,
        slot: {
          start: selectedSlot.start,
          end: selectedSlot.end,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
        },
        ...formData,
      });
      setStep('success');
    } catch (err) {
      console.error('Booking error:', err);
      setError('Failed to create booking. Please try again.');
      setSubmitting(false);
    }
  };

  // ========== RENDER ==========

  // A. Loading screen
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading booking page...</p>
        </div>
      </div>
    );
  }

  // B. Success screen
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Booking Confirmed!</h2>
          <p className="text-gray-600 mb-6">
            We've sent a confirmation email to{' '}
            <strong>{formData.attendee_email}</strong> with all the details.
          </p>
          {selectedSlot && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Date:</strong>{' '}
                {new Date(selectedSlot.start).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Time:</strong>{' '}
                {selectedSlot.startTime ||
                  new Date(selectedSlot.start).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
              </p>
            </div>
          )}
          <p className="text-gray-500 text-sm">See you then! 🎉</p>
        </div>
      </div>
    );
  }

  // D. Choice screen (if external link exists)
if (step === 'choice') {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {teamInfo?.name || 'Schedule a Meeting'}
              </h1>
              {teamInfo?.description && (
                <p className="text-gray-600">{teamInfo.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Booking Method Options */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Choose Your Booking Method
          </h2>
          
          <div className="space-y-4">
            {/* External Platform Option */}
            <button
              onClick={() => window.open(memberInfo.external_booking_link, '_blank')}
              className="w-full flex items-center justify-between p-6 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                {memberInfo.external_booking_platform === 'calendly' ? (
                  <svg className="h-10 w-10 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.2 16.5c-.3.3-.8.3-1.1 0L12 12.4l-4.1 4.1c-.3.3-.8.3-1.1 0-.3-.3-.3-.8 0-1.1L11 11.3V5.2c0-.4.4-.8.8-.8s.8.4.8.8v6.1l4.2 4.2c.3.3.3.8 0 1z"/>
                  </svg>
                ) : memberInfo.external_booking_platform === 'hubspot' ? (
                  <svg className="h-10 w-10" fill="#FF7A59" viewBox="0 0 24 24">
                    <path d="M18.5 8.6l-1.9-1.9V4.5c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5v.7l-2.7-2.7c-.3-.3-.7-.3-1 0L2.5 9.9c-.3.3-.3.7 0 1l1.4 1.4c.3.3.7.3 1 0l5.6-5.6 5.6 5.6c.3.3.7.3 1 0l1.4-1.4c.3-.3.3-.7 0-1z"/>
                  </svg>
                ) : (
                  <Calendar className="h-10 w-10 text-purple-600" />
                )}
                <div>
                  <p className="font-semibold text-gray-900 text-lg">
                    Book via {
                      memberInfo.external_booking_platform === 'calendly' ? 'Calendly' :
                      memberInfo.external_booking_platform === 'hubspot' ? 'HubSpot' :
                      'External Calendar'
                    }
                  </p>
                  <p className="text-sm text-gray-600">Opens in a new tab</p>
                </div>
              </div>
              <svg className="h-6 w-6 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>

            {/* AI-Powered Booking Option */}
            <button
              onClick={() => setStep('auth')}
              className="w-full flex items-center justify-between p-6 border-2 border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-lg">
                    AI-Powered Smart Booking
                  </p>
                  <p className="text-sm text-gray-600">
                    Get personalized time suggestions based on your availability
                  </p>
                </div>
              </div>
              <svg className="h-6 w-6 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            Both methods will sync with your calendar automatically
          </p>
        </div>
      </div>
    </div>
  );
}

  // C. Main booking UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {teamInfo?.name || 'Schedule a Meeting'}
              </h1>
              {teamInfo?.description && (
                <p className="text-gray-600">{teamInfo.description}</p>
              )}
            </div>
          </div>
          {error && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column: auth / slots */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {step === 'auth' && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Connect your calendar
                </h2>
                <p className="text-gray-600 mb-6">
                  We’ll check your availability and suggest the best times.
                </p>
                <button
                  onClick={handleGoogleConnect}
                  className="w-full py-3 mb-3 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center gap-3 hover:border-blue-400 transition"
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    className="h-5 w-5"
                  />
                  <span className="font-medium text-gray-700">
                    Continue with Google Calendar
                  </span>
                </button>
                <button
                  disabled
                  className="w-full py-3 bg-gray-100 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-3 text-gray-400 cursor-not-allowed"
                >
                  <LogIn className="h-5 w-5" />
                  <span>Microsoft Calendar (soon)</span>
                </button>
                <p className="text-xs text-gray-400 mt-4">
                  We’ll only read availability to suggest slots.
                </p>
              </>
            )}

            {step === 'slots' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    AI Slot Suggestions
                  </h2>
                  <button
                    onClick={() => fetchAiSlots(token)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Generating best times for you...
                  </p>
                </div>
              </>
            )}

            {(step === 'confirm' || step === 'success') && aiSlots.length > 0 && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Suggested time slots
                </h2>
                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {aiSlots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        selectedSlot === slot
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-blue-300 text-gray-700'
                      }`}
                    >
                      <p className="font-semibold">
                        {new Date(slot.start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-sm">
                        {slot.startTime ||
                          new Date(slot.start).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                        –{' '}
                        {slot.endTime ||
                          (slot.end &&
                            new Date(slot.end).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            }))}
                      </p>
                      {slot.match && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                          {(slot.match * 100).toFixed(0)}% match
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right column: form */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Your Information
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.attendee_name}
                    onChange={(e) =>
                      setFormData({ ...formData, attendee_name: e.target.value })
                    }
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={formData.attendee_email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        attendee_email: e.target.value,
                      })
                    }
                    placeholder="john@example.com"
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Any specific topics or questions..."
                    rows="4"
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !selectedSlot}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Confirm Booking
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
