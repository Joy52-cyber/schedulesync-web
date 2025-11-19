import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Edit2, Trash2, Mail, Copy, Check, X, Settings, 
  Clock, Send, Link2, Calendar, User, AlertCircle, CheckCircle,
  ChevronRight, Sparkles
} from 'lucide-react';
import { teams } from '../utils/api';

export default function Teams() {
  const navigate = useNavigate();
  const [teamsList, setTeamsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const response = await teams.getAll();
      setTeamsList(response.data.teams || []);
    } catch (error) {
      console.error('Error loading teams:', error);
      showNotification('Failed to load teams', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (teamId) => {
    try {
      const response = await teams.getMembers(teamId);
      return response.data.members || [];
    } catch (error) {
      console.error('Error loading members:', error);
      return [];
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await teams.create(newTeam);
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '' });
      loadTeams();
      showNotification('Team created successfully!');
    } catch (error) {
      console.error('Error creating team:', error);
      showNotification('Failed to create team', 'error');
    }
  };

  const handleDeleteTeam = async (id) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      await teams.delete(id);
      loadTeams();
      showNotification('Team deleted successfully');
    } catch (error) {
      console.error('Error deleting team:', error);
      showNotification('Failed to delete team', 'error');
    }
  };

  const handleEditTeam = async (e) => {
    e.preventDefault();
    try {
      await teams.update(selectedTeam.id, {
        name: selectedTeam.name,
        description: selectedTeam.description
      });
      setShowEditModal(false);
      loadTeams();
      showNotification('Team updated successfully!');
    } catch (error) {
      console.error('Error updating team:', error);
      showNotification('Failed to update team', 'error');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const response = await teams.addMember(selectedTeam.id, { 
        email: newMemberEmail,
        sendEmail: true 
      });
      setNewMemberEmail('');
      
      const members = await loadMembers(selectedTeam.id);
      setSelectedTeam({ ...selectedTeam, members });
      
      showNotification(`Member invited! Booking link sent to ${newMemberEmail}`);
    } catch (error) {
      console.error('Error adding member:', error);
      showNotification('Failed to add member', 'error');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove this member from the team?')) return;
    try {
      await teams.removeMember(selectedTeam.id, memberId);
      const members = await loadMembers(selectedTeam.id);
      setSelectedTeam({ ...selectedTeam, members });
      showNotification('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      showNotification('Failed to remove member', 'error');
    }
  };

  const openManageModal = async (team) => {
    const members = await loadMembers(team.id);
    setSelectedTeam({ ...team, members });
    setShowManageModal(true);
  };

  const getTeamBookingUrl = (teamId) => {
    return `${window.location.origin}/team/${teamId}/book`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    showNotification('Link copied to clipboard!');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-lg ${
            notification.type === 'error' 
              ? 'bg-red-500 text-white' 
              : 'bg-green-500 text-white'
          }`}>
            {notification.type === 'error' ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <CheckCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Teams
              </h1>
              <p className="text-gray-600 mt-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Manage your scheduling teams and members
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="group px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
              Create Team
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
            </div>
            <p className="mt-4 text-gray-600 font-medium">Loading teams...</p>
          </div>
        ) : teamsList.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="h-12 w-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No teams yet</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Create your first team to start organizing your scheduling and managing bookings
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-105 transition-all inline-flex items-center gap-3"
            >
              <Sparkles className="h-5 w-5" />
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {teamsList.map((team) => (
              <div 
                key={team.id} 
                className="group bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden"
              >
                {/* Card Header with Gradient */}
                <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {team.name}
                      </h3>
                      {team.description && (
                        <p className="text-gray-600 mt-2 text-sm line-clamp-2">
                          {team.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedTeam(team);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit Team"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Team"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <Calendar className="h-4 w-4" />
                    <span>Created {new Date(team.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}</span>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => openManageModal(team)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-between group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Manage Members
                      </span>
                      <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                    
                    <button
                      onClick={() => navigate(`/teams/${team.id}/settings`)}
                      className="w-full px-4 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-all flex items-center justify-between group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Team Settings
                      </span>
                      <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create New Team</h2>
                <p className="text-sm text-gray-600">Start organizing your scheduling</p>
              </div>
            </div>
            
            <form onSubmit={handleCreateTeam} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
                  placeholder="e.g., Sales Team, Support Team"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all resize-none"
                  placeholder="What does this team do?"
                  rows="3"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTeam({ name: '', description: '' });
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-105 transition-all"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Edit2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Edit Team</h2>
                <p className="text-sm text-gray-600">Update team information</p>
              </div>
            </div>
            
            <form onSubmit={handleEditTeam} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={selectedTeam.name}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={selectedTeam.description}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all resize-none"
                  rows="3"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-105 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Team Modal - Enhanced */}
      {showManageModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-auto shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white bg-opacity-20 backdrop-blur-lg rounded-xl flex items-center justify-center">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedTeam.name}</h2>
                    <p className="text-blue-100 text-sm mt-1">
                      {selectedTeam.members?.length || 0} member{selectedTeam.members?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowManageModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {/* Team Booking URL */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Team Booking Link</h3>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={getTeamBookingUrl(selectedTeam.id)}
                    readOnly
                    className="w-full px-4 py-3 bg-white border-2 border-blue-200 rounded-lg text-sm text-gray-700 font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(getTeamBookingUrl(selectedTeam.id))}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 font-semibold"
                  >
                    {copiedUrl === getTeamBookingUrl(selectedTeam.id) ? (
                      <>
                        <Check className="h-5 w-5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-5 w-5" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Add Member Section */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Invite New Member</h3>
                </div>
                <form onSubmit={handleAddMember} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="member@example.com"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="h-5 w-5" />
                    Send Invitation
                  </button>
                  <p className="text-xs text-gray-600 text-center">
                    💌 An email with booking link will be sent automatically
                  </p>
                </form>
              </div>

              {/* Members List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Team Members
                </h3>
                
                {!selectedTeam.members || selectedTeam.members.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No members yet</p>
                    <p className="text-gray-500 text-sm mt-1">Invite your first member above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTeam.members.map((member) => (
                      <div
                        key={member.id}
                        className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-lg">
                              {(member.user_email?.[0] || 'U').toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900">
                                {member.user_name || member.user_email}
                              </p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                member.user_id 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {member.user_id ? '✓ Active' : '⏳ Invited'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{member.user_email}</p>
                            
                            {/* Member Actions */}
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => {
                                  setShowManageModal(false);
                                  navigate(`/team-members/${member.id}/availability`);
                                }}
                                className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all flex items-center gap-2"
                              >
                                <Clock className="h-4 w-4" />
                                Availability
                              </button>
                              
                              {member.booking_token && (
                                <button
                                  onClick={() => copyToClipboard(`${window.location.origin}/book/${member.booking_token}`)}
                                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-2"
                                >
                                  {copiedUrl === `${window.location.origin}/book/${member.booking_token}` ? (
                                    <>
                                      <Check className="h-4 w-4" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4" />
                                      Copy Link
                                    </>
                                  )}
                                </button>
                              )}
                              
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all flex items-center gap-2 ml-auto"
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}