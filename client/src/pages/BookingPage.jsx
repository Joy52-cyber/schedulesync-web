import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, User, Mail, MessageSquare, Loader2, CheckCircle, Globe } from 'lucide-react';
import SmartSlotPicker from '../components/SmartSlotPicker';
import { bookings } from '../utils/api';

export default function BookingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teamInfo, setTeamInfo] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [error, setError] = useState('');
  
  const [step, setStep] = useState('calendar-choice');
  const [guestCalendar, setGuestCalendar] = useState(null);
  const [hasProcessedOAuth, setHasProcessedOAuth] = useState(false);
  
  const [formData, setFormData] = useState({
    attendee_name: '',
    attendee_email: '',
    notes: '',
  });
  
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    loadBookingInfo();
  }, [token]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
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

        const url = `${import.meta.env.VITE_API_URL}/api/book/auth/${provider}`;

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
        
        setGuestCalendar(authData);

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

  const loadBookingInfo = async () => {
    try {
      setLoading(true);
      const response = await bookings.getByToken(token);
      setTeamInfo(response.data.data.team);
      setMemberInfo(response.data.data.member);
    } catch (err) {
      console.error('Error loading booking info:', err);
      setError('Invalid booking link');
    } finally {
      setLoading(false);
    }
  };

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
        prompt: 'select_account',
        state: `booking:${token}:google`,
      });

      console.log('🔐 Initiating guest calendar OAuth...');
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (provider === 'microsoft') {
      alert('Microsoft Calendar integration coming soon!');
    }
  };

  const handleSkipCalendar = () => {
    setStep('form');
  };

  const handleSlotSelected = (slot) => {
    console.log('Slot selected:', slot);
    setSelectedSlot(slot);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedSlot) {
      alert('Please select a time slot');
      return;
    }

    if (!formData.attendee_name || !formData.attendee_email) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      
      await bookings.create({
        token,
        slot: selectedSlot,
        attendee_name: formData.attendee_name,
        attendee_email: formData.attendee_email,
        notes: formData.notes,
      });

      navigate('/booking-confirmation', {
        state: {
          booking: {
            ...selectedSlot,
            attendee_name: formData.attendee_name,
            team_name: teamInfo?.name,
            member_name: memberInfo?.name,
          }
        }
      });
    } catch (err) {
      console.error('Error creating booking:', err);
      alert(err.response?.data?.error || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-blue-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (error && !teamInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center">
          <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">😕</div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm sm:text-base font-medium min-h-[44px]"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-12">
        
        {/* Header Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 mb-4">
            {/* Avatar */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl sm:text-2xl lg:text-3xl">
                {memberInfo?.name?.[0]?.toUpperCase() || teamInfo?.name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>

            {/* Info */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
                {memberInfo?.name || teamInfo?.name || 'Schedule a Meeting'}
              </h1>
              <p className="text-sm sm:text-base text-gray-600">{teamInfo?.name}</p>
              {teamInfo?.description && (
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{teamInfo.description}</p>
              )}
            </div>

            {/* Duration Badge */}
            <div className="bg-blue-100 text-blue-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              30 min
            </div>
          </div>

          {/* Calendar Connection Status */}
          {guestCalendar?.signedIn && (
            <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-green-900 truncate">
                  ✅ Connected via {guestCalendar.provider === 'google' ? 'Google' : 'Microsoft'} • {guestCalendar.email}
                </p>
                <p className="text-[10px] sm:text-xs text-green-700">
                  Showing mutual available times ✨
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Calendar Choice Step */}
        {step === 'calendar-choice' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 text-center sm:text-left">
                Connect Your Calendar (Optional)
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6 text-center sm:text-left">
                Get smart scheduling by checking your availability automatically
              </p>

              <div className="space-y-3 sm:space-y-4">
                {/* Google Calendar */}
                <button
                  onClick={() => handleCalendarConnect('google')}
                  className="w-full group"
                >
                  <div className="flex flex-col sm:flex-row items-center justify-between p-3 sm:p-4 lg:p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg sm:rounded-xl lg:rounded-2xl hover:border-green-500 hover:shadow-lg active:shadow-xl transition-all min-h-[80px] sm:min-h-0">
                    <div className="flex items-center gap-3 sm:gap-4 text-center sm:text-left mb-3 sm:mb-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                        <Globe className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg">
                          Connect Google Calendar
                        </p>
                        <p className="text-xs sm:text-sm text-gray-700 mt-0.5">
                          Smart scheduling with mutual availability
                        </p>
                      </div>
                    </div>
                    <div className="bg-green-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold group-hover:bg-green-700 transition-colors">
                      Connect
                    </div>
                  </div>
                </button>

                {/* Skip */}
                <button
                  onClick={handleSkipCalendar}
                  className="w-full p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border-2 border-gray-300 rounded-lg sm:rounded-xl transition-all min-h-[44px]"
                >
                  <p className="text-sm sm:text-base font-semibold text-gray-700">
                    Continue without calendar
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    You'll see all available times
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Step */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Time Selection */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
                Select a Time
              </h2>

              <SmartSlotPicker
                bookingToken={token}
                guestCalendar={guestCalendar}
                onSlotSelected={handleSlotSelected}
              />
            </div>

            {/* Guest Information */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <User className="h-5 w-5 sm:h-6 sm:w-6" />
                Your Information
              </h2>

              <div className="space-y-3 sm:space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={formData.attendee_name}
                      onChange={(e) => setFormData({ ...formData, attendee_name: e.target.value })}
                      placeholder="John Doe"
                      className="w-full pl-9 sm:pl-10 pr-3 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={formData.attendee_email}
                      onChange={(e) => setFormData({ ...formData, attendee_email: e.target.value })}
                      placeholder="john@example.com"
                      className="w-full pl-9 sm:pl-10 pr-3 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Additional Notes (Optional)
                  </label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows="3"
                      placeholder="Any specific topics or questions?"
                      className="w-full pl-9 sm:pl-10 pr-3 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none resize-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="sticky bottom-0 bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-t-4 border-blue-500">
              <button
                type="submit"
                disabled={!selectedSlot || submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 sm:py-4 rounded-lg sm:rounded-xl text-base sm:text-lg font-bold hover:from-blue-700 hover:to-purple-700 active:from-blue-800 active:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 sm:gap-3 min-h-[52px] sm:min-h-[56px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                    Confirm Booking
                  </>
                )}
              </button>

              {!selectedSlot && (
                <p className="text-xs sm:text-sm text-center text-gray-500 mt-2 sm:mt-3">
                  Please select a time slot to continue
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}