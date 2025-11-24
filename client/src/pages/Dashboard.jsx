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
  ChevronRight,
  Globe,
  Copy,
  Check,
  Link as LinkIcon,
  Loader2,
  X,
  Save,
} from 'lucide-react';

import api, { auth, timezone as timezoneApi } from '../utils/api';
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
  const [user, setUser] = useState(null);

  const [bookingLink, setBookingLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Availability modal
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);

  const [availability, setAvailability] = useState([
    { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
    { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
    { day: 'Wednesday', enabled: true, start: '09:00', end: '17:00' },
    { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
    { day: 'Friday', enabled: true, start: '09:00', end: '17:00' },
    { day: 'Saturday', enabled: false, start: '09:00', end: '17:00' },
    { day: 'Sunday', enabled: false, start: '09:00', end: '17:00' },
  ]);

  // Load all dashboard data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadUserTimezone(),
      loadUserProfile(),
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
      if (response.data.timezone) setTimezone(response.data.timezone);
    } catch (error) {
      console.error('Error loading timezone:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await auth.me();
      const u = response.data.user;
      setUser(u);

      // Load booking link
      if (u?.booking_token) {
        setBookingLink(`${window.location.origin}/book/${u.booking_token}`);
      }

      // Load availability if exists
      if (u?.availability) {
        setAvailability(u.availability);
      }

    } catch (error) {
      console.error('Profile load failed', error);
    }
  };

  const handleCreateLink = async () => {
    setGeneratingLink(true);
    try {
      await api.get('/my-booking-link');
      await loadUserProfile();
    } catch (error) {
      alert('Could not generate link.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveAvailability = async () => {
    setSavingAvailability(true);
    try {
      await api.post('/availability/update', { availability });
      setSavingAvailability(false);
      setShowAvailabilityModal(false);
    } catch (error) {
      console.error('Failed saving availability:', error);
      setSavingAvailability(false);
    }
  };

  const updateDay = (index, field, value) => {
    setAvailability(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">

      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Welcome back!
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/bookings')}
                className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" /> Calendar
              </button>

              <button
                onClick={() => navigate('/my-booking-link')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" /> New
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* TIMEZONE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Your Timezone</h3>
              <p className="text-xs text-gray-500">Used for all events</p>
            </div>
          </div>

          <div className="w-72">
            <TimezoneSelector
              value={timezone}
              onChange={t => setTimezone(t)}
              showLabel={false}
            />
          </div>
        </div>

        {/* BOOKING LINK */}
        {bookingLink ? (
          <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <label className="font-bold text-blue-900">Your Booking Link</label>
                <div className="mt-2 font-mono bg-white border border-blue-200 rounded-lg px-4 py-3 break-all">
                  {bookingLink}
                </div>
              </div>

              <div className="ml-4 flex flex-col gap-2">
                <button
                  onClick={handleCopyLink}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl"
                >
                  {copied ? <Check /> : <Copy />}
                </button>

                <button
                  onClick={() => setShowAvailabilityModal(true)}
                  className="px-6 py-3 bg-white border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Availability
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 rounded-2xl border border-orange-200 p-6">
            <div className="flex gap-4 items-center">
              <div className="p-3 bg-orange-100 rounded-full">
                <LinkIcon className="h-6 w-6 text-orange-600" />
              </div>

              <div>
                <h3 className="font-bold text-orange-900">No booking link yet</h3>
                <p className="text-orange-700">Create one to start accepting bookings</p>
              </div>
            </div>

            <button
              onClick={handleCreateLink}
              disabled={generatingLink}
              className="mt-4 px-6 py-3 bg-orange-600 text-white rounded-xl flex items-center gap-2"
            >
              {generatingLink ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Create Booking Link
            </button>
          </div>
        )}

      </main>

      {/* ===========================
              AVAILABILITY MODAL
      ============================ */}
      {showAvailabilityModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">

            {/* HEADER */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex justify-between items-center">
              <h2 className="text-white text-xl font-bold flex gap-2 items-center">
                <Clock className="h-5 w-5" /> Edit Availability
              </h2>
              <button
                onClick={() => setShowAvailabilityModal(false)}
                className="p-2 bg-white/20 rounded-full text-white"
              >
                <X />
              </button>
            </div>

            {/* BODY */}
            <div className="p-6 space-y-4">

              {availability.map((day, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200">
                  
                  {/* Left */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={e => updateDay(idx, 'enabled', e.target.checked)}
                    />
                    <span className="font-semibold text-gray-700">{day.day}</span>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      disabled={!day.enabled}
                      value={day.start}
                      onChange={e => updateDay(idx, 'start', e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-1"
                    />
                    <span>–</span>
                    <input
                      type="time"
                      disabled={!day.enabled}
                      value={day.end}
                      onChange={e => updateDay(idx, 'end', e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-1"
                    />
                  </div>

                </div>
              ))}

            </div>

            {/* FOOTER */}
           {/* Modal Footer */}
<div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
  <button
    onClick={() => setShowAvailabilityModal(false)}
    className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
  >
    Close
  </button>

  <button
    onClick={async () => {
      try {
        // Send updated availability to backend
        const response = await api.post('/availability/update', {
          availability: editedAvailability,
        });

        if (response.data.success) {
          alert('Availability saved successfully!');
          setShowAvailabilityModal(false);
        } else {
          alert('Failed to save. Please try again.');
        }

      } catch (error) {
        console.error('Save availability error:', error);
        alert('Server error saving availability.');
      }
    }}
    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
  >
    Save Changes <ChevronRight className="h-4 w-4" />
  </button>
</div>

            </div>

          </div>
        </div>
      )}

      <AISchedulerChat />
    </div>
  );
}
