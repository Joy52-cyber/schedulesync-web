import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Zap,
  Share2,
  Users,
  Clock,
  CheckCircle,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const handleStartFree = () => {
    navigate('/register');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="border-b border-purple-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900">
              ScheduleSync
            </span>
          </button>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogin}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Log in
            </button>
            <button
              onClick={handleStartFree}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:from-blue-600 hover:to-purple-700 transition-all"
            >
              Start free
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {/* Hero + Features (compact) */}
        <section className="max-w-6xl mx-auto px-4 py-10 md:py-12">
          <div className="grid md:grid-cols-[1.2fr,1fr] gap-10 items-center">
            {/* Hero copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full bg-white/70 border border-purple-100 text-xs font-medium text-purple-700">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                AI-powered team scheduling
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight">
                Turn scheduling chaos into a single, shared source of truth.
              </h1>

              <p className="text-sm md:text-base text-gray-600 mb-5 max-w-xl">
                ScheduleSync connects your team meetings, personal tasks, and
                everything in between—without the back-and-forth. No more double
                bookings. Just clean, reliable availability.
              </p>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3 mb-3 max-w-md">
                <input
                  type="email"
                  placeholder="Work email"
                  className="flex-1 px-3 py-2 rounded-lg border border-purple-100 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 text-sm"
                />
                <button
                  onClick={handleStartFree}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md hover:from-blue-600 hover:to-purple-700 hover:shadow-lg transition-all"
                >
                  Get started free
                </button>
              </div>
              <p className="text-xs text-gray-500">
                No credit card required.{' '}
                <button
                  onClick={handleLogin}
                  className="text-purple-600 hover:text-purple-700 font-semibold"
                >
                  Already have an account? Sign in
                </button>
              </p>
            </div>

            {/* Small feature cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-purple-100 p-4 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  Calendar integration
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Connect Google & Outlook and keep one clean source of truth.
                </p>
              </div>

              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-purple-100 p-4 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center mb-2">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  Smart availability
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  AI-powered slot suggestions that respect everyone&apos;s
                  calendar.
                </p>
              </div>

              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-purple-100 p-4 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center mb-2">
                  <Share2 className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  One shareable link
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Let guests book in seconds—no accounts or logins needed.
                </p>
              </div>

              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-purple-100 p-4 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  Built for teams
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Round-robin, collective, and first-available booking modes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Compact “How it works” + use cases */}
        <section className="max-w-6xl mx-auto px-4 pb-10 md:pb-12">
          <div className="grid md:grid-cols-2 gap-8 items-start rounded-2xl bg-white/80 border border-purple-100 shadow-sm px-5 py-6 md:px-8 md:py-7">
            {/* Steps */}
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">
                Get your booking link in 4 quick steps
              </h2>
              <div className="space-y-3">
                {[
                  {
                    n: 1,
                    title: 'Create your account',
                    desc: 'Sign up for free—takes less than a minute.',
                  },
                  {
                    n: 2,
                    title: 'Connect your calendars',
                    desc: 'Link Google, Outlook, or both in one place.',
                  },
                  {
                    n: 3,
                    title: 'Set your rules',
                    desc: 'Working hours, buffers, lead time, and booking limits.',
                  },
                  {
                    n: 4,
                    title: 'Share your link',
                    desc: 'Drop it into emails, chats, or your website.',
                  },
                ].map((step) => (
                  <div key={step.n} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs flex items-center justify-center mt-0.5">
                      {step.n}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Where to use it */}
            <div className="border-t md:border-t-0 md:border-l border-purple-100 md:pl-6 pt-5 md:pt-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Drop your link wherever work happens
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      Email signature
                    </p>
                    <p className="text-gray-600 mt-0.5">
                      Add a &quot;Book time with me&quot; link to every send.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Share2 className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      Social profiles
                    </p>
                    <p className="text-gray-600 mt-0.5">
                      Perfect for LinkedIn, X, and bio links.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      Business cards
                    </p>
                    <p className="text-gray-600 mt-0.5">
                      Add a QR code that opens your booking page.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Website</p>
                    <p className="text-gray-600 mt-0.5">
                      Embed it on your contact or pricing pages.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Compact footer CTA */}
        <section className="max-w-6xl mx-auto px-4 pb-10">
          <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-6 md:px-8 md:py-7 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg md:text-xl font-semibold mb-1">
                Ready to simplify scheduling for your team?
              </h2>
              <p className="text-xs md:text-sm text-blue-50 max-w-xl">
                Start free, connect your calendars, and share your booking link
                in minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleStartFree}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-white text-purple-600 hover:bg-gray-100 shadow-md"
              >
                Start free
              </button>
              <Link
                to="/book"
                className="px-4 py-2 rounded-full text-sm font-semibold border border-white/70 text-white hover:bg-white/10"
              >
                Try a guest booking
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
