import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar, User, Mail, MessageSquare, CheckCircle, Loader2, Clock,
  Sparkles, Shield, Zap, ArrowRight, Star, Check, DollarSign, CreditCard
} from 'lucide-react';
// Import the centralized API helper
import { bookings, payments, api } from '../utils/api'; 
import SmartSlotPicker from '../components/SmartSlotPicker';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '../components/PaymentForm';

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

  // Payment states
  const [pricingInfo, setPricingInfo] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);

  useEffect(() => {
    loadBookingInfo();
    loadPricingInfo();
  }, [token]);

  // --- OAUTH HANDLING ---
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

        // USE API HELPER HERE (Avoids double /api issues)
        const response = await api.post(`/book/auth/${provider}`, { 
            code, 
            bookingToken: token 
        });

        const data = response.data;
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
      console.log('📥 Booking info raw response:', response.data);

      const payload = response.data?.data || response.data || {};

      if (!payload.team || !payload.member) {
        throw new Error('Missing team or member in booking payload');
      }

      setTeamInfo(payload.team);
      setMemberInfo(payload.member);
    } catch (err) {
      console.error('Error loading booking info:', err);
      setError('Invalid booking link');
      setTeamInfo(null);
      setMemberInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const loadPricingInfo = async () => {
    try {
      // USE API HELPER
      const response = await payments.getPricing(token);
      const data = response.data;
      
      console.log('💰 Pricing info loaded:', data);
      setPricingInfo(data);

      if (data.paymentRequired && data.price > 0) {
        // USE API HELPER
        const configResponse = await payments.getConfig();
        const config = configResponse.data;
        setStripePromise(loadStripe(config.publishableKey));
        console.log('💳 Stripe loaded for payment');
      }
    } catch (error) {
      console.error('❌ Error loading pricing:', error);
    }
  };

  const getCurrencySymbol = (currency) => {
    const symbols = {
      USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$',
      SGD: 'S$', PHP: '₱', JPY: '¥', INR: '₹',
    };
    return symbols[currency] || currency;
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

  const handlePaymentSuccess = async (paymentIntentId) => {
    setPaymentIntentId(paymentIntentId);
    
    try {
      setSubmitting(true);
      
      // USE API HELPER
      const response = await payments.confirmBooking({
        paymentIntentId,
        bookingToken: token,
        slot: selectedSlot,
        attendeeName: formData.attendee_name,
        attendeeEmail: formData.attendee_email,
        notes: formData.notes,
      });

      const data = response.data;

      if (data.success) {
        console.log('✅ Paid booking created successfully');
        setShowPayment(false);

        const bookingData = {
          id: data.booking?.id,
          start_time: selectedSlot.start,
          end_time: selectedSlot.end,
          attendee_name: formData.attendee_name,
          attendee_email: formData.attendee_email,
          organizer_name: memberInfo?.name,
          team_name: teamInfo?.name,
          notes: formData.notes,
          payment_amount: pricingInfo.price,
          payment_currency: pricingInfo.currency,
          payment_receipt_url: data.booking?.payment_receipt_url,
        };

        const dataParam = encodeURIComponent(JSON.stringify(bookingData));
        navigate(`/booking-confirmation?data=${dataParam}`);
      } else {
        throw new Error('Payment processed but booking failed');
      }
    } catch (error) {
      console.error('❌ Post-payment booking error:', error);
      alert('Payment successful but booking creation failed. Please contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedSlot) return;

    if (!formData.attendee_name || !formData.attendee_email) {
      alert('Please fill in all required fields');
      return;
    }

    if (pricingInfo?.paymentRequired && pricingInfo?.price > 0) {
      console.log('💳 Payment required, showing payment modal');
      setShowPayment(true);
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

      console.log('🔍 Full API response:', response);

      const bookingData = {
        id: response.data.booking?.id,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        attendee_name: formData.attendee_name,
        attendee_email: formData.attendee_email,
        organizer_name: memberInfo?.name,
        team_name: teamInfo?.name,
        notes: formData.notes,
        meet_link: response.data.booking?.meet_link || null,
        booking_token: response.data.booking?.booking_token || token,
      };

      console.log('📦 Booking data being passed:', bookingData);

      const dataParam = encodeURIComponent(JSON.stringify(bookingData));
      navigate(`/booking-confirmation?data=${dataParam}`);

    } catch (err) {
      console.error('❌ Full error:', err);
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
        {/* Header / Banner Section */}
        <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5"></div>
          <div className="relative p-8">
            <div className="flex items-start gap-6 mb-4">
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg text-white font-bold text-3xl">
                {memberInfo?.name?.[0]?.toUpperCase() || teamInfo?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-gray-900 truncate">
                  {memberInfo?.name || teamInfo?.name || 'Schedule a Meeting'}
                </h1>
                <p className="text-gray-600 mb-3">{teamInfo?.name}</p>
                {teamInfo?.description && <p className="text-gray-700">{teamInfo.description}</p>}
              </div>
            </div>
            
            {guestCalendar?.signedIn && (
              <div className="bg-green-50 border-green-200 border p-3 rounded-lg flex items-center gap-3 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <span>Calendar Connected: {guestCalendar.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Banner */}
        {pricingInfo?.paymentRequired && pricingInfo?.price > 0 && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl shadow-xl p-6 mb-6 text-white flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl"><DollarSign className="h-8 w-8" /></div>
              <div>
                <p className="text-sm opacity-90">Session Price</p>
                <p className="text-3xl font-black">{getCurrencySymbol(pricingInfo.currency)}{pricingInfo.price.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end"><CreditCard className="h-4 w-4" /> Payment Required</div>
              <p className="text-xs opacity-75">Secure checkout with Stripe</p>
            </div>
          </div>
        )}

        {/* Step 1: Calendar Choice */}
        {step === 'calendar-choice' && (
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <h2 className="text-2xl font-bold mb-6">Sync Your Calendar</h2>
            <p className="text-gray-600 mb-6">Connect your Google Calendar to see conflicting times automatically.</p>
            
            <button onClick={() => handleCalendarConnect('google')} className="w-full p-4 border-2 border-blue-100 hover:border-blue-500 rounded-xl flex items-center gap-4 transition-all mb-4 group">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-8 w-8" />
              <div className="text-left">
                <p className="font-bold text-gray-900 group-hover:text-blue-600">Connect Google Calendar</p>
                <p className="text-sm text-gray-500">Recommended for best availability</p>
              </div>
              <ArrowRight className="ml-auto text-gray-300 group-hover:text-blue-600" />
            </button>

            <button onClick={handleSkipCalendar} className="w-full p-4 text-gray-500 font-semibold hover:text-gray-800">
              Skip and continue without syncing
            </button>
          </div>
        )}

        {/* Step 2: Form & Slot Picker */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Calendar className="text-blue-600" /> Select a Time
              </h2>
              <SmartSlotPicker
                bookingToken={token}
                guestCalendar={guestCalendar}
                onSlotSelected={handleSlotSelected}
              />
            </div>

            {selectedSlot && (
              <div className="bg-white rounded-3xl shadow-xl p-8 animate-slideUp">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <User className="text-purple-600" /> Your Details
                </h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={formData.attendee_name}
                    onChange={(e) => setFormData({ ...formData, attendee_name: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email Address"
                    value={formData.attendee_email}
                    onChange={(e) => setFormData({ ...formData, attendee_email: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                  />
                  <textarea
                    rows="3"
                    placeholder="Additional Notes (Optional)"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            )}

            {selectedSlot && (
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-5 rounded-2xl text-lg font-bold hover:shadow-xl transition-all flex justify-center items-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" /> : (pricingInfo?.paymentRequired ? 'Pay & Confirm' : 'Confirm Booking')}
              </button>
            )}
          </form>
        )}
      </div>

      {/* Payment Modal */}
      {showPayment && pricingInfo && stripePromise && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <Elements stripe={stripePromise}>
              <PaymentForm
                amount={pricingInfo.price}
                currency={pricingInfo.currency}
                onPaymentSuccess={handlePaymentSuccess}
                onCancel={() => setShowPayment(false)}
                bookingDetails={{
                  token,
                  slot: selectedSlot,
                  attendee_name: formData.attendee_name,
                  attendee_email: formData.attendee_email,
                  notes: formData.notes,
                }}
              />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
}