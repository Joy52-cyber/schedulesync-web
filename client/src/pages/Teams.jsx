import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpgrade } from '../context/UpgradeContext';
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
  const { showUpgradeModal, hasTeamFeature, currentTier } = useUpgrade(); 
  const [teamsList, setTeamsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  
  // ✅ NEW: Dropdown and edit modal state
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    loadTeams();
  }, []);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

   if (!hasTeamFeature()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border-2 border-purple-200">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="h-10 w-10 text-white" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Team Features
            </h1>
            
            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
              Create teams, add members, and manage group scheduling with round-robin 
              and collective booking modes.
            </p>

            <div className="bg-purple-50 rounded-2xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-purple-900 mb-4">What you get with Team plan:</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  Create unlimited teams
                </li>
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  Up to 10 team members per team
                </li>
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  Round-robin booking mode
                </li>
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  Collective team scheduling
                </li>
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  Team booking links
                </li>
              </ul>
            </div>

            <button
              onClick={() => showUpgradeModal('teams')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg"
            >
              Upgrade to Team Plan - $25/month
            </button>
            
            <p className="text-sm text-gray-500 mt-4">
              Currently on: <span className="font-medium capitalize">{currentTier}</span> plan
            </p>
          </div>
        </div>
      </div>
    );
  }

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

      const sortedTeams = [...allTeams].sort((a, b) => {
        const aIsPersonal = isPersonalTeam(a);
        const bIsPersonal = isPersonalTeam(b);
        if (aIsPersonal && !bIsPersonal) return -1;
        if (!aIsPersonal && bIsPersonal) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      setTeamsList(sortedTeams);
    } catch (error) {
      console.error('❌ Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBookingLink = (team) => {
    const personal = isPersonalTeam(team);
    
    if (personal) {
      if (!team.booking_token) return null;
      return {
        url: `${window.location.origin}/book/${team.booking_token}`,
        token: team.booking_token,
      };
    } else {
      if (!team.team_booking_token) return null;
      return {
        url: `${window.location.origin}/book/${team.team_booking_token}`,
        token: team.team_booking_token,
      };
    }
  };

  const handleCopyLink = (team) => {
    const linkInfo = getBookingLink(team);
    
    if (!linkInfo) {
      alert('⚠️ Booking link not available. Please refresh the page or contact support.');
      return;
    }

    navigator.clipboard
      .writeText(linkInfo.url)
      .then(() => {
        setCopiedId(linkInfo.token);
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

  // ✅ NEW: Edit team handler
  const handleEditTeam = async (e) => {
    e.preventDefault();
    if (!editingTeam) return;
    
    setActionLoading(true);
    try {
      await teams.update(editingTeam.id, {
        name: editingTeam.name,
        description: editingTeam.description,
      });
      setEditingTeam(null);
      loadTeams();
    } catch (error) {
      console.error('❌ Error updating team:', error);
      alert('Failed to update team. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ NEW: Delete team handler
  const handleDeleteTeam = async (teamId) => {
    setActionLoading(true);
    try {
      await teams.delete(teamId);
      setDeleteConfirm(null);
      loadTeams();
    } catch (error) {
      console.error('❌ Error deleting team:', error);
      alert('Failed to delete team. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ NEW: Open booking page in new tab
  const handleOpenBookingPage = (team) => {
    const linkInfo = getBookingLink(team);
    if (linkInfo) {
      window.open(linkInfo.url, '_blank');
    }
    setOpenMenuId(null);
  };

  // ✅ NEW: Dropdown Menu Component
  const TeamDropdownMenu = ({ team }) => {
    const personal = isPersonalTeam(team);
    const linkInfo = getBookingLink(team);
    const isOpen = openMenuId === team.id;

    return (
      <div className="relative" ref={isOpen ? menuRef : null}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuId(isOpen ? null : team.id);
          }}
          className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <MoreVertical className="h-4 w-4 text-white" />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Settings */}
            <button
              onClick={() => {
                navigate(`/teams/${team.id}/settings`);
                setOpenMenuId(null);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <Settings className="h-4 w-4 text-gray-500" />
              Team Settings
            </button>

            {/* Edit */}
            {!personal && (
              <button
                onClick={() => {
                  setEditingTeam({ ...team });
                  setOpenMenuId(null);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <Edit className="h-4 w-4 text-gray-500" />
                Edit Team
              </button>
            )}

            {/* Open Booking Page */}
            {linkInfo && (
              <button
                onClick={() => handleOpenBookingPage(team)}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-gray-500" />
                Open Booking Page
              </button>
            )}

            {/* Copy Link */}
            {linkInfo && (
              <button
                onClick={() => {
                  handleCopyLink(team);
                  setOpenMenuId(null);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <Copy className="h-4 w-4 text-gray-500" />
                Copy Booking Link
              </button>
            )}

            {/* Delete - Only for non-personal teams */}
            {!personal && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <button
                  onClick={() => {
                    setDeleteConfirm(team);
                    setOpenMenuId(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Team
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
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
              const personal = isPersonalTeam(team);
              const linkInfo = getBookingLink(team);
              const hasLink = !!linkInfo;

              return (
                <div
                  key={team.id}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all border-2 border-gray-100 overflow-hidden"
                >
                  <div
                    className={`p-6 relative ${
                      personal
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                        : 'bg-gradient-to-br from-blue-500 to-purple-600'
                    }`}
                  >
                    {personal && (
                      <div className="absolute top-4 left-4">
                        <span className="bg-white/30 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <Star className="h-3 w-3 fill-white" />
                          Personal
                        </span>
                      </div>
                    )}

                    {/* ✅ FIXED: Working dropdown menu */}
                    <div className="absolute top-4 right-4">
                      <TeamDropdownMenu team={team} />
                    </div>

                    <div
                      className={`w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 ${
                        personal ? 'mt-8' : ''
                      }`}
                    >
                      <Users className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{team.name}</h3>
                    <p
                      className={`text-sm line-clamp-2 ${
                        personal ? 'text-green-100' : 'text-blue-100'
                      }`}
                    >
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
                        <p className="text-2xl font-bold text-gray-900">{team.booking_mode?.substring(0, 2).toUpperCase() || 'RR'}</p>
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
                        onClick={() => handleCopyLink(team)}
                        disabled={!hasLink}
                        className={`w-full px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${
                          !hasLink
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : copiedId === linkInfo?.token
                            ? 'bg-green-100 text-green-700 border-2 border-green-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {!hasLink ? (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            No Link
                          </>
                        ) : copiedId === linkInfo?.token ? (
                          <>
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-green-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy {personal ? 'Link' : 'Team Link'}
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
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ NEW: Edit Team Modal */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Team</h2>
              <button
                onClick={() => setEditingTeam(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                  placeholder="Sales Team"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  value={editingTeam.description || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, description: e.target.value })}
                  placeholder="Book time with our sales team"
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ NEW: Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete Team?</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? 
                This action cannot be undone. All team members will be removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTeam(deleteConfirm.id)}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Team
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}