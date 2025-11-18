import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Users, 
  Copy, 
  Check, 
  AlertCircle, 
  TrendingUp,
  Zap,
  UserPlus,
  Calendar,
  Info,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function TeamSettings() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState({
    booking_mode: 'individual',
    allow_team_booking: false
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadTeamSettings();
  }, [teamId]);

  const loadTeamSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_URL}/teams/${teamId}/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTeam(response.data.team);
      setMembers(response.data.members);
      setSettings({
        booking_mode: response.data.team.booking_mode || 'individual',
        allow_team_booking: response.data.team.allow_team_booking || false
      });
    } catch (error) {
      console.error('Error loading team settings:', error);
      alert('Failed to load team settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${API_URL}/teams/${teamId}/settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Settings saved successfully!');
      await loadTeamSettings(); // Reload to get updated data
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const copyTeamBookingLink = () => {
    const link = `${window.location.origin}/book/team/${team.team_booking_token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'round-robin': return <TrendingUp className="h-5 w-5" />;
      case 'first-available': return <Zap className="h-5 w-5" />;
      case 'collective': return <Users className="h-5 w-5" />;
      default: return <UserPlus className="h-5 w-5" />;
    }
  };

  const getModeDescription = (mode) => {
    switch (mode) {
      case 'round-robin':
        return 'Distribute bookings evenly across all team members. Each member gets the next booking in rotation.';
      case 'first-available':
        return 'Assign bookings to the first available team member based on their calendar.';
      case 'collective':
        return 'Book the entire team at once. All members will be invited to the meeting.';
      default:
        return 'Each team member has their own individual booking page.';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
      </div>
    );
  }

  const teamBookingLink = team?.team_booking_token 
    ? `${window.location.origin}/book/team/${team.team_booking_token}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            Team Booking Settings
          </h1>
          <p className="text-gray-600 mt-2">{team?.name}</p>
        </div>
        <button
          onClick={() => navigate('/teams')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ← Back to Teams
        </button>
      </div>

      {/* Booking Mode Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          Booking Mode
        </h2>
        <p className="text-gray-600 mb-6">
          Choose how bookings should be distributed among your team members
        </p>

        <div className="space-y-3">
          {/* Individual Mode */}
          <button
            onClick={() => setSettings({ ...settings, booking_mode: 'individual' })}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
              settings.booking_mode === 'individual'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                settings.booking_mode === 'individual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                <UserPlus className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900">Individual Booking</h3>
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                    Default
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Each team member has their own individual booking page. Team booking page is disabled.
                </p>
              </div>
              {settings.booking_mode === 'individual' && (
                <Check className="h-6 w-6 text-blue-600 flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Round-Robin Mode */}
          <button
            onClick={() => setSettings({ ...settings, booking_mode: 'round-robin' })}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
              settings.booking_mode === 'round-robin'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                settings.booking_mode === 'round-robin' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900">Round-Robin</h3>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Distribute bookings evenly. The team member with the fewest bookings gets assigned next.
                </p>
              </div>
              {settings.booking_mode === 'round-robin' && (
                <Check className="h-6 w-6 text-blue-600 flex-shrink-0" />
              )}
            </div>
          </button>

          {/* First-Available Mode */}
          <button
            onClick={() => setSettings({ ...settings, booking_mode: 'first-available' })}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
              settings.booking_mode === 'first-available'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                settings.booking_mode === 'first-available' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                <Zap className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900">First Available</h3>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                    Smart
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Assign to the first team member who is available at the requested time (requires calendar sync).
                </p>
              </div>
              {settings.booking_mode === 'first-available' && (
                <Check className="h-6 w-6 text-blue-600 flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Collective Mode */}
          <button
            onClick={() => setSettings({ ...settings, booking_mode: 'collective' })}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
              settings.booking_mode === 'collective'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                settings.booking_mode === 'collective' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900">Collective Booking</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Book with the entire team at once. All team members will be invited to the meeting.
                </p>
              </div>
              {settings.booking_mode === 'collective' && (
                <Check className="h-6 w-6 text-blue-600 flex-shrink-0" />
              )}
            </div>
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                {settings.booking_mode === 'individual' ? 'Individual Mode' : 
                 settings.booking_mode === 'round-robin' ? 'Round-Robin Mode' :
                 settings.booking_mode === 'first-available' ? 'First Available Mode' :
                 'Collective Mode'}
              </p>
              <p className="text-sm text-blue-800">
                {getModeDescription(settings.booking_mode)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enable Team Booking */}
      {settings.booking_mode !== 'individual' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ExternalLink className="h-6 w-6 text-blue-600" />
            Team Booking Page
          </h2>

          <div className="flex items-start gap-4 mb-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allow_team_booking}
                onChange={(e) => setSettings({ ...settings, allow_team_booking: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <div>
              <p className="font-semibold text-gray-900">Enable Public Team Booking Page</p>
              <p className="text-sm text-gray-600 mt-1">
                Allow clients to book directly with your team using a shared booking link
              </p>
            </div>
          </div>

          {settings.allow_team_booking && teamBookingLink && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm font-semibold text-green-900 mb-3">
                📎 Your Team Booking Link
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={teamBookingLink}
                  readOnly
                  className="flex-1 px-4 py-2 bg-white border border-green-300 rounded-lg text-sm font-mono"
                />
                <button
                  onClick={copyTeamBookingLink}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Booking Distribution Stats */}
      {members.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Booking Distribution
          </h2>

          <div className="space-y-4">
            {members.map(member => {
              const maxBookings = Math.max(...members.map(m => parseInt(m.total_bookings) || 0));
              const percentage = maxBookings > 0 ? ((parseInt(member.total_bookings) || 0) / maxBookings) * 100 : 0;

              return (
                <div key={member.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold">
                          {(member.user_name || member.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {member.user_name || member.name || member.email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {parseInt(member.upcoming_bookings) || 0} upcoming
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {parseInt(member.total_bookings) || 0}
                      </p>
                      <p className="text-xs text-gray-500">total bookings</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div>
          <p className="font-semibold text-gray-900">Ready to save your changes?</p>
          <p className="text-sm text-gray-600">
            Your team booking settings will be updated immediately
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              Saving...
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}