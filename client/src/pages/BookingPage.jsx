import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  User,
  Mail,
  MessageSquare,
  CheckCircle,
  Loader2,
  Clock,
  Sparkles,
  Shield,
  Zap,
  ArrowRight,
  Star,
  Check,
} from 'lucide-react';
import { bookings } from '../utils/api';
import SmartSlotPicker from '../components/SmartSlotPicker';

export default function BookingPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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

  if (!selectedSlot) return;

  if (!formData.attendee_name || !formData.attendee_email) {
    alert('Please fill in all required fields');
    return;
  }

  try {
    setSubmitting(true);
    
    const response = await bookings.create({
      token,
      slot: selectedSlot,
      attendee_name: formData.attendee_name,
      attendee_email: formData.attendee_email,
      notes: formData.notes,
    });

    // Prepare booking data for confirmation page
    const bookingData = {
      id: response.data.booking.id,
      start_time: selectedSlot.start,
      end_time: selectedSlot.end,
      attendee_name: formData.attendee_name,
      attendee_email: formData.attendee_email,
      organizer_name: memberInfo?.name,
      team_name: teamInfo?.name,
      notes: formData.notes,
      meet_link: response.data.booking.meet_link || null,
      booking_token: response.data.booking.booking_token || token,
    };

    // Pass as URL parameter (required by BookingConfirmation component)
    const dataParam = encodeURIComponent(JSON.stringify(bookingData));
    navigate(`/booking-confirmation?data=${dataParam}`);

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
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-600" />
          </div>
          <p className="text-gray-600 font-medium">Loading your booking page...</p>
        </div>
      </div>
    );
  }

  if (error && !teamInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">😕</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Booking Link</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-semibold"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Premium Header */}
        <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl"></div>
          
          <div className="relative p-8">
            <div className="flex items-start gap-6 mb-4">
              {/* Avatar with Ring */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-30"></div>
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-3xl">
                    {memberInfo?.name?.[0]?.toUpperCase() || teamInfo?.name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900 truncate">
                    {memberInfo?.name || teamInfo?.name || 'Schedule a Meeting'}
                  </h1>
                  <div className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 flex-shrink-0">
                    <Clock className="h-4 w-4" />
                    30 min
                  </div>
                </div>
                <p className="text-gray-600 mb-3">{teamInfo?.name}</p>
                
                {teamInfo?.description && (
                  <p className="text-gray-700 leading-relaxed">{teamInfo.description}</p>
                )}
              </div>
            </div>

            {/* Calendar Connection Badge */}
            {guestCalendar?.signedIn && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-green-900 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Calendar Connected
                    </p>
                    <p className="text-sm text-green-700">
                      {guestCalendar.name} • Showing mutual availability
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Calendar Choice Step */}
        {step === 'calendar-choice' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Why Connect Section */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl shadow-xl p-8 text-white">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-7 w-7" />
                <h2 className="text-2xl font-bold">Get Smart Scheduling</h2>
              </div>
              <p className="text-blue-50 mb-6">
                Connect your calendar to automatically find times that work for both of you
              </p>
              
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <Zap className="h-8 w-8 mb-2" />
                  <p className="font-semibold mb-1">Instant Booking</p>
                  <p className="text-sm text-blue-100">See mutual free times instantly</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <Shield className="h-8 w-8 mb-2" />
                  <p className="font-semibold mb-1">Privacy First</p>
                  <p className="text-sm text-blue-100">We only see busy/free, never details</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <User className="h-8 w-8 mb-2" />
                  <p className="font-semibold mb-1">Auto-fill Info</p>
                  <p className="text-sm text-blue-100">Your details filled automatically</p>
                </div>
              </div>
            </div>

            {/* Connection Options */}
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Choose Connection Method</h3>
              
              <div className="space-y-4">
                {/* Google Calendar - Featured */}
                <button
                  onClick={() => handleCalendarConnect('google')}
                  className="w-full group relative"
                >
                  {/* Glow Effect */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl opacity-20 group-hover:opacity-30 blur transition-opacity"></div>
                  
                  <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-5 group-hover:border-green-500 group-hover:shadow-lg transition-all">
                    {/* Recommended Badge */}
                    <div className="absolute top-4 right-4">
                      <span className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-bold rounded-full shadow-md">
                        <Star className="h-3 w-3 fill-white" />
                        RECOMMENDED
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                        <img
                          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                          alt="Google"
                          className="h-8 w-8"
                        />
                      </div>
                      
                      <div className="flex-1 text-left">
                        <p className="font-bold text-gray-900 text-lg mb-1">
                          Connect Google Calendar
                        </p>
                        <p className="text-sm text-gray-700 mb-3">
                          Smart scheduling with mutual availability detection
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs font-medium text-green-700 shadow-sm">
                            <Zap className="h-3 w-3" />
                            Instant
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs font-medium text-green-700 shadow-sm">
                            <Shield className="h-3 w-3" />
                            Secure
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs font-medium text-green-700 shadow-sm">
                            <Check className="h-3 w-3" />
                            No event details shared
                          </span>
                        </div>
                      </div>
                      
                      <ArrowRight className="h-6 w-6 text-green-600 group-hover:translate-x-2 transition-transform flex-shrink-0" />
                    </div>
                  </div>
                </button>

                {/* Divider */}
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-gray-500 font-semibold">or</span>
                  </div>
                </div>

                {/* Skip Option */}
                <button
                  onClick={handleSkipCalendar}
                  className="w-full group"
                >
                  <div className="flex items-center justify-center gap-3 p-5 border-2 border-dashed border-gray-300 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                    <span className="font-semibold text-gray-700 group-hover:text-blue-700 transition-colors">
                      Continue without calendar sync
                    </span>
                    <ArrowRight className="h-5 w-5 text-gray-500 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              </div>

              {/* Trust Badge */}
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-600 text-center flex items-center justify-center gap-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  Your calendar data is encrypted and never stored on our servers
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Step */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
            {/* Time Selection with Progress */}
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedSlot ? 'bg-green-500' : 'bg-blue-600'} shadow-lg`}>
                    {selectedSlot ? (
                      <CheckCircle className="h-6 w-6 text-white" />
                    ) : (
                      <span className="text-white font-bold">1</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="h-6 w-6 text-blue-600" />
                      Select Your Time
                    </h2>
                    <p className="text-sm text-gray-600">
                      {selectedSlot ? 'Time selected! Continue below' : 'Choose an available slot'}
                    </p>
                  </div>
                </div>
              </div>

              <SmartSlotPicker
                bookingToken={token}
                guestCalendar={guestCalendar}
                onSlotSelected={handleSlotSelected}
              />
            </div>

            {/* Guest Information */}
            {selectedSlot && (
              <div className="bg-white rounded-3xl shadow-xl p-8 animate-slideUp">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold">2</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <User className="h-6 w-6 text-purple-600" />
                      Your Information
                    </h2>
                    <p className="text-sm text-gray-600">Almost there! Just need a few details</p>
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl opacity-0 group-focus-within:opacity-10 blur transition-opacity"></div>
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      <input
                        type="text"
                        required
                        value={formData.attendee_name}
                        onChange={(e) => setFormData({ ...formData, attendee_name: e.target.value })}
                        placeholder="John Doe"
                        className="relative w-full pl-12 pr-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl opacity-0 group-focus-within:opacity-10 blur transition-opacity"></div>
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      <input
                        type="email"
                        required
                        value={formData.attendee_email}
                        onChange={(e) => setFormData({ ...formData, attendee_email: e.target.value })}
                        placeholder="john@example.com"
                        className="relative w-full pl-12 pr-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl opacity-0 group-focus-within:opacity-10 blur transition-opacity"></div>
                      <MessageSquare className="absolute left-4 top-4 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows="4"
                        placeholder="Any specific topics or questions you'd like to discuss?"
                        className="relative w-full pl-12 pr-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none resize-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Premium Submit Button */}
            {selectedSlot && (
              <div className="relative animate-slideUp">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl opacity-30 blur-xl"></div>
                
                <button
                  type="submit"
                  disabled={submitting}
                  className="relative w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white px-8 py-5 rounded-2xl text-lg font-bold hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center justify-center gap-3"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>Confirming Your Booking...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-6 w-6" />
                      <span>Confirm Booking</span>
                      <ArrowRight className="h-6 w-6" />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}