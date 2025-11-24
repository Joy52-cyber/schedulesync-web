import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Zap,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  Shield,
  Smartphone,
  CheckCircle,
  MoreHorizontal
} from 'lucide-react';
import LoginPanel from '../components/LoginPanel';

export default function Landing({ defaultLoginOpen = false }) {
  const [isLoginOpen, setIsLoginOpen] = useState(defaultLoginOpen);
  const [bookingLink, setBookingLink] = useState('');
  const [detectedSource, setDetectedSource] = useState(null); // calendly, cal.com, hubspot, google-calendar, google-meet, microsoft, schedulesync
  const [showConnectionOptions, setShowConnectionOptions] = useState(false);
  const navigate = useNavigate();

  // Detect source system from pasted booking link (hostname-based)
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

      if (host.includes('calendly.com')) {
        source = 'calendly';
      } else if (host.includes('cal.com')) {
        source = 'cal.com';
      } else if (host.includes('hubspot')) {
        source = 'hubspot';
      } else if (host.includes('google.com') && path.includes('calendar')) {
        source = 'google-calendar';
      } else if (host.includes('meet.google.com')) {
        source = 'google-meet';
      } else if (
        host.includes('outlook.') ||
        host.includes('office.com') ||
        host.includes('microsoft.')
      ) {
        source = 'microsoft';
      } else if (host.includes('eyeball.games') || host.includes('trucal.xyz')) {
        // Your own ScheduleSync-hosted booking links
        source = 'schedulesync';
      }

      setDetectedSource(source);
    } catch {
      // If URL parsing fails (partial / invalid), don't show detection
      setDetectedSource(null);
    }
  };

  // When user presses Enter on the booking link
  const handleBookingLinkSubmit = (e) => {
    e.preventDefault();
    if (!bookingLink) return;

    // Save for later use in onboarding if needed
    localStorage.setItem('importedLink', bookingLink);

    // Ensure detection uses latest value, then show connection step
    handleBookingLinkChange(bookingLink);
    setShowConnectionOptions(true);
  };

  // Detection explanation card
  const renderDetectedSuggestion = () => {
    if (!detectedSource) return null;

    let title = '';
    let body = '';

    switch (detectedSource) {
      case 'calendly':
        title = 'Calendly link detected';
        body =
          'We can connect this Calendly booking link to your ScheduleSync account so you keep your existing flows.';
        break;
      case 'cal.com':
        title = 'Cal.com link detected';
        body =
          'You can plug this Cal.com booking link into your ScheduleSync profile to keep things in sync.';
        break;
      case 'hubspot':
        title = 'HubSpot Meetings link detected';
        body =
          'Connect your HubSpot booking link inside ScheduleSync to keep your existing flows.';
        break;
      case 'google-calendar':
        title = 'Google Calendar link detected';
        body =
          'ScheduleSync can connect directly to Google Calendar so everything stays in sync.';
        break;
      case 'google-meet':
        title = 'Google Meet link detected';
        body =
          'Connect Google Calendar so new bookings automatically get Meet links.';
        break;
      case 'microsoft':
        title = 'Microsoft / Outlook link detected';
        body =
          'Connect your Outlook / Microsoft 365 calendar to sync availability automatically.';
        break;
      case 'schedulesync':
        title = 'ScheduleSync link detected';
        body =
          'This booking link is already powered by ScheduleSync. Log in to manage this link or update your availability.';
        break;
      default:
        return null;
    }

    return (
      <div className="mt-3 inline-flex items-start gap-2 max-w-md text-left text-xs sm:text-[13px] bg-white/10 border border-white/25 rounded-2xl px-3 py-2 text-white/90">
        <Zap className="w-3.5 h-3.5 mt-0.5 text-amber-200 shrink-0" />
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-white/80">{body}</div>
        </div>
      </div>
    );
  };

  // Step: choose how to connect (calendar / Calendly / proceed without)
  const renderConnectionOptions = () => {
    if (!showConnectionOptions) return null;

    const isCalendly = detectedSource === 'calendly';

    return (
      <div className="mt-3 w-full max-w-md bg-white/10 border border-white/25 rounded-2xl px-3 py-3 text-xs sm:text-[13px] text-white/90">
        <div className="font-semibold mb-1.5">
          How do you want to connect?
        </div>
        <p className="text-white/75 mb-3">
          Choose how you&apos;d like to start with ScheduleSync. You can always
          change this later in settings.
        </p>

        <div className="flex flex-col gap-1.5">
          {/* Connect calendar */}
          <button
            type="button"
            onClick={() => navigate('/register?connect=calendar')}
            className="w-full inline-flex items-center justify-between rounded-xl bg-white/90 text-slate-900 px-3 py-2 text-[12px] font-semibold hover:bg-white shadow-sm"
          >
            <span>Connect Google / Outlook calendar</span>
            <span className="text-[10px] text-slate-500">
              Recommended
            </span>
          </button>

          {/* Connect Calendly – only if we detected Calendly */}
          {isCalendly && (
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="w-full inline-flex items-center justify-between rounded-xl bg-sky-50/90 text-sky-800 px-3 py-2 text-[12px] font-semibold border border-sky-200 hover:bg-sky-50"
            >
              <span>Connect Calendly</span>
              <span className="text-[10px] text-sky-600">
                Uses your existing link
              </span>
            </button>
          )}

          {/* Proceed without */}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="w-full inline-flex items-center justify-between rounded-xl bg-transparent text-white px-3 py-2 text-[12px] font-semibold border border-white/30 hover:bg-white/5"
          >
            <span>Continue without connecting</span>
            <span className="text-[10px] text-white/70">
              Set this up later
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <LoginPanel isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* ================= HERO SECTION (Compact) ================= */}
      <div className="relative bg-indigo-900 text-white overflow-hidden pb-32">
        {/* Background Gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[80px]" />
          <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] rounded-full bg-blue-500/20 blur-[80px]" />
        </div>

        {/* Header - Slim */}
        <header className="relative z-20 border-b border-white/5 bg-white/5 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base tracking-tight">ScheduleSync</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLoginOpen(true)}
                className="text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => navigate('/register')}
                className="text-xs font-bold text-indigo-900 bg-white rounded-full px-4 py-1.5 hover:bg-indigo-50 transition-all"
              >
                Get Started
              </button>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <section className="relative z-10 max-w-3xl mx-auto px-4 pt-12 pb-16 text-center">
          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-800/50 border border-indigo-700 text-indigo-200 text-[10px] uppercase font-bold tracking-wider mb-6">
            <Sparkles className="w-3 h-3 mr-1.5 text-amber-400" />
            AI-Powered Scheduling
          </div>

          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-4 drop-shadow-sm">
            Scheduling made{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300">
              effortless.
            </span>
          </h1>

          <p className="text-base text-indigo-200/80 max-w-lg mx-auto mb-8 leading-relaxed">
            Share your link, let people book a time, and never worry about double bookings again.
          </p>

          {/* Input Field */}
          <div className="max-w-md mx-auto relative group flex flex-col items-center">
            <form onSubmit={handleBookingLinkSubmit} className="relative w-full">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-700" />
              <input
                type="text"
                value={bookingLink}
                onChange={(e) => handleBookingLinkChange(e.target.value)}
                placeholder="Enter your booking link and press Enter..."
                className="relative w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 text-sm rounded-full pl-5 pr-12 py-3 focus:outline-none focus:bg.white/20 transition-all"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 bottom-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors shadow-lg"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Detection + Connection Step */}
            {renderDetectedSuggestion()}
            {renderConnectionOptions()}
          </div>
        </section>
      </div>

      {/* ================= DASHBOARD MOCKUP (Overlapping) ================= */}
      <div className="relative z-20 px-4 -mt-24 mb-16">
        <div className="max-w-4xl mx-auto">
          {/* Main Container Frame */}
          <div className="rounded-xl bg-white p-1.5 shadow-2xl border border-slate-200/60 ring-1 ring-slate-900/5">
            <div className="aspect-[16/10] sm:aspect-[2/1] rounded-lg bg-slate-50 border border-slate-100 overflow-hidden relative flex">
              {/* Sidebar (Fake) */}
              <div className="w-16 sm:w-48 bg-white border-r border-slate-100 flex-shrink-0 flex flex-col pt-4">
                <div className="px-4 mb-6 hidden sm:block">
                  <div className="h-2 w-20 bg-slate-200 rounded" />
                </div>
                <div className="flex flex-col gap-1 px-2 sm:px-3">
                  <div className="h-8 w-full bg-indigo-50 rounded-md flex items-center justify-center sm:justify-start sm:px-3 gap-2">
                    <div className="w-4 h-4 bg-indigo-200 rounded" />
                    <div className="hidden sm:block h-2 w-16 bg-indigo-200 rounded" />
                  </div>
                  <div className="h-8 w-full hover:bg-slate-50 rounded-md flex items-center justify-center sm:justify-start sm:px-3 gap-2">
                    <div className="w-4 h-4 bg-slate-200 rounded" />
                    <div className="hidden sm:block h-2 w-20 bg-slate-200 rounded" />
                  </div>
                  <div className="h-8 w-full hover:bg-slate-50 rounded-md flex items-center justify-center sm:justify-start sm:px-3 gap-2">
                    <div className="w-4 h-4 bg-slate-200 rounded" />
                    <div className="hidden sm:block h-2 w-12 bg-slate-200 rounded" />
                  </div>
                </div>
              </div>

              {/* Main Area */}
              <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
                {/* Header (Fake) */}
                <div className="h-12 bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-6">
                  <div className="h-3 w-24 bg-slate-800 rounded-sm" />
                  <div className="flex gap-2">
                    <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200" />
                    <div className="h-7 w-20 rounded-md bg-indigo-600 shadow-sm hidden sm:block" />
                  </div>
                </div>

                {/* Dashboard Content (Fake) */}
                <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Card 1: 30 Min Meeting */}
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 group">
                    <div className="flex justify-between items-start">
                      <div className="h-3 w-3 rounded-full bg-purple-500" />
                      <MoreHorizontal className="w-4 h-4 text-slate-300" />
                    </div>
                    <div>
                      <div className="h-3 w-3/4 bg-slate-800 rounded mb-1.5" />
                      <div className="h-2 w-1/2 bg-slate-400 rounded" />
                    </div>
                    <div className="mt-2 h-6 w-full bg-slate-50 border border-slate-100 rounded flex items-center px-2">
                      <div className="h-1.5 w-1/3 bg-slate-200 rounded" />
                    </div>
                  </div>

                  {/* Card 2: 15 Min Call */}
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <MoreHorizontal className="w-4 h-4 text-slate-300" />
                    </div>
                    <div>
                      <div className="h-3 w-2/3 bg-slate-800 rounded mb-1.5" />
                      <div className="h-2 w-1/2 bg-slate-400 rounded" />
                    </div>
                    <div className="mt-2 h-6 w-full bg-slate-50 border border-slate-100 rounded flex items-center px-2">
                      <div className="h-1.5 w-1/3 bg-slate-200 rounded" />
                    </div>
                  </div>

                  {/* Card 3: Stats */}
                  <div className="hidden lg:flex bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-xl shadow-lg text-white flex-col justify-between">
                    <div className="flex gap-2 items-center opacity-80">
                      <Users className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase">Bookings</span>
                    </div>
                    <div className="text-2xl font-bold">12</div>
                    <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full w-2/3 bg-white rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

      
            </div>
          </div>
        </div>
      </div>

      {/* ================= FEATURES (Grid) ================= */}
      <section className="py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">
              Why teams switch to ScheduleSync
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Instant Setup</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Connect Google, Outlook, or Apple Calendar in one click. We auto-detect your busy slots instantly.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Conflict Protection</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Our algorithm checks across all your connected calendars to ensure you never get double-booked.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center mb-3">
                <Smartphone className="w-5 h-5 text-pink-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Mobile Optimized</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Your booking page looks perfect on any device, making it easy for clients to book on the go.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="py-10 px-4 mb-6">
        <div className="max-w-3xl mx-auto bg-slate-900 rounded-2xl overflow-hidden relative px-6 py-10 text-center shadow-lg">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-3">
              Ready to take back your time?
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-900 rounded-full text-sm font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
              >
                Start for Free <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">ScheduleSync</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-900 cursor-pointer">Privacy</span>
            <span className="hover:text-slate-900 cursor-pointer">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
