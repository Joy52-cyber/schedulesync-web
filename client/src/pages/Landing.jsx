// client/src/pages/Landing.jsx
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

  const handleGetStarted = (e) => {
    e.preventDefault();
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-purple-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900">
              ScheduleSync
            </span>
          </div>

          {/* Nav / CTA */}
          <div className="flex items-center gap-3 text-sm">
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 shadow-sm"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-12">
            <div className="inline-block mb-6 px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-semibold shadow-md">
              Transform Your Scheduling Experience
            </div>

            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-5 leading-tight">
              Turn scheduling chaos into a single, shared source of truth
            </h1>

            <p className="text-lg text-gray-600 mb-8 max-w-3xl mx-auto">
              ScheduleSync connects your team meetings, personal tasks, and
              everything in between—without the confusion. Say goodbye to
              double bookings and hello to seamless coordination.
            </p>

            {/* CTA Form */}
            <form
              onSubmit={handleGetStarted}
              className="max-w-md mx-auto mb-4"
            >
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-xl border border-purple-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-sm"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold text-sm hover:from-blue-600 hover:to-purple-700 shadow-md"
                >
                  Get started free
                </button>
              </div>
            </form>

            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-purple-600 hover:text-purple-700 font-semibold"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {/* Card 1 */}
            <div className="rounded-2xl border border-purple-100 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Calendar Integration
                </h3>
                <p className="text-sm text-gray-600">
                  Connect Google Calendar, Outlook, and more. Consolidate your
                  schedule in one place.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-purple-100 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Smart Availability
                </h3>
                <p className="text-sm text-gray-600">
                  Automatically sync availability across your calendars and
                  prevent double bookings.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-purple-100 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mb-4">
                  <Share2 className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Easy to Share
                </h3>
                <p className="text-sm text-gray-600">
                  Share your booking link and let others schedule time with you
                  effortlessly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              How to Get Your Booking Link
            </h2>
            <p className="text-gray-600">
              Set up your personalized scheduling page in just a few steps.
            </p>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-white/80 backdrop-blur-sm shadow-sm p-8 space-y-6">
            {[
              {
                step: 1,
                title: 'Create your account',
                desc: 'Sign up for free in just a few seconds.',
              },
              {
                step: 2,
                title: 'Connect your calendar',
                desc: 'Link your Google, Outlook, or other calendars.',
              },
              {
                step: 3,
                title: 'Set your availability',
                desc: "Define when you're available for meetings.",
              },
              {
                step: 4,
                title: 'Share your link',
                desc: 'Send your personalized booking link to anyone.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  {item.step}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {item.title}
                  </h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Where to Share Section */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              Where to Share Your Link
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <InfoCard
              icon={
                <Users className="w-6 h-6 text-purple-600" />
              }
              title="Email Signature"
              desc="Add it to your email for easy scheduling."
              gradient="from-purple-100 to-purple-200"
            />
            <InfoCard
              icon={<Share2 className="w-6 h-6 text-orange-600" />}
              title="Social Media"
              desc="Share on LinkedIn, X, or your bio."
              gradient="from-orange-100 to-orange-200"
            />
            <InfoCard
              icon={<Clock className="w-6 h-6 text-yellow-600" />}
              title="Business Cards"
              desc="Print it or use a QR code for quick access."
              gradient="from-yellow-100 to-yellow-200"
            />
            <InfoCard
              icon={<CheckCircle className="w-6 h-6 text-blue-600" />}
              title="Website"
              desc="Embed it on your site or contact page."
              gradient="from-blue-100 to-blue-200"
            />
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <div className="rounded-3xl bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-xl">
            <div className="p-10 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Ready to simplify your scheduling?
              </h2>
              <p className="mb-8 text-blue-50 max-w-2xl mx-auto text-sm md:text-base">
                Join professionals who have streamlined their scheduling
                workflow with ScheduleSync.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register"
                  className="px-6 py-3 rounded-xl bg-white text-purple-600 font-semibold text-sm shadow-md hover:bg-gray-100"
                >
                  Get started free
                </Link>
                <a
                  href="#"
                  className="px-6 py-3 rounded-xl border border-white/70 text-white font-semibold text-sm hover:bg-white/10"
                >
                  Watch demo
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoCard({ icon, title, desc, gradient }) {
  return (
    <div className="rounded-2xl border border-purple-100 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-shadow">
      <div className="p-6 text-center">
        <div
          className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 mx-auto`}
        >
          {icon}
        </div>
        <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
        <p className="text-sm text-gray-600">{desc}</p>
      </div>
    </div>
  );
}
