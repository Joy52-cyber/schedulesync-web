import { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Globe,
  Bell,
  Calendar,
  Clock,
  Save,
  Check,
  Loader2
} from 'lucide-react';

export default function UserSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    timezone: 'America/New_York'
  });

  const [availability, setAvailability] = useState({
    workingHours: { start: '09:00', end: '17:00' },
    bufferTime: 15,
    leadTime: 60
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    bookingReminders: true,
    dailySummary: false
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/user/settings`, {
        credentials: 'include'
      });
      const data = await response.json();
      setProfile(data.profile || profile);
      setAvailability(data.availability || availability);
      setNotifications(data.notifications || notifications);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await fetch(`${import.meta.env.VITE_API_URL}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profile, availability, notifications })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account and preferences</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
          <div className="flex border-b-2 border-gray-100 overflow-x-auto">
            {[
              { id: 'profile', icon: User, label: 'Profile' },
              { id: 'availability', icon: Calendar, label: 'Availability' },
              { id: 'notifications', icon: Bell, label: 'Notifications' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </div>
              </button>
            ))}
          </div>

          <div className="p-8">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Full Name
                    </div>
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Timezone
                    </div>
                  </label>
                  <select
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                  >
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'availability' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Start Time
                      </div>
                    </label>
                    <input
                      type="time"
                      value={availability.workingHours.start}
                      onChange={(e) => setAvailability({
                        ...availability,
                        workingHours: { ...availability.workingHours, start: e.target.value }
                      })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">End Time</label>
                    <input
                      type="time"
                      value={availability.workingHours.end}
                      onChange={(e) => setAvailability({
                        ...availability,
                        workingHours: { ...availability.workingHours, end: e.target.value }
                      })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Buffer Time (minutes)
                  </label>
                  <input
                    type="number"
                    value={availability.bufferTime}
                    onChange={(e) => setAvailability({ ...availability, bufferTime: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-4">
                {[
                  { key: 'emailNotifications', icon: Mail, title: 'Email Notifications', desc: 'Receive booking confirmations' },
                  { key: 'bookingReminders', icon: Bell, title: 'Booking Reminders', desc: 'Get reminded before meetings' },
                  { key: 'dailySummary', icon: Calendar, title: 'Daily Summary', desc: 'Daily booking summary' }
                ].map((notif) => (
                  <label key={notif.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <notif.icon className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="font-semibold text-gray-900">{notif.title}</p>
                        <p className="text-sm text-gray-600">{notif.desc}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications[notif.key]}
                      onChange={(e) => setNotifications({ ...notifications, [notif.key]: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold text-lg disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="h-5 w-5" />
                Saved!
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}