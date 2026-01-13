import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, X, Sparkles, Crown, Building2, Users, Zap, ArrowLeft } from 'lucide-react';
import { useUpgrade } from '../context/UpgradeContext';
import api from '../utils/api';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'Get started with basic scheduling',
    icon: Zap,
    color: 'gray',
    features: [
      { text: '10 AI queries/month', included: true },
      { text: '50 bookings/month', included: true },
      { text: '2 event types', included: true },
      { text: '3 quick links', included: true },
      { text: '1 calendar connection', included: true },
      { text: 'Buffer times', included: false },
      { text: 'Email templates', included: false },
      { text: 'Smart rules', included: false },
      { text: 'Teams', included: false },
    ],
    cta: 'Current Plan',
    popular: false
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 8,
    period: '/month',
    description: 'For individuals who need more',
    icon: Sparkles,
    color: 'blue',
    features: [
      { text: '50 AI queries/month', included: true },
      { text: '200 bookings/month', included: true },
      { text: '5 event types', included: true },
      { text: '10 quick links', included: true },
      { text: '2 calendar connections', included: true },
      { text: 'Buffer times', included: true },
      { text: 'Email templates', included: true },
      { text: 'Smart rules', included: false },
      { text: 'Teams', included: false },
    ],
    cta: 'Upgrade',
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 15,
    period: '/month',
    description: 'Full power for professionals',
    icon: Crown,
    color: 'purple',
    features: [
      { text: '250 AI queries/month', included: true },
      { text: 'Unlimited bookings', included: true },
      { text: 'Unlimited event types', included: true },
      { text: 'Unlimited quick links', included: true },
      { text: '3 calendar connections', included: true },
      { text: 'Buffer times', included: true },
      { text: 'Email templates', included: true },
      { text: 'Smart rules', included: true },
      { text: 'Email assistant', included: true },
      { text: 'Teams', included: false },
    ],
    cta: 'Upgrade',
    popular: true
  },
  {
    id: 'team',
    name: 'Team',
    price: 20,
    period: '/user/month',
    description: 'For teams that schedule together',
    icon: Users,
    color: 'pink',
    features: [
      { text: '750 AI queries pooled', included: true },
      { text: 'Unlimited everything', included: true },
      { text: 'Up to 10 team members', included: true },
      { text: 'Round-robin scheduling', included: true },
      { text: 'Team availability', included: true },
      { text: 'Load balancing', included: true },
      { text: 'Autonomous mode', included: true },
      { text: 'Priority routing', included: true },
    ],
    cta: 'Upgrade',
    popular: false
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    icon: Building2,
    color: 'slate',
    features: [
      { text: 'Unlimited AI queries', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'SSO / SAML', included: true },
      { text: 'Audit logs', included: true },
      { text: 'Custom integrations', included: true },
      { text: 'Dedicated support', included: true },
      { text: 'SLA guarantee', included: true },
      { text: 'Onboarding assistance', included: true },
    ],
    cta: 'Contact Sales',
    popular: false
  }
];

const COLOR_CLASSES = {
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-500' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

export default function Pricing() {
  const navigate = useNavigate();
  const { currentTier, refreshUsage } = useUpgrade();
  const [loading, setLoading] = useState(null);

  const handlePlanSelect = async (planId) => {
    if (planId === 'free') return;
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@trucal.xyz?subject=Enterprise%20Inquiry';
      return;
    }

    setLoading(planId);
    try {
      const response = await api.post('/billing/create-checkout', { plan: planId });

      if (response.data.checkout_url) {
        // Refresh usage after upgrade
        if (refreshUsage) refreshUsage();
        navigate('/settings?upgraded=true');
      } else if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to process upgrade. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const isLoggedIn = !!localStorage.getItem('token');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Back link */}
        <Link
          to={isLoggedIn ? "/dashboard" : "/"}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {isLoggedIn ? "Dashboard" : "Home"}
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start free, upgrade when you need more. No hidden fees.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentTier === plan.id;
            const colors = COLOR_CLASSES[plan.color];

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col ${
                  plan.popular
                    ? 'border-purple-500 shadow-xl shadow-purple-500/20'
                    : colors.border
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg} mb-4`}>
                  <Icon className={`h-6 w-6 ${colors.text}`} />
                </div>

                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{plan.description}</p>

                <div className="mt-4 mb-6">
                  {typeof plan.price === 'number' ? (
                    <>
                      <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-500">{plan.period}</span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  )}
                </div>

                <ul className="space-y-3 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-300 flex-shrink-0" />
                      )}
                      <span className={feature.included ? 'text-gray-700 text-sm' : 'text-gray-400 text-sm'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanSelect(plan.id)}
                  disabled={isCurrent || loading === plan.id}
                  className={`mt-6 w-full py-3 rounded-xl font-semibold transition-all ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-500 cursor-default'
                      : plan.popular
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {loading === plan.id ? 'Loading...' : isCurrent ? 'Current Plan' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ or Trust badges */}
        <div className="mt-16 text-center">
          <p className="text-gray-500">
            All plans include SSL encryption, 99.9% uptime, and email support.
          </p>
        </div>
      </div>
    </div>
  );
}
