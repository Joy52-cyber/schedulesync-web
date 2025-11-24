// client/src/pages/Landing.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Zap,
  Share2,
  Users,
  Clock,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import LoginPanel from '../components/LoginPanel';

export default function Landing({ defaultLoginOpen = false }) {
  const [isLoginOpen, setIsLoginOpen] = useState(defaultLoginOpen);
  const [bookingLink, setBookingLink] = useState('');
  const [detectedSource, setDetectedSource] = useState(null);
  const navigate = useNavigate();

  // Detect source system from pasted booking link
  const handleBookingLinkChange = (value) => {
    setBookingLink(value);

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
      }

      setDetectedSource(source);
    } catch (err) {
      // Invalid URL or partial input — don't show suggestions
      setDetectedSource(null);
    }
  };

  // Human-friendly suggestion text per detected system
  const renderDetectedSuggestion = () => {
    if (!detectedSource) return null;

    let title = '';
    let body = '';

    switch (detectedSource) {
      case 'calendly':
        title = 'Calendly link detected';
        body =
          'After you sign up, you can add this as your external booking link so ScheduleSync and Calendly work together.';
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
          'ScheduleSync can connect directly to Google Calendar during setup so everything stays in sync.';
        break;
      case 'google-meet':
        title = 'Google Meet link detected';
        body =
          'Connect Google Calendar in ScheduleSync so new bookings automatically get Meet links.';
        break;
      case 'microsoft':
        title = 'Microsoft / Outlook link detected';
        body =
          'Connect your Outlook / Microsoft 365 calendar in ScheduleSync to sync availability automatically.';
        break;
      default:
        return null;
    }

    return (
      <div className="mt-2 inline-flex items-start gap-2 max-w-md text-left text-xs sm:text-[13px] bg-white/10 border border-white/25 rounded-2xl px-3 py-2 text-white/90">
        <Zap className="w-3.5 h-3.5 mt-0.5 text-amber-200 shrink-0" />
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-white/80">{body}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Login modal */}
      <LoginPanel isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* HERO GRADIENT */}
      <div className="bg-gradient-to-br from-indigo-600 via-fuchsia-500 to-orange-400 text-white pb-10">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-indigo-900/10 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white text-sm sm:text-base">
                ScheduleSync
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLoginOpen(true)}
                className="text-xs sm:text-sm font-medium text-white/80 hover:text-white"
              >
                Log in
              </button>
              <button
                onClick={() => navigate('/register')}
                className="text-xs sm:text-sm font-semibold text-indigo-700 bg-white rounded-full px-3 sm:px-4 py-1.5 hover:bg-slate-100 shadow-sm"
              >
                Start free
              </button>
            </div>
          </div>
        </header>

        {/* HERO – compact, with floating cards like the mockup */}
        <section className="max-w-4xl mx-auto px-4 pt-10 pb-8 text-center">
          <div className="flex flex-col items-center gap-6">
            {/* Tagline pill */}
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/15 text-white text-xs sm:text-sm border border-white/20">
              Transform your scheduling in minutes
            </div>

            {/* Title + floating icons row */}
            <div className="flex items-center justify-center gap-6 sm:gap-10">
              {/* Left floating card */}
              <div className="hidden sm:flex w-16 h-16 rounded-3xl bg-white/12 border border-white/30 shadow-[0_18px_45px_rgba(15,23,42,0.35)] items-center justify-center motion-safe:animate-bounce">
                <Calendar className="w-7 h-7 text-white" />
              </div>

              <div className="flex flex-col gap-2">
                <h1 className="text-3xl sm:text-4xl font-semibold leading-tight text-white drop-shadow-sm">
                  Meetings
                  <br className="hidden sm:block" />
                  {' '}Without the Mess.
                </h1>
                <p className="text-sm sm:text-base font-medium text-white/90">
                  Your Smart Booking Link That Actually <span className="italic">Works.</span>
                </p>
              </div>

              {/* Right floating card */}
              <div className="hidden sm:flex w-16 h-16 rounded-full bg-white/12 border border-white/30 shadow-[0_18px_45px_rgba(15,23,42,0.35)] items-center justify-center motion-safe:animate-bounce">
                <Clock className="w-7 h-7 text-white" />
              </div>
            </div>

            {/* Supporting text */}
            <p className="max-w-2xl text-sm sm:text-base text-white/80 mx-auto">
              Paste your existing booking link and we&apos;ll help you connect
              it with ScheduleSync so you don&apos;t have to start from scratch.
            </p>

            {/* Bullets */}
            <div className="flex flex-wrap justify-center gap-4 text-white/90 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Bring your existing booking links</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Connect Calendly, Google, Outlook & more</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Let AI handle your availability</span>
              </div>
            </div>

            {/* Booking link + CTA */}
            <div className="flex flex-col items-center gap-2 mt-1">
              <div className="w-full max-w-md flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={bookingLink}
                  onChange={(e) => handleBookingLinkChange(e.target.value)}
                  placeholder="Enter your booking link (Calendly, Google, etc.)"
                  className="flex-1 bg-white text-slate-900 border border-white/40 text-sm rounded-full px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/60"
                />
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="bg-white text-indigo-700 hover:bg-slate-100 text-sm font-semibold rounded-full px-4 py-2.5 shadow-sm"
                >
                  Start with ScheduleSync
                </button>
              </div>

              {/* suggestion based on detected link source */}
              {renderDetectedSuggestion()}
            </div>

            <p className="text-xs text-white/80">
              Already have an account?{' '}
              <button
                onClick={() => setIsLoginOpen(true)}
                className="text-white font-medium underline-offset-2 hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </section>
      </div>

      {/* MAIN CONTENT – compact sections */}

      {/* Why teams switch */}
      <section className="max-w-5xl mx-auto px-4 -mt-8 pb-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-7">
          <h2 className="text-center text-base sm:text-lg font-semibold text-slate-900 mb-5">
            Why teams switch to ScheduleSync
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="flex gap-3">
              <div className="mt-1 w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  Calendar Integration (Magic-fast)
                </h3>
                <p className="text-xs text-slate-600">
                  Sync Google Calendar, Outlook, Microsoft 365—even multiple calendars.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-1 w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  AI-Powered Scheduling
                </h3>
                <p className="text-xs text-slate-600">
                  Tell our AI: “Find me a 30-min meeting next week after 2 PM.” Done.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-1 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  Smart Availability
                </h3>
                <p className="text-xs text-slate-600">
                  Detects conflicts, work hours, and time zones—shows only slots that fit.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-1 w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  One Clean Link for Everything
                </h3>
                <p className="text-xs text-slate-600">
                  Works everywhere—email, chat, website, QR code.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Where to share */}
      <section className="max-w-5xl mx-auto px-4 pb-9">
        <h2 className="text-center text-sm sm:text-base font-semibold text-gray-900 mb-4">
          Where to share your link
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4 text-center">
            <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-xs font-medium mb-1">Email signature</p>
            <p className="text-[11px] text-gray-600">Add it under your name.</p>
          </div>
          <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4 text-center">
            <Share2 className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-xs font-medium mb-1">Social profiles</p>
            <p className="text-[11px] text-gray-600">Drop it in your bio link.</p>
          </div>
          <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4 text-center">
            <Clock className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-xs font-medium mb-1">Business cards</p>
            <p className="text-[11px] text-gray-600">Print a short URL or QR.</p>
          </div>
          <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4 text-center">
            <CheckCircle className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-xs font-medium mb-1">Website</p>
            <p className="text-[11px] text-gray-600">Embed it on your site.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
