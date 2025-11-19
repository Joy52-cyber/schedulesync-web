import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  User,
  Mail,
  MessageSquare,
  CheckCircle,
  Loader2,
  Sparkles,
  ExternalLink,
  Star,
  Clock,
} from 'lucide-react';
import { bookings } from '../utils/api';
import SmartSlotPicker from '../components/SmartSlotPicker';

export default function BookingPageUnified() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ========== STATE ==========
  const [step, setStep] = useState('loading');
  const [teamInfo, setTeamInfo] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [guestAuth, setGuestAuth] = useState({
    signedIn: false,
    hasCalendarAccess: false,
    provider: null,
    email: '',
    name: '',
    accessToken: '',
    refreshToken: '',
  });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [formData, setFormData] = useState({
    attendee_name: '',
    attendee_email: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasProcessedOAuth, setHasProcessedOAuth] = useState(false);

  // ========== PERSISTENCE HELPERS ==========

  const saveGuestAuth = (authData) => {
    try {
      sessionStorage.setItem(`guestAuth_${token}`, JSON.stringify(authData));
      setGuestAuth(authData);
    } catch (err) {
      console.error('Failed to save guest auth:', err);
      setGuestAuth(authData);
    }
  };

  const loadGuestAuth = () => {
    try {
      const saved = sessionStorage.getItem(`guestAuth_${token}`);
      if (saved) {
        const authData = JSON.parse(saved);
        console.log('✅ Restored guest auth from session:', authData.email);
        setGuestAuth(authData);
        
        setFormData((prev) => ({
          ...prev,
          attendee_name: authData.name || prev.attendee_name,
          attendee_email: authData.email || prev.attendee_email,
        }));
        
        return authData;
      }
    } catch (err) {
      console.error('Failed to load guest auth:', err);
    }
    return null;
  };

  const clearGuestAuth = () => {
    try {
      sessionStorage.removeItem(`guestAuth_${token}`);
    } catch (err) {
      console.error('Failed to clear guest auth:', err);
    }
    setGuestAuth({
      signedIn: false,
      hasCalendarAccess: false,
      provider: null,
      email: '',
      name: '',
      accessToken: '',
      refreshToken: '',
    });
  };

  // ========== EFFECTS ==========

  // Load booking context on mount
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await bookings.getByToken(token);
        const { team, member } = res.data || {};

        setTeamInfo(team || null);
        setMemberInfo(member || null);
        
        const savedAuth = loadGuestAuth();
        
        if (savedAuth && savedAuth.signedIn) {
          console.log('✅ User already authenticated, going to form');
          setStep('form');
        } else {
          setStep('calendar-choice');
        }
      } catch (err) {
        console.error('❌ Error fetching team info:', err);
        setError('Invalid or expired booking link.');
        setStep('error');
      }
    })();
  }, [token]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    console.log('🔍 OAuth check:', { code: !!code, state, hasProcessedOAuth });
    
    if (!code || !state?.startsWith('booking:') || !token || hasProcessedOAuth) {
      return;
    }

    console.log('✅ Starting OAuth processing...');
    setHasProcessedOAuth(true);

    (async () => {
      try {
        setError('');
        const provider = state.includes('microsoft') ? 'microsoft' : 'google';
        console.log(`🔐 Processing ${provider} OAuth callback...`);

        const url = `${import.meta.env.VITE_API_URL}/book/auth/${provider}`;

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ code, bookingToken: token }),
        });

        if (!resp.ok) {
          const errorData = await resp.json();
          console.error('❌ OAuth API error:', errorData);
          throw new Error(errorData.error || 'Calendar connection failed');
        }

        const data = await resp.json();
        console.log('✅ OAuth response:', data);

        const authData = {
          signedIn: true,
          hasCalendarAccess: data.hasCalendarAccess || false,
          provider: provider,
          email: data.email || '',
          name: data.name || '',
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
        
        saveGuestAuth(authData);

        setFormData((prev) => ({
          ...prev,
          attendee_name: data.name || prev.attendee_name,
          attendee_email: data.email || prev.attendee_email,
        }));

        navigate(`/book/${token}`, { replace: true });
        setStep('form');
      } catch (err) {
        console.error('❌ OAuth failed:', err);
        setError('Unable to connect your calendar. Please try again.');
        setHasProcessedOAuth(false);
        setStep('calendar-choice');
      }
    })();
  }, [searchParams, token, navigate, hasProcessedOAuth]);

  // ========== HANDLER FUNCTIONS ==========

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
      alert('Microsoft Calendar integration coming soon!');
    }
  };

  const handleSkipConnection = () => {
    setStep('form');
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!selectedSlot) {
    setError('Please select a time slot.');
    return;
  }

  setSubmitting(true);
  setError('');

  try {
    const response = await bookings.create({
      token,
      slot: selectedSlot,
      ...formData,
    });
    
    // Prepare booking data for confirmation page
    const bookingInfo = {
      id: response.data?.booking?.id || Date.now(),
      start_time: selectedSlot.start,
      end_time: selectedSlot.end,
      attendee_name: formData.attendee_name,
      attendee_email: formData.attendee_email,
      notes: formData.notes,
      organizer_name: memberInfo?.name,
      organizer_email: memberInfo?.email,
      booking_token: token,
      team_name: teamInfo?.name
    };
    
    // Redirect to confirmation page
    const encodedData = encodeURIComponent(JSON.stringify(bookingInfo));
    window.location.href = `/booking-confirmation?data=${encodedData}`;
    
  } catch (err) {
    console.error('❌ Booking error:', err);
    setError('Failed to create booking. Please try again.');
    setSubmitting(false);
  }
};

  // ========== RENDER ==========

  // Loading screen
  /*if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading booking page...</p>
        </div>
      </div>
    );
  }

  // Success screen
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
                {selectedSlot.time || new Date(selectedSlot.start).toLocaleTimeString([], {
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
  */

  // Calendar connection choice screen
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

          {/* Options Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Connect Your Calendar
            </h2>
            
            <div className="space-y-4">
              {/* Google Calendar */}
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

              {/* External Link */}
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

  // Main booking form
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
            {guestAuth.signedIn && (
              <button
                onClick={() => {
                  clearGuestAuth();
                  setStep('calendar-choice');
                }}
                className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Change calendar
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Connection Status */}
        {guestAuth.signedIn && (
          <div className="bg-white rounded-3xl shadow-2xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
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
              <button
                onClick={() => {
                  clearGuestAuth();
                  setStep('calendar-choice');
                }}
                className="text-xs text-gray-500 hover:text-gray-700 underline ml-4"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Slots and Form Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* SMART SLOT PICKER - Left Column */}
          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <SmartSlotPicker
              bookingToken={token}
              guestCalendar={guestAuth.hasCalendarAccess ? {
                accessToken: guestAuth.accessToken,
                refreshToken: guestAuth.refreshToken
              } : null}
              onSlotSelected={(slot) => {
                setSelectedSlot(slot);
                console.log('✅ Slot selected:', slot);
              }}
            />
          </div>

          {/* Form Column - Right */}
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
                disabled={submitting || !selectedSlot}
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