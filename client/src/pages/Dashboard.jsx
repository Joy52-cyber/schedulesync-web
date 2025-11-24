import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  ChevronRight,
  MoreHorizontal,
  Globe,
  Copy, 
  Check,
  Link as LinkIcon,
  Loader2,
  X // Added X for closing the modal
} from 'lucide-react';
import api from '../utils/api'; 
import { auth, timezone as timezoneApi } from '../utils/api'; 
import AISchedulerChat from '../components/AISchedulerChat';
import TimezoneSelector from '../components/TimezoneSelector';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    activeTeams: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('');
  
  // Booking Link State
  const [bookingLink, setBookingLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // ✅ NEW STATE: For the Availability Pop-up
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadUserTimezone(),
      loadUserProfile()
    ]);
    setLoading(false);
  };

  const loadDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data.stats);
      setRecentBookings(response.data.recentBookings || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const loadUserTimezone = async () => {
    try {
      const response = await timezoneApi.get();
      if (response.data.timezone) {
        setTimezone(response.data.timezone);
      }
    } catch (error) {
      console.error('Error loading timezone:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
        const response = await auth.me(); 
        if (response.data.user?.booking_token) {
            const link = `${window.location.origin}/book/${response.data.user.booking_token}`;
            setBookingLink(link);
        } else {
            setBookingLink(''); 
        }
    } catch (error) {
        console.error("Could not load user profile for link", error);
    }
  };

  const handleCreateLink = async () => {
    setGeneratingLink(true);
    try {
        await api.get('/my-booking-link');
        await loadUserProfile();
    } catch (error) {
        console.error("Failed to generate link:", error);
        alert("Could not generate link. Please try again.");
    } finally {
        setGeneratingLink(false);
    }
  };

  const handleTimezoneChange = async (newTimezone) => {
    try {
      setTimezone(newTimezone);
      await timezoneApi.update({ timezone: newTimezone });
    } catch (error) {
      console.error('Failed to update timezone:', error);
    }
  };

  const handleCopyLink = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return <CheckCircle2 className="h-4 w-4" />;
      case 'pending': return <AlertCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Bookings',
      value: stats.totalBookings,
      icon: Calendar,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      change: '+12%',
    },
    {
      label: 'Upcoming',
      value: stats.upcomingBookings,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      badge: 'This week',
    },
    {
      label: 'Active Teams',
      value: stats.activeTeams,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm">
                  Welcome back! Here's what's happening today.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/bookings')}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Calendar
              </button>
              <button
                onClick={() => navigate('/my-booking-link')}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                New
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full relative">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-6">

            {/* Timezone Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Globe className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Your Timezone</h3>
                        <p className="text-xs text-gray-500">Used for all your calendar events</p>
                    </div>
                </div>
                <div className="w-full sm:w-72">
                    <TimezoneSelector 
                        value={timezone} 
                        onChange={handleTimezoneChange} 
                        showLabel={false} 
                    />
                </div>
            </div>

            {/* BOOKING LINK CARD */}
            {bookingLink ? (
                <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="w-full">
                            <label className="text-sm font-bold text-blue-900 mb-2 block">
                                Your Main Booking Link:
                            </label>
                            <div className="font-mono text-sm text-blue-700 bg-white border border-blue-200 rounded-lg px-4 py-3 w-full break-all">
                                {bookingLink}
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-6">
                            <button
                                onClick={handleCopyLink}
                                className="whitespace-nowrap flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto"
                            >
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? 'Copied!' : 'Copy Link'}
                            </button>
                            
                            {/* ✅ MODIFIED BUTTON: TRIGGERS POPUP */}
                            <button
                                onClick={() => setShowAvailabilityModal(true)}
                                className="whitespace-nowrap flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-700 border border-blue-200 rounded-xl font-semibold hover:bg-blue-50 transition-colors w-full md:w-auto"
                            >
                                <Users className="h-4 w-4" />
                                Availability
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-orange-50 rounded-2xl border border-orange-200 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-orange-100 rounded-full">
                         <LinkIcon className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                         <h3 className="text-lg font-bold text-orange-900">Setup Required</h3>
                         <p className="text-sm text-orange-800">You don't have a personal booking link yet.</p>
                      </div>
                   </div>
                   <button
                      onClick={handleCreateLink}
                      disabled={generatingLink}
                      className="w-full sm:w-auto px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                      {generatingLink ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                      {generatingLink ? "Generating..." : "Create Booking Link"}
                   </button>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((stat, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:shadow-xl transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-gray-600 text-sm font-medium">
                        {stat.label}
                      </p>
                      <p className={`text-3xl font-bold ${stat.color}`}>
                        {stat.value}
                      </p>
                      {stat.change && (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full inline-flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {stat.change}
                        </span>
                      )}
                      {stat.badge && (
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full inline-block ${stat.bg} ${stat.color}`}
                        >
                          {stat.badge}
                        </span>
                      )}
                    </div>
                    <div
                      className={`${stat.bg} h-14 w-14 rounded-xl flex items-center justify-center shadow-md`}
                    >
                      <stat.icon className={`h-7 w-7 ${stat.color}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* REST OF YOUR DASHBOARD CODE (Welcome Message, Recent Bookings, etc)... */}
            
            {/* ... keeping the rest of the file exactly as you had it ... */}

          </div>
        </div>
      </main>

      {/* ✅ AVAILABILITY POP-UP MODAL */}
      {showAvailabilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex items-center justify-between">
                    <div className="text-white">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Clock className="h-5 w-5" /> Quick Availability Check
                        </h2>
                        <p className="text-blue-100 text-sm">Your standard working hours</p>
                    </div>
                    <button 
                        onClick={() => setShowAvailabilityModal(false)}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                {/* Modal Content - Quick Preview */}
                <div className="p-6">
                    <div className="space-y-4">
                        {/* Sample schedule preview - You can replace this with your actual Availability component */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                                <div key={day} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="font-semibold text-gray-700">{day}</span>
                                    <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">9:00 AM - 5:00 PM</span>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mt-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-800">
                                This is a quick view. To make complex changes or add date-specific overrides, visit the full settings page.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button 
                        onClick={() => setShowAvailabilityModal(false)}
                        className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Close
                    </button>
                    <button 
                        onClick={() => navigate('/my-booking-link')}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        Edit Full Schedule <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* AI Chat Widget */}
      <AISchedulerChat />
    </div>
  );
}