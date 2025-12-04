import React, { useState, useEffect } from 'react';
import SubscriptionUpgradeModal from './SubscriptionUpgradeModal';

const BillingManagement = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    fetchSubscriptionDetails();
  }, []);

  const fetchSubscriptionDetails = async () => {
    try {
      const response = await fetch('/api/subscriptions/current', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
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

  const handleUpgrade = () => {
    setShowUpgradeModal(true);
  };

  const handleUpgradeSuccess = (plan) => {
    setShowUpgradeModal(false);
    fetchSubscriptionDetails(); // Refresh data
    alert(`Successfully upgraded to ${plan.name} plan!`);
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You\'ll lose access to Pro features at the end of your billing period.')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await fetchSubscriptionDetails(); // Refresh data
        alert('Subscription cancelled successfully');
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateBilling = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/subscriptions/billing-portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const { url } = await response.json();
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      alert('Failed to open billing management');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  // ✅ FIXED: Check subscription.plan instead of subscription.tier
  const currentTier = subscription?.plan || 'free';

  if (!subscription || currentTier === 'free') {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Billing Management</h2>
        <p className="text-gray-600 mb-4">You're currently on the free plan. Upgrade to access billing management.</p>
        <button
          onClick={handleUpgrade}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700"
        >
          Upgrade Now
        </button>
      </div>
    );
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // ✅ FIXED: Updated pricing to match our strategy
  const getPlanPrice = (tier) => {
    switch(tier) {
      case 'pro': return '$12';     // ✅ Changed from $15 to $12
      case 'team': return '$25';    // ✅ Changed from $45 to $25
      default: return '$0';
    }
  };

  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-6">Billing Management</h2>

        {/* Current Plan */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-lg">Current Plan</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              currentTier === 'pro' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {currentTier === 'pro' ? '⚡ Pro' : '👑 Team'}
            </span>
          </div>
          
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {getPlanPrice(currentTier)}/month
          </div>
          
          {/* ✅ FIXED: Updated feature descriptions */}
          <p className="text-sm text-gray-600">
            {currentTier === 'pro' 
              ? 'Unlimited AI queries + unlimited bookings'  // ✅ Changed from 500 bookings
              : 'Everything in Pro + unlimited team members'
            }
          </p>
        </div>

        {/* Subscription Details */}
        <div className="space-y-4 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className={`font-medium ${
              subscription.status === 'active' ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {subscription.status === 'active' ? '✅ Active' : 
               subscription.status === 'cancelled' ? '⚠️ Cancelled' : 
               subscription.status}
            </span>
          </div>

          {subscription.current_period_end && (
            <div className="flex justify-between">
              <span className="text-gray-600">
                {subscription.status === 'cancelled' ? 'Access ends:' : 'Next billing:'}
              </span>
              <span className="font-medium">
                {formatDate(subscription.current_period_end)}
              </span>
            </div>
          )}

          {subscription.cancel_at && (
            <div className="flex justify-between">
              <span className="text-gray-600">Cancellation date:</span>
              <span className="font-medium text-red-600">
                {formatDate(subscription.cancel_at)}
              </span>
            </div>
          )}
        </div>

        {/* Payment Method */}
        {subscription.payment_method && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium mb-2">Payment Method</h4>
            <div className="flex items-center">
              <span className="text-gray-600">
                💳 •••• •••• •••• {subscription.payment_method.last4} 
                ({subscription.payment_method.brand?.toUpperCase()})
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Expires {subscription.payment_method.exp_month}/{subscription.payment_method.exp_year}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleUpdateBilling}
            disabled={actionLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? 'Loading...' : 'Update Payment Method & View Invoices'}
          </button>

          {subscription.status === 'active' && (
            <button
              onClick={handleCancelSubscription}
              disabled={actionLoading}
              className="w-full border border-red-300 text-red-700 py-3 px-4 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel Subscription
            </button>
          )}

          {subscription.status === 'cancelled' && (
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                Your subscription is cancelled and will end on {formatDate(subscription.current_period_end)}. 
                You can reactivate anytime before then.
              </p>
            </div>
          )}
        </div>

        {/* Upgrade Option */}
        {currentTier === 'pro' && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">Need more power?</h4>
            <p className="text-sm text-blue-600 mb-3">
              Upgrade to Team plan for unlimited team members and advanced features.
            </p>
            <button 
              onClick={handleUpgrade}
              className="bg-blue-600 text-white py-2 px-4 rounded font-medium hover:bg-blue-700"
            >
              Upgrade to Team - $25/month  {/* ✅ Fixed from $45 to $25 */}
            </button>
          </div>
        )}
      </div>

      {/* ✅ ADDED: Upgrade Modal */}
      <SubscriptionUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={handleUpgradeSuccess}
        currentTier={currentTier}
      />
    </>
  );
};

export default BillingManagement;