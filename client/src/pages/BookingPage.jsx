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
  Info,
  Shield,
  Zap,
  Globe,
  ArrowRight,
  X,
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  // ========== RENDER ==========

  // Loading screen
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading booking page...</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Unavailable</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Calendar connection choice screen
  if (step === 'calendar-choice') {
    const hasExternalLink = memberInfo?.external_booking_link?.trim();

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header Card */}
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 animate-fadeIn">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-2xl">
                  {memberInfo?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {memberInfo?.name || 'Schedule a Meeting'}
                </h1>
                <p className="text-gray-600">{teamInfo?.name || 'Book your time'}</p>
              </div>
              <div className="ml-auto bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                30 min
              </div>
            </div>
            {teamInfo?.description && (
              <p className="text-gray-600 mt-4 pl-20">{teamInfo.description}</p>
            )}
          </div>

          {/* Main Options Card */}
          <div className="bg-white rounded-3xl shadow-xl p-8 animate-fadeIn" style={{animationDelay: '0.1s'}}>
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                Choose Your Booking Method
              </h2>
            </div>
            
            <div className="space-y-4">
              {/* Google Calendar - RECOMMENDED */}
              <button
                onClick={() => handleCalendarConnect('google')}
                className="w-full relative group"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative flex items-center justify-between p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl hover:border-green-500 hover:shadow-lg transition-all text-left">
                  {/* Recommended Badge */}
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-bold rounded-full shadow-md">
                      <Star className="h-3 w-3 fill-white" />
                      RECOMMENDED
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 pr-32">
                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        className="h-8 w-8"
                      />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg mb-1">
                        Connect Google Calendar
                      </p>
                      <p className="text-sm text-gray-700 mb-2">
                        Smart scheduling with mutual availability
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/80 rounded-full text-xs font-medium text-green-700">
                          <Zap className="h-3 w-3" />
                          Instant booking
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/80 rounded-full text-xs font-medium text-green-700">
                          <Shield className="h-3 w-3" />
                          Privacy safe
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <ArrowRight className="h-6 w-6 text-green-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Microsoft Calendar */}
              <button
                onClick={() => handleCalendarConnect('microsoft')}
                disabled
                className="w-full relative opacity-60 cursor-not-allowed"
              >
                <div className="flex items-center justify-between p-6 bg-gray-50 border-2 border-gray-200 rounded-2xl text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <svg className="h-8 w-8" viewBox="0 0 23 23" fill="none">
                        <path d="M0 0h10.93v10.93H0z" fill="#F35325" />
                        <path d="M12.07 0H23v10.93H12.07z" fill="#81BC06" />
                        <path d="M0 12.07h10.93V23H0z" fill="#05A6F0" />
                        <path d="M12.07 12.07H23V23H12.07z" fill="#FFBA08" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg mb-1">
                        Microsoft Calendar
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        Outlook, Office 365 calendars
                      </p>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 rounded-full text-xs font-medium text-gray-600">
                        <Clock className="h-3 w-3" />
                        Coming soon
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Divider */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white text-gray-500 font-semibold text-sm">
                    or choose another option
                  </span>
                </div>
              </div>

              {/* External Link (Calendly, etc) */}
              {hasExternalLink && (
                <button
                  onClick={() => window.open(memberInfo.external_booking_link, '_blank')}
                  className="w-full group"
                >
                  <div className="flex items-center justify-between p-6 border-2 border-blue-200 bg-blue-50 rounded-2xl hover:border-blue-400 hover:shadow-md transition-all text-left">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                        <ExternalLink className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-lg mb-1">
                          Book via{' '}
                          {memberInfo.external_booking_platform === 'calendly'
                            ? 'Calendly'
                            : memberInfo.external_booking_platform === 'hubspot'
                            ? 'HubSpot'
                            : memberInfo.external_booking_platform === 'cal.com'
                            ? 'Cal.com'
                            : 'External Platform'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Opens in new tab • External scheduling
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-blue-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>
                </button>
              )}

              {/* Continue Without Connecting */}
              <button
                onClick={handleSkipConnection}
                className="w-full group"
              >
                <div className="flex items-center justify-center gap-3 p-5 border-2 border-dashed border-gray-300 rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-all">
                  <span className="font-medium text-gray-700">
                    Continue without calendar sync
                  </span>
                  <ArrowRight className="h-5 w-5 text-gray-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            {/* Benefits Section */}
            <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl border-2 border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <p className="text-sm font-bold text-gray-900">
                  Why connect your calendar?
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="flex flex-col items-start">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                    <Zap className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Mutual Availability
                  </p>
                  <p className="text-xs text-gray-600">
                    See only times that work for both of you
                  </p>
                </div>
                <div className="flex flex-col items-start">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Auto-fill Details
                  </p>
                  <p className="text-xs text-gray-600">
                    Name and email prefilled automatically
                  </p>
                </div>
                <div className="flex flex-col items-start">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                    <Shield className="h-5 w-5 text-purple-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Privacy Protected
                  </p>
                  <p className="text-xs text-gray-600">
                    Only see busy/free, never event details
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main booking form with SmartSlotPicker
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Sticky Header */}
      <div className="bg-white border-b-2 border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xl">
                  {memberInfo?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {memberInfo?.name || 'Schedule a Meeting'}
                </h1>
                <p className="text-sm text-gray-600">{teamInfo?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                30 min
              </div>
              
              {guestAuth.signedIn && (
                <button
                  onClick={() => {
                    clearGuestAuth();
                    setStep('calendar-choice');
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Change calendar
                </button>
              )}
            </div>
          </div>

          {/* Connection Status Banner */}
          {guestAuth.signedIn && (
            <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-900 flex-1">
                <span className="font-semibold">Connected via {guestAuth.provider === 'google' ? 'Google' : 'Microsoft'}</span>
                {' • '}{guestAuth.name}
                {guestAuth.hasCalendarAccess && ' • Showing mutual available times ✨'}
              </p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <Info className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-900 flex-1">{error}</p>
              <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left Sidebar - Progress & Info */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6 sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Booking Progress
              </h3>
              
              {/* Step Indicators */}
              <div className="space-y-4">
                {/* Step 1 - Select Time */}
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedSlot ? 'bg-green-500' : 'bg-blue-600'
                  }`}>
                    {selectedSlot ? (
                      <CheckCircle className="h-5 w-5 text-white" />
                    ) : (
                      <span className="text-white font-bold text-sm">1</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Select Time</p>
                    {selectedSlot ? (
                      <div className="text-sm text-gray-600 mt-1">
                        <p className="font-medium">{formatDate(selectedSlot.start)}</p>
                        <p>{formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">Choose an available slot</p>
                    )}
                  </div>
                </div>
                
                {/* Step 2 - Enter Details */}
                <div className={`flex items-start gap-3 ${selectedSlot ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selectedSlot ? 'bg-blue-600' : 'bg-gray-200'
                  }`}>
                    <span className="text-white font-bold text-sm">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Your Details</p>
                    <p className="text-sm text-gray-600">Complete the form</p>
                  </div>
                </div>
                
                {/* Step 3 - Confirm */}
                <div className={`flex items-start gap-3 ${selectedSlot && formData.attendee_name && formData.attendee_email ? 'opacity-100' : 'opacity-40'}`}>
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Confirm</p>
                    <p className="text-sm text-gray-600">Finalize your booking</p>
                  </div>
                </div>
              </div>
              
              {/* Additional Info */}
              {teamInfo?.description && (
                <div className="mt-6 pt-6 border-t-2 border-gray-200">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {teamInfo.description}
                  </p>
                </div>
              )}

              {/* Calendar Connection Info */}
              {guestAuth.hasCalendarAccess && (
                <div className="mt-6 pt-6 border-t-2 border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-semibold text-gray-900">
                      Smart Scheduling Active
                    </p>
                  </div>
                  <p className="text-xs text-gray-600">
                    Times shown are available for both you and {memberInfo?.name}. 
                    We never see your event details - only busy/free times.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Content - Slot Picker & Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Smart Slot Picker */}
            <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Select a Time
              </h3>
              
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

            {/* Booking Form */}
            {selectedSlot && (
              <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6 animate-fadeIn">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-600" />
                  Your Information
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={formData.attendee_name}
                        onChange={(e) =>
                          setFormData({ ...formData, attendee_name: e.target.value })
                        }
                        disabled={guestAuth.signedIn}
                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={formData.attendee_email}
                        onChange={(e) =>
                          setFormData({ ...formData, attendee_email: e.target.value })
                        }
                        disabled={guestAuth.signedIn}
                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <textarea
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        rows="3"
                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none resize-none transition-all"
                        placeholder="Anything you'd like to share about the meeting?"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !selectedSlot}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      <>
                        Confirm Booking
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}