import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Users, 
  Settings,
  RefreshCw,
  Zap,
  UserPlus,
  Info,
  Bell
} from 'lucide-react';
import api from '../utils/api';
import ReminderSettings from '../components/ReminderSettings';

export default function TeamSettings() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    booking_mode: 'individual',
  });

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  const loadTeam = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/teams/${teamId}`);
      const teamData = response.data.team;
      
      setTeam(teamData);
      setFormData({
        name: teamData.name || '',
        description: teamData.description || '',
        booking_mode: teamData.booking_mode || 'individual',
      });
    } catch (error) {
      console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      await api.put(`/teams/${teamId}`, formData);
      console.log('✅ Team settings saved');
      
      // Go back to teams page
      navigate('/teams');
    } catch (error) {
      console.error('Error saving team:', error);
      alert('Failed to save team settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const bookingModes = [
    {
      id: 'individual',
      name: 'Individual',
      icon: Users,
      description: 'Guest selects a specific team member to book with',
      color: 'blue',
      badge: 'Default'
    },
    {
      id: 'round_robin',
      name: 'Round-robin',
      icon: RefreshCw,
      description: 'Automatically rotate bookings evenly among all team members',
      color: 'purple',
      badge: 'Auto-assign'
    },
    {
      id: 'first_available',
      name: 'First Available',
      icon: Zap,
      description: 'Assign to the first team member who has availability',
      color: 'green',
      badge: 'Fastest'
    },
    {
      id: 'collective',
      name: 'Collective',
      icon: UserPlus,
      description: 'Book a meeting with all team members at once',
      color: 'orange',
      badge: 'Group'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/teams')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Settings</h1>
          <p className="text-gray-600 mt-1">Configure how your team accepts bookings</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Basic Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                placeholder="Sales Team"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                placeholder="Describe what this team does..."
              />
            </div>
          </div>
        </div>

        {/* Booking Mode Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Booking Mode
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Choose how bookings are assigned to team members
            </p>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How booking modes work:</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Individual:</strong> Guests choose who they want to meet with</li>
                  <li>• <strong>Round-robin:</strong> System automatically distributes bookings fairly</li>
                  <li>• <strong>First Available:</strong> System picks the first free team member</li>
                  <li>• <strong>Collective:</strong> Books everyone for a group meeting</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Booking Mode Options */}
          <div className="grid md:grid-cols-2 gap-4">
            {bookingModes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = formData.booking_mode === mode.id;
              
              const colorClasses = {
                blue: {
                  border: 'border-blue-500',
                  bg: 'bg-blue-50',
                  badge: 'bg-blue-600',
                  icon: 'text-blue-600',
                  hover: 'hover:border-blue-300'
                },
                purple: {
                  border: 'border-purple-500',
                  bg: 'bg-purple-50',
                  badge: 'bg-purple-600',
                  icon: 'text-purple-600',
                  hover: 'hover:border-purple-300'
                },
                green: {
                  border: 'border-green-500',
                  bg: 'bg-green-50',
                  badge: 'bg-green-600',
                  icon: 'text-green-600',
                  hover: 'hover:border-green-300'
                },
                orange: {
                  border: 'border-orange-500',
                  bg: 'bg-orange-50',
                  badge: 'bg-orange-600',
                  icon: 'text-orange-600',
                  hover: 'hover:border-orange-300'
                }
              };

              const colors = colorClasses[mode.color];

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, booking_mode: mode.id })}
                  className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? `${colors.border} ${colors.bg} shadow-lg`
                      : `border-gray-200 hover:shadow-md ${colors.hover}`
                  }`}
                >
                  {/* Badge */}
                  <span className={`absolute top-3 right-3 px-2 py-1 ${colors.badge} text-white text-xs font-bold rounded-full`}>
                    {mode.badge}
                  </span>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg ${colors.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`h-6 w-6 ${colors.icon}`} />
                  </div>

                  {/* Content */}
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    {mode.name}
                    {isSelected && (
                      <span className="text-green-600">✓</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {mode.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/teams')}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>

      {/* NEW: Reminder Settings Section */}
      <div className="pt-6 border-t-2 border-gray-200">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-600" />
            Reminder Automation
          </h2>
          <p className="text-gray-600 mt-1">
            Configure automatic meeting reminders for this team
          </p>
        </div>
        
        <ReminderSettings teamId={parseInt(teamId)} />
      </div>
    </div>
  );
}