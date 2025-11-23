// client/src/pages/BookingPage.jsx

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar, User, Mail, MessageSquare, CheckCircle, Loader2, Clock,
  Sparkles, Shield, Zap, ArrowRight, Star, Check, DollarSign, CreditCard
} from 'lucide-react';

// ✅ FIX: Import oauth helper
import { bookings, payments, oauth } from '../utils/api'; 
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

  // ✅ FIX: Updated OAuth handling
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    // Only process if this is a guest booking OAuth callback
    if (!code || !state?.startsWith('guest-booking:') || !token || hasProcessedOAuth) {
      return;
    }

    console.log('✅ Starting guest OAuth processing...');
    setHasProcessedOAuth(true);

    (async () => {
      try {
        setError('');
        console.log('🔐 Processing guest Google OAuth callback...');

        // ✅ FIX: Use oauth helper instead of direct api.post
        const response = await oauth.guestGoogleAuth(code, token);
        const data = response.data;
        
        console.log('✅ Guest OAuth response:', data);

        const authData = {
          signedIn: true,
          hasCalendarAccess: data.hasCalendarAccess || false,
          provider: 'google',
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

        // Clean up URL
        navigate(`/book/${token}`, { replace: true });
        setStep('form');
      } catch (err) {
        console.error('❌ Guest OAuth failed:', err);
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
      console.log('📥 Booking info loaded:', response.data);

      const payload = response.data?.data || response.data || {};

      if (!payload.team || !payload.member) {
        throw new Error('Missing team or member information');
      }

      setTeamInfo(payload.team);
      setMemberInfo(payload.member);
    } catch (err) {
      console.error('❌ Error loading booking info:', err);
      setError(err.response?.data?.error || 'Invalid booking link');
      setTeamInfo(null);
      setMemberInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const loadPricingInfo = async () => {
    try {
      const response = await payments.getPricing(token);
      const data = response.data;
      
      console.log('💰 Pricing info loaded:', data);
      setPricingInfo(data);

      // Load Stripe if payment is required
      if (data.paymentRequired && data.price > 0) {
        const configResponse = await payments.getConfig();
        const config = configResponse.data;
        setStripePromise(loadStripe(config.publishableKey));
        console.log('💳 Stripe initialized');
      }
    } catch (error) {
      console.error('⚠️ Error loading pricing:', error);
      // Don't block the booking flow if pricing fails
      setPricingInfo({ paymentRequired: false, price: 0, currency: 'USD' });
    }
  };

  const getCurrencySymbol = (currency) => {
    const symbols = {
      USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$',
      SGD: 'S$', PHP: '₱', JPY: '¥', INR: '₹',
    };
    return symbols[currency] || currency;
  };

  // ✅ FIX: Updated redirect URI to avoid conflict with organizer OAuth
  const handleCalendarConnect = (provider) => {
    if (provider === 'google') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      // ✅ Redirect back to THIS booking page, not /oauth/callback
      const redirectUri = `${window.location.origin}/book/${token}`;
      const scope = 'openid email profile https://www.googleapis.com/auth/calendar.readonly';

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        access_type: 'offline',
        prompt: 'select_account',
        // ✅ Use different state prefix to distinguish from organizer OAuth
        state: `guest-booking:${token}:google`,
      });

      console.log('🔐 Initiating guest calendar OAuth...');
      console.log('📍 Redirect URI:', redirectUri);
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (provider === 'microsoft') {
      alert('Microsoft Calendar integration coming soon!');
    }
  };

  const handleSkipCalendar = () => {
    setStep('form');
  };

  const handleSlotSelected = (slot) => {
    console.log('✅ Slot selected:', slot);
    setSelectedSlot(slot);
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    setPaymentIntentId(paymentIntentId);
    
    try {
      setSubmitting(true);
      
      const response = await payments.confirmBooking(
        paymentIntentId,
        token,
        selectedSlot,
        formData.attendee_name,
        formData.attendee_email,
        formData.notes
      );

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

    if (!selectedSlot) {
      alert('Please select a time slot');
      return;
    }

    if (!formData.attendee_name || !formData.attendee_email) {
      alert('Please fill in all required fields');
      return;
    }

    // If payment is required, show payment modal
    if (pricingInfo?.paymentRequired && pricingInfo?.price > 0) {
      console.log('💳 Payment required, showing payment modal');
      setShowPayment(true);
      return;
    }

    // Free booking - create directly
    try {
      setSubmitting(true);
      
      const response = await bookings.create({
        token,
        slot: selectedSlot,
        attendee_name: formData.attendee_name,
        attendee_email: formData.attendee_email,
        notes: formData.notes,
      });

      console.log('✅ Booking created:', response.data);

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

      const dataParam = encodeURIComponent(JSON.stringify(bookingData));
      navigate(`/booking-confirmation?data=${dataParam}`);

    } catch (err) {
      console.error('❌ Booking creation failed:', err);
      alert(err.response?.data?.error || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ... rest of the component (loading states, error states, JSX) stays the same ...