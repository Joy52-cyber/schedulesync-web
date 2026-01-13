import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Zap,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Users,
  Shield,
  Star,
  Bot,
  Play,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Bot,
      title: 'AI Scheduling Assistant',
      description: 'Type "Book meeting with john@email.com tomorrow 2pm" and it\'s done. No forms, no clicks.',
      stat: '10x faster',
      color: 'from-purple-500 to-pink-500',
      demo: 'Ask AI: "Book with client@company.com tomorrow"'
    },
    {
      icon: Zap,
      title: 'Instant Calendar Sync',
      description: 'Connect Google or Outlook Calendar in one click. Auto-detects your availability.',
      stat: '< 30 seconds',
      color: 'from-blue-500 to-cyan-500',
      demo: 'One-click OAuth connection'
    },
    {
      icon: Shield,
      title: 'Zero Double-Bookings',
      description: 'Smart conflict detection across all your calendars. Never get overbooked again.',
      stat: '100% protected',
      color: 'from-green-500 to-emerald-500',
      demo: 'Checks all calendars in real-time'
    },
    {
      icon: Users,
      title: 'Team Scheduling',
      description: 'Round-robin, collective availability, weighted distribution. Perfect for sales teams.',
      stat: 'Team plan',
      color: 'from-orange-500 to-red-500',
      demo: 'Book with entire team instantly'
    }
  ];

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started',
      features: [
        '50 bookings/month',
        '2 event types',
        '10 AI queries/month',
        '3 quick links/month',
        'Google & Outlook sync',
        'Email reminders',
      ],
      cta: 'Get Started Free',
      popular: false,
    },
    {
      name: 'Starter',
      price: '$8',
      period: '/month',
      description: 'For individuals who need more',
      features: [
        '200 bookings/month',
        '5 event types',
        '50 AI queries/month',
        '10 quick links/month',
        'Buffer times',
        'Email templates',
      ],
      cta: 'Start Starter',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$15',
      period: '/month',
      description: 'For busy professionals',
      features: [
        'Unlimited bookings',
        'Unlimited event types',
        '250 AI queries/month',
        'Unlimited quick links',
        'Smart Rules (AI)',
        'Email Assistant (AI)',
        'Priority support',
      ],
      cta: 'Start Pro Trial',
      popular: true,
    },
    {
      name: 'Team',
      price: '$20',
      period: '/user/month',
      description: 'For growing teams',
      features: [
        'Everything in Pro',
        '750 AI queries pooled',
        'Round-robin booking',
        'Collective availability',
        'Autonomous mode',
        'Up to 10 members',
      ],
      cta: 'Start Team Trial',
      popular: false,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large organizations',
      features: [
        'Unlimited everything',
        'Unlimited team size',
        'SSO / SAML',
        'Audit logs',
        'Dedicated support',
        'SLA guarantee',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">

      {/* Blob Animation Styles */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>

      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg">ScheduleSync</span>
            </div>
            
            <div className="hidden md:flex items-center gap-6 text-sm">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={() => navigate('/login')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 px-2 sm:px-3 py-2"
              >
                Log in
              </button>
              <button 
                onClick={() => navigate('/register')}
                className="text-xs sm:text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full px-3 sm:px-4 py-2 hover:shadow-lg transition-all"
              >
                <span className="hidden sm:inline">Get Started Free</span>
                <span className="sm:hidden">Sign Up</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ================= HERO SECTION ================= */}
      <section className="relative bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-purple-200 text-sm font-medium text-purple-600 mb-8 shadow-sm">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            <span>AI-Powered Scheduling Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 tracking-tight">
            Schedule meetings<br />
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">in seconds with AI</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            Say goodbye to back-and-forth emails. Our AI assistant books meetings for you instantly—just tell it what you need.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button 
              onClick={() => navigate('/register')}
              className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-lg font-bold hover:shadow-2xl transition-all transform hover:scale-105 flex items-center gap-2"
            >
              Start for Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => navigate('/demo')}
              className="px-8 py-4 bg-white text-gray-900 rounded-full text-lg font-semibold border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              Try Live Demo
            </button>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600 mb-16">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Free forever plan</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Setup in 30 seconds</span>
            </div>
          </div>

          {/* Hero Demo/Screenshot */}
          <div className="relative max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-8 border-white">
              <div className="bg-gradient-to-br from-purple-100 to-pink-100 aspect-video flex items-center justify-center">
                <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl p-6 mx-4">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">AI Scheduler</div>
                      <div className="text-xs text-gray-500">Always ready to help</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <div className="bg-purple-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-sm text-sm">
                        Book meeting with john@email.com tomorrow at 2pm
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm text-sm">
                        ✅ Done! Meeting scheduled with john@email.com for tomorrow at 2:00 PM. Confirmation emails sent.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <div className="bg-white rounded-xl shadow-xl px-6 py-4 border border-gray-100">
                <div className="text-3xl font-bold text-purple-600">10x</div>
                <div className="text-sm text-gray-600">Faster booking</div>
              </div>
              <div className="bg-white rounded-xl shadow-xl px-6 py-4 border border-gray-100">
                <div className="text-3xl font-bold text-pink-600">95%</div>
                <div className="text-sm text-gray-600">Less back-and-forth</div>
              </div>
              <div className="bg-white rounded-xl shadow-xl px-6 py-4 border border-gray-100">
                <div className="text-3xl font-bold text-blue-600">0</div>
                <div className="text-sm text-gray-600">Double bookings</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= COMPARE SECTION ================= */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-8">
              A smarter alternative to
            </p>
            <div className="flex flex-wrap items-center justify-center gap-12 opacity-60">
              <div className="text-2xl font-bold text-gray-400">Calendly</div>
              <div className="text-2xl font-bold text-gray-400">Cal.com</div>
              <div className="text-2xl font-bold text-gray-400">HubSpot</div>
              <div className="text-2xl font-bold text-gray-400">Acuity</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURES SECTION ================= */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              The only scheduling tool with AI built in
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Stop wasting time on back-and-forth emails. Let AI handle your scheduling.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl hover:border-purple-200 transition-all">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">{feature.title}</h3>
                  <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-bold">
                    {feature.stat}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {feature.description}
                </p>
                
                <div className="text-sm text-purple-600 font-medium bg-purple-50 rounded-lg px-4 py-3 border border-purple-100">
                  💡 {feature.demo}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRICING SECTION ================= */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Start free, upgrade when you need more. No hidden fees.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {pricingTiers.map((tier, idx) => (
              <div 
                key={idx} 
                className={`relative bg-white rounded-2xl p-8 border-2 transition-all ${
                  tier.popular 
                    ? 'border-purple-500 shadow-xl scale-105' 
                    : 'border-gray-200 hover:border-purple-200 hover:shadow-lg'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold rounded-full">
                    Most Popular
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-extrabold text-gray-900">{tier.price}</span>
                    <span className="text-gray-500">{tier.period}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{tier.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => navigate('/register')}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    tier.popular
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= WHAT YOU GET ================= */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Everything you need to schedule smarter
            </h2>
            <p className="text-xl text-gray-600">
              One simple platform. No hidden fees. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Free Plan Highlights */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Free Forever</h3>
                  <p className="text-xs text-gray-600">No credit card needed</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>50 bookings/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>10 AI queries/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>Google & Outlook sync</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>Custom booking URL</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>Email reminders</span>
                </li>
              </ul>
            </div>

            {/* AI Assistant - STAR FEATURE */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-300 relative">
              <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full">
                ✨ EXCLUSIVE
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">AI Scheduling</h3>
                  <p className="text-xs text-gray-600">The future of booking</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-4">
                Type "Book with john@email.com tomorrow 2pm" and it's done. No other tool has this.
              </p>
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <p className="text-xs text-purple-700 font-medium">
                  💡 Free: 10 queries/month<br/>
                  💎 Pro: Unlimited queries
                </p>
              </div>
            </div>

            {/* Pro Features */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Pro Power</h3>
                  <p className="text-xs text-gray-600">$15/month</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Unlimited</strong> bookings</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Unlimited</strong> AI queries</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Unlimited</strong> event types</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Custom branding</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Priority support</span>
                </li>
              </ul>
            </div>

            {/* Quick Links - UNIQUE FEATURE */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-200 relative">
              <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                ✨ UNIQUE
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Quick Links</h3>
                  <p className="text-xs text-gray-600">Instant one-time booking</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-4">
                Create a one-time booking link for VIPs. They book instantly without seeing your full calendar.
              </p>
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="text-xs text-amber-700 font-medium">
                  🎁 Free: 2/month<br/>
                  💎 Pro: Unlimited
                </p>
              </div>
            </div>

            {/* Team Features */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-indigo-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Team Scheduling</h3>
                  <p className="text-xs text-gray-600">$25/month (up to 10)</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Round-robin distribution</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Collective availability</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Team booking pages</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Admin controls</span>
                </li>
              </ul>
            </div>

            {/* Security & Support */}
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 border-2 border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Secure & Reliable</h3>
                  <p className="text-xs text-gray-600">Your data is safe</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  <span>SSL encryption</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  <span>OAuth 2.0 auth</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  <span>Regular backups</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  <span>Email support</span>
                </li>
              </ul>
            </div>

          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <button 
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-lg font-bold hover:shadow-2xl transition-all transform hover:scale-105"
            >
              Start Free – No Credit Card Required
            </button>
            <p className="text-sm text-gray-500 mt-4">
              🎁 Free forever plan • ⚡ Upgrade anytime • 💳 Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="py-24 bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6">
            Ready to schedule smarter?
          </h2>
          <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
            Join professionals who've ditched the back-and-forth emails.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button 
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-white text-purple-600 rounded-full text-lg font-bold hover:shadow-2xl transition-all transform hover:scale-105"
            >
              Get Started Free
            </button>
            <button 
              onClick={() => navigate('/demo')}
              className="px-8 py-4 bg-purple-500/30 backdrop-blur-sm text-white rounded-full text-lg font-semibold border-2 border-white/30 hover:bg-purple-500/50 transition-all flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              Try Live Demo
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 text-purple-100">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Free forever plan</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>30-second setup</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-white text-lg">ScheduleSync</span>
              </div>
              <p className="text-sm text-gray-400">
                AI-powered scheduling that actually works.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><button onClick={() => navigate('/demo')} className="hover:text-white transition-colors text-left">Demo</button></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => navigate('/about')} className="hover:text-white transition-colors text-left">About</button></li>
                <li><a href="mailto:support@trucal.xyz" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors text-left">Privacy Policy</button></li>
                <li><button onClick={() => navigate('/terms')} className="hover:text-white transition-colors text-left">Terms of Service</button></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
            <p>&copy; {new Date().getFullYear()} ScheduleSync. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}