import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Mail, Copy, Check, X, Settings, Send } from 'lucide-react';
import { teams } from '../utils/api';

export default function Teams() {
  const [teamsList, setTeamsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);

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

  const handleDeleteTeam = async (id) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      await teams.delete(id);
      loadTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
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
    } catch (error) {
      console.error('Error updating team:', error);
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
      
      // Reload members
      const members = await loadMembers(selectedTeam.id);
      setSelectedTeam({ ...selectedTeam, members });
      
      alert(`✅ Member added!\n\nBooking URL:\n${response.data.bookingUrl}\n\nAn invitation email has been sent to ${newMemberEmail}`);
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove this member from the team?')) return;
    try {
      await teams.removeMember(selectedTeam.id, memberId);
      
      // Reload members
      const members = await loadMembers(selectedTeam.id);
      setSelectedTeam({ ...selectedTeam, members });
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const openManageModal = async (team) => {
    setSelectedTeam(team);
    const members = await loadMembers(team.id);
    setSelectedTeam({ ...team, members });
    setShowManageModal(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const getTeamBookingUrl = (teamId) => {
    return `${window.location.origin}/team/${teamId}/book`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
          <p className="text-gray-600 mt-1">Manage your scheduling teams</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
        >
          <Plus className="h-5 w-5" />
          Create Team
        </button>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamsList.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-12 text-center shadow-md">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No teams yet</h3>
            <p className="text-gray-600 mb-6">Create your first team to start scheduling</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Create Your First Team
            </button>
          </div>
        ) : (
          teamsList.map((team) => (
            <div key={team.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{team.name}</h3>
                  <p className="text-gray-600 text-sm mb-3">{team.description || 'No description'}</p>
                  <p className="text-xs text-gray-500">
                    Created {new Date(team.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => openManageModal(team)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Manage
                </button>
                <button
                  onClick={() => {
                    setSelectedTeam(team);
                    setShowEditModal(true);
                  }}
                  className="px-4 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors"
                  title="Edit Team"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="px-4 py-2.5 border-2 border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete Team"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="Marketing Team"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="Team for marketing campaigns and client meetings"
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
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Team</h2>
            <form onSubmit={handleEditTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={selectedTeam.name}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={selectedTeam.description}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  rows="3"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Team Modal */}
      {showManageModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-3xl w-full my-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Manage Team</h2>
                <p className="text-gray-600 mt-1">{selectedTeam.name}</p>
              </div>
              <button
                onClick={() => setShowManageModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            {/* Team Booking URL */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Team Booking URL</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={getTeamBookingUrl(selectedTeam.id)}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm text-gray-700"
                />
                <button
                  onClick={() => copyToClipboard(getTeamBookingUrl(selectedTeam.id))}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  {copiedUrl === getTeamBookingUrl(selectedTeam.id) ? (
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

            {/* Add Member Section */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Member</h3>
              <form onSubmit={handleAddMember} className="flex gap-3">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Send className="h-5 w-5" />
                  Send Invite
                </button>
              </form>
              <p className="text-xs text-gray-500 mt-2">
                💡 An invitation email with booking URL will be sent to this address
              </p>
            </div>

            {/* Members List */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Team Members ({selectedTeam.members?.length || 0})
              </h3>
              
              {!selectedTeam.members || selectedTeam.members.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No members yet. Add your first member above!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedTeam.members.map((member) => (
                    <div
                      key={member.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-lg">
                              {(member.user_email?.[0] || 'U').toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900">
                              {member.user_name || member.user_email}
                            </p>
                            <p className="text-sm text-gray-600">{member.user_email}</p>
                            {member.booking_token && (
                              <div className="mt-2 bg-gray-50 rounded-lg p-2">
                                <p className="text-xs text-gray-500 mb-1">Personal Booking URL:</p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={`${window.location.origin}/book/${member.booking_token}`}
                                    readOnly
                                    className="flex-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700"
                                  />
                                  <button
                                    onClick={() => copyToClipboard(`${window.location.origin}/book/${member.booking_token}`)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Copy URL"
                                  >
                                    {copiedUrl === `${window.location.origin}/book/${member.booking_token}` ? (
                                      <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                            <div className="mt-2 text-xs text-gray-500">
                              <span className="inline-flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${member.user_id ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                {member.user_id ? 'Active Account' : 'Invitation Sent'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Remove Member"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}