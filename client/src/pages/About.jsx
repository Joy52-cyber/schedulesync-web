import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowLeft, Zap, Users, Shield, Bot, Heart } from 'lucide-react';

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 relative z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-600 to-pink-600 text-white py-20 relative z-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Calendar className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">About ScheduleSync</h1>
          <p className="text-xl text-purple-100 max-w-2xl mx-auto">
            We're building the future of scheduling�where AI handles the back-and-forth so you can focus on what matters.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-16 relative z-10">
        
        {/* Our Story */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Story</h2>
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border-2 border-white/20 p-8">
            <p className="text-gray-600 mb-4 leading-relaxed">
              ScheduleSync was born from a simple frustration: scheduling meetings shouldn't require 10 emails back and forth. 
              We believed there had to be a better way.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Traditional scheduling tools made you share a link, wait for the other person to pick a time, 
              and hope their calendar didn't change. It was better than email, but still clunky.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We asked: <strong>What if you could just tell an AI what you need, and it would handle the rest?</strong> 
              That's why we built ScheduleSync with AI at its core�not as an afterthought, but as the foundation.
            </p>
          </div>
        </section>

        {/* What Makes Us Different */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">What Makes Us Different</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border-2 border-white/20 p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">AI-First Design</h3>
              <p className="text-gray-600 text-sm">
                While others bolt on AI features, we built our entire platform around intelligent scheduling. 
                Just tell it what you need in plain English.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border-2 border-white/20 p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Speed & Simplicity</h3>
              <p className="text-gray-600 text-sm">
                No complex setup. Connect your calendar, and you're ready to go. 
                Create a booking in seconds, not minutes.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border-2 border-white/20 p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Privacy First</h3>
              <p className="text-gray-600 text-sm">
                We only read your busy/free times, never the content of your events. 
                Your calendar data stays yours.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border-2 border-white/20 p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Built for Teams</h3>
              <p className="text-gray-600 text-sm">
                Round-robin assignments, collective availability, team booking pages�we've got you covered 
                whether you're solo or a growing team.
              </p>
            </div>
          </div>
        </section>

        {/* Our Values */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Values</h2>
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border-2 border-white/20 p-8">
            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Heart className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">User-Centric Design</h3>
                  <p className="text-gray-600 text-sm">Every feature we build starts with one question: does this make scheduling easier?</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Shield className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Transparency</h3>
                  <p className="text-gray-600 text-sm">Simple pricing. Clear communication. No hidden fees or dark patterns.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Zap className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Continuous Improvement</h3>
                  <p className="text-gray-600 text-sm">We ship updates constantly based on your feedback. Your input shapes our roadmap.</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Get in Touch</h2>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200 p-8 text-center">
            <p className="text-gray-700 mb-4">
              Have questions, feedback, or just want to say hi?
            </p>
            <a 
              href="mailto:support@trucal.xyz"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold hover:shadow-lg transition-all"
            >
              Contact Us
            </a>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} ScheduleSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}