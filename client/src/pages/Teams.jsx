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
  Star,
  Trash2,
  Edit,
  ExternalLink,
  X,
} from 'lucide-react';
import { teams } from '../utils/api';

export default function Teams() {
  const navigate = useNavigate();
  const [teamsList, setTeamsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [editTeam, setEditTeam] = useState({ name: '', description: '' });
  const [showMenu, setShowMenu] = useState(null);

  useEffect(() => {
    loadTeams();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowMenu(null);
    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenu]);

  const isPersonalTeam = (team) => {
    if (!team) return false;
    if (team.is_personal === true) return true;
    const name = (team.name || '').toLowerCase();
    if (name.includes('personal') && name.includes('booking')) return true;
    return false;
  };

  const loadTeams = async () => {
    try {
      const response = await teams.getAll();
      const allTeams = response.data.teams || [];

      console.log('📊 Raw teams from API:', allTeams);

      const sortedTeams = [...allTeams].sort((a, b) => {
        const aIsPersonal = isPersonalTeam(a);
        const bIsPersonal = isPersonalTeam(b);
        if (aIsPersonal && !bIsPersonal) return -1;
        if (!aIsPersonal && bIsPersonal) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      console.log('✅ Sorted teams (personal first):', sortedTeams);
      setTeamsList(sortedTeams);
    } catch (error) {
      console.error('❌ Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (e, teamId, bookingToken) => {
    e.stopPropagation();
    if (!bookingToken) {
      alert('⚠️ Booking link not available. Please refresh the page.');
      return;
    }

    const link = `${window.location.origin}/book/${bookingToken}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiedId(bookingToken);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch((err) => {
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
      console.error('❌ Error creating team:', error);
      alert('Failed to create team. Please try again.');
    }
  };

  const handleEditTeam = async (e) => {
    e.preventDefault();
    if (!selectedTeam) return;
    
    try {
      await teams.update(selectedTeam.id, editTeam);
      setShowEditModal(false);
      setSelectedTeam(null);
      setEditTeam({ name: '', description: '' });
      loadTeams();
    } catch (error) {
      console.error('❌ Error updating team:', error);
      alert('Failed to update team. Please try again.');
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    
    try {
      await teams.delete(selectedTeam.id);
      setShowDeleteConfirm(false);
      setSelectedTeam(null);
      loadTeams();
    } catch (error) {
      console.error('❌ Error deleting team:', error);
      alert('Failed to delete team. Please try again.');
    }
  };

  const openEditModal = (team) => {
    setSelectedTeam(team);
    setEditTeam({ name: team.name, description: team.description || '' });
    setShowEditModal(true);
    setShowMenu(null);
  };

  const openDeleteConfirm = (team) => {
    setSelectedTeam(team);
    setShowDeleteConfirm(true);
    setShowMenu(null);
  };

  const toggleMenu = (e, teamId) => {
    e.stopPropagation();
    setShowMenu(showMenu === teamId ? null : teamId);
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
        {/* Header */}
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

        {/* Empty State */}
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
          /* Teams Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamsList.map((team) => {
              const personal = isPersonalTeam(team);

              return (
                <div
                  key={team.id}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all border-2 border-gray-100 overflow-hidden"
                >
                  {/* Card Header */}
                  <div
                    className={`p-6 relative ${
                      personal
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                        : 'bg-gradient-to-br from-blue-500 to-purple-600'
                    }`}
                  >
                    {/* Personal Badge */}
                    {personal && (
                      <div className="absolute top-4 left-4">
                        <span className="bg-white/30 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <Star className="h-3 w-3 fill-white" />
                          Personal
                        </span>
                      </div>
                    )}

                    {/* Menu Button */}
                    <div className="absolute top-4 right-4 relative">
                      <button 
                        onClick={(e) => toggleMenu(e, team.id)}
                        className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
                      >
                        <MoreVertical className="h-4 w-4 text-white" />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {showMenu === team.id && (
                        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[160px] z-10">
                          <button
                            onClick={() => openEditModal(team)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit Team
                          </button>
                          <button
                            onClick={() => navigate(`/teams/${team.id}/settings`)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Settings className="h-4 w-4" />
                            Team Settings
                          </button>
                          {team.booking_token && (
                            <a
                              href={`${window.location.origin}/book/${team.booking_token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Preview Booking
                            </a>
                          )}
                          {!personal && (
                            <>
                              <div className="border-t border-gray-100 my-1"></div>
                              <button
                                onClick={() => openDeleteConfirm(team)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Team
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Team Icon & Name */}
                    <div className={`w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 ${personal ? 'mt-8' : ''}`}>
                      <Users className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1 pr-8">{team.name}</h3>
                    <p className={`text-sm line-clamp-2 ${personal ? 'text-green-100' : 'text-blue-100'}`}>
                      {team.description || 'No description'}
                    </p>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    {/* Stats */}
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

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={() => navigate(`/teams/${team.id}/members`)}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-semibold"
                      >
                        <Settings className="h-4 w-4" />
                        Manage Members
                      </button>

                      <button
                        onClick={(e) => handleCopyLink(e, team.id, team.booking_token)}
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
                            No Link Available
                          </>
                        ) : copiedId === team.booking_token ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy Booking Link
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create New Team</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
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
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Team</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTeam(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleEditTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Team Name *</label>
                <input
                  type="text"
                  required
                  value={editTeam.name}
                  onChange={(e) => setEditTeam({ ...editTeam, name: e.target.value })}
                  placeholder="Sales Team"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  value={editTeam.description}
                  onChange={(e) => setEditTeam({ ...editTeam, description: e.target.value })}
                  placeholder="Book time with our sales team"
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedTeam(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-semibold transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete Team?</h2>
              <p className="text-gray-600">
                Are you sure you want to delete <span className="font-semibold">"{selectedTeam.name}"</span>? 
                This will remove all team members and cannot be undone.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedTeam(null);
                }}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeam}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition-colors"
              >
                Delete Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}