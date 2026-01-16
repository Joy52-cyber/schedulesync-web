import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Users, 
  Clock,
  Save,
  Trash2,
  ArrowLeft,
  Check,
  Loader2,
  Zap
} from 'lucide-react';
import { teams } from '../utils/api';

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
  });

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  const loadTeam = async () => {
    try {
      const response = await teams.getAll();
      const foundTeam = response.data.teams.find(t => t.id === parseInt(teamId));
      setTeam(foundTeam || team);
    } catch (error) {
      console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await teams.update(teamId, team);
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
      await teams.delete(teamId);
      navigate('/teams');
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <div className="relative z-10">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
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

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border-2 border-white/20 hover:shadow-purple-200/30 transition-all">

          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-8">
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

            {/* Scheduling Mode Info */}
            <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-6">
              <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Scheduling Mode Explained
              </h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold">Round Robin:</span>
                  <span>Distributes bookings evenly among team members.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">Collective:</span>
                  <span>All team members must be available for the meeting.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">First Available:</span>
                  <span>Books with the first available team member.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:shadow-2xl hover:shadow-purple-200/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 font-bold disabled:opacity-50 shadow-lg"
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
            className="bg-white/80 border-2 border-red-500 text-red-600 px-8 py-4 rounded-xl hover:bg-red-50 hover:shadow-2xl hover:shadow-red-200/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 font-bold shadow-lg"
          >
            <Trash2 className="h-5 w-5" />
            Delete Team
          </button>
        </div>
      </div>
    </div>
  );
}
