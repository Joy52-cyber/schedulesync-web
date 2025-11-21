import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus,
  Trash2,
  ArrowLeft,
  Mail,
  Shield,
  Crown,
  Loader2,
  CheckCircle,
  XCircle,
  Calendar,
  Settings,
  DollarSign,
  Link2
} from 'lucide-react';
import { teams } from '../utils/api';
import MemberExternalLinkModal from '../components/MemberExternalLinkModal';
import MemberPricingSettings from '../components/MemberPricingSettings';

export default function TeamMembers() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [newMember, setNewMember] = useState({ email: '', role: 'member' });

  useEffect(() => {
    loadTeamMembers();
  }, [teamId]);

  const loadTeamMembers = async () => {
    try {
      const [teamRes, membersRes] = await Promise.all([
        teams.getAll(),
        teams.getMembers(teamId)
      ]);
      
      const teamData = teamRes.data.teams.find(t => t.id === parseInt(teamId));
      setTeam(teamData);
      setMembers(membersRes.data.members || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await teams.addMember(teamId, newMember);
      setShowAddModal(false);
      setNewMember({ email: '', role: 'member' });
      loadTeamMembers();
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove this member from the team?')) return;
    
    try {
      await teams.removeMember(teamId, memberId);
      loadTeamMembers();
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const handleToggleActive = async (memberId, isActive) => {
    try {
      await teams.updateMember(teamId, memberId, { is_active: !isActive });
      loadTeamMembers();
    } catch (error) {
      console.error('Error updating member:', error);
    }
  };

  const handleSaveExternalLink = async (data) => {
    try {
      await teams.updateMemberExternalLink(teamId, selectedMember.id, data);
      loadTeamMembers();
      setShowExternalLinkModal(false);
    } catch (error) {
      console.error('Error saving external link:', error);
      throw error;
    }
  };

  const openExternalLinkModal = (member) => {
    setSelectedMember(member);
    setShowExternalLinkModal(true);
  };

  const openPricingModal = (member) => {
    setSelectedMember(member);
    setShowPricingModal(true);
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-8">
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Teams
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Team Members</h1>
              <p className="text-gray-600">{team?.name} - Manage your team members</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/teams/${teamId}/settings`)}
                className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2 font-semibold"
              >
                <Settings className="h-5 w-5" />
                Team Settings
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
              >
                <Plus className="h-5 w-5" />
                Add Member
              </button>
            </div>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center border-2 border-gray-100">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No members yet</h2>
            <p className="text-gray-600 mb-6">Add team members to start scheduling</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transition-all inline-flex items-center gap-2 font-semibold"
            >
              <Plus className="h-5 w-5" />
              Add Your First Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => (
              <div key={member.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-2 border-gray-100 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                      {member.user_name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{member.user_name || 'Unknown'}</h3>
                        {member.role === 'admin' && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{member.user_email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    {member.is_active ? (
                      <span className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-semibold">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                    <span className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                      <Shield className="h-3 w-3" />
                      {member.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{member.booking_count || 0}</p>
                      <p className="text-xs text-gray-600">Bookings</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{member.priority || 1}</p>
                      <p className="text-xs text-gray-600">Priority</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => navigate(`/teams/${teamId}/members/${member.id}/availability`)}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Calendar className="h-4 w-4" />
                      Availability
                    </button>
                    
                    <button
                      onClick={() => openPricingModal(member)}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <DollarSign className="h-4 w-4" />
                      Pricing
                    </button>

                    <button
                      onClick={() => openExternalLinkModal(member)}
                      className="w-full bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Link2 className="h-4 w-4" />
                      External Link
                    </button>

                    <button
                      onClick={() => handleToggleActive(member.id, member.is_active)}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors text-sm font-semibold"
                    >
                      {member.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="w-full bg-red-50 text-red-600 px-4 py-2 rounded-xl hover:bg-red-100 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Team Member</h2>
            
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </div>
                </label>
                <input
                  type="email"
                  required
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="member@example.com"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Role
                  </div>
                </label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-semibold transition-all"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* External Link Modal */}
      {showExternalLinkModal && selectedMember && (
        <MemberExternalLinkModal
          member={selectedMember}
          onSave={handleSaveExternalLink}
          onClose={() => setShowExternalLinkModal(false)}
        />
      )}

      {/* Pricing Modal */}
      {showPricingModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full my-8 shadow-2xl">
            <div className="sticky top-0 bg-white border-b-2 border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-2xl font-bold text-gray-900">Pricing Settings</h2>
              <button
                onClick={() => setShowPricingModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="h-6 w-6 text-gray-500" />
              </button>
            </div>
            <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              <MemberPricingSettings
                teamId={teamId}
                memberId={selectedMember.id}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}