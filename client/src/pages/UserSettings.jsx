import { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Globe, 
  Calendar, 
  Save, 
  Check, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import api, { auth, timezone as timezoneApi } from '../utils/api';

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

  // We'll fetch the PRIMARY team member record for availability
  const [memberId, setMemberId] = useState(null);
  const [availability, setAvailability] = useState({
    workingHours: { 
        monday: { enabled: true, start: '09:00', end: '17:00' },
        tuesday: { enabled: true, start: '09:00', end: '17:00' },
        wednesday: { enabled: true, start: '09:00', end: '17:00' },
        thursday: { enabled: true, start: '09:00', end: '17:00' },
        friday: { enabled: true, start: '09:00', end: '17:00' },
        saturday: { enabled: false, start: '09:00', end: '17:00' },
        sunday: { enabled: false, start: '09:00', end: '17:00' }
    },
    bufferTime: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 1. Load User Profile
      const userRes = await auth.me();
      const userData = userRes.data.user;
      
      setProfile({
        name: userData.name,
        email: userData.email,
        timezone: userData.timezone || 'America/New_York'
      });

      // 2. Find Personal Team Member ID to get Availability
      // We look for the team named "Name's Personal Bookings"
      const teamsRes = await api.get('/teams');
      const personalTeam = teamsRes.data.teams.find(t => t.name.includes("Personal Bookings"));
      
      if (personalTeam) {
          const membersRes = await api.get(`/teams/${personalTeam.id}/members`);
          const me = membersRes.data.members.find(m => m.user_id === userData.id);
          
          if (me) {
              setMemberId(me.id);
              // 3. Fetch Availability Details using the existing backend endpoint
              const availRes = await api.get(`/team-members/${me.id}/availability`);
              if (availRes.data.member?.working_hours) {
                  setAvailability({
                      workingHours: availRes.data.member.working_hours,
                      bufferTime: availRes.data.member.buffer_time || 0
                  });
              }
          }
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save Profile (Timezone)
      await timezoneApi.update({ timezone: profile.timezone });
      
      // 2. Save Availability (if member found)
      if (memberId) {
          await api.put(`/team-members/${memberId}/availability`, {
              working_hours: availability.workingHours,
              buffer_time: availability.bufferTime,
              // We preserve other settings by not sending them or backend handles defaults
          });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (day, field, value) => {
      setAvailability(prev => ({
          ...prev,
          workingHours: {
              ...prev.workingHours,
              [day]: {
                  ...prev.workingHours[day],
                  [field]: value
              }
          }
      }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Settings</h1>
        <p className="text-gray-600">Manage your personal profile and schedule availability.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto">
          {[
            { id: 'profile', icon: User, label: 'Profile' },
            { id: 'availability', icon: Calendar, label: 'Availability' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 sm:p-8">
          
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-lg">
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
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
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
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Singapore">Singapore</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Australia/Sydney">Sydney</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">This determines how your available times are displayed.</p>
              </div>
            </div>
          )}

          {/* AVAILABILITY TAB */}
          {activeTab === 'availability' && (
            <div className="space-y-8">
              {!memberId && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3 text-yellow-800 text-sm">
                   <AlertCircle className="h-5 w-5 shrink-0" />
                   <p>We couldn't find your personal booking profile. Please create your booking link on the Dashboard first.</p>
                </div>
              )}

              <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Weekly Hours</h3>
                  <div className="space-y-3">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                          <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                              <div className="w-28 flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    checked={availability.workingHours[day]?.enabled}
                                    onChange={(e) => updateDay(day, 'enabled', e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="capitalize font-medium text-gray-700">{day}</span>
                              </div>
                              
                              {availability.workingHours[day]?.enabled ? (
                                  <div className="flex items-center gap-2 flex-1">
                                      <input 
                                          type="time" 
                                          value={availability.workingHours[day].start}
                                          onChange={(e) => updateDay(day, 'start', e.target.value)}
                                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                      />
                                      <span className="text-gray-400">-</span>
                                      <input 
                                          type="time" 
                                          value={availability.workingHours[day].end}
                                          onChange={(e) => updateDay(day, 'end', e.target.value)}
                                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                      />
                                  </div>
                              ) : (
                                  <span className="text-sm text-gray-400 italic py-1.5">Unavailable</span>
                              )}
                          </div>
                      ))}
                  </div>
              </div>

              <div className="max-w-xs">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Buffer Time (minutes)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={availability.bufferTime}
                    onChange={(e) => setAvailability({ ...availability, bufferTime: parseInt(e.target.value) })}
                    className="w-full pl-4 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="absolute right-4 top-2.5 text-gray-400 text-sm">min</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Add gaps between meetings to prevent back-to-back bookings.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Bar */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 font-bold shadow-sm disabled:opacity-70 disabled:cursor-wait"
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
  );
}