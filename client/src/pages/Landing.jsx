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
  Inbox,
  Mail,
  Send,
  Clock,
  Check,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Mail,
      title: 'Email Bot',
      description: 'CC schedule@mg.trucal.xyz on any email thread. Our AI proposes times, handles replies, and books automatically. Works with Gmail, Outlook, Apple Mail—any email client.',
      stat: 'All plans',
      color: 'from-purple-500 to-pink-500',
      demo: 'Zero apps to install • AI handles back-and-forth • One-click booking',
      isNew: true,
      badge: 'FEATURED'
    },
    {
      icon: Zap,
      title: 'Instant Calendar Sync',
      description: 'Connect Google or Outlook Calendar in one click. Auto-detects your availability and prevents double-bookings.',
      stat: '< 30 seconds',
      color: 'from-green-500 to-emerald-500',
      demo: 'One-click OAuth connection'
    },
    {
      icon: Clock,
      title: 'Smart Availability',
      description: 'Set buffer times, booking caps, and custom hours. Your calendar, your rules—without the complexity.',
      stat: 'Starter+',
      color: 'from-blue-500 to-cyan-500',
      demo: 'Simple controls that just work'
    },
    {
      icon: Users,
      title: 'Team Scheduling',
      description: 'Round-robin distribution, team availability pooling, routing & load balancing. Perfect for sales teams.',
      stat: 'Team plan',
      color: 'from-orange-500 to-red-500',
      demo: 'Book with entire team instantly'
    }
  ];

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      period: '',
      description: 'Perfect to get started',
      features: [
        '10 AI actions/month',
        '1 booking page',
        '2 temporary links/month',
        'Google & Outlook sync',
        'Email reminders',
        'Custom URL (trucal.xyz/you)',
      ],
      cta: 'Start Free',
      popular: false,
    },
    {
      name: 'Starter',
      price: '$8',
      period: '/month',
      description: 'For active professionals',
      features: [
        '50 AI actions/month',
        'Unlimited temporary links',
        'Email Bot (CC to schedule)',
        'AI time suggestions',
        'Email draft suggestions',
        'Buffer times & booking caps',
      ],
      cta: 'Upgrade to Starter',
      popular: true,
      badge: 'MOST POPULAR'
    },
    {
      name: 'Pro',
      price: '$15',
      period: '/month',
      description: 'For power users',
      features: [
        '250 AI actions/month',
        'Everything in Starter',
        'Natural language rules',
        'Auto-rescheduling suggestions',
        'Inbox assistant',
        '1 guest seat included',
      ],
      cta: 'Go Pro',
      popular: false,
    },
    {
      name: 'Team',
      price: '$20',
      period: '/user/month',
      description: 'For growing teams',
      features: [
        '750 AI actions pooled (per 5 users)',
        'Round-robin distribution',
        'Team availability pooling',
        'Routing & load balancing',
        'Admin controls',
        'Team onboarding',
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
        'Unlimited AI actions',
        'Full autonomous mode',
        'SSO, SCIM, audit logs',
        'Calendly migration assistance',
        'Dedicated support',
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
              <span className="font-bold text-lg">TruCal</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">Pricing</a>
              <button onClick={() => navigate('/demo')} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">Demo</button>
            </nav>

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
            The AI scheduling assistant<br />
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">that deletes complexity</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            While Calendly adds more settings, TruCal just works.
          </p>

          {/* Email Bot Highlight */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-300 relative">
              <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                INCLUDED IN ALL PLANS
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Mail className="w-8 h-8 text-purple-600" />
                <h3 className="text-xl font-bold text-gray-900">Email Bot</h3>
              </div>
              <p className="text-gray-700 mb-2">
                Just CC <span className="bg-purple-100 px-2 py-1 rounded font-mono text-purple-700 font-semibold">schedule@mg.trucal.xyz</span> on any email
              </p>
              <p className="text-sm text-gray-600">
                AI proposes times, handles replies, books automatically
              </p>
            </div>
          </div>

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

      {/* ================= HOW IT WORKS - EMAIL BOT ================= */}
      <section className="py-24 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold mb-6">
              <Sparkles className="w-4 h-4" />
              HOW IT WORKS
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Schedule meetings without leaving your inbox
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Just CC our AI assistant on any email. No apps, no browser tabs, no context switching.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Steps */}
            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">CC schedule@mg.trucal.xyz on any email</h3>
                  <p className="text-gray-600">Works with Gmail, Outlook, Apple Mail, or any email client. Just add the bot to CC.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">AI proposes available times</h3>
                  <p className="text-gray-600">Our AI instantly checks your calendar and sends beautifully formatted time options to everyone in the thread.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Recipient clicks to book</h3>
                  <p className="text-gray-600">They pick a time right from their email. One click, instant booking. No links to open.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Meeting confirmed automatically</h3>
                  <p className="text-gray-600">Calendar invites sent, confirmations delivered. Zero back-and-forth required.</p>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => navigate('/register')}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-lg font-bold hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2"
                >
                  Try it now - CC schedule@mg.trucal.xyz
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Right: Email Mockup */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-200 overflow-hidden">
                {/* Email Header */}
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span className="font-semibold text-gray-900">New Email</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-12">To:</span>
                      <span className="text-gray-900">john@company.com</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-12">CC:</span>
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-mono text-xs font-bold inline-flex items-center gap-2">
                        <Sparkles className="w-3 h-3" />
                        schedule@mg.trucal.xyz
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-12">Subject:</span>
                      <span className="text-gray-900">Partnership Discussion</span>
                    </div>
                  </div>
                </div>

                {/* Email Body */}
                <div className="p-6">
                  <p className="text-gray-700 mb-6">
                    Hey John,<br /><br />
                    Let's find a time to chat about the partnership opportunity!
                  </p>

                  <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">TruCal Scheduling Assistant</p>
                        <p className="text-xs text-gray-500">via schedule@mg.trucal.xyz</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      Hi John! 👋 I'm helping schedule your meeting. Pick a time:
                    </p>

                    {/* Time Slot Buttons */}
                    <div className="space-y-2">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg p-3 text-sm font-semibold flex items-center justify-between cursor-pointer hover:shadow-lg transition-shadow">
                        <span>✓ Today - Jan 15 at 4:00 PM</span>
                        <span>→</span>
                      </div>
                      <div className="bg-gray-100 text-gray-900 rounded-lg p-3 text-sm font-medium cursor-pointer hover:bg-gray-200 transition-colors">
                        <span className="text-gray-500 text-xs block mb-1">Tomorrow</span>
                        Jan 16 at 10:00 AM
                      </div>
                      <div className="bg-gray-100 text-gray-900 rounded-lg p-3 text-sm font-medium cursor-pointer hover:bg-gray-200 transition-colors">
                        <span className="text-gray-500 text-xs block mb-1">Friday</span>
                        Jan 19 at 2:00 PM
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Badges */}
              <div className="absolute -top-4 -right-4 px-4 py-2 bg-green-500 text-white rounded-full font-bold text-sm shadow-lg transform rotate-6">
                ✓ Zero apps
              </div>
              <div className="absolute -bottom-4 -left-4 px-4 py-2 bg-yellow-400 text-yellow-900 rounded-full font-bold text-sm shadow-lg transform -rotate-6">
                ⚡ Instant
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= COMPARISON: CC VS BOOKING LINKS ================= */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Why CC beats booking links
            </h2>
            <p className="text-xl text-gray-600">
              Stay in your email. Let AI handle the coordination.
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border-2 border-gray-200">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Old Way */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gray-300 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">😓</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Old Way</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-red-600 text-sm font-bold">✗</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Send booking link</p>
                      <p className="text-sm text-gray-600">Copy-paste your Calendly link</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-red-600 text-sm font-bold">✗</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Recipient visits page</p>
                      <p className="text-sm text-gray-600">Opens new tab, leaves email</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-red-600 text-sm font-bold">✗</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Back-and-forth</p>
                      <p className="text-sm text-gray-600">"None of these times work..."</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-red-600 text-sm font-bold">✗</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Impersonal</p>
                      <p className="text-sm text-gray-600">Generic booking page</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* TruCal Way */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">TruCal Way</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Just CC the bot</p>
                      <p className="text-sm text-gray-600">schedule@mg.trucal.xyz</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Stays in email</p>
                      <p className="text-sm text-gray-600">Click button, done. No tabs.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">AI handles it</p>
                      <p className="text-sm text-gray-600">Smart replies, auto-booking</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Conversational</p>
                      <p className="text-sm text-gray-600">Feels natural, human</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-lg font-bold hover:shadow-xl transition-all transform hover:scale-105"
            >
              Try it now - CC schedule@mg.trucal.xyz
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Free forever • No credit card • 30-second setup
            </p>
          </div>
        </div>
      </section>

      {/* ================= FEATURES SECTION ================= */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Everything you need. Nothing you don't.
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Focus on Email Bot as your key differentiator. The rest is built-in.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className={`group bg-white rounded-2xl p-8 shadow-sm border-2 hover:shadow-xl transition-all relative ${feature.isNew ? 'border-purple-300 hover:border-purple-400' : 'border-gray-100 hover:border-purple-200'}`}>
                {feature.badge && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {feature.badge}
                  </div>
                )}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>

                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">{feature.title}</h3>
                  <div className="flex items-center gap-2">
                    {feature.isPro && (
                      <span className="px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-xs font-bold">
                        PRO
                      </span>
                    )}
                    <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-bold">
                      {feature.stat}
                    </span>
                  </div>
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
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold rounded-full">
                    {tier.badge}
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

                {tier.highlight && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                    <p className="text-sm font-semibold text-purple-700 flex items-center justify-center gap-2">
                      <Inbox className="w-4 h-4" />
                      {tier.highlight}
                    </p>
                  </div>
                )}

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

          {/* What are AI Actions Explainer */}
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border-2 border-purple-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                What are AI Actions?
              </h3>
              <p className="text-gray-700 mb-4">
                AI Actions count when TruCal works for you:
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Suggesting optimal times across calendars</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Auto-rescheduling conflicts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Drafting email replies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Applying your scheduling rules</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURE COMPARISON vs CALENDLY ================= */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              TruCal vs Calendly
            </h2>
            <p className="text-xl text-gray-600">
              See why teams are switching
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Pain Point</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-gray-500">Calendly</th>
                  <th className="px-6 py-4 text-center text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white">TruCal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">Schedule via email</td>
                  <td className="px-6 py-4 text-center text-gray-500">❌ Send link</td>
                  <td className="px-6 py-4 text-center text-green-600 font-semibold">✅ Just CC</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">Set up rules</td>
                  <td className="px-6 py-4 text-center text-gray-500">Complex UI</td>
                  <td className="px-6 py-4 text-center text-green-600 font-semibold">Natural language</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">Handle conflicts</td>
                  <td className="px-6 py-4 text-center text-gray-500">Manual</td>
                  <td className="px-6 py-4 text-center text-green-600 font-semibold">AI auto-reschedule</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">Team routing</td>
                  <td className="px-6 py-4 text-center text-gray-500">Extra $$$</td>
                  <td className="px-6 py-4 text-center text-green-600 font-semibold">Built-in</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Calendly Exit Plan */}
          <div className="mt-8 text-center">
            <p className="text-gray-700 mb-2">
              Switching from Calendly? <span className="font-bold text-purple-600">Get 3 months Pro free + migration help.</span>
            </p>
            <button
              onClick={() => navigate('/contact')}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium underline"
            >
              Learn more
            </button>
          </div>
        </div>
      </section>

      {/* ================= TRUST SECTION ================= */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise-grade security</h3>
            <p className="text-gray-600">Your data is protected</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-gray-700">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span>SSL encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span>OAuth 2.0</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span>Regular backups</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span>GDPR ready</span>
            </div>
          </div>
        </div>
      </section>


      {/* ================= FINAL CTA ================= */}
      <section className="py-24 bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6">
            Ready to schedule smarter?
          </h2>
          <p className="text-xl text-purple-100 mb-4 max-w-2xl mx-auto">
            Join professionals who've ditched the back-and-forth emails.
          </p>
          <p className="text-lg text-white/90 font-semibold mb-8 max-w-2xl mx-auto">
            Just CC <span className="bg-white/20 px-3 py-1 rounded-lg font-mono">schedule@mg.trucal.xyz</span> on your next email.
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
                <span className="font-bold text-white text-lg">TruCal</span>
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
            <p>&copy; {new Date().getFullYear()} TruCal. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}