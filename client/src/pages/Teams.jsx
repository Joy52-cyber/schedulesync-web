import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Settings, 
  Copy,
  Check,
  Loader2,
  MoreVertical,
  AlertCircle,
  Star
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
    const allTeams = response.data.teams || [];
    
    console.log('📊 Teams loaded:', allTeams.length);
    console.log('📊 Sample team data:', allTeams[0]);
    
    // Sort: Personal booking first, then alphabetically
    const sortedTeams = [...allTeams].sort((a, b) => {
      const aIsPersonal = a.is_personal || a.member_count === 1;
      const bIsPersonal = b.is_personal || b.member_count === 1;
      
      if (aIsPersonal && !bIsPersonal) return -1;
      if (!aIsPersonal && bIsPersonal) return 1;
      return a.name.localeCompare(b.name);
    });
    
    setTeamsList(sortedTeams); // ← use the sorted list
  } catch (error) {
    console.error('Error loading teams:', error);
  } finally {
    setLoading(false);
  }
};


  const handleCopyLink = (teamId, bookingToken) => {
    if (!bookingToken) {
      alert('⚠️ Booking link not available. Please refresh the page or contact support.');
      console.error('❌ No booking token for team:', teamId);
      return;
    }

    const link = `${window.location.origin}/book/${bookingToken}`;
    
    console.log('📋 Copying booking link:', link);
    
    navigator.clipboard.writeText(link).then(() => {
      console.log('✅ Link copied successfully');
      setCopiedId(bookingToken);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch((err) => {
      console.error('❌ Failed to copy:', err);
      alert('Failed to copy link. Please try again.');
    });
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
      alert('Failed to create team. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading teams...</p>
        </div>
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
            {teamsList.map((team) => {
              const isPersonal = team.is_personal || team.member_count === 1;
              
              return (
                <div
                  key={team.id}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all border-2 border-gray-100 overflow-hidden"
                >
                  <div className={`p-6 relative ${
                    isPersonal 
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                      : 'bg-gradient-to-br from-blue-500 to-purple-600'
                  }`}>
                    {/* Personal Badge */}
                    {isPersonal && (
                      <div className="absolute top-4 left-4">
                        <span className="bg-white/30 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <Star className="h-3 w-3 fill-white" />
                          Personal
                        </span>
                      </div>
                    )}
                    
                    <div className="absolute top-4 right-4">
                      <button className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors">
                        <MoreVertical className="h-4 w-4 text-white" />
                      </button>
                    </div>
                    
                    <div className={`w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 ${isPersonal ? 'mt-8' : ''}`}>
                      <Users className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{team.name}</h3>
                    <p className={`text-sm line-clamp-2 ${
                      isPersonal ? 'text-green-100' : 'text-blue-100'
                    }`}>
                      {team.description || 'No description'}
                    </p>
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

                    <div className="space-y-2">
                      <button
                        onClick={() => navigate(`/teams/${team.id}/members`)}
                        className="w-full bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold"
                      >
                        <Settings className="h-4 w-4" />
                        Manage Team
                      </button>
                      
                      <button
                        onClick={() => handleCopyLink(team.id, team.booking_token)}
                        disabled={!team.booking_token}
                        className={`w-full px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${
                          !team.booking_token
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : copiedId === team.booking_token
                            ? 'bg-green-100 text-green-700 border-2 border-green-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {!team.booking_token ? (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            No Link
                          </>
                        ) : copiedId === team.booking_token ? (
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
              );
            })}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  placeholder="Book time with our sales team"
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-semibold transition-all"
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