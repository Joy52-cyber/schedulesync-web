import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Mail, Copy, Check, X } from 'lucide-react';
import { teams } from '../utils/api';

export default function Teams() {
  const [teamsList, setTeamsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [expandedTeam, setExpandedTeam] = useState(null);
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
      setTeamsList(prev =>
        prev.map(team =>
          team.id === teamId
            ? { ...team, members: response.data.members }
            : team
        )
      );
    } catch (error) {
      console.error('Error loading members:', error);
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

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const response = await teams.addMember(selectedTeam.id, { 
        email: newMemberEmail,
        sendEmail: true 
      });
      setShowAddMemberModal(false);
      setNewMemberEmail('');
      loadMembers(selectedTeam.id);
      alert(`Member added! Booking URL: ${response.data.bookingUrl}`);
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member');
    }
  };

  const handleRemoveMember = async (teamId, memberId) => {
    if (!confirm('Remove this member?')) return;
    try {
      await teams.removeMember(teamId, memberId);
      loadMembers(teamId);
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const toggleTeamExpansion = (teamId) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
    } else {
      setExpandedTeam(teamId);
      loadMembers(teamId);
    }
  };

  const copyBookingUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
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

      {/* Teams List */}
      <div className="space-y-4">
        {teamsList.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-md">
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
            <div key={team.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              {/* Team Header */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleTeamExpansion(team.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{team.name}</h3>
                    <p className="text-gray-600">{team.description || 'No description'}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Created {new Date(team.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTeam(team);
                        setShowAddMemberModal(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Add Member"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTeam(team.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Team"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Team Members (Expanded) */}
              {expandedTeam === team.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h4>
                  
                  {!team.members || team.members.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 mb-4">No members yet</p>
                      <button
                        onClick={() => {
                          setSelectedTeam(team);
                          setShowAddMemberModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add First Member
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className="bg-white rounded-lg p-4 flex items-center justify-between border border-gray-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600 font-semibold">
                                {member.user_email?.[0]?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {member.user_name || member.user_email || 'Unknown'}
                              </p>
                              <p className="text-sm text-gray-600">{member.user_email}</p>
                              {member.booking_token && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Booking URL: {window.location.origin}/book/{member.booking_token}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.booking_token && (
                              <button
                                onClick={() => copyBookingUrl(`${window.location.origin}/book/${member.booking_token}`)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Copy Booking URL"
                              >
                                {copiedUrl === `${window.location.origin}/book/${member.booking_token}` ? (
                                  <Check className="h-5 w-5 text-green-600" />
                                ) : (
                                  <Copy className="h-5 w-5" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(team.id, member.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove Member"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                  Team Name
                </label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
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
                  rows="3"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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

      {/* Add Member Modal */}
      {showAddMemberModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Team Member</h2>
            <p className="text-gray-600 mb-6">to {selectedTeam.name}</p>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setNewMemberEmail('');
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}