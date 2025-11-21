import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, User, Mail, MessageSquare, Check, ArrowLeft, 
  Loader2, AlertCircle, ExternalLink, Globe, CreditCard, DollarSign
} from 'lucide-react';
import api from '../utils/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '../components/PaymentForm';
// BUILD_TIMESTAMP: 2025-11-21-07:00-FINAL
import { useState, useEffect } from 'react';


export default function Book() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [bookingCreated, setBookingCreated] = useState(false);
  const [error, setError] = useState(null);
  
  // Payment states
  const [pricingInfo, setPricingInfo] = useState(null);
  useEffect(() => {
  console.log('🔍 PRICING INFO:', pricingInfo);
}, [pricingInfo]);
  const [showPayment, setShowPayment] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);

  useEffect(() => {
    if (token) {
      loadBookingData();
      loadPricingInfo();
    }
  }, [token]);

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

      // Load Stripe if payment required
      if (data.paymentRequired && data.price > 0) {
        const configResponse = await fetch('/api/payments/config');
        const config = await configResponse.json();
        setStripePromise(loadStripe(config.publishableKey));
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    setPaymentIntentId(paymentIntentId);
    
    try {
      setSubmitting(true);
      
      // Create booking with payment
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

    // Check if payment required
    if (pricingInfo?.paymentRequired && pricingInfo?.price > 0) {
      setShowPayment(true);
      return;
    }

    // Free booking - proceed as normal
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

  const getCurrencySymbol = (currency) => {
    const symbols = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      AUD: 'A$',
      CAD: 'C$',
      SGD: 'S$',
      PHP: '?',
      JPY: '¥',
      INR: '?',
    };
    return symbols[currency] || currency;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border-2 border-red-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Page Not Found</h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
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
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Check className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 text-center mb-3">
            {pricingInfo?.paymentRequired ? 'Payment Successful!' : 'Booking Confirmed!'}
          </h2>
          <p className="text-gray-600 text-center mb-6 text-lg">
            {pricingInfo?.paymentRequired 
              ? 'Your payment has been processed and your booking is confirmed.'
              : 'Your booking has been confirmed successfully.'}
          </p>
          
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border-2 border-blue-200">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Booking Details
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-semibold text-gray-900">
                  {selectedSlot && new Date(selectedSlot.start).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="font-semibold text-gray-900">
                  {selectedSlot && new Date(selectedSlot.start).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
              {pricingInfo?.paymentRequired && (
                <div className="flex justify-between pt-3 border-t">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-bold text-green-600 text-lg">
                    {getCurrencySymbol(pricingInfo.currency)}{pricingInfo.price.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-gray-900 mb-1">Check Your Email</p>
                <p className="text-gray-700">
                  A confirmation email with calendar invite has been sent to <strong>{formData.email}</strong>
                  {pricingInfo?.paymentRequired && ' along with your payment receipt.'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!bookingData) {
    return null;
  }

  // Check if using external booking link
  if (bookingData?.member?.external_booking_link) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border-2 border-blue-200">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ExternalLink className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            Redirecting to Booking Page
          </h2>
          <p className="text-gray-600 text-center mb-6">
            This member uses {bookingData.member.external_booking_platform || 'an external platform'} for bookings.
          </p>
          
            href={bookingData.member.external_booking_link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="h-5 w-5" />
            Continue to Booking
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg flex-shrink-0">
              {bookingData.member.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-black text-gray-900">
                Book with {bookingData.member.name || 'Team Member'}
              </h1>
              <p className="text-gray-600 mt-1">{bookingData.team.name}</p>
              {bookingData.team.description && (
                <p className="text-gray-500 text-sm mt-2">{bookingData.team.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Pricing Banner */}
        {pricingInfo?.paymentRequired && pricingInfo?.price > 0 && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 mb-6 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm opacity-90">Session Price</p>
                  <p className="text-3xl font-black">
                    {getCurrencySymbol(pricingInfo.currency)}{pricingInfo.price.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm opacity-90 mb-1">
                  <CreditCard className="h-4 w-4" />
                  <span>Payment Required</span>
                </div>
                <p className="text-xs opacity-75">Secure checkout with Stripe</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - Slot Selection */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-6 w-6 text-blue-600" />
              Select a Time
            </h2>
            
            {selectedSlot ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">Selected Time</h3>
                    <button
                      onClick={() => setSelectedSlot(null)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                    >
                      Change
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">
                        {new Date(selectedSlot.start).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">
                        {new Date(selectedSlot.start).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-2">No time selected</p>
                <p className="text-sm text-gray-500">
                  Time slot selection will be available in the next update
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Booking Form */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-6 w-6 text-purple-600" />
              Your Information
            </h2>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                  rows="3"
                  placeholder="Any special requests or topics to discuss..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedSlot}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : pricingInfo?.paymentRequired && pricingInfo?.price > 0 ? (
                  <>
                    <CreditCard className="h-5 w-5" />
                    Pay {getCurrencySymbol(pricingInfo.currency)}{pricingInfo.price.toFixed(2)} & Confirm
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Confirm Booking
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && pricingInfo && stripePromise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white">Complete Payment</h2>
              <p className="text-blue-100 text-sm mt-1">Secure payment to confirm your booking</p>
            </div>
            
            <div className="p-6">
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
        </div>
      )}
    </div>
  );
}