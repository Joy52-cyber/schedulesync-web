import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, CreditCard, Lock, AlertCircle, CheckCircle } from 'lucide-react';

export default function PaymentForm({ 
  amount, 
  currency, 
  onPaymentSuccess, 
  onCancel,
  bookingDetails 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    AUD: 'A$',
    CAD: 'C$',
    SGD: 'S$',
    PHP: '₱',
    JPY: '¥',
    INR: '₹',
  };

  const symbol = currencySymbols[currency] || currency;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent on backend
      const intentResponse = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingToken: bookingDetails.token,
          attendeeName: bookingDetails.attendee_name,
          attendeeEmail: bookingDetails.attendee_email,
        }),
      });

      if (!intentResponse.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret } = await intentResponse.json();

      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: bookingDetails.attendee_name,
              email: bookingDetails.attendee_email,
            },
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent.status === 'succeeded') {
        // Payment successful, call success handler
        onPaymentSuccess(paymentIntent.id);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        '::placeholder': {
          color: '#9ca3af',
        },
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      invalid: {
        color: '#ef4444',
      },
    },
  };

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Amount Display */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Amount to Pay</p>
            <p className="text-4xl font-black text-gray-900">
              {symbol}{amount.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2 uppercase tracking-wide">
              {currency}
            </p>
          </div>
        </div>

        {/* Booking Summary */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Booking Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-semibold text-gray-900">{bookingDetails.attendee_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-semibold text-gray-900">{bookingDetails.attendee_email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span className="font-semibold text-gray-900">
                {new Date(bookingDetails.slot.start).toLocaleDateString('en-US', {
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
                {new Date(bookingDetails.slot.start).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Card Input */}
        <div className="bg-white rounded-xl border-2 border-gray-300 p-5">
          <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Card Information
          </label>
          <div className="p-4 border-2 border-gray-200 rounded-lg bg-gray-50">
            <CardElement options={cardElementOptions} />
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <Lock className="h-4 w-4" />
            <span>Secured by Stripe • Your payment information is encrypted</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 text-sm">Payment Error</p>
              <p className="text-red-800 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!stripe || processing}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                Pay {symbol}{amount.toFixed(2)}
              </>
            )}
          </button>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="4" width="22" height="16" rx="2" fill="#635BFF"/>
              <text x="12" y="14" fill="white" fontSize="8" fontWeight="bold" textAnchor="middle">stripe</text>
            </svg>
            <span>Powered by Stripe</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Lock className="h-4 w-4" />
            <span>256-bit SSL</span>
          </div>
        </div>
      </form>
    </div>
  );
}