import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, CreditCard, Lock, AlertCircle, Sparkles, TestTube } from 'lucide-react';

export default function SubscriptionPaymentForm({ 
  plan, 
  onSuccess, 
  onCancel 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe is not loaded. Please refresh the page.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      console.log('🚀 Creating subscription for plan:', plan.id);

      // 1. Create subscription on backend
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ plan_id: plan.id })
      });

      const data = await response.json();
      console.log('💻 Backend response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Subscription creation failed');
      }

      // 2. Handle payment confirmation
      if (data.client_secret && data.client_secret !== 'simulated_success') {
        console.log('💳 Processing Stripe payment...');
        
        const cardElement = elements.getElement(CardElement);
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
          data.client_secret,
          {
            payment_method: {
              card: cardElement,
              billing_details: {
                name: 'Subscription User', // You can get real name from user data
              },
            },
          }
        );

        if (stripeError) {
          throw new Error(stripeError.message);
        }

        if (paymentIntent.status === 'succeeded') {
          console.log('✅ Payment successful!');
          onSuccess(plan);
        }
      } else {
        // Simulated success for testing
        console.log('🧪 Simulated payment success');
        onSuccess(plan);
      }

    } catch (err) {
      console.error('❌ Subscription error:', err);
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        '::placeholder': { color: '#9ca3af' },
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      invalid: { color: '#ef4444' },
    },
    hidePostalCode: false,
  };

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Plan Summary */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-blue-900">{plan.name} Plan</h3>
            </div>
            <p className="text-3xl font-black text-gray-900 mb-1">
              ${plan.price}<span className="text-lg text-gray-600">/month</span>
            </p>
            <p className="text-sm text-gray-600">{plan.description}</p>
          </div>
        </div>

        {/* Features Summary */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-3 text-sm">What you'll get:</h4>
          <ul className="space-y-1">
            {plan.features.slice(0, 3).map((feature, index) => (
              <li key={index} className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-2 text-xs">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* ✅ ADDED: Test Mode Notice */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TestTube className="h-4 w-4 text-yellow-600" />
            <span className="text-yellow-800 font-bold text-sm">Test Mode Active</span>
          </div>
          <p className="text-yellow-800 text-sm font-medium mb-1">This is a demo payment form</p>
          <div className="text-yellow-700 text-xs space-y-1">
            <p>Use test card: <span className="font-mono bg-yellow-100 px-2 py-1 rounded">4242 4242 4242 4242</span></p>
            <p>Expiry: Any future date | CVC: Any 3 digits</p>
          </div>
        </div>

        {/* Card Input */}
        <div className="bg-white rounded-xl border-2 border-gray-300 p-5">
          <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Payment Information
          </label>
          <div className="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 min-h-[50px] flex items-center">
            <CardElement 
              options={cardElementOptions} 
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <Lock className="h-4 w-4" />
            <span>Secured by Stripe • Cancel anytime</span>
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

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!stripe || processing}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                Pay ${plan.price}/month
              </>
            )}
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="text-center pt-4 border-t">
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Lock className="h-4 w-4" />
              <span>SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Powered by Stripe</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💳 30-day money-back guarantee • Cancel anytime
          </p>
        </div>
      </form>
    </div>
  );
}