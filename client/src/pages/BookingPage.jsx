import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  User,
  Mail,
  MessageSquare,
  CheckCircle,
  Loader2,
  Lock,
  Sparkles,
  ExternalLink,
  Star,
  Clock,
} from 'lucide-react';
import { bookings } from '../utils/api';

export default function BookingPageUnified() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Step flow: 'loading' | 'calendar-choice' | 'form' | 'slots' | 'success'
  const [step, setStep] = useState('loading');

  const [teamInfo, setTeamInfo] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  
  // Guest OAuth state
  const [guestAuth, setGuestAuth] = useState({
    signedIn: false,
    hasCalendarAccess: false,
    provider: null, // 'google' | 'microsoft' | null
    email: '',
    name: '',
  });

  const [aiSlots, setAiSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [formData, setFormData] = useState({
    attendee_name: '',
    attendee_email: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 1) Load booking context
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await bookings.getByToken(token);
        const { team, member } = res.data || {};

        setTeamInfo(team || null);
        setMemberInfo(member || null);

        // Go directly to calendar choice screen
        setStep('calendar-choice');
      } catch (err) {
        console.error('❌ Error fetching team info:', err);
        setError('Invalid or expired booking link.');
        setStep('error');
      }
    })();
  }, [token]);

  // 2) Handle OAuth redirect
  useEffect(() => {
    const code = searchParams.get('code');
    const provider = searchParams.get('state')?.includes('microsoft') ? 'microsoft' : 'google';

    if (!code || !token) return;

    (async () => {
      try {
        setError('');
        console.log(`🔐 Processing ${provider} OAuth callback...`);

        // Call backend to exchange code for tokens
        const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/book/auth/${provider}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ code, bookingToken: token }),
        });

        if (!resp.ok) throw new Error('Calendar connection failed');

        const data = await resp.json();
        
        setGuestAuth({
          signedIn: true,
          hasCalendarAccess: data.hasCalendarAccess || false,
          provider: provider,
          email: data.email || '',
          name: data.name || '',
        });

        setFormData((prev) => ({
          ...prev,
          attendee_name: data.name || prev.attendee_name,
          attendee_email: data.email || prev.attendee_email,
        }));

        console.log(`✅ Guest authenticated via ${provider}`);

        navigate(`/book/${token}`, { replace: true });

        // Fetch slots with calendar access
        if (data.hasCalendarAccess) {
          await fetchAiSlots(token, true);
        }

        // Move to form
        setStep('form');
      } catch (err) {
        console.error('❌ OAuth failed:', err);
        setError('Unable to connect your calendar. Please try again.');
        setStep('calendar-choice');
      }
    })();
  }, [searchParams, token, navigate]);

  // 3) Fetch AI slots
  const fetchAiSlots = async (bookingToken, includeMutualAvailability = false) => {
    try {
      setStep('slots');

      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/suggest-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingToken,
          duration: 60,
          includeMutualAvailability,
        }),
      });

      if (!resp.ok) throw new Error('Failed to get AI slots');

      const data = await resp.json();
      const slots = data.slots || [];
      setAiSlots(slots);
      if (slots.length > 0) setSelectedSlot(slots[0]);

      console.log(`✅ Loaded ${slots.length} slots`);
      setStep('form'); // Back to form with slots loaded
    } catch (err) {
      console.error('❌ AI slot error:', err);
      setError('Failed to load slot suggestions.');
      setStep('form');
    }
  };

  // 4) Trigger OAuth (Google or Microsoft)
  const handleCalendarConnect = (provider) => {
    if (provider === 'google') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
     const redirectUri = `${window.location.origin}/oauth/callback`;
      const scope = 'openid email profile https://www.googleapis.com/auth/calendar.readonly';

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        access_type: 'offline',
        prompt: 'consent',
        state: `booking:${token}:google`,
      });

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (provider === 'microsoft') {
      // Microsoft OAuth flow (similar pattern)
      alert('Microsoft Calendar integration coming soon!');
      // TODO: Implement Microsoft OAuth
    }
  };

  // 5) Skip calendar connection
  const handleSkipConnection = () => {
    setStep('form');
  };

  // 6) Final submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot && aiSlots.length > 0) {
      setError('Please select a time slot.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await bookings.create({
        token,
        slot: selectedSlot || {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 3600000).toISOString(),
        },
        ...formData,
      });
      setStep('success');
    } catch (err) {
      console.error('❌ Booking error:', err);
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
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center animate-fadeIn">
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

  // C. UNIFIED Calendar Connection Choice Screen
  if (step === 'calendar-choice') {
    const hasExternalLink = memberInfo?.external_booking_link?.trim();

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 py-12 px-4">
        <div className="max-w-3xl mx-auto animate-fadeIn">
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
                {memberInfo?.name && (
                  <p className="text-gray-600">with {memberInfo.name}</p>
                )}
              </div>
            </div>
            <p className="text-gray-600 text-lg">
              Choose how you'd like to schedule your meeting
            </p>
          </div>

          {/* Unified Options Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Connect Your Calendar
            </h2>
            
            <div className="space-y-4">
              {/* Google Calendar - RECOMMENDED */}
              <button
                onClick={() => handleCalendarConnect('google')}
                className="w-full flex items-center justify-between p-6 border-2 border-green-300 bg-green-50 rounded-xl hover:border-green-500 hover:shadow-lg transition-all group text-left relative"
              >
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                    <Star className="h-3 w-3" />
                    RECOMMENDED
                  </span>
                </div>
                <div className="flex items-center gap-4 pr-32">
                  <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md">
                    <img
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google"
                      className="h-8 w-8"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">
                      Connect Google Calendar
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Get smart time suggestions based on both calendars
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Sparkles className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-green-700">
                        Best booking experience • Mutual availability
                      </span>
                    </div>
                  </div>
                </div>
                <svg
                  className="h-6 w-6 text-green-600 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {/* Microsoft Calendar */}
              <button
                onClick={() => handleCalendarConnect('microsoft')}
                disabled
                className="w-full flex items-center justify-between p-6 border-2 border-gray-200 bg-gray-50 rounded-xl opacity-60 cursor-not-allowed text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md">
                    <svg className="h-8 w-8" viewBox="0 0 23 23" fill="none">
                      <path d="M0 0h10.93v10.93H0z" fill="#F35325" />
                      <path d="M12.07 0H23v10.93H12.07z" fill="#81BC06" />
                      <path d="M0 12.07h10.93V23H0z" fill="#05A6F0" />
                      <path d="M12.07 12.07H23V23H12.07z" fill="#FFBA08" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">
                      Connect Microsoft Calendar
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Outlook, Office 365, and Microsoft 365 calendars
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500">
                        Coming soon
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Divider */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-medium">or</span>
                </div>
              </div>

              {/* External Link (if configured) */}
              {hasExternalLink && (
                <button
                  onClick={() => window.open(memberInfo.external_booking_link, '_blank')}
                  className="w-full flex items-center justify-between p-6 border-2 border-blue-200 bg-blue-50 rounded-xl hover:border-blue-400 hover:shadow-md transition-all group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                      <ExternalLink className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-lg">
                        Book via{' '}
                        {memberInfo.external_booking_platform === 'calendly'
                          ? 'Calendly'
                          : memberInfo.external_booking_platform === 'hubspot'
                          ? 'HubSpot'
                          : memberInfo.external_booking_platform === 'cal.com'
                          ? 'Cal.com'
                          : 'External Calendar'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Use our external booking platform (opens in new tab)
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-5 w-5 text-blue-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
              )}

              {/* Continue Without Connecting */}
              <button
                onClick={handleSkipConnection}
                className="w-full flex items-center justify-center gap-3 p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all text-gray-600 font-medium"
              >
                <span>Continue without connecting</span>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Benefits Section */}
            <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                ✨ Why connect your calendar?
              </p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Mutual availability:</strong> See only times that work for both of you
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Auto-fill details:</strong> Your name and email are prefilled automatically
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Privacy protected:</strong> We only see busy/free times, never event details
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // D. Main booking form (same as before, but simplified)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {teamInfo?.name || 'Schedule a Meeting'}
                </h1>
                {memberInfo?.name && (
                  <p className="text-gray-600">with {memberInfo.name}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setStep('calendar-choice')}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Change calendar
            </button>
          </div>

          {/* Connection Status */}
          {guestAuth.signedIn && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">
                  Connected via {guestAuth.provider === 'google' ? 'Google' : 'Microsoft'} Calendar as {guestAuth.name}
                </p>
                {guestAuth.hasCalendarAccess && (
                  <p className="text-xs text-green-700 mt-1">
                    Showing mutual available times ✨
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Rest of booking form - same as original */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Slots column */}
          <div className="bg-white rounded-3xl shadow-2xl p-6">
            {aiSlots.length === 0 ? (
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Select a Time</h3>
                <button
                  onClick={() => fetchAiSlots(token, guestAuth.hasCalendarAccess)}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-5 w-5" />
                  Get Time Suggestions
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">
                    {guestAuth.hasCalendarAccess ? '🎯 Mutually Available' : '⏰ Suggested Times'}
                  </h3>
                  <button
                    onClick={() => fetchAiSlots(token, guestAuth.hasCalendarAccess)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {aiSlots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        selectedSlot === slot
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-sm">
                        {new Date(slot.start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-gray-600">
                        {slot.startTime ||
                          new Date(slot.start).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                      </p>
                      {slot.match && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                          {(slot.match * 100).toFixed(0)}% match
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form column */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Information</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    disabled={guestAuth.signedIn}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                  />
                </div>
              </div>

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
                    disabled={guestAuth.signedIn}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                  />
                </div>
              </div>

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
                    rows="4"
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || (aiSlots.length > 0 && !selectedSlot)}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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