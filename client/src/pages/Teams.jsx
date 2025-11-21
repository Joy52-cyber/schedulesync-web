import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Settings, 
  Copy,
  Check,
  Loader2,
  MoreVertical
} from 'lucide-react';
import { teams } from '../utils/api';

export default function Teams() {
  const navigate = useNavigate();
  const [teamsList, setTeamsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await teams.getAll();
      setTeamsList(response.data.teams || []);
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (teamId, bookingToken) => {
    const link = `${window.location.origin}/book/${bookingToken}`;
    navigator.clipboard.writeText(link);
    setCopiedId(bookingToken);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await teams.create(newTeam);
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '' });
      loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Teams</h1>
            <p className="text-gray-600">Manage your scheduling teams and members</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">Create Team</span>
          </button>
        </div>

        {teamsList.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center border-2 border-gray-100">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No teams yet</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first team to start managing group bookings
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transition-all inline-flex items-center gap-2 font-semibold"
            >
              <Plus className="h-5 w-5" />
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamsList.map((team) => (
              <div
                key={team.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all border-2 border-gray-100 overflow-hidden"
              >
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 relative">
                  <div className="absolute top-4 right-4">
                    <button className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30">
                      <MoreVertical className="h-4 w-4 text-white" />
                    </button>
                  </div>
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{team.name}</h3>
                  <p className="text-blue-100 text-sm line-clamp-2">{team.description}</p>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{team.member_count || 0}</p>
                      <p className="text-xs text-gray-600">Members</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{team.booking_count || 0}</p>
                      <p className="text-xs text-gray-600">Bookings</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{team.mode || 'RR'}</p>
                      <p className="text-xs text-gray-600">Mode</p>
                    </div>
                  </div>
                  <button
  onClick={() => navigate(`/teams/${team.id}/members`)}  // ← Add /members
  className="w-full bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold"
>
  <Settings className="h-4 w-4" />
  Manage Team
</button>
                  <div className="space-y-2">
                   
                      onClick={() => handleCopyLink(team.id, team.booking_token)}
                      className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 font-semibold"
                    >
                      {copiedId === team.booking_token ? (
                        <>
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Team Name *</label>
                <input
                  type="text"
                  required
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  placeholder="Sales Team"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  placeholder="Book time with our sales team"
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-semibold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}