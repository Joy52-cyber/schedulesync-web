import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

// Initialize Stripe
let stripePromise;

const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

// Payment Form Component
const SubscriptionPaymentForm = ({ plan, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);

    try {
      // Create subscription on your backend
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          plan: plan.id
        })
      });

      const { client_secret, subscription_id } = await response.json();

      // Confirm payment
      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
        }
      });

      if (result.error) {
        setError(result.error.message);
      } else {
        // Payment successful!
        onSuccess(subscription_id);
      }
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-lg">{plan.name} Plan</h3>
        <p className="text-2xl font-bold text-blue-600">${plan.price}/month</p>
        <p className="text-sm text-gray-600">{plan.description}</p>
      </div>

      <div className="p-4 border border-gray-300 rounded-md">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
          }}
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm p-3 bg-red-50 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || isLoading}
          className={`flex-1 py-3 px-4 rounded-md font-medium ${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isLoading ? 'Processing...' : `Subscribe for $${plan.price}/month`}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// Main Pricing Component
const PricingModal = ({ isOpen, onClose, currentPlan = 'free' }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      description: '3 ChatGPT queries per month',
      features: ['3 ChatGPT queries/month', '25 bookings/month', 'Email support'],
      color: 'gray'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 15,
      description: 'Unlimited ChatGPT + advanced features',
      features: ['Unlimited ChatGPT queries', '500 bookings/month', '5 team members', 'Priority support'],
      color: 'blue',
      popular: true
    },
    {
      id: 'team',
      name: 'Team', 
      price: 45,
      description: 'Everything in Pro + unlimited team',
      features: ['Everything in Pro', 'Unlimited bookings', 'Unlimited team members', 'White-label options'],
      color: 'purple'
    }
  ];

  const handlePlanSelect = (plan) => {
    if (plan.id === 'free') {
      // Handle downgrade to free
      handleDowngrade();
    } else {
      setSelectedPlan(plan);
      setShowPayment(true);
    }
  };

  const handleDowngrade = async () => {
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        window.location.reload(); // Refresh to show updated plan
      }
    } catch (error) {
      console.error('Downgrade failed:', error);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    onClose();
    window.location.reload(); // Refresh to show new plan
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {!showPayment ? (
          // Plans Selection
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Choose Your Plan</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">×</button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div 
                  key={plan.id}
                  className={`relative p-6 border-2 rounded-lg ${
                    plan.popular ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  } ${currentPlan === plan.id ? 'ring-2 ring-green-500' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {currentPlan === plan.id && (
                    <div className="absolute -top-3 right-4">
                      <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    {plan.price > 0 && <span className="text-gray-600">/month</span>}
                  </div>
                  <p className="text-gray-600 mb-4">{plan.description}</p>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <span className="text-green-500 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handlePlanSelect(plan)}
                    disabled={currentPlan === plan.id}
                    className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
                      currentPlan === plan.id
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : plan.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-800 text-white hover:bg-gray-900'
                    }`}
                  >
                    {currentPlan === plan.id ? 'Current Plan' : 
                     plan.id === 'free' ? 'Downgrade' : 'Upgrade'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Payment Form
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Complete Your Upgrade</h2>
              <button onClick={() => setShowPayment(false)} className="text-gray-500 hover:text-gray-700 text-xl">←</button>
            </div>

            <Elements stripe={getStripe()}>
              <SubscriptionPaymentForm
                plan={selectedPlan}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowPayment(false)}
              />
            </Elements>
          </div>
        )}
      </div>
    </div>
  );
};

export default PricingModal;