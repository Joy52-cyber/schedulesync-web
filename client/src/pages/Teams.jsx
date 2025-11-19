import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Edit2, Trash2, Mail, Copy, Check, X, Settings, 
  Clock, Send, Link2, Calendar, User, AlertCircle, CheckCircle, ChevronRight
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
    setTimeout(() => setNotification(null), 2000);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await teams.create(newTeam);
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '' });
      loadTeams();
      showNotification('Team created!');
    } catch (error) {
      console.error('Error creating team:', error);
      showNotification('Failed to create team', 'error');
    }
  };

  const handleDeleteTeam = async (id) => {
    if (!confirm('Delete this team?')) return;
    try {
      await teams.delete(id);
      loadTeams();
      showNotification('Team deleted');
    } catch (error) {
      console.error('Error deleting team:', error);
      showNotification('Failed to delete', 'error');
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
      showNotification('Team updated!');
    } catch (error) {
      console.error('Error updating team:', error);
      showNotification('Update failed', 'error');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await teams.addMember(selectedTeam.id, { 
        email: newMemberEmail,
        sendEmail: true 
      });
      setNewMemberEmail('');
      const members = await loadMembers(selectedTeam.id);
      setSelectedTeam({ ...selectedTeam, members });
      showNotification('Member invited!');
    } catch (error) {
      console.error('Error adding member:', error);
      showNotification('Failed to add', 'error');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove member?')) return;
    try {
      await teams.removeMember(selectedTeam.id, memberId);
      const members = await loadMembers(selectedTeam.id);
      setSelectedTeam({ ...selectedTeam, members });
      showNotification('Member removed');
    } catch (error) {
      console.error('Error removing member:', error);
      showNotification('Remove failed', 'error');
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
    showNotification('Copied!');
    setTimeout(() => setCopiedUrl(null), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Notification */}
      {notification && (
        <div className="fixed top-3 right-3 z-50 animate-slide-in">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
            notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}>
            {notification.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            {notification.message}
          </div>
        </div>
      )}

      {/* Compact Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
              <p className="text-xs text-gray-600 mt-0.5">Manage scheduling teams</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>
        </div>
      </div>

      {/* Compact Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        ) : teamsList.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">No teams yet</h2>
            <p className="text-sm text-gray-600 mb-4">Create your first team</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Create Team
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teamsList.map((team) => (
              <div key={team.id} className="bg-white rounded-lg border hover:border-blue-300 hover:shadow-md transition-all">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-lg"></div>
                <div className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{team.name}</h3>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => { setSelectedTeam(team); setShowEditModal(true); }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {team.description && (
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{team.description}</p>
                  )}
                  <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(team.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => openManageModal(team)}
                      className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        Members
                      </span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => navigate(`/teams/${team.id}/settings`)}
                      className="w-full px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1">
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                      </span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compact Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Create Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Sales Team"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                  rows="2"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setNewTeam({ name: '', description: '' }); }}
                  className="flex-1 px-4 py-2 border text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compact Edit Modal */}
      {showEditModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Edit Team</h2>
            <form onSubmit={handleEditTeam} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  value={selectedTeam.name}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={selectedTeam.description}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                  rows="2"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compact Manage Modal */}
      {showManageModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-xl">
            {/* Compact Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedTeam.name}</h2>
                  <p className="text-xs text-blue-100">{selectedTeam.members?.length || 0} members</p>
                </div>
                <button onClick={() => setShowManageModal(false)} className="p-1 hover:bg-white hover:bg-opacity-20 rounded text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto p-4">
              {/* Compact Team Link */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-semibold text-gray-900">Team Link</h3>
                </div>
                <input
                  type="text"
                  value={getTeamBookingUrl(selectedTeam.id)}
                  readOnly
                  className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded text-xs mb-2"
                />
                <button
                  onClick={() => copyToClipboard(getTeamBookingUrl(selectedTeam.id))}
                  className="w-full px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-1.5 text-xs font-medium"
                >
                  {copiedUrl === getTeamBookingUrl(selectedTeam.id) ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                </button>
              </div>

              {/* Compact Add Member */}
              <div className="bg-gray-50 border rounded-lg p-3 mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Mail className="h-4 w-4 text-purple-600" />
                  <h3 className="text-xs font-semibold text-gray-900">Invite Member</h3>
                </div>
                <form onSubmit={handleAddMember} className="space-y-2">
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="w-full px-3 py-1.5 border rounded-lg text-xs focus:border-purple-500 focus:outline-none"
                    required
                  />
                  <button type="submit" className="w-full px-3 py-1.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 flex items-center justify-center gap-1.5 text-xs">
                    <Send className="h-3.5 w-3.5" />
                    Send Invite
                  </button>
                </form>
              </div>

              {/* Compact Members List */}
              <div>
                <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Members
                </h3>
                {!selectedTeam.members || selectedTeam.members.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg border-dashed border-2">
                    <Users className="h-8 w-8 text-gray-300 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">No members yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedTeam.members.map((member) => (
                      <div key={member.id} className="bg-white border rounded-lg p-2.5 hover:border-blue-300 transition-all">
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-xs">{(member.user_email?.[0] || 'U').toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="font-semibold text-xs text-gray-900 truncate">{member.user_name || member.user_email}</p>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${member.user_id ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {member.user_id ? '✓' : '⏳'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 truncate mb-2">{member.user_email}</p>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => { setShowManageModal(false); navigate(`/team-members/${member.id}/availability`); }}
                                className="px-2 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 flex items-center gap-1"
                              >
                                <Clock className="h-3 w-3" />
                                Availability
                              </button>
                              {member.booking_token && (
                                <button
                                  onClick={() => copyToClipboard(`${window.location.origin}/book/${member.booking_token}`)}
                                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
                                >
                                  {copiedUrl === `${window.location.origin}/book/${member.booking_token}` ? <><Check className="h-3 w-3" />Copied</> : <><Copy className="h-3 w-3" />Link</>}
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 flex items-center gap-1 ml-auto"
                              >
                                <Trash2 className="h-3 w-3" />
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
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}