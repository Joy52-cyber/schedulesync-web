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
    console.log('CTA email:', ctaEmail);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* LOGIN PANEL */}
      <LoginPanel isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* HERO GRADIENT WRAPPER */}
      <div className="bg-gradient-to-br from-indigo-600 via-fuchsia-500 to-orange-400 text-white pb-12">

        {/* HEADER */}
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
                className="text-xs sm:text-sm font-semibold text-indigo-700 bg-white rounded-full px-3 sm:px-4 py-1.5 hover:bg-slate-100 shadow-sm"
              >
                Start free
              </button>
            </div>
          </div>
        </header>

        {/* HERO – COMPACT FLOATING ICONS */}
        <section className="max-w-5xl mx-auto px-4 pt-10 pb-10 text-center">
          <div className="flex flex-col items-center gap-7">

            {/* TAGLINE */}
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/15 text-white text-xs sm:text-sm border border-white/20">
              Transform your scheduling in minutes
            </div>

            {/* TITLE + FLOATING ICONS */}
            <div className="flex items-center justify-center gap-6 sm:gap-10">

              {/* LEFT ICON */}
              <div className="hidden sm:flex w-16 h-16 md:w-20 md:h-20 bg-white/18 border border-white/30 rounded-3xl shadow-xl items-center justify-center motion-safe:animate-bounce">
                <Calendar className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>

              {/* TEXT */}
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

              {/* RIGHT ICON */}
              <div className="hidden sm:flex w-16 h-16 md:w-20 md:h-20 bg-white/18 border border-white/30 rounded-full shadow-xl items-center justify-center motion-safe:animate-bounce">
                <Clock className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
            </div>

            {/* SUPPORTING TEXT */}
            <p className="max-w-2xl text-sm sm:text-base text-white/80 mx-auto">
              Stop juggling calendars. Stop sending “Is this time okay?” emails.
              ScheduleSync finds the perfect time, every time—so you don&apos;t have to.
            </p>

            {/* BULLETS */}
            <div className="flex flex-wrap justify-center gap-4 text-white/90 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Connect your calendars</span>
              </div>

              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Share one smart link</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Let AI handle the rest</span>
              </div>
            </div>

            {/* EMAIL CTA */}
            <form
              onSubmit={handleCtaSubmit}
              className="w-full max-w-md flex flex-col sm:flex-row gap-2 mt-1"
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

      {/* ——— MAIN CONTENT ——— */}

      {/* FEATURE SECTION */}
      <section className="max-w-5xl mx-auto px-4 -mt-10 pb-10">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8">
          <h2 className="text-center text-base sm:text-lg font-semibold text-slate-900 mb-6">
            Why teams switch to ScheduleSync
          </h2>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Feature 1 */}
            <div className="flex gap-3">
              <div className="mt-1 w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Calendar Integration (Magic-fast)</h3>
                <p className="text-xs text-slate-600">
                  Sync Google Calendar, Outlook, Microsoft 365—even multiple calendars.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-3">
              <div className="mt-1 w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">AI-Powered Scheduling</h3>
                <p className="text-xs text-slate-600">
                  Tell our AI: “Find me a 30-min meeting next week after 2PM.” Done.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-3">
              <div className="mt-1 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Smart Availability</h3>
                <p className="text-xs text-slate-600">
                  Detects conflicts, work hours, time zones — shows only slots that fit.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-3">
              <div className="mt-1 w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">One Clean Link for Everything</h3>
                <p className="text-xs text-slate-600">
                  Works anywhere — email, chat, website, QR code.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHERE TO SHARE */}
      <section className="max-w-5xl mx-auto px-4 pb-12">
        <h2 className="text-center text-sm sm:text-base font-semibold text-gray-900 mb-5">
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

      {/* FINAL CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <div className="bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-orange-500 text-white shadow-md rounded-2xl">
          <div className="p-8 sm:p-10 text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-2">
              Ready to simplify your scheduling?
            </h2>

            <p className="text-xs sm:text-sm text-indigo-100 mb-6">
              Join teams and solo professionals who avoid double bookings with ScheduleSync.
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

    </div>
  );
}
