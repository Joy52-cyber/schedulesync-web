import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Zap,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Plus,
  Shield,      
  Smartphone   
} from 'lucide-react';
import LoginPanel from '../components/LoginPanel';

export default function Landing({ defaultLoginOpen = false }) {
  const [isLoginOpen, setIsLoginOpen] = useState(defaultLoginOpen);
  const [bookingLink, setBookingLink] = useState('');
  const [detectedSource, setDetectedSource] = useState(null);
  const [showConnectionOptions, setShowConnectionOptions] = useState(false);
  const navigate = useNavigate();

  // Detect source system from pasted booking link
  const handleBookingLinkChange = (value) => {
    setBookingLink(value);
    setShowConnectionOptions(false);

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
      else if (host.includes('eyeball.games') || host.includes('trucal.xyz')) source = 'schedulesync';

      setDetectedSource(source);
    } catch {
      setDetectedSource(null);
    }
  };

  const handleBookingLinkSubmit = (e) => {
    e.preventDefault();
    if (!bookingLink) return;
    localStorage.setItem('importedLink', bookingLink);
    handleBookingLinkChange(bookingLink);
    setShowConnectionOptions(true);
  };

  const renderDetectedSuggestion = () => {
    if (!detectedSource) return null;
    
    let title = '';
    let body = '';

    switch (detectedSource) {
      case 'calendly': title = 'Calendly link detected'; body = 'Connect this link to keep your existing flows.'; break;
      case 'cal.com': title = 'Cal.com link detected'; body = 'Plug this link in to keep things in sync.'; break;
      case 'hubspot': title = 'HubSpot link detected'; body = 'Connect HubSpot to keep existing flows.'; break;
      case 'google-calendar': title = 'Google Calendar detected'; body = 'Connect directly to stay in sync.'; break;
      case 'google-meet': title = 'Google Meet detected'; body = 'Connect Calendar for auto Meet links.'; break;
      case 'microsoft': title = 'Outlook detected'; body = 'Connect Outlook to sync availability.'; break;
      case 'schedulesync': title = 'ScheduleSync link'; body = 'Log in to manage this link.'; break;
      default: return null;
    }

    return (
      <div className="mt-3 inline-flex items-start gap-2 max-w-md text-left text-xs bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-white/90 animate-in fade-in slide-in-from-top-2 backdrop-blur-sm">
        <Zap className="w-3.5 h-3.5 mt-0.5 text-amber-300 shrink-0" />
        <div>
          <div className="font-bold">{title}</div>
          <div className="text-white/80 text-[11px] leading-tight">{body}</div>
        </div>
      </div>
    );
  };

  const renderConnectionOptions = () => {
    if (!showConnectionOptions) return null;
    const isCalendly = detectedSource === 'calendly';

    return (
      <div className="mt-3 w-full max-w-sm bg-white/10 border border-white/25 rounded-xl p-3 text-white/90 animate-in fade-in slide-in-from-top-2 backdrop-blur-sm">
        <div className="font-bold text-center mb-2 text-xs">How do you want to connect?</div>
        
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setIsLoginOpen(true)} className="w-full flex items-center justify-between rounded-lg bg-white text-slate-900 px-3 py-2 text-xs font-bold hover:bg-slate-100 transition-all">
            <span>Connect Google / Outlook</span>
            <span className="text-[10px] text-slate-500 font-medium">Recommended</span>
          </button>

          {isCalendly && (
            <button type="button" onClick={() => setIsLoginOpen(true)} className="w-full flex items-center justify-between rounded-lg bg-sky-100 text-sky-900 px-3 py-2 text-xs font-bold hover:bg-sky-200 transition-all">
              <span>Connect Calendly</span>
              <span className="text-[10px] text-sky-700 font-medium">Uses existing link</span>
            </button>
          )}

          <button type="button" onClick={() => navigate('/register')} className="w-full flex items-center justify-between rounded-lg bg-white/10 text-white px-3 py-2 text-xs font-bold border border-white/20 hover:bg-white/20 transition-all">
            <span>Continue without connecting</span>
            <span className="text-[10px] text-white/60 font-medium">Set up later</span>
          </button>
        </div>
        
        <div className="text-center mt-2 text-[10px] text-white/60">
            Already have an account? <button onClick={() => setIsLoginOpen(true)} className="text-white font-semibold hover:underline ml-1">Sign in</button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <LoginPanel isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* ================= HERO SECTION (Compact) ================= */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white overflow-hidden pb-16">
        {/* Header - Ultra Slim */}
        <header className="relative z-20 border-b border-white/10 bg-white/5 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center border border-white/30 shadow-inner">
                <Calendar className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight">ScheduleSync</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsLoginOpen(true)} className="text-xs font-medium text-white/80 hover:text-white transition-colors">
                Log in
              </button>
              <button onClick={() => navigate('/register')} className="text-xs font-bold text-indigo-600 bg-white rounded-full px-3 py-1 hover:bg-indigo-50 transition-all shadow-sm">
                Get Started
              </button>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <section className="relative z-10 max-w-2xl mx-auto px-4 pt-12 pb-10 text-center">
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-bold uppercase tracking-wider mb-4 backdrop-blur-sm">
            <Sparkles className="w-3 h-3 mr-1.5 text-yellow-300" />
            AI-Powered Scheduling
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight mb-3 drop-shadow-md">
            Scheduling made effortless.
          </h1>

          <p className="text-sm text-white/80 max-w-md mx-auto mb-6 leading-relaxed font-medium">
            Share your link, let people book a time, and never worry about double bookings again.
          </p>

          {/* Input Field Area */}
          <div className="max-w-sm mx-auto flex flex-col items-center w-full">
            <div className="relative w-full group">
              <div className="absolute inset-0 bg-white rounded-full blur opacity-20 group-hover:opacity-30 transition duration-700"></div>
              <form onSubmit={handleBookingLinkSubmit} className="relative flex w-full">
                <input
                  type="text"
                  value={bookingLink}
                  onChange={(e) => handleBookingLinkChange(e.target.value)}
                  placeholder="Paste your booking link..."

                  className="w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium rounded-full pl-4 pr-10 py-2.5 focus:outline-none shadow-xl transition-all"
                />
                <button 
                  type="submit"
                  className="absolute right-1 top-1 bottom-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors shadow-md"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
            
            {/* Detection Badge & Connection Options */}
            {detectedSource && (
              <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col items-center">
                 {!showConnectionOptions && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-[10px] font-bold text-white shadow-sm">
                      <CheckCircle className="w-3 h-3 text-emerald-300" /> 
                      Link Detected
                    </div>
                 )}
                 {renderDetectedSuggestion()}
                 {renderConnectionOptions()}
              </div>
            )}

            {/* "Continue without link" Option */}
            {!detectedSource && (
              <button
                onClick={() => navigate('/register')}
                className="mt-4 text-xs font-medium text-white/60 hover:text-white transition-colors flex items-center gap-1.5 group"
              >
                <Plus className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                <span>Don't have a link? Start from scratch</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {/* ================= FEATURES (Compact Grid) ================= */}
      <section className="py-10 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-lg md:text-xl font-bold text-slate-900">Why teams switch to ScheduleSync</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-md transition-all">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <Zap className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs mb-1">Instant Setup</h3>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Connect Google, Outlook, or Apple Calendar in one click. We auto-detect your busy slots instantly.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-md transition-all">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                <Shield className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs mb-1">Conflict Protection</h3>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Our algorithm checks across all your connected calendars to ensure you never get double-booked.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-md transition-all">
              <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center mb-2">
                <Smartphone className="w-4 h-4 text-pink-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs mb-1">Mobile Optimized</h3>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Your booking page looks perfect on any device, making it easy for clients to book on the go.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA (Compact) ================= */}
      <section className="py-8 px-4">
        <div className="max-w-2xl mx-auto bg-slate-900 rounded-xl overflow-hidden relative px-6 py-8 text-center shadow-lg">
           <div className="relative z-10">
             <h2 className="text-lg font-bold text-white mb-3">
                Ready to take back your time?
             </h2>
             <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={() => navigate('/register')} className="w-full sm:w-auto px-5 py-2 bg-white text-slate-900 rounded-full text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
                  Start for Free <ArrowRight className="w-3 h-3" />
                </button>
             </div>
           </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-4">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-3 text-[10px] text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">ScheduleSync</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-900 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-slate-900 cursor-pointer transition-colors">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}