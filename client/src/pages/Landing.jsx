// client/src/pages/LandingPage.jsx
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Users, Sparkles, Zap, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      {/* Nav */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-white text-lg">
              ScheduleSync
            </span>
          </button>

          <div className="flex items-center gap-3 text-sm">
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 text-white/80 hover:text-white transition"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="px-3.5 py-1.5 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              Start free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16">
        <div className="grid lg:grid-cols-[1.2fr,1fr] gap-10 items-center">
          {/* Left side */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-white/80">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              <span>AI-assisted scheduling for teams that move fast</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              Turn scheduling chaos into a single, shared source of truth.
            </h1>

            <p className="text-sm sm:text-base text-white/80 max-w-xl">
              ScheduleSync connects your team members, external booking links,
              and calendars into one intelligent system. Let guests book in
              seconds while you keep full control over availability, buffers,
              and meeting rules.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 text-white/90 text-sm hover:border-white/50 hover:bg-white/5 transition"
              >
                I already have an account
              </Link>
            </div>

            {/* Key points */}
            <div className="grid sm:grid-cols-3 gap-4 pt-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-300" />
                  <p className="font-semibold">Team-first scheduling</p>
                </div>
                <p className="text-white/70">
                  Individual, round-robin, collective, and first-available
                  booking flows built in.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-300" />
                  <p className="font-semibold">Smart slot suggestions</p>
                </div>
                <p className="text-white/70">
                  AI ranks the best time slots using working hours, conflicts,
                  and buffers.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-300" />
                  <p className="font-semibold">Calendar-native</p>
                </div>
                <p className="text-white/70">
                  Designed around Google Calendar, external booking links, and
                  clean guest flows.
                </p>
              </div>
            </div>
          </div>

          {/* Right side – simple preview card */}
          <div className="relative">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 -left-6 w-32 h-32 bg-blue-500/30 rounded-full blur-3xl" />

            <div className="relative bg-slate-900/80 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-white/60">Upcoming demo</p>
                  <p className="text-sm font-semibold">Sales team booking</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-medium">
                  AUTO-ROUTED
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Mode</span>
                  <span className="font-medium">Round-robin</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Team</span>
                  <span className="font-medium">Sales EMEA · 4 members</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Buffer</span>
                  <span className="font-medium">15 min before &amp; after</span>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-xl bg-slate-800/80 border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70">AI suggestion</span>
                  <span className="text-emerald-300 font-semibold">
                    Match score: 92%
                  </span>
                </div>
                <p className="text-[11px] text-white/60">
                  “This slot avoids internal conflicts and keeps buffers for
                  all participants.”
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-sm font-semibold"
              >
                Log in and set up availability
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} ScheduleSync. Built for teams who are done
        with calendar chaos.
      </footer>
    </div>
  );
}
