import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Zap,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Clock,
  Users,
  Shield,
  Smartphone,
  Star,
  Globe,
  Bot,
  Mail,
  Link2,
  TrendingUp,
  MessageSquare,
  Play,
  Check,
  ChevronRight,
  Plus,
  X
} from 'lucide-react';
import LoginPanel from '../components/LoginPanel';

export default function Landing({ defaultLoginOpen = false }) {
  const [isLoginOpen, setIsLoginOpen] = useState(defaultLoginOpen);
  const [bookingLink, setBookingLink] = useState('');
  const [detectedSource, setDetectedSource] = useState(null);
  const [showConnectionOptions, setShowConnectionOptions] = useState(false);
  const navigate = useNavigate();

  // Detect source system from pasted booking link
  const handleBookingLinkChange = (value) => {
    setBookingLink(value);
    setShowConnectionOptions(false);

    if (!value) {
      setDetectedSource(null);
      return;
    }

    try {
      const normalized = value.startsWith('http') ? value : `https://${value}`;
      const url = new URL(normalized);
      const host = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();

      let source = null;

      if (host.includes('calendly.com')) source = 'calendly';
      else if (host.includes('cal.com')) source = 'cal.com';
      else if (host.includes('hubspot')) source = 'hubspot';
      else if (host.includes('google.com') && path.includes('calendar')) source = 'google-calendar';
      else if (host.includes('meet.google.com')) source = 'google-meet';
      else if (host.includes('outlook.') || host.includes('office.com') || host.includes('microsoft.')) source = 'microsoft';
      else if (host.includes('trucal.xyz')) source = 'schedulesync';

      setDetectedSource(source);
    } catch {
      setDetectedSource(null);
    }
  };

  const handleBookingLinkSubmit = (e) => {
    e.preventDefault();
    if (!bookingLink) return;
    localStorage.setItem('importedLink', bookingLink);
    handleBookingLinkChange(bookingLink);
    setShowConnectionOptions(true);
  };

  const renderDetectedSuggestion = () => {
    if (!detectedSource) return null;
    
    let title = '';
    let body = '';

    switch (detectedSource) {
      case 'calendly': title = 'Calendly link detected'; body = 'Connect this link to keep your existing flows.'; break;
      case 'cal.com': title = 'Cal.com link detected'; body = 'Plug this link in to keep things in sync.'; break;
      case 'hubspot': title = 'HubSpot link detected'; body = 'Connect HubSpot to keep existing flows.'; break;
      case 'google-calendar': title = 'Google Calendar detected'; body = 'Connect directly to stay in sync.'; break;
      case 'google-meet': title = 'Google Meet detected'; body = 'Connect Calendar for auto Meet links.'; break;
      case 'microsoft': title = 'Outlook detected'; body = 'Connect Outlook to sync availability.'; break;
      case 'schedulesync': title = 'ScheduleSync link'; body = 'Log in to manage this link.'; break;
      default: return null;
    }

    return (
      <div className="mt-3 inline-flex items-start gap-2 max-w-md text-left text-xs bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-white/90 animate-in fade-in slide-in-from-top-2 backdrop-blur-sm">
        <Zap className="w-3.5 h-3.5 mt-0.5 text-amber-300 shrink-0" />
        <div>
          <div className="font-bold">{title}</div>
          <div className="text-white/80 text-[11px] leading-tight">{body}</div>
        </div>
      </div>
    );
  };

  const renderConnectionOptions = () => {
    if (!showConnectionOptions) return null;
    const isCalendly = detectedSource === 'calendly';

    return (
      <div className="mt-3 w-full max-w-sm bg-white/10 border border-white/25 rounded-xl p-3 text-white/90 animate-in fade-in slide-in-from-top-2 backdrop-blur-sm">
        <div className="font-bold text-center mb-2 text-xs">How do you want to connect?</div>
        
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setIsLoginOpen(true)} className="w-full flex items-center justify-between rounded-lg bg-white text-slate-900 px-3 py-2 text-xs font-bold hover:bg-slate-100 transition-all">
            <span>Connect Google / Outlook</span>
            <span className="text-[10px] text-slate-500 font-medium">Recommended</span>
          </button>

          {isCalendly && (
            <button type="button" onClick={() => setIsLoginOpen(true)} className="w-full flex items-center justify-between rounded-lg bg-sky-100 text-sky-900 px-3 py-2 text-xs font-bold hover:bg-sky-200 transition-all">
              <span>Connect Calendly</span>
              <span className="text-[10px] text-sky-700 font-medium">Uses existing link</span>
            </button>
          )}

          <button type="button" onClick={() => navigate('/register')} className="w-full flex items-center justify-between rounded-lg bg-white/10 text-white px-3 py-2 text-xs font-bold border border-white/20 hover:bg-white/20 transition-all">
            <span>Continue without connecting</span>
            <span className="text-[10px] text-white/60 font-medium">Set up later</span>
          </button>
        </div>
        
        <div className="text-center mt-2 text-[10px] text-white/60">
          Already have an account? <button onClick={() => setIsLoginOpen(true)} className="text-white font-semibold hover:underline ml-1">Sign in</button>
        </div>
      </div>
    );
  };

  const features = [
    {
      icon: Bot,
      title: 'AI Scheduling Assistant',
      description: 'Say "Book meeting with john@email.com tomorrow 2pm" and it\'s done. No forms, no clicks.',
      stat: '10x faster',
      color: 'from-purple-500 to-pink-500',
      demo: 'Ask AI: "Book with client@company.com tomorrow"'
    },
    {
      icon: Zap,
      title: 'Instant Calendar Sync',
      description: 'Connect Google, Outlook, or Apple Calendar in one click. Auto-detects your availability.',
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

  const testimonials = [
    {
      quote: "ScheduleSync's AI assistant saves me 2 hours every week. I just tell it what I need and it books everything.",
      author: "Sarah Chen",
      role: "Sales Director",
      company: "TechCorp",
      avatar: "SC"
    },
    {
      quote: "We switched from Calendly and saved $180/month while getting better features. The AI is game-changing.",
      author: "Michael Rodriguez",
      role: "Founder",
      company: "StartupXYZ",
      avatar: "MR"
    },
    {
      quote: "Finally, a scheduling tool that works the way I think. No more copy-pasting links in every email.",
      author: "Emily Watson",
      role: "Consultant",
      company: "Independent",
      avatar: "EW"
    }
  ];

  const comparisonData = [
    { feature: 'AI Scheduling Assistant', schedulesync: 'Free (10/mo)', calendly: false, cal: false },
    { feature: 'Custom Booking URL', schedulesync: 'Free', calendly: '$12/mo', cal: 'Free' },
    { feature: 'Unlimited Event Types', schedulesync: 'Pro $12/mo', calendly: '$12/mo', cal: 'Free' },
    { feature: 'Email Templates', schedulesync: 'Pro $12/mo', calendly: '$12/mo', cal: '$12/mo' },
    { feature: 'Team Scheduling', schedulesync: 'Team $25/mo', calendly: '$20/seat', cal: '$15/mo' },
    { feature: 'Round-Robin Booking', schedulesync: 'Team $25/mo', calendly: '$20/seat', cal: '$15/mo' },
    { feature: 'Magic Links', schedulesync: 'Free (3/mo)', calendly: false, cal: false },
    { feature: 'Email Reminders', schedulesync: 'Free', calendly: 'Free', cal: 'Free' },
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
        '3 magic links/month',
        'Google & Outlook sync',
        'Email reminders',
        'Custom booking URL',
      ],
      cta: 'Get Started Free',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$12',
      period: '/month',
      description: 'For busy professionals',
      features: [
        'Unlimited bookings',
        'Unlimited event types',
        'Unlimited AI queries',
        'Unlimited magic links',
        'Email templates',
        'Priority support',
        'Custom branding',
      ],
      cta: 'Start Pro Trial',
      popular: true,
    },
    {
      name: 'Team',
      price: '$25',
      period: '/month',
      description: 'For growing teams',
      features: [
        'Everything in Pro',
        'Unlimited teams',
        'Round-robin booking',
        'Collective availability',
        'Team booking pages',
        'Admin controls',
        'Up to 10 members',
      ],
      cta: 'Start Team Trial',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <LoginPanel isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* ================= HEADER ================= */}
<header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
    <div className="flex items-center justify-between">
      {/* Logo - always visible */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg">ScheduleSync</span>
      </div>
      
      {/* Desktop Nav - hidden on mobile */}
      <div className="hidden md:flex items-center gap-6 text-sm">
        <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium">Features</a>
        <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
        <a href="#compare" className="text-gray-600 hover:text-gray-900 font-medium">Compare</a>
      </div>

      {/* Desktop Auth Buttons - hidden on mobile */}
      <div className="hidden md:flex items-center gap-3">
        <button 
          onClick={() => setIsLoginOpen(true)}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Log in
        </button>
        <button 
          onClick={() => navigate('/register')}
          className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full px-4 py-2 hover:shadow-lg transition-all"
        >
          Get Started Free
        </button>
      </div>
    </div>
  </div>
</header>

      {/* ================= HERO SECTION ================= */}
      <section className="relative bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 overflow-hidden pt-20 pb-32">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-purple-200 text-sm font-medium text-purple-600 mb-8 shadow-sm">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            <span>Trusted by 10,000+ professionals</span>
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-purple-200">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="font-bold">4.9/5</span>
            </div>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 tracking-tight">
            Schedule meetings<br />
            with <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">just your voice</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
            Say goodbye to back-and-forth emails. Our AI assistant books meetings for you in seconds—just tell it what you need.
          </p>

          {/* Link Detection Input */}
          <div className="max-w-sm mx-auto flex flex-col items-center w-full mb-8">
            <div className="relative w-full group">
              <div className="absolute inset-0 bg-white rounded-full blur opacity-20 group-hover:opacity-30 transition duration-700"></div>
              <form onSubmit={handleBookingLinkSubmit} className="relative flex w-full">
                <input
                  type="text"
                  value={bookingLink}
                  onChange={(e) => handleBookingLinkChange(e.target.value)}
                  placeholder="Paste your Calendly/Cal.com link..."
                  className="w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium rounded-full pl-4 pr-10 py-3 focus:outline-none shadow-xl transition-all focus:ring-2 focus:ring-purple-500"
                />
                <button 
                  type="submit"
                  className="absolute right-1 top-1 bottom-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors shadow-md"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
            
            {/* Detection Badge & Connection Options */}
            {detectedSource && (
              <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col items-center">
                {!showConnectionOptions && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-sm border border-purple-300 text-[10px] font-bold text-purple-600 shadow-sm">
                    <CheckCircle className="w-3 h-3 text-emerald-500" /> 
                    Link Detected
                  </div>
                )}
                {renderDetectedSuggestion()}
                {renderConnectionOptions()}
              </div>
            )}

            {/* "Continue without link" Option */}
            {!detectedSource && (
              <button
                onClick={() => navigate('/register')}
                className="mt-4 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1.5 group"
              >
                <Plus className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                <span>Don't have a link? Start from scratch</span>
              </button>
            )}
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
            <button className="px-8 py-4 bg-white text-gray-900 rounded-full text-lg font-semibold border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all flex items-center gap-2">
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600">
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
<div className="mt-16 relative max-w-5xl mx-auto">
  <div className="relative rounded-2xl overflow-hidden shadow-2xl border-8 border-white">
    <div className="bg-gradient-to-br from-purple-100 to-pink-100 aspect-video flex items-center justify-center">
      {/* Mockup Chat Interface */}
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl p-6 mx-4">
        {/* ... chat content ... */}
      </div>
    </div>
  </div>
  
  {/* Stats - NOW INSIDE as a proper row below */}
  <div className="flex flex-wrap justify-center gap-4 mt-8">
    <div className="bg-white rounded-xl shadow-xl px-6 py-4 border border-gray-100">
      <div className="text-3xl font-bold text-purple-600">10x</div>
      <div className="text-sm text-gray-600">Faster booking</div>
    </div>
    <div className="bg-white rounded-xl shadow-xl px-6 py-4 border border-gray-100">
      <div className="text-3xl font-bold text-pink-600">95%</div>
      <div className="text-sm text-gray-600">Time saved</div>
    </div>
    <div className="bg-white rounded-xl shadow-xl px-6 py-4 border border-gray-100">
      <div className="text-3xl font-bold text-blue-600">0</div>
      <div className="text-sm text-gray-600">Double bookings</div>
    </div>
  </div>
</div>

      {/* ================= TRUSTED BY ================= */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-8">
              Switching from these platforms daily
            </p>
            <div className="flex flex-wrap items-center justify-center gap-12 opacity-60">
              <div className="text-2xl font-bold text-gray-400">Calendly</div>
              <div className="text-2xl font-bold text-gray-400">Cal.com</div>
              <div className="text-2xl font-bold text-gray-400">HubSpot</div>
              <div className="text-2xl font-bold text-gray-400">Chili Piper</div>
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

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
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

      {/* ================= TESTIMONIALS ================= */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Loved by busy professionals
            </h2>
            <p className="text-xl text-gray-600">
              See what people are saying about ScheduleSync
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                
                <p className="text-gray-700 mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </p>
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{testimonial.author}</div>
                    <div className="text-sm text-gray-600">{testimonial.role} @ {testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= COMPARISON TABLE ================= */}
      <section id="compare" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Why switch to ScheduleSync?
            </h2>
            <p className="text-xl text-gray-600">
              More features. Better AI. Competitive pricing.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-6 text-sm font-semibold text-gray-600 uppercase tracking-wider">Feature</th>
                  <th className="text-center p-6">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center mb-2">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div className="font-bold text-gray-900">ScheduleSync</div>
                      <div className="text-xs text-green-600 font-semibold">Free - $25/mo</div>
                    </div>
                  </th>
                  <th className="text-center p-6 text-gray-600">
                    <div className="font-semibold">Calendly</div>
                    <div className="text-xs text-gray-500">Free - $20/seat</div>
                  </th>
                  <th className="text-center p-6 text-gray-600">
                    <div className="font-semibold">Cal.com</div>
                    <div className="text-xs text-gray-500">Free - $15/mo</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
                    <td className="p-6 font-medium text-gray-900">{row.feature}</td>
                    <td className="p-6 text-center">
                      {typeof row.schedulesync === 'string' ? (
                        <span className="text-purple-600 font-semibold text-sm">{row.schedulesync}</span>
                      ) : row.schedulesync ? (
                        <CheckCircle className="w-6 h-6 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="p-6 text-center text-sm text-gray-600">
                      {typeof row.calendly === 'string' ? (
                        <span className="text-orange-600 font-medium">{row.calendly}</span>
                      ) : row.calendly ? (
                        <CheckCircle className="w-5 h-5 text-gray-400 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="p-6 text-center text-sm text-gray-600">
                      {typeof row.cal === 'string' ? (
                        <span className="text-gray-600">{row.cal}</span>
                      ) : row.cal ? (
                        <CheckCircle className="w-5 h-5 text-gray-400 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-gray-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-12">
            <button 
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-lg font-bold hover:shadow-2xl transition-all transform hover:scale-105"
            >
              Start for Free – No Credit Card Required
            </button>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="py-24 bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6">
            Ready to save 10 hours a week?
          </h2>
          <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
            Join 10,000+ professionals who've ditched the back-and-forth emails.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button 
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-white text-purple-600 rounded-full text-lg font-bold hover:shadow-2xl transition-all transform hover:scale-105"
            >
              Get Started Free
            </button>
            <button className="px-8 py-4 bg-purple-500/30 backdrop-blur-sm text-white rounded-full text-lg font-semibold border-2 border-white/30 hover:bg-purple-500/50 transition-all">
              Book a Demo
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
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
            <p>&copy; {new Date().getFullYear()} ScheduleSync. All rights reserved.</p>
            <div className="flex items-center gap-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
              <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}