import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Users, 
  Clock,
  Link as LinkIcon,
  Save,
  Trash2,
  ArrowLeft,
  Check,
  Loader2,
  DollarSign,
  Calendar,
  Zap
} from 'lucide-react';

export default function TeamSettings() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [team, setTeam] = useState({
    name: '',
    description: '',
    duration: 30,
    mode: 'round-robin',
    bufferTime: 0,
    leadTime: 60,
    price: 0,
    currency: 'USD'
  });

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  const loadTeam = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      setTeam(data.team || team);
    } catch (error) {
      console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(team)
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving team:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this team? This cannot be undone.')) return;
    
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      navigate('/teams');
    } catch (error) {
      console.error('Error deleting team:', error);
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Teams
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Team Settings</h1>
          <p className="text-gray-600">Configure your team's booking preferences</p>
        </div>

        {/* Settings Form */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-gray-100">
          
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <Settings className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{team.name}</h2>
                <p className="text-blue-100">{team.description}</p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-8 space-y-8">
            
            {/* Basic Info */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Basic Information
              </h3>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Team Name</label>
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => setTeam({ ...team, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  placeholder="Sales Team"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  value={team.description}
                  onChange={(e) => setTeam({ ...team, description: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none transition-all"
                  placeholder="Book time with our sales team"
                />
              </div>
            </div>

            {/* Scheduling Settings */}
            <div className="space-y-6 pt-6 border-t-2 border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-600" />
                Scheduling Settings
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Meeting Duration (minutes)</label>
                  <input
                    type="number"
                    value={team.duration}
                    onChange={(e) => setTeam({ ...team, duration: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Scheduling Mode</label>
                  <select
                    value={team.mode}
                    onChange={(e) => setTeam({ ...team, mode: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  >
                    <option value="round-robin">Round Robin</option>
                    <option value="collective">Collective</option>
                    <option value="first-available">First Available</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Buffer Time (minutes)</label>
                  <input
                    type="number"
                    value={team.bufferTime}
                    onChange={(e) => setTeam({ ...team, bufferTime: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Lead Time (minutes)</label>
                  <input
                    type="number"
                    value={team.leadTime}
                    onChange={(e) => setTeam({ ...team, leadTime: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-6 pt-6 border-t-2 border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Pricing (Optional)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={team.price}
                    onChange={(e) => setTeam({ ...team, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Currency</label>
                  <select
                    value={team.currency}
                    onChange={(e) => setTeam({ ...team, currency: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Mode Explanation */}
            <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-6">
              <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Scheduling Mode Explained
              </h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold">Round Robin:</span>
                  <span>Distributes bookings evenly among team members</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">Collective:</span>
                  <span>All team members must be available for the meeting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">First Available:</span>
                  <span>Books with the first available team member</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold disabled:opacity-50"
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

          <button
            onClick={handleDelete}
            className="bg-white border-2 border-red-500 text-red-600 px-8 py-4 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-2 font-bold"
          >
            <Trash2 className="h-5 w-5" />
            Delete Team
          </button>
        </div>
      </div>
    </div>
  );
}