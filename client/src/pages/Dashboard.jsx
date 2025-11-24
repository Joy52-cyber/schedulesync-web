// client/src/pages/Dashboard.jsx
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
} from 'lucide-react';

import api, { auth, timezone as timezoneApi } from '../utils/api';
import AISchedulerChat from '../components/AISchedulerChat';
import TimezoneSelector from '../components/TimezoneSelector';

export default function Dashboard() {
  const navigate = useNavigate();

  // Dashboard state
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    activeTeams: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('');
  const [user, setUser] = useState(null);

  // Booking link
  const [bookingLink, setBookingLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Availability modal
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  // Editable availability state
  const defaultHours = {
    Monday: { start: "09:00", end: "17:00" },
    Tuesday: { start: "09:00", end: "17:00" },
    Wednesday: { start: "09:00", end: "17:00" },
    Thursday: { start: "09:00", end: "17:00" },
    Friday: { start: "09:00", end: "17:00" },
  };

  const [editedAvailability, setEditedAvailability] = useState(defaultHours);

  // Load dashboard on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadUserTimezone(),
      loadUserProfile(),
      loadAvailability(),
    ]);
    setLoading(false);
  };

  const loadDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data.stats);
      setRecentBookings(response.data.recentBookings || []);
    } catch (error) {
      console.error("Dashboard load error:", error);
    }
  };

  const loadUserTimezone = async () => {
    try {
      const response = await timezoneApi.get();
      if (response.data.timezone) setTimezone(response.data.timezone);
    } catch (error) {
      console.error("Timezone load error:", error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await auth.me();
      const u = response.data.user || null;

      setUser(u);

      if (u?.booking_token) {
        setBookingLink(`${window.location.origin}/book/${u.booking_token}`);
      }
    } catch (error) {
      console.error("Profile load error:", error);
    }
  };

  const loadAvailability = async () => {
    try {
      const response = await api.get('/availability/me');
      if (response.data.availability) {
        setEditedAvailability(response.data.availability);
      }
    } catch (error) {
      console.error("Availability load error:", error);
    }
  };

  const handleCreateLink = async () => {
    setGeneratingLink(true);
    try {
      await api.get('/my-booking-link');
      await loadUserProfile();
    } catch (error) {
      console.error("Generate link error:", error);
    }
    setGeneratingLink(false);
  };

  const handleCopyLink = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-gray-500 text-sm">Welcome back!</p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Booking Link */}
        <div className="bg-white p-4 rounded-xl border">
          <div className="font-semibold mb-1">Your Booking Link</div>
          <div className="font-mono p-2 bg-gray-50 border rounded">{bookingLink}</div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              {copied ? "Copied!" : "Copy"}
            </button>

            <button
              onClick={() => setShowAvailabilityModal(true)}
              className="px-4 py-2 bg-white border border-blue-300 text-blue-600 rounded-lg"
            >
              Availability
            </button>
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/*                EDITABLE AVAILABILITY MODAL               */}
      {/* ========================================================= */}

      {showAvailabilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex items-center justify-between">
              <div className="text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Edit Availability
                </h2>
                <p className="text-blue-100 text-sm">
                  Update your standard working hours
                </p>
              </div>

              <button
                onClick={() => setShowAvailabilityModal(false)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-4">
                {Object.keys(editedAvailability).map(day => (
                  <div
                    key={day}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border"
                  >
                    <span className="font-semibold">{day}</span>

                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={editedAvailability[day].start}
                        onChange={e =>
                          setEditedAvailability(prev => ({
                            ...prev,
                            [day]: { ...prev[day], start: e.target.value }
                          }))
                        }
                        className="border rounded-lg px-2 py-1 text-sm"
                      />

                      <input
                        type="time"
                        value={editedAvailability[day].end}
                        onChange={e =>
                          setEditedAvailability(prev => ({
                            ...prev,
                            [day]: { ...prev[day], end: e.target.value }
                          }))
                        }
                        className="border rounded-lg px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">

              <button
                onClick={() => setShowAvailabilityModal(false)}
                className="px-4 py-2 text-gray-600 border rounded-xl hover:bg-gray-100"
              >
                Close
              </button>

              <button
                onClick={async () => {
                  try {
                    const response = await api.post('/availability/update', {
                      availability: editedAvailability,
                    });

                    if (response.data.success) {
                      alert("Availability saved!");
                      setShowAvailabilityModal(false);
                    } else {
                      alert("Failed saving availability.");
                    }
                  } catch (error) {
                    console.error("Save availability error:", error);
                    alert("Server error saving availability.");
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2"
              >
                Save Changes <ChevronRight className="h-4 w-4" />
              </button>

            </div>
          </div>
        </div>
      )}

      <AISchedulerChat />
    </div>
  );
}
