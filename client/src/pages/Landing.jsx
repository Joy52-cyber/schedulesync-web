import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Zap, Share2, Users, Clock, CheckCircle } from 'lucide-react';
import LoginPanel from '../components/LoginPanel';
import AppLogo from "./AppLogo";


export default function Landing({ defaultLoginOpen = false }) {
  const [isLoginOpen, setIsLoginOpen] = useState(defaultLoginOpen);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Floating login panel */}
      <LoginPanel isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-purple-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <AppLogo />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLoginOpen(true)}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Log in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm font-semibold text-white rounded-full px-4 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-sm"
            >
              Start free
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 pt-12 pb-16">
        <section className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center mb-12">
          <div>
            <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white mb-4">
              Transform your scheduling experience
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Turn scheduling chaos into a single, shared source of truth.
            </h1>
            <p className="text-gray-600 mb-6 max-w-xl">
              ScheduleSync connects your team meetings, personal tasks, and everything in between—without the confusion.
              Say goodbye to double bookings and hello to seamless coordination.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-3">
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center justify-center px-5 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-sm"
              >
                Get started free
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-medium border border-purple-200 text-purple-700 bg-white/70 hover:bg-white"
              >
                Watch 2-min demo
              </button>
            </div>

            <p className="text-xs text-gray-500">
              No credit card required · Cancel anytime
            </p>
          </div>

          {/* Mini feature card */}
          <div className="space-y-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-purple-100 p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Smart team scheduling</p>
                  <p className="text-xs text-gray-500">
                    Individual, round-robin, and collective booking modes.
                  </p>
                </div>
              </div>

              <ul className="space-y-2 text-xs text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-[10px] text-green-700">
                    ✓
                  </span>
                  AI-powered slot recommendations
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-[10px] text-green-700">
                    ✓
                  </span>
                  Google Calendar + Meet integration
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-[10px] text-green-700">
                    ✓
                  </span>
                  No more double bookings
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Small feature row */}
        <section className="grid gap-4 md:grid-cols-3 text-sm">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-purple-100 p-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <p className="font-semibold text-gray-900 mb-1">Calendar integration</p>
            <p className="text-xs text-gray-600">
              Connect Google Calendar and keep everything in sync.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-purple-100 p-4">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mb-2">
              <Zap className="w-4 h-4 text-green-600" />
            </div>
            <p className="font-semibold text-gray-900 mb-1">Smart availability</p>
            <p className="text-xs text-gray-600">
              Respect buffers, working hours, and meeting limits automatically.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-purple-100 p-4">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center mb-2">
              <Share2 className="w-4 h-4 text-purple-600" />
            </div>
            <p className="font-semibold text-gray-900 mb-1">Share in one link</p>
            <p className="text-xs text-gray-600">
              Drop your booking link into email, socials, or your website.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
