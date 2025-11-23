import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar, User, Mail, MessageSquare, CheckCircle, Loader2, Clock,
  Sparkles, Shield, Zap, ArrowRight, Star, Check, DollarSign, CreditCard,
  ExternalLink
} from 'lucide-react';
// Import the centralized API helper
import { bookings, payments, oauth, api } from '../utils/api';
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
  const [redirecting, setRedirecting] = useState(false); // ✅ New state for redirect
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
  const [pricingInfo, setPricingInfo] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);

  useEffect(() => {
    loadBookingInfo();
  }, [token]);

  // --- OAUTH HANDLING ---
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code || !state?.startsWith('guest-booking:') || !token || hasProcessedOAuth) {
      return;
    }

    console.log('✅ Starting guest OAuth processing...');
    setHasProcessedOAuth(true);

    (async () => {
      try {
        setError('');
        console.log('🔐 Processing guest Google OAuth callback...');
        const response = await oauth.guestGoogleAuth(code, token);
        const data = response.data;
        
        setGuestCalendar({
          signedIn: true,
          hasCalendarAccess: data.hasCalendarAccess || false,
          provider: 'google',
          email: data.email || '',
          name: data.name || '',
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        setFormData((prev) => ({
          ...prev,
          attendee_name: data.name || prev.attendee_name,
          attendee_email: data.email || prev.attendee_email,
        }));

        navigate(`/book/${token}`, { replace: true });
        setStep('form');
      } catch (err) {
        console.error('❌ Guest OAuth failed:', err);
        setHasProcessedOAuth(false);
      }
    })();
  }, [searchParams, token, navigate, hasProcessedOAuth]);

  const loadBookingInfo = async () => {
    try {
      setLoading(true);
      const response = await bookings.getByToken(token);
      console.log('📥 Booking info loaded:', response.data);

      const payload = response.data?.data || response.data || {};

      if (!payload.team || !payload.member) {
        throw new Error('Missing team or member information');
      }

      // ✅ LOGIC FIX: Handle External Links
      if (payload.member.external_booking_link) {
        console.log('🔀 External link detected. Redirecting to:', payload.member.external_booking_link);
        setRedirecting(true);
        setMemberInfo(payload.member); // Set member info to show "Redirecting..." UI
        
        // Small delay for UX so they see what's happening
        setTimeout(() => {
          window.location.href = payload.member.external_booking_link;
        }, 1500);
        return;
      }

      setTeamInfo(payload.team);
      setMemberInfo(payload.member);
      
      // Only load pricing if NOT redirecting
      loadPricingInfo();

    } catch (err) {
      console.error('❌ Error loading booking info:', err);
      setError(err.response?.data?.error || 'Invalid booking link');
      setTeamInfo(null);
      setMemberInfo(null);
    } finally {
      // If we are redirecting, keep loading state effectively "true" (or handle via redirecting state)
      // to prevent flashing the normal UI
      setLoading(false);
    }
  };

  const loadPricingInfo = async () => {
    try {
      const response = await payments.getPricing(token);
      const data = response.data;
      setPricingInfo(data);

      if (data.paymentRequired && data.price > 0) {
        const configResponse = await payments.getConfig();
        const config = configResponse.data;
        setStripePromise(loadStripe(config.publishableKey));
      }
    } catch (error) {
      console.error('⚠️ Error loading pricing:', error);
      setPricingInfo({ paymentRequired: false, price: 0, currency: 'USD' });
    }
  };

  const getCurrencySymbol = (currency) => {
    const symbols = { USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', PHP: '₱', JPY: '¥', INR: '₹' };
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
        state: `guest-booking:${token}:google`,
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
  };

  const handleSkipCalendar = () => setStep('form');
  const handleSlotSelected = (slot) => setSelectedSlot(slot);

  const handlePaymentSuccess = async (paymentIntentId) => {
    setPaymentIntentId(paymentIntentId);
    try {
      setSubmitting(true);
      const response = await payments.confirmBooking(
        paymentIntentId, token, selectedSlot, 
        formData.attendee_name, formData.attendee_email, formData.notes
      );
      if (response.data.success) {
        navigateBookingSuccess(response.data.booking);
      }
    } catch (error) {
      alert('Payment successful but booking creation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return alert('Please select a time slot');
    
    if (pricingInfo?.paymentRequired && pricingInfo?.price > 0) {
      setShowPayment(true);
      return;
    }

    try {
      setSubmitting(true);
      const response = await bookings.create({
        token, slot: selectedSlot, ...formData
      });
      navigateBookingSuccess(response.data.booking);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const navigateBookingSuccess = (booking) => {
     const bookingData = {
        id: booking?.id,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        attendee_name: formData.attendee_name,
        attendee_email: formData.attendee_email,
        organizer_name: memberInfo?.name,
        team_name: teamInfo?.name,
        notes: formData.notes,
        meet_link: booking?.meet_link || null,
        booking_token: booking?.booking_token || token,
      };
      const dataParam = encodeURIComponent(JSON.stringify(bookingData));
      navigate(`/booking-confirmation?data=${dataParam}`);
  };

  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            {redirecting ? <ExternalLink className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-600" /> : <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-600" />}
          </div>
          <p className="text-gray-900 font-bold text-lg">
            {redirecting ? `Redirecting to ${memberInfo?.name}'s calendar...` : 'Loading...'}
          </p>
          {redirecting && <p className="text-gray-500 text-sm mt-2">Please wait while we take you to the booking page.</p>}
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5"></div>
          <div className="relative p-8">
            <div className="flex items-start gap-6 mb-4">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-30"></div>
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-3xl">
                    {memberInfo?.name?.[0]?.toUpperCase() || teamInfo?.name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>

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
                {teamInfo?.description && <p className="text-gray-700 leading-relaxed">{teamInfo.description}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Banner */}
        {pricingInfo?.paymentRequired && pricingInfo?.price > 0 && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl shadow-xl p-6 sm:p-8 mb-6 text-white">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm opacity-90 mb-1">Session Price</p>
                  <p className="text-3xl sm:text-4xl font-black">
                    {getCurrencySymbol(pricingInfo.currency)}{pricingInfo.price.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-end gap-2 text-sm opacity-90 mb-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-semibold">Payment Required</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Steps */}
        {step === 'calendar-choice' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Choose Connection Method</h3>
              <div className="space-y-4">
                <button onClick={() => handleCalendarConnect('google')} className="w-full group relative">
                   <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl opacity-20 group-hover:opacity-30 blur transition-opacity"></div>
                   <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-5 group-hover:border-green-500 transition-all flex items-center gap-4">
                      <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-8 w-8" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-gray-900 text-lg">Connect Google Calendar</p>
                        <p className="text-sm text-gray-700">Check conflicts automatically</p>
                      </div>
                      <ArrowRight className="h-6 w-6 text-green-600" />
                   </div>
                </button>
                <button onClick={handleSkipCalendar} className="w-full group">
                  <div className="flex items-center justify-center gap-3 p-5 border-2 border-dashed border-gray-300 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                    <span className="font-semibold text-gray-700">Continue without calendar sync</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-600" /> Select a Time
              </h2>
              <SmartSlotPicker bookingToken={token} guestCalendar={guestCalendar} onSlotSelected={handleSlotSelected} />
            </div>

            {selectedSlot && (
              <div className="bg-white rounded-3xl shadow-xl p-8 animate-slideUp">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <User className="h-6 w-6 text-purple-600" /> Your Information
                </h2>
                <div className="space-y-5">
                   <input type="text" required value={formData.attendee_name} onChange={(e) => setFormData({ ...formData, attendee_name: e.target.value })} placeholder="Full Name" className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" />
                   <input type="email" required value={formData.attendee_email} onChange={(e) => setFormData({ ...formData, attendee_email: e.target.value })} placeholder="Email Address" className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" />
                   <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="4" placeholder="Notes (Optional)" className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" />
                </div>
              </div>
            )}

            {selectedSlot && (
              <div className="relative animate-slideUp">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl opacity-30 blur-xl"></div>
                <button type="submit" disabled={submitting} className="relative w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white px-8 py-5 rounded-2xl text-lg font-bold hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
                   {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : (pricingInfo?.paymentRequired ? 'Pay & Confirm' : 'Confirm Booking')}
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {showPayment && pricingInfo && stripePromise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
             <Elements stripe={stripePromise}>
                <PaymentForm amount={pricingInfo.price} currency={pricingInfo.currency} onPaymentSuccess={handlePaymentSuccess} onCancel={() => setShowPayment(false)} bookingDetails={{ token, slot: selectedSlot, ...formData }} />
             </Elements>
          </div>
        </div>
      )}
    </div>
  );
}