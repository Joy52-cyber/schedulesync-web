
import React, { useState, useEffect } from 'react';
import SubscriptionUpgradeModal from './SubscriptionUpgradeModal';

const SubscriptionSettings = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/subscriptions/current', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ADDED: Handle upgrade success
  const handleUpgradeSuccess = (plan) => {
    setShowUpgradeModal(false);
    fetchSubscription(); // Refresh subscription data
    alert(`Successfully upgraded to ${plan.name} plan!`);
  };

  const handleCancelSubscription = async () => {
  if (!confirm('Are you sure you want to cancel your subscription? You\'ll keep access until the end of your billing period.')) {
    return;
  }

  try {
    const response = await fetch('/api/subscriptions/cancel', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      // ✅ Update state with returned subscription data
      setSubscription(prev => ({
        ...prev,
        status: data.status || 'cancelled',
        next_billing_date: data.current_period_end,
        cancel_at: data.cancel_at
      }));
      alert('Subscription cancelled. You\'ll keep access until your billing period ends.');
    } else {
      alert(data.error || 'Failed to cancel subscription.');
    }
  } catch (error) {
    console.error('Cancel error:', error);
    alert('Failed to cancel subscription. Please try again.');
  }
};

 const openBillingPortal = async () => {
  try {
    const response = await fetch('/api/subscriptions/billing-portal', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok && data.url) {
      // ✅ Check if it's the same page to avoid refresh
      if (data.is_simulated) {
        alert('Billing is managed through this settings page. Update payment methods by contacting support.');
      } else {
        window.open(data.url, '_blank');
      }
    } else {
      alert(data.error || 'Failed to open billing portal.');
    }
  } catch (error) {
    console.error('Billing portal error:', error);
    alert('Failed to open billing portal.');
  }
};

  const plan = subscription?.plan || 'free';
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  
  // ✅ FIXED: Updated pricing to match our strategy
  const planPrice = plan === 'free' ? 0 : plan === 'pro' ? 12 : 25;  // Changed from 15/45 to 12/25

  return (
    <>
      <div className="bg-white rounded-lg shadow border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Subscription Settings</h2>

        {/* Current Plan */}
        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-2">Current Plan</h3>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-semibold">{planName} Plan</div>
              <div className="text-sm text-gray-600">
                {planPrice === 0 ? 'Free forever' : `$${planPrice}/month`}
              </div>
              {subscription?.status === 'cancelled' && (
                <div className="text-sm text-red-600 mt-1">
                  Cancelled (access until {new Date(subscription.next_billing_date).toLocaleDateString()})
                </div>
              )}
              {subscription?.grace_period && (
                <div className="text-sm text-green-600 mt-1">Grace period active</div>
              )}
            </div>
            
            {plan !== 'team' && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {plan === 'free' ? 'Upgrade' : 'Upgrade to Team'}
              </button>
            )}
          </div>
        </div>

        {/* Billing Actions */}
        {plan !== 'free' && (
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Billing</h3>
            <div className="space-y-2">
              
              {subscription?.payment_method && (
                <div className="text-sm text-gray-600">
                  Payment method: •••• •••• •••• {subscription.payment_method.last4}
                </div>
              )}
              
              {subscription?.next_billing_date && (
                <div className="text-sm text-gray-600">
                  Next billing: {new Date(subscription.next_billing_date).toLocaleDateString()}
                </div>
              )}

              <div className="flex space-x-3 mt-3">
                <button
                  onClick={openBillingPortal}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Manage Billing
                </button>
                
                {subscription?.status !== 'cancelled' && (
                  <button
                    onClick={handleCancelSubscription}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plan Features */}
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Your Features</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              {/* ✅ FIXED: Updated to match our new strategy */}
              {plan === 'free' ? '10 AI queries/month' : '🤖 Unlimited AI queries'}
            </div>
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              {/* ✅ FIXED: Updated to match our new strategy */}
              {plan === 'free' ? '50 bookings/month' : 
               plan === 'pro' ? 'Unlimited bookings' : 
               'Unlimited bookings'}
            </div>
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              {plan === 'free' ? '1 booking link' : 'Unlimited booking links'}
            </div>
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              {plan === 'team' ? 'Unlimited team members' : 
               plan === 'pro' ? 'Up to 5 team members' : 
               '1 user only'}
            </div>
            {plan !== 'free' && (
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                {plan === 'team' ? 'Phone + Priority support' : 'Priority email support'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ FIXED: Upgrade Modal with onSuccess prop */}
      <SubscriptionUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={handleUpgradeSuccess}  
        currentTier={plan}
      />
    </>
  );
};

export default SubscriptionSettings;