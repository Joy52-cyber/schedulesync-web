// ============ BILLING SETTINGS PAGE ============

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  XCircle,
  Download,
  Receipt,
  AlertTriangle,
  ArrowLeft,
  Zap,
  Users,
  Bot,
  Crown,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

import api from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import SubscriptionUpgradeModal from '../components/SubscriptionUpgradeModal';

export default function BillingSettings() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState({ ai_queries_used: 0, ai_queries_limit: 10 });
  const [limits, setLimits] = useState({ current_bookings: 0, limits: { soft: 50 } });
  const [invoices, setInvoices] = useState([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserProfile(),
        loadSubscription(),
        loadUsage(),
        loadLimits(),
        loadInvoices()
      ]);
    } catch (error) {
      console.error('Failed to load billing data:', error);
      notify.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await api.auth.me();
      setUser(response.data.user);
    } catch (error) {
      console.error('Profile load error:', error);
    }
  };

  const loadSubscription = async () => {
    try {
      const response = await api.get('/billing/subscription');
      setSubscription(response.data);
    } catch (error) {
      console.error('Subscription load error:', error);
    }
  };

  const loadUsage = async () => {
    try {
      const response = await api.user.usage();
      setUsage(response.data);
    } catch (error) {
      console.error('Usage load error:', error);
    }
  };

  const loadLimits = async () => {
    try {
      const response = await api.user.limits();
      setLimits(response.data);
    } catch (error) {
      console.error('Limits load error:', error);
    }
  };

  const loadInvoices = async () => {
    try {
      const response = await api.get('/billing/invoices');
      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error('Invoices load error:', error);
    }
  };

  const handleUpgrade = async (plan) => {
    setShowUpgradeModal(true);
  };

  const handleUpgradeSuccess = async (plan) => {
    notify.success(`Successfully upgraded to ${plan.name} plan!`);
    setShowUpgradeModal(false);
    await loadBillingData(); // Refresh data to show new plan
  };

  const handleCancelSubscription = async () => {
    try {
      await api.post('/billing/cancel');
      notify.success('Subscription cancelled successfully');
      setShowCancelModal(false);
      loadBillingData();
    } catch (error) {
      console.error('Cancel error:', error);
      notify.error('Failed to cancel subscription');
    }
  };

  const handleReactivate = async () => {
    try {
      await api.post('/billing/reactivate');
      notify.success('Subscription reactivated successfully');
      loadBillingData();
    } catch (error) {
      console.error('Reactivate error:', error);
      notify.error('Failed to reactivate subscription');
    }
  };

  const downloadInvoice = async (invoiceId) => {
    try {
      const response = await api.get(`/billing/invoices/${invoiceId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      notify.success('Invoice downloaded');
    } catch (error) {
      console.error('Download error:', error);
      notify.error('Failed to download invoice');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  const currentTier = user?.tier || 'free';
  const isActive = subscription?.status === 'active';
  const isCancelled = subscription?.status === 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
              <p className="text-gray-600">Manage your plan and billing information</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Current Plan Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Current Plan</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              currentTier === 'free' 
                ? 'bg-gray-100 text-gray-700'
                : currentTier === 'pro'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
            }`}>
              {currentTier === 'free' ? '🆓 Free Plan' : 
               currentTier === 'pro' ? '⚡ Pro Plan' : 
               '👑 Team Plan'}
            </span>
          </div>

          {/* Plan Details */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Current Usage */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Usage This Month</h3>
              
              {/* AI Queries */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    AI Queries
                  </span>
                  <span className="text-sm font-medium">
                    {currentTier === 'free' ? `${usage.ai_queries_used}/${usage.ai_queries_limit}` : '∞ Unlimited'}
                  </span>
                </div>
                {currentTier === 'free' && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{width: `${Math.min(100, (usage.ai_queries_used / usage.ai_queries_limit) * 100)}%`}}
                    />
                  </div>
                )}
              </div>

              {/* Bookings */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Bookings
                  </span>
                  <span className="text-sm font-medium">
                    {currentTier === 'free' ? `${limits.current_bookings}/${limits.limits.soft}` : '∞ Unlimited'}
                  </span>
                </div>
                {currentTier === 'free' && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{width: `${Math.min(100, (limits.current_bookings / limits.limits.soft) * 100)}%`}}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Subscription Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Subscription Details</h3>
              
              {subscription ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span className={`font-medium ${
                      isActive ? 'text-green-600' : 
                      isCancelled ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {isActive ? '✅ Active' : 
                       isCancelled ? '❌ Cancelled' : '⏳ Pending'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Price</span>
                    <span className="font-medium">${subscription.price}/month</span>
                  </div>
                  
                  {subscription.next_billing_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {isCancelled ? 'Ends' : 'Next billing'}
                      </span>
                      <span className="font-medium">
                        {new Date(subscription.next_billing_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p>No active subscription</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            {currentTier === 'free' && (
              <button
                onClick={() => handleUpgrade('pro')}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Upgrade to Pro - $12/month
              </button>
            )}
            
            {currentTier === 'pro' && (
              <button
                onClick={() => handleUpgrade('team')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Upgrade to Team - $25/month
              </button>
            )}

            {subscription && isActive && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="bg-red-100 text-red-700 px-6 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors"
              >
                Cancel Subscription
              </button>
            )}

            {subscription && isCancelled && (
              <button
                onClick={handleReactivate}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Reactivate Subscription
              </button>
            )}

            {subscription && (
              <button
                onClick={() => window.open(subscription.manage_url, '_blank')}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Manage Billing
              </button>
            )}
          </div>
        </div>

        {/* Available Plans */}
        {currentTier === 'free' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Available Plans</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pro Plan */}
              <div className="border-2 border-purple-200 rounded-xl p-6 hover:border-purple-300 transition-colors">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-purple-600 mb-2">⚡ Pro Plan</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-2">$12<span className="text-lg text-gray-600">/month</span></div>
                  <p className="text-gray-600">Perfect for busy professionals</p>
                </div>
                
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Unlimited AI queries</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Unlimited bookings</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Advanced email templates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Priority support</span>
                  </li>
                </ul>
                
                <button
                  onClick={() => handleUpgrade('pro')}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Upgrade to Pro
                </button>
              </div>

              {/* Team Plan */}
              <div className="border-2 border-blue-200 rounded-xl p-6 hover:border-blue-300 transition-colors">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-blue-600 mb-2">👑 Team Plan</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-2">$25<span className="text-lg text-gray-600">/month</span></div>
                  <p className="text-gray-600">For teams and organizations</p>
                </div>
                
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Everything in Pro</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Team collaboration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Advanced analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">White-label options</span>
                  </li>
                </ul>
                
                <button
                  onClick={() => handleUpgrade('team')}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Upgrade to Team
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Billing History */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Billing History</h2>
          
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No invoices yet</p>
              <p className="text-gray-400 text-sm">Your billing history will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      invoice.status === 'paid' ? 'bg-green-100' :
                      invoice.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      {invoice.status === 'paid' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : invoice.status === 'pending' ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    
                    <div>
                      <p className="font-medium">${invoice.amount} - {invoice.description}</p>
                      <p className="text-sm text-gray-600">{new Date(invoice.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${
                      invoice.status === 'paid' ? 'text-green-600' :
                      invoice.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {invoice.status === 'paid' ? 'Paid' :
                       invoice.status === 'pending' ? 'Pending' : 'Failed'}
                    </span>
                    
                    {invoice.status === 'paid' && (
                      <button
                        onClick={() => downloadInvoice(invoice.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Download Invoice"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              
              <h2 className="text-xl font-bold mb-2">Cancel Subscription?</h2>
              <p className="text-gray-600 mb-6">
                You'll lose access to Pro features at the end of your current billing period. 
                You can reactivate anytime.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleCancelSubscription}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors"
                >
                  Yes, Cancel Subscription
                </button>
                <button 
                  onClick={() => setShowCancelModal(false)}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Keep Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <SubscriptionUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={handleUpgradeSuccess}
        currentTier={currentTier}
      />
    </div>
  );
}