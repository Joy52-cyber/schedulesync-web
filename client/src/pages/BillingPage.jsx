import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle,
  Receipt,
  Settings,
  Crown,
  Zap,
  Users,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import SubscriptionUpgradeModal from '../components/SubscriptionUpgradeModal';

const BillingPage = () => {
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const subResponse = await fetch('/api/billing/subscription', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (subResponse.ok) {
        setSubscription(await subResponse.json());
      } else {
        throw new Error('Failed to fetch subscription');
      }

      const invResponse = await fetch('/api/billing/invoices', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (invResponse.ok) {
        const invData = await invResponse.json();
        setInvoices(invData.invoices || []);
      }
    } catch (err) {
      console.error('Billing fetch error:', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel?\n\nYou\'ll keep access until the end of your billing period.')) return;

    setActionLoading(true);
    try {
      const response = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setSubscription(prev => ({ ...prev, status: 'cancelled', cancel_at: data.cancel_at }));
        alert('Subscription cancelled. Access continues until ' + new Date(data.cancel_at).toLocaleDateString());
      } else {
        alert(data.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      alert('Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/billing/reactivate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setSubscription(prev => ({ ...prev, status: 'active', cancel_at: null }));
        alert('Subscription reactivated!');
      } else {
        alert(data.error || 'Failed to reactivate');
      }
    } catch (err) {
      alert('Failed to reactivate subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpgradeSuccess = (plan) => {
    setShowUpgradeModal(false);
    fetchBillingData();
    alert(`Successfully upgraded to ${plan.name}!`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Loading billing information...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Billing</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={fetchBillingData} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const plan = subscription?.plan || 'free';
  const isPaid = plan !== 'free';
  const isCancelled = subscription?.status === 'cancelled';

  const planDetails = {
    free: { name: 'Free', price: 0, icon: Settings, features: ['10 AI queries/month', '50 bookings/month', '1 booking link', 'Email support'] },
    pro: { name: 'Pro', price: 12, icon: Zap, features: ['Unlimited AI queries', 'Unlimited bookings', 'Unlimited links', 'Priority support'] },
    team: { name: 'Team', price: 25, icon: Users, features: ['Everything in Pro', 'Unlimited team members', 'Admin dashboard', 'Phone support'] }
  };

  const currentPlan = planDetails[plan] || planDetails.free;
  const PlanIcon = currentPlan.icon;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Billing & Subscription</h1>
            <p className="text-gray-600 mt-1">Manage your plan and billing information</p>
          </div>
          <button onClick={fetchBillingData} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Refresh">
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {/* Current Plan Card */}
        <div className={`bg-white rounded-xl shadow-sm border-2 ${isCancelled ? 'border-yellow-300' : isPaid ? 'border-purple-200' : 'border-gray-200'} overflow-hidden`}>
          <div className={`p-6 ${isPaid ? 'bg-gradient-to-r from-purple-50 to-blue-50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isPaid ? 'bg-purple-100' : 'bg-gray-200'}`}>
                  <PlanIcon className={`h-8 w-8 ${isPaid ? 'text-purple-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900">{currentPlan.name} Plan</h2>
                    {isPaid && !isCancelled && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>}
                    {isCancelled && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">Cancelling</span>}
                  </div>
                  <p className="text-gray-600">{currentPlan.price === 0 ? 'Free forever' : `$${currentPlan.price}/month`}</p>
                </div>
              </div>
              
              {plan !== 'team' && !isCancelled && (
                <button onClick={() => setShowUpgradeModal(true)} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  <Crown className="h-4 w-4" />
                  {plan === 'free' ? 'Upgrade' : 'Upgrade to Team'}
                </button>
              )}
            </div>
          </div>

          <div className="p-6 border-t border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3">Your Features</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {currentPlan.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
            
            {plan !== 'team' && !isCancelled && (
              <button onClick={() => setShowUpgradeModal(true)} className="sm:hidden w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                <Crown className="h-4 w-4" />
                {plan === 'free' ? 'Upgrade Now' : 'Upgrade to Team'}
              </button>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">AI Queries</span>
              <Zap className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{isPaid ? '∞ Unlimited' : '10/month'}</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Bookings</span>
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{isPaid ? '∞ Unlimited' : '50/month'}</p>
          </div>
        </div>

        {/* Subscription Details */}
        {isPaid && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Subscription Details
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Status</span>
                <span className={`font-medium flex items-center gap-2 ${isCancelled ? 'text-yellow-600' : 'text-green-600'}`}>
                  {isCancelled ? <><XCircle className="h-4 w-4" /> Cancelled</> : <><CheckCircle className="h-4 w-4" /> Active</>}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Price</span>
                <span className="font-medium text-gray-900">${currentPlan.price}/month</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">{isCancelled ? 'Access ends' : 'Next billing'}</span>
                <span className="font-medium text-gray-900">{formatDate(subscription?.current_period_end || subscription?.next_billing_date)}</span>
              </div>

              {subscription?.payment_method && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Payment method</span>
                  <span className="font-medium text-gray-900 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {subscription.payment_method.brand?.toUpperCase()} •••• {subscription.payment_method.last4}
                    <span className="text-gray-500 text-sm">({subscription.payment_method.exp_month}/{subscription.payment_method.exp_year})</span>
                  </span>
                </div>
              )}
            </div>

            {isCancelled && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 font-medium">Subscription Cancelled</p>
                    <p className="text-yellow-700 text-sm mt-1">
                      Your subscription will end on {formatDate(subscription?.cancel_at || subscription?.current_period_end)}. 
                      You'll keep access to all features until then.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {isCancelled ? (
                <button onClick={handleReactivate} disabled={actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><RefreshCw className="h-5 w-5" /> Reactivate Subscription</>}
                </button>
              ) : (
                <button onClick={handleCancelSubscription} disabled={actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50">
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><XCircle className="h-5 w-5" /> Cancel Subscription</>}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Billing History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Billing History
          </h3>
          
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No billing history yet</p>
              {!isPaid && (
                <button onClick={() => setShowUpgradeModal(true)} className="mt-4 text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 mx-auto">
                  Upgrade to Pro <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice, index) => (
                <div key={invoice.id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${invoice.status === 'paid' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                      <Receipt className={`h-5 w-5 ${invoice.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{formatCurrency(invoice.amount)} - {invoice.description}</p>
                      <p className="text-sm text-gray-500">{formatDate(invoice.date)}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${invoice.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {invoice.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upgrade CTA for free users */}
        {!isPaid && (
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold mb-1">Ready to unlock more?</h3>
                <p className="text-purple-100">Get unlimited AI queries, unlimited bookings, and priority support.</p>
              </div>
              <button onClick={() => setShowUpgradeModal(true)} className="w-full sm:w-auto px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-gray-100 flex items-center justify-center gap-2">
                <Crown className="h-5 w-5" />
                Upgrade to Pro - $12/month
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-4">
          <p>Need help? Contact us at <a href="mailto:support@trucal.xyz" className="text-purple-600 hover:underline">support@trucal.xyz</a></p>
          <p className="mt-1">💳 All payments secured by Stripe • Cancel anytime</p>
        </div>
      </div>

      <SubscriptionUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={handleUpgradeSuccess}
        currentTier={plan}
      />
    </div>
  );
};

export default BillingPage;