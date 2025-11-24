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
  ArrowRight,
  Shield,
  Smartphone
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

      if (host.includes('calendly.com')) source = 'calendly';
      else if (host.includes('cal.com')) source = 'cal.com';
      else if (host.includes('hubspot')) source = 'hubspot';
      else if (host.includes('google.com') && path.includes('calendar')) source = 'google-calendar';
      else if (host.includes('meet.google.com')) source = 'google-meet';
      else if (host.includes('outlook.') || host.includes('office.com') || host.includes('microsoft.')) source = 'microsoft';

      setDetectedSource(source);
    } catch {
      setDetectedSource(null);
    }
  };

  const handleBookingLinkSubmit = (e) => {
    e.preventDefault();
    if (!bookingLink) return;
    // Ideally: Save this link to localStorage so you can auto-import it during registration!
    localStorage.setItem('importedLink', bookingLink); 
    navigate('/register');
  };

  const renderDetectedSuggestion = () => {
    if (!detectedSource) return null;

    let title = '';
    let body = '';
    
    switch (detectedSource) {
      case 'calendly':
        title = 'Calendly link detected';
        body = 'Migrate your Calendly settings instantly.';
        break;
      case 'cal.com':
        title = 'Cal.com link detected';
        body = 'Switch from Cal.com without losing data.';
        break;
      case 'hubspot':
        title = 'HubSpot link detected';
        body = 'Connect HubSpot for seamless CRM syncing.';
        break;
      default:
        title = 'Booking link detected';
        body = 'We can import your availability from this link.';
    }

    return (
      <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300 inline-flex flex-col sm:flex-row sm:items-center gap-3 max-w-lg text-left bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <div className="font-semibold text-sm">{title}</div>
            <div className="text-xs text-white/80">{body}</div>
          </div>
        </div>
        <button
          onClick={() => navigate('/register')}
          className="whitespace-nowrap bg-white text-indigo-600 text-xs font-bold px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          Import & Start
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <LoginPanel isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* ================= HERO SECTION ================= */}
      <div className="relative bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 text-white overflow-hidden">
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
           <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-500/20 blur-[100px]" />
           <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[100px]" />
        </div>

        {/* Header */}
        <header className="relative z-20 border-b border-white/5 bg-white/5 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">ScheduleSync</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsLoginOpen(true)}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => navigate('/register')}
                className="text-sm font-semibold text-white bg-white/10 border border-white/10 rounded-full px-5 py-2 hover:bg-white/20 transition-all"
              >
                Get Started
              </button>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <section className="relative z-10 max-w-5xl mx-auto px-4 pt-16 pb-24 text-center">
          <div className="flex flex-col items-center gap-6">
            
            {/* Announcement Pill */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-100 text-xs font-medium backdrop-blur-sm animate-fade-in-up">
              <Sparkles className="w-3 h-3 mr-2 text-amber-300" />
              <span>New: AI-Powered Conflict Detection</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.15] drop-shadow-sm max-w-3xl">
              Scheduling infrastructure for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-indigo-200 to-purple-200">
                everyone.
              </span>
            </h1>

            <p className="text-lg text-indigo-100/80 max-w-2xl mx-auto leading-relaxed">
              Paste your existing booking link below. We'll import your settings, 
              connect your calendar, and upgrade you to a better experience in seconds.
            </p>

            {/* Input & Detector */}
            <div className="w-full max-w-lg mt-4 relative">
              <form onSubmit={handleBookingLinkSubmit} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <input
                  type="text"
                  value={bookingLink}
                  onChange={(e) => handleBookingLinkChange(e.target.value)}
                  placeholder="Paste your Calendly or Cal.com link..."
                  className="relative w-full bg-white text-slate-900 placeholder:text-slate-400 text-base rounded-full pl-6 pr-14 py-4 shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
              {renderDetectedSuggestion()}
            </div>

            {/* Social Proof (Light) */}
            <div className="pt-8 flex items-center justify-center gap-8 opacity-60 grayscale mix-blend-screen">
               {/* Placeholders for logos (Google, Microsoft, etc.) - simple text for now */}
               <span className="font-bold text-xl">Google</span>
               <span className="font-bold text-xl">Microsoft</span>
               <span className="font-bold text-xl">HubSpot</span>
               <span className="font-bold text-xl">Zoom</span>
            </div>
          </div>
        </section>
      </div>

      {/* ================= DASHBOARD PREVIEW (The "Bridge") ================= */}
      {/* This overlaps the hero to create depth */}
      <div className="relative z-20 -mt-16 px-4 mb-20">
        <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl bg-white p-2 shadow-2xl border border-slate-200/60 ring-1 ring-slate-900/5">
                {/* CSS Mockup of Dashboard Interface */}
                <div className="aspect-[16/9] rounded-xl bg-slate-50 border border-slate-100 overflow-hidden relative group cursor-default">
                    {/* Sidebar */}
                    <div className="absolute left-0 top-0 bottom-0 w-48 bg-white border-r border-slate-100 hidden sm:block p-4 space-y-3">
                        <div className="h-2 w-20 bg-slate-200 rounded mb-6"></div>
                        <div className="h-8 w-full bg-indigo-50 rounded-lg border border-indigo-100"></div>
                        <div className="h-8 w-full bg-white rounded-lg"></div>
                        <div className="h-8 w-full bg-white rounded-lg"></div>
                    </div>
                    {/* Header */}
                    <div className="absolute top-0 left-0 sm:left-48 right-0 h-16 bg-white border-b border-slate-100 flex items-center px-6 justify-between">
                        <div className="h-4 w-32 bg-slate-200 rounded"></div>
                        <div className="flex gap-2">
                           <div className="h-8 w-8 rounded-full bg-slate-100"></div>
                           <div className="h-8 w-24 rounded-lg bg-indigo-600"></div>
                        </div>
                    </div>
                    {/* Main Area */}
                    <div className="absolute top-16 left-0 sm:left-48 right-0 bottom-0 p-6 bg-slate-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-3">
                                    <div className="h-3 w-16 bg-green-100 rounded-full"></div>
                                    <div className="h-5 w-3/4 bg-slate-800 rounded"></div>
                                    <div className="h-3 w-1/2 bg-slate-200 rounded"></div>
                                    <div className="mt-2 h-8 w-full bg-slate-50 rounded border border-slate-100"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Overlay Tag */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 text-white px-6 py-3 rounded-full backdrop-blur-sm shadow-xl flex items-center gap-3 transition-transform hover:scale-105">
                         <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                         <span className="font-medium text-sm">Dashboard Live Preview</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* ================= VALUE PROPS ================= */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why teams switch to ScheduleSync</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              We took the complexity out of scheduling. No more double bookings, 
              no more "what time works for you?" emails.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Instant Setup</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Connect Google, Outlook, or Apple Calendar in one click. 
                We auto-detect your busy slots instantly.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Conflict Protection</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Our algorithm checks across all your connected calendars 
                to ensure you never get double-booked.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Mobile Optimized</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Your booking page looks perfect on any device, making it 
                easy for clients to book on the go.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-3xl overflow-hidden relative px-6 py-16 text-center shadow-2xl">
           {/* Background Glows */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[80px]"></div>
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 blur-[80px]"></div>

           <div className="relative z-10">
             <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Ready to take back your time?
             </h2>
             <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                Join thousands of professionals who save 5+ hours a week with ScheduleSync.
                No credit card required.
             </p>
             <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={() => navigate('/register')}
                  className="w-full sm:w-auto px-8 py-3.5 bg-white text-slate-900 rounded-full font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                >
                  Start Scheduling for Free <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                   onClick={() => setIsLoginOpen(true)}
                   className="text-white/70 hover:text-white font-medium text-sm px-4"
                >
                  Or log in to existing account
                </button>
             </div>
           </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 pt-12 pb-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 opacity-80">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900">ScheduleSync</span>
            </div>
            <div className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} ScheduleSync Inc.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}