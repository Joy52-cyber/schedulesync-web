import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Zap,
  Sparkles,
  ArrowRight,
  Shield,
  Smartphone,
  CheckCircle,
  Plus
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
    const lower = value.toLowerCase();
    if (lower.includes('calendly')) setDetectedSource('calendly');
    else if (lower.includes('cal.com')) setDetectedSource('cal.com');
    else if (lower.includes('hubspot')) setDetectedSource('hubspot');
    else if (lower.includes('google') && lower.includes('calendar')) setDetectedSource('google-calendar');
    else if (lower.includes('outlook') || lower.includes('office')) setDetectedSource('microsoft');
    else setDetectedSource(null);
  };

  const handleBookingLinkSubmit = (e) => {
    e.preventDefault();
    if (!bookingLink) return;
    localStorage.setItem('importedLink', bookingLink);
    navigate('/register');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <LoginPanel isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* ================= HERO SECTION ================= */}
      <div className="relative bg-indigo-900 text-white overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute -top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[80px]" />
           <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] rounded-full bg-blue-500/20 blur-[80px]" />
        </div>

        {/* Header - Slim */}
        <header className="relative z-20 border-b border-white/5 bg-white/5 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Calendar className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight">ScheduleSync</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsLoginOpen(true)} className="text-xs font-medium text-white/70 hover:text-white transition-colors">
                Log in
              </button>
              <button onClick={() => navigate('/register')} className="text-xs font-bold text-indigo-900 bg-white rounded-full px-3 py-1.5 hover:bg-indigo-50 transition-all">
                Get Started
              </button>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <section className="relative z-10 max-w-3xl mx-auto px-4 pt-16 pb-24 text-center">
          <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-800/50 border border-indigo-700 text-indigo-200 text-[10px] uppercase font-bold tracking-wider mb-4">
            <Sparkles className="w-3 h-3 mr-1.5 text-amber-400" />
            AI-Powered Scheduling
          </div>

          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-4 drop-shadow-sm">
            Scheduling made <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300">effortless.</span>
          </h1>

          <p className="text-base text-indigo-200/80 max-w-md mx-auto mb-8 leading-relaxed">
            Share your link, let people book a time, and never worry about double bookings again.
          </p>

          {/* Input Field */}
          <div className="max-w-md mx-auto relative group flex flex-col items-center">
            <form onSubmit={handleBookingLinkSubmit} className="relative w-full">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-700"></div>
              <input
                type="text"
                value={bookingLink}
                onChange={(e) => handleBookingLinkChange(e.target.value)}
                placeholder="Paste your Calendly link to import..."
                className="relative w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 text-sm rounded-full pl-4 pr-10 py-3 focus:outline-none focus:bg-white/20 transition-all"
              />
              <button 
                type="submit"
                className="absolute right-1.5 top-1.5 bottom-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors shadow-lg"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
            
            {/* Detection Badge */}
            {detectedSource && (
              <div className="absolute -bottom-8 left-0 right-0 flex justify-center animate-in fade-in slide-in-from-top-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wide">
                  <CheckCircle className="w-3 h-3" /> {detectedSource} Detected
                </span>
              </div>
            )}

            {/* "Continue without link" Option */}
            {!detectedSource && (
              <button
                onClick={() => navigate('/register')}
                className="mt-5 text-xs font-medium text-indigo-300 hover:text-white transition-colors flex items-center gap-1.5 group"
              >
                <Plus className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                <span>Don't have a link? Start from scratch</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {/* ================= FEATURES (Grid) ================= */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">Why teams switch to ScheduleSync</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">Instant Setup</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Connect Google, Outlook, or Apple Calendar in one click. We auto-detect your busy slots instantly.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">Conflict Protection</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Our algorithm checks across all your connected calendars to ensure you never get double-booked.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center mb-3">
                <Smartphone className="w-5 h-5 text-pink-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">Mobile Optimized</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Your booking page looks perfect on any device, making it easy for clients to book on the go.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto bg-slate-900 rounded-2xl overflow-hidden relative px-6 py-12 text-center shadow-xl">
           <div className="relative z-10">
             <h2 className="text-2xl font-bold text-white mb-4">
                Ready to take back your time?
             </h2>
             <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                Join thousands of professionals who save hours every week. No credit card required.
             </p>
             <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={() => navigate('/register')} className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-900 rounded-full text-sm font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
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