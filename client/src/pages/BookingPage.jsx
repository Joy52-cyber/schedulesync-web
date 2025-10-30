import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, Mail, MessageSquare, CheckCircle, Loader2, LogIn } from 'lucide-react';
import { bookings } from '../utils/api';

export default function BookingPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState('loading'); 
  // 'loading' | 'auth' | 'slots' | 'confirm' | 'success'

  const [teamInfo, setTeamInfo] = useState(null);
  const [aiSlots, setAiSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    attendee_name: '',
    attendee_email: '',
    notes: ''
  });

  // 1) Load booking context
  useEffect(() => {
    const load = async () => {
      try {
        const res = await bookings.getByToken(token);
        setTeamInfo(res.data.team);
        setStep('auth');
      } catch (err) {
        console.error('Error fetching team info:', err);
        setError('Invalid booking link');
        setStep('auth'); // still show auth to avoid blank
      }
    };
    load();
  }, [token]);

  // 2) If we came back from Google with ?code=... run the guest auth
  useEffect(() => {
    const code = searchParams.get('code');
    // we also check we are on the right step
    if (code && token) {
      // immediately exchange code for this booking token
      (async () => {
        try {
          setError('');
          // POST /api/book/auth/google
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
          // after connecting calendar → go to slots
          await fetchAiSlots(token);
          // clean the URL (remove ?code=...) so refresh won't re-use code
          navigate(`/book/${token}`, { replace: true });
        } catch (err) {
          console.error('Guest Google auth failed:', err);
          setError('Unable to connect your calendar. Please try again.');
          setStep('auth');
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token]);

  // 3) Fetch AI slots (after calendar is connected)
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
            duration: 60, // 1 hour, can be dynamic
          }),
        }
      );
      if (!resp.ok) {
        throw new Error('Failed to get AI slots');
      }
      const data = await resp.json();
      const slots = data.slots || [];
      setAiSlots(slots);
      // if at least 1 slot, preselect first
      if (slots.length > 0) {
        setSelectedSlot(slots[0]);
      }
      // move to confirm if we want immediate
      setStep('confirm');
    } catch (err) {
      console.error('AI slot error:', err);
      setError('Failed to load AI slot suggestions. You can try again.');
      // fallback: stay on slots step to show retry
      setStep('slots');
    }
  };

  // 4) Trigger Google OAuth (guest)
  const handleGoogleConnect = () => {
    // we send user to Google — the redirect URI must be the same as in your server
    // we include nothing extra here because we’ll post code+bookingToken in the callback effect
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid');
    const state = encodeURIComponent(`booking:${token}`);
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
    window.location.href = authUrl;
  };

  // 5) Form submit → final booking
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select a suggested time slot first.');
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

  // loading screen
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

  // success screen (reuse your UI)
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Booking Confirmed!</h2>
          <p className="text-gray-600 mb-6">
            We've sent a confirmation email to <strong>{formData.attendee_email}</strong> with all the details and a calendar invite.
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
              {teamInfo?.description && <p className="text-gray-600">{teamInfo.description}</p>}
            </div>
          </div>
          {error && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Steps UI */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left side: auth / slots */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {step === 'auth' && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Connect your calendar</h2>
                <p className="text-gray-600 mb-6">
                  We’ll check your availability and suggest the best times based on your calendar.
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
                  <span className="font-medium text-gray-700">Continue with Google Calendar</span>
                </button>
                <button
                  disabled
                  className="w-full py-3 bg-gray-100 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-3 text-gray-400 cursor-not-allowed"
                >
                  <LogIn className="h-5 w-5" />
                  <span>Microsoft Calendar (soon)</span>
                </button>
                <p className="text-xs text-gray-400 mt-4">
                  We will only use your calendar to find available time slots for this meeting.
                </p>
              </>
            )}

            {step === 'slots' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">AI Slot Suggestions</h2>
                  <button
                    onClick={() => fetchAiSlots(token)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Generating best times for you...</p>
                </div>
              </>
            )}

            {(step === 'confirm' || step === 'success') && aiSlots.length > 0 && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Suggested time slots</h2>
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

          {/* Right side: form */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Information</h2>

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
                      setFormData({ ...formData, attendee_email: e.target.value })
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
