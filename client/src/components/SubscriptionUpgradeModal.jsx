import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// Payment Form Component
const PaymentForm = ({ plan, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create subscription
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ plan_id: plan.id })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Confirm payment with Stripe
      const cardElement = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(data.client_secret, {
        payment_method: { card: cardElement }
      });

      if (result.error) {
        setError(result.error.message);
      } else {
        onSuccess(plan);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 border border-gray-300 rounded-lg">
        <CardElement options={{
          style: {
            base: { fontSize: '16px', color: '#374151' }
          }
        }} />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || loading}
          className={`flex-1 py-3 px-4 rounded-lg font-medium ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? 'Processing...' : `Pay $${plan.price}/month`}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// Main Upgrade Modal Component
const SubscriptionUpgradeModal = ({ isOpen, onClose, onSuccess, currentTier = 'free' }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [step, setStep] = useState('select'); // 'select' or 'payment'

  const plans = [
    {
      id: 'pro',
      name: 'Pro',
      price: 12,
      description: 'Perfect for individuals',
      features: [
        '🤖 UNLIMITED ChatGPT queries',
        '📅 Unlimited bookings',
        '🔗 Unlimited booking links',
        '⚡ AI optimization',
        '📞 Priority support'
      ],
      color: 'blue',
      popular: true
    },
    {
      id: 'team',
      name: 'Team', 
      price: 25,
      description: 'Best for organizations',
      features: [
        '✅ Everything in Pro',
        '👥 Unlimited team members',
        '🔄 Round-robin scheduling',
        '📊 Admin dashboard',
        '☎️ Phone support'
      ],
      color: 'purple',
      popular: false
    }
  ];

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setStep('payment');
  };

  const handlePaymentSuccess = (plan) => {
    setStep('select');
    setSelectedPlan(null);
    onClose();
    
    // Call the success handler passed from parent
    if (onSuccess) {
      onSuccess(plan);
    }
  };

  const handleBack = () => {
    setStep('select');
    setSelectedPlan(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {step === 'select' ? 'Upgrade Your Plan' : `Subscribe to ${selectedPlan?.name}`}
              </h2>
              <p className="text-gray-600 mt-1">
                {step === 'select' 
                  ? 'Unlock unlimited ChatGPT and advanced features'
                  : 'Complete your payment to upgrade'
                }
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'select' ? (
            
            /* Plan Selection */
            <div className="grid md:grid-cols-2 gap-6">
              {plans.map((plan) => (
                <div 
                  key={plan.id}
                  className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
                    plan.popular 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handlePlanSelect(plan)}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-6 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      ${plan.price}<span className="text-lg text-gray-500">/month</span>
                    </div>
                    <p className="text-gray-600 text-sm">{plan.description}</p>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <span className="text-green-500 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button className={`w-full py-3 rounded-lg font-medium ${
                    plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}>
                    Choose {plan.name}
                  </button>
                </div>
              ))}
            </div>

          ) : (
            
            /* Payment Step */
            <div className="max-w-md mx-auto">
              <button 
                onClick={handleBack}
                className="mb-4 text-blue-600 hover:text-blue-700 text-sm"
              >
                ← Back to plans
              </button>

              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
                <h3 className="font-bold text-lg">{selectedPlan.name} Plan</h3>
                <div className="text-2xl font-bold text-gray-900">
                  ${selectedPlan.price}/month
                </div>
                <p className="text-sm text-gray-600">{selectedPlan.description}</p>
              </div>

              <Elements stripe={stripePromise}>
                <PaymentForm 
                  plan={selectedPlan}
                  onSuccess={handlePaymentSuccess}
                  onCancel={handleBack}
                />
              </Elements>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t text-center">
          <p className="text-xs text-gray-500">
            💳 Secure payment powered by Stripe • Cancel anytime • 30-day money-back guarantee
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionUpgradeModal;