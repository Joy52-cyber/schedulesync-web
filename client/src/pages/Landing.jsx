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
  const navigate = useNavigate();
  const [ctaEmail, setCtaEmail] = useState('');

  const handleCtaSubmit = (e) => {
    e.preventDefault();
    // Placeholder for future: send to backend or marketing tool
    console.log('CTA email:', ctaEmail);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Floating Login Panel */}
      <LoginPanel
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />

      {/* HERO WRAPPER WITH GRADIENT */}
      <div className="bg-gradient-to-br from-indigo-600 via-fuchsia-500 to-orange-400 text-white pb-16">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-indigo-900/10 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
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
                className="text-xs sm:text-sm font-semibold text-indigo-900 rounded-full px-3 sm:px-4 py-1.5 bg-white hover:bg-slate-100 shadow-sm"
              >
                Start free
              </button>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="max-w-5xl mx-auto px-4 pt-10">
          <div className="flex flex-col items-center gap-8 text-center">
            {/* Small pill */}
            <div className="inline-flex items-center mb-1 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs sm:text-sm shadow-sm border border-white/20">
              Transform your scheduling in minutes
            </div>

            {/* Icons row (calendar + clock) */}
            <div className="flex items-center justify-center gap-10 sm:gap-16">
              <div className="hidden sm:flex w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/20 shadow-lg items-center justify-center">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div className="flex flex-col gap-3">
                <h1 className="mb-1 text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight">
                  Meetings
                  <br className="hidden sm:block" />
                  {' '}Without the Mess.
                </h1>
                <p className="text-base sm:text-lg font-medium text-white/90">
                  Your Smart Booking Link That Actually{' '}
                  <span className="italic">Works.</span>
                </p>
              </div>
              <div className="hidden sm:flex w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 shadow-lg items-center justify-center">
                <Clock className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Supporting copy */}
            <p className="max-w-2xl text-sm sm:text-base text-white/80">
              Stop juggling calendars. Stop sending “Is this time okay?” emails.
              ScheduleSync finds the perfect time, every time—so you don&apos;t
              have to.
            </p>

            {/* Bullet points */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm sm:text-base text-white/90">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Connect your calendars</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Share one smart link</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Let AI handle the rest</span>
              </div>
            </div>

            {/* Email CTA */}
            <form
              onSubmit={handleCtaSubmit}
              className="w-full max-w-md flex flex-col sm:flex-row gap-2 mt-2"
            >
              <input
                type="email"
                value={ctaEmail}
                onChange={(e) => setCtaEmail(e.target.value)}
                placeholder="Enter your work email"
                className="flex-1 bg-white text-slate-900 border border-white/40 text-sm rounded-full px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/60"
              />
              <button
                type="submit"
                className="bg-white text-indigo-700 hover:bg-slate-100 text-sm font-semibold rounded-full px-4 py-2.5 shadow-sm"
              >
                Get started
              </button>
            </form>

            <p className="text-xs text-white/80 mt-1">
              Already have an account?{' '}
              <button
                className="text-white font-medium underline-offset-2 hover:underline"
                onClick={() => setIsLoginOpen(true)}
              >
                Sign in
              </button>
            </p>
          </div>
        </section>
      </div>

      {/* MAIN CONTENT SECTIONS */}
      <main className="flex-1">
        {/* WHY TEAMS SWITCH / FEATURE CARDS */}
        <section className="max-w-5xl mx-auto px-4 -mt-10 pb-10">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8">
            <h2 className="text-center text-base sm:text-lg font-semibold text-slate-900 mb-6">
              Why teams switch to ScheduleSync
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              {/* Calendar Integration */}
              <div className="flex gap-3">
                <div className="mt-1 w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">
                    Calendar Integration (Magic-fast)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Sync Google Calendar, Outlook, Microsoft 365—even multiple
                    calendars. Your availability updates instantly, all in the
                    background.
                  </p>
                </div>
              </div>

              {/* AI-Powered Scheduling */}
              <div className="flex gap-3">
                <div className="mt-1 w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">
                    AI-Powered Scheduling
                  </h3>
                  <p className="text-xs text-slate-600">
                    Tell our AI: “Find me a 30-min meeting with Mark next week
                    after 2 PM.” Done. Booked. Emailed.
                  </p>
                </div>
              </div>

              {/* Smart Availability */}
              <div className="flex gap-3">
                <div className="mt-1 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">
                    Smart Availability
                  </h3>
                  <p className="text-xs text-slate-600">
                    No more back-and-forth. We detect conflicts, work hours, and
                    time zones, then only show slots that actually fit.
                  </p>
                </div>
              </div>

              {/* One Clean Link */}
              <div className="flex gap-3">
                <div className="mt-1 w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">
                    One Clean Link for Everything
                  </h3>
                  <p className="text-xs text-slate-600">
                    Your personal or team booking link works everywhere—email,
                    chat, website, QR code.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHERE TO SHARE / USE CASES (kept from original, lightly tweaked) */}
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-center text-sm sm:text-base font-semibold text-gray-900 mb-5">
            Where to share your link
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-purple-100 rounded-xl shadow-sm">
              <div className="p-4 text-center">
                <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-xs font-medium mb-1">Email signature</p>
                <p className="text-[11px] text-gray-600">
                  Add it below your name for every message.
                </p>
              </div>
            </div>

            <div className="bg-white border border-purple-100 rounded-xl shadow-sm">
              <div className="p-4 text-center">
                <Share2 className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-xs font-medium mb-1">Social profiles</p>
                <p className="text-[11px] text-gray-600">
                  Drop it in your LinkedIn or bio link.
                </p>
              </div>
            </div>

            <div className="bg-white border border-purple-100 rounded-xl shadow-sm">
              <div className="p-4 text-center">
                <Clock className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                <p className="text-xs font-medium mb-1">Business cards</p>
                <p className="text-[11px] text-gray-600">
                  Print a short URL or QR code.
                </p>
              </div>
            </div>

            <div className="bg-white border border-purple-100 rounded-xl shadow-sm">
              <div className="p-4 text-center">
                <CheckCircle className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-medium mb-1">Website</p>
                <p className="text-[11px] text-gray-600">
                  Embed it on your contact or pricing page.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA (kept, but matches new palette) */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <div className="bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-orange-500 text-white border-none shadow-md rounded-2xl">
            <div className="p-8 sm:p-10 text-center">
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-2">
                Ready to simplify your scheduling?
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100 mb-6">
                Join teams and solo professionals who use ScheduleSync to avoid
                back-and-forth emails and double bookings.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate('/register')}
                  className="px-5 py-2.5 rounded-full bg-white text-indigo-700 hover:bg-slate-100 text-sm font-semibold shadow-sm"
                >
                  Get started free
                </button>
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-full border border-white text-white hover:bg-white/10 text-sm font-semibold"
                >
                  Watch demo
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
