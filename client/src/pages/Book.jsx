
// BUILD VERSION: 2024-11-22-PURPLE-UI-FORCE
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, User, Mail, MessageSquare, Check, ArrowLeft, 
  Loader2, AlertCircle, ExternalLink, CheckCircle2, Phone, Sparkles,
  ArrowRight, CreditCard, DollarSign
} from 'lucide-react';
import api from '../utils/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '../components/PaymentForm';

export default function Book() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingCreated, setBookingCreated] = useState(false);
  const [error, setError] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // OAuth states
  const [guestEmail, setGuestEmail] = useState('');
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [guestAccessToken, setGuestAccessToken] = useState(null);
  
  // Payment states
  const [pricingInfo, setPricingInfo] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    if (token) {
      loadBookingData();
      loadPricingInfo();
    }
  }, [token]);

  useEffect(() => {
    if (bookingData && !loadingSlots) {
      loadAvailableSlots();
    }
  }, [bookingData, guestAccessToken]);

  const loadBookingData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/book/${token}`);
      setBookingData(response.data.data);
    } catch (error) {
      console.error('Error loading booking data:', error);
      setError('Failed to load booking page. Invalid or expired link.');
    } finally {
      setLoading(false);
    }
  };

  const loadPricingInfo = async () => {
    try {
      const response = await fetch(`/api/book/${token}/pricing`);
      const data = await response.json();
      setPricingInfo(data);

      if (data.paymentRequired && data.price > 0) {
        const configResponse = await fetch('/api/payments/config');
        const config = await configResponse.json();
        setStripePromise(loadStripe(config.publishableKey));
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    }
  };

  const loadAvailableSlots = async () => {
    try {
      setLoadingSlots(true);
      const response = await api.post(`/book/${token}/slots-with-status`, {
        guestAccessToken: guestAccessToken,
        guestRefreshToken: null,
        duration: 30,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      setAvailableSlots(response.data.slots || {});
      
      // Auto-select first available date
      const dates = Object.keys(response.data.slots || {});
      if (dates.length > 0 && !selectedDate) {
        setSelectedDate(dates[0]);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    try {
      setSubmitting(true);
      
      const response = await api.post('/api/payments/confirm-booking', {
        paymentIntentId,
        bookingToken: token,
        slot: selectedSlot,
        attendeeName: formData.name,
        attendeeEmail: formData.email,
        notes: formData.notes,
      });

      if (response.data.success) {
        setBookingCreated(true);
        setShowPayment(false);
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Failed to create booking after payment. Please contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    if (!selectedSlot || !agreedToTerms) {
      alert('Please select a time slot and agree to terms');
      return;
    }

    if (pricingInfo?.paymentRequired && pricingInfo?.price > 0) {
      setShowPayment(true);
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post('/api/bookings', {
        token,
        slot: selectedSlot,
        attendee_name: formData.name,
        attendee_email: formData.email,
        notes: formData.notes,
      });

      if (response.data.success) {
        setBookingCreated(true);
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  // Get available dates from slots
  const availableDates = Object.keys(availableSlots).slice(0, 7).map(dateKey => {
    const date = new Date(availableSlots[dateKey][0]?.start);
    return {
      key: dateKey,
      label: dateKey.split(',')[0],
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' })
    };
  });

  const getCurrencySymbol = (currency) => {
    const symbols = {
      USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$'
    };
    return symbols[currency] || currency;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border-2 border-red-200">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Page Not Found</h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (bookingCreated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full border-2 border-green-200">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">
            Booking Confirmed!
          </h2>
          <p className="text-gray-600 text-center mb-6">
            Check your email for confirmation and calendar invite.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!bookingData) return null;

  // External booking redirect
  if (bookingData?.member?.external_booking_link) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <ExternalLink className="h-12 w-12 text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            External Booking
          </h2>
          <p className="text-gray-600 text-center mb-6">
            This member uses {bookingData.member.external_booking_platform} for bookings.
          </p>
          
            href={bookingData.member.external_booking_link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            Continue to Booking
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="space-y-6">
          
          {/* Header Card */}
          <div className="bg-white rounded-2xl shadow-sm border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                {bookingData.member.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-gray-900 text-xl font-bold">{bookingData.member.name}</h2>
                  {pricingInfo?.paymentRequired && (
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Premium
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-3">{bookingData.team.name}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>30 min</span>
                  {pricingInfo?.paymentRequired && (
                    <>
                      <span>•</span>
                      <span className="text-purple-600 font-semibold">
                        {getCurrencySymbol(pricingInfo.currency)}{pricingInfo.price}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {availableDates.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-green-900 mb-1 font-semibold">Availability Confirmed</h3>
                  <p className="text-green-700 text-sm">
                    {hasCalendarAccess 
                      ? "Great! We found times that work for both calendars."
                      : "Multiple time slots are available for booking."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Date Selection */}
          <div className="bg-white rounded-2xl shadow-sm border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-purple-600" />
              <h3 className="text-gray-900 font-bold">Select a Date</h3>
            </div>
            
            {loadingSlots ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">Loading available dates...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {availableDates.map((date) => (
                  <button
                    key={date.key}
                    onClick={() => setSelectedDate(date.key)}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      selectedDate === date.key
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                    }`}
                  >
                    <div className={`text-2xl mb-1 font-bold ${
                      selectedDate === date.key ? 'text-purple-600' : 'text-gray-900'
                    }`}>
                      {date.day}
                    </div>
                    <div className={`text-xs ${
                      selectedDate === date.key ? 'text-purple-600' : 'text-gray-600'
                    }`}>
                      {date.label}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time Selection */}
          {selectedDate && availableSlots[selectedDate] && (
            <div className="bg-white rounded-2xl shadow-sm border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <h3 className="text-gray-900 font-bold">Available Times</h3>
                </div>
                <span className="text-xs bg-gray-100 px-3 py-1 rounded-full">
                  {availableSlots[selectedDate].filter(s => s.status === 'available').length} slots
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2">
                {availableSlots[selectedDate].map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => slot.status === 'available' && setSelectedSlot(slot)}
                    disabled={slot.status !== 'available'}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      slot.status !== 'available'
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : selectedSlot === slot
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 hover:border-green-400 hover:bg-green-50/50'
                    }`}
                  >
                    <div className={`mb-1 font-semibold ${
                      slot.status !== 'available'
                        ? 'text-gray-400'
                        : selectedSlot === slot
                        ? 'text-green-700'
                        : 'text-gray-900'
                    }`}>
                      {slot.time}
                    </div>
                    {slot.matchScore && slot.status === 'available' && (
                      <div className={`text-xs ${
                        slot.matchScore >= 80 ? 'text-green-600' :
                        slot.matchScore >= 60 ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {slot.matchLabel}
                      </div>
                    )}
                    {slot.status !== 'available' && (
                      <div className="text-xs text-gray-400">
                        {slot.details || 'Unavailable'}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contact Form */}
          <div className="bg-white rounded-2xl shadow-sm border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-purple-600" />
              <h3 className="text-gray-900 font-bold">Your Information</h3>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-medium">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-medium">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-medium">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-medium">Additional Notes</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <textarea
                    placeholder="Any specific topics or questions?"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none min-h-24 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="terms" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                  I agree to the terms and conditions. I will receive a confirmation email after booking.
                </label>
              </div>

              <button
                type="submit"
                disabled={!selectedSlot || !agreedToTerms || submitting}
                className="w-full h-14 bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 hover:from-purple-600 hover:via-purple-700 hover:to-pink-600 text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : pricingInfo?.paymentRequired ? (
                  <>
                    Pay {getCurrencySymbol(pricingInfo.currency)}{pricingInfo.price} & Book
                    <ArrowRight className="h-5 w-5" />
                  </>
                ) : (
                  <>
                    Schedule Booking
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              🔒 Your information is secure and will never be shared
            </p>
            <p className="text-xs text-gray-500">
              Powered by ScheduleSync
            </p>
          </div>
        </div>
      </div>

      {/* Payment Modal - Keep existing */}
      {showPayment && pricingInfo && stripePromise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full">
            <Elements stripe={stripePromise}>
              <PaymentForm
                amount={pricingInfo.price}
                currency={pricingInfo.currency}
                onPaymentSuccess={handlePaymentSuccess}
                onCancel={() => setShowPayment(false)}
                bookingDetails={{
                  token,
                  slot: selectedSlot,
                  attendee_name: formData.name,
                  attendee_email: formData.email,
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