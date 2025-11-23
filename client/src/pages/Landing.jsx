import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Sparkles,
  Clock,
  ArrowRight,
  Shield,
  BarChart2,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Top nav */}
      <header className="w-full border-b border-white/5 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                ScheduleSync
              </div>
              <div className="text-[11px] text-slate-400">
                Team scheduling that actually scales
              </div>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-300">
            <button
              onClick={() => {
                const el = document.getElementById('features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-white"
            >
              Features
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('how-it-works');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-white"
            >
              How it works
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('pricing');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-white"
            >
              For teams
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:inline-flex text-sm text-slate-300 hover:text-white"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="inline-flex items-center gap-2 rounded-full bg-white text-slate-950 px-4 py-1.5 text-sm font-semibold shadow-lg shadow-blue-500/30 hover:bg-slate-100"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 pt-12 pb-20">
        <section className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200 mb-4">
              <Sparkles className="h-3 w-3" />
              Built for teams that live in their calendars
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white mb-4">
              One link to schedule your
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300">
                entire team, across tools.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 mb-6 max-w-xl">
              ScheduleSync centralizes bookings for your whole team — whether
              you use Google Calendar, Outlook, or external booking tools like
              Calendly. No more double-bookings, no more juggling links.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold shadow-lg shadow-blue-500/40 hover:bg-blue-600"
              >
                Start free workspace
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-400"
              >
                Sign in
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-400" />
                No credit card required
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-400" />
                Perfect for client-facing teams
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-400" />
                Built-in AI scheduling assistant
              </div>
            </div>
          </div>

          {/* Visual preview / fake dashboard */}
          <div className="relative">
            <div className="absolute -top-10 -right-8 h-36 w-36 rounded-full bg-blue-500/30 blur-3xl" />
            <div className="absolute bottom-0 -left-8 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />

            <div className="relative rounded-2xl border border-slate-700/70 bg-slate-900/70 backdrop-blur shadow-2xl shadow-blue-900/70 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">
                    Today&apos;s pipeline
                  </p>
                  <p className="text-sm font-semibold text-white">
                    12 meetings, 4 teammates, 0 conflicts
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  AI is suggesting optimal slots
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-300" />
                      <span className="text-xs font-semibold text-slate-100">
                        Team booking
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300 border border-emerald-500/30">
                      Round robin
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Automatically routes incoming bookings to the right person.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-cyan-300" />
                      <span className="text-xs font-semibold text-slate-100">
                        Smart availability
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300 border border-blue-500/30">
                      AI-assisted
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Respects buffers, working hours, and external bookings.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-violet-300" />
                  <div>
                    <p className="text-xs font-semibold text-slate-100">
                      Insights for your team
                    </p>
                    <p className="text-[11px] text-slate-400">
                      See who&apos;s overbooked and where you&apos;re losing
                      leads.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-emerald-300">
                    +27% more completed meetings
                  </p>
                  <p className="text-[10px] text-slate-500">
                    after centralizing booking links
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 right-4 rounded-xl bg-slate-900/90 border border-slate-700 px-3 py-2 flex items-center gap-2 text-[11px] text-slate-200 shadow-lg shadow-slate-950/80">
              <Shield className="h-3.5 w-3.5 text-emerald-300" />
              <span>Built for agencies, coaches, & remote teams</span>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section id="features" className="mt-16">
          <p className="text-xs font-semibold text-blue-300 mb-2">
            WHY TEAMS USE SCHEDULESYNC
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-6">
            All your booking chaos, routed into one clean system.
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 text-sm">
            <FeatureCard
              icon={<Users className="h-4 w-4" />}
              title="Team-based booking modes"
              body="Round-robin, collective, or first available. Everyone stays in sync, guests just see one link."
            />
            <FeatureCard
              icon={<Calendar className="h-4 w-4" />}
              title="Deep calendar rules"
              body="Buffers, working hours, blocked times, and lead time — enforced automatically across the team."
            />
            <FeatureCard
              icon={<Sparkles className="h-4 w-4" />}
              title="AI scheduling assistant"
              body="Let guests say what they need in plain language. AI proposes the best slots based on your rules."
            />
            <FeatureCard
              icon={<Clock className="h-4 w-4" />}
              title="No more double-booking"
              body="We look at your existing calendars and external booking tools before showing a slot."
            />
            <FeatureCard
              icon={<BarChart2 className="h-4 w-4" />}
              title="Booking analytics"
              body="Soon: see which teammates are overloaded, which links convert, and when your team is in demand."
            />
            <FeatureCard
              icon={<Shield className="h-4 w-4" />}
              title="Client-ready experience"
              body="Simple, branded booking flows for your guests. Powerful controls under the hood for your team."
            />
          </div>
        </section>

        {/* Small "For teams" section / pricing teaser */}
        <section id="pricing" className="mt-16">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-300 mb-1">
                FOR GROWING TEAMS
              </p>
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
                Start free while you onboard your first teammates.
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                Perfect for agencies, consultants, and product teams that need
                shared booking links, not just individual pages.
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <p className="text-xs text-slate-400">
                Early access pricing —
                <span className="text-emerald-300 font-semibold">
                  {' '}
                  founder-led support included.
                </span>
              </p>
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400"
              >
                Create my workspace
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, body }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 flex flex-col gap-2">
      <div className="inline-flex items-center gap-2 text-slate-100">
        <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-blue-300">
          {icon}
        </div>
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <p className="text-xs text-slate-300">{body}</p>
    </div>
  );
}
