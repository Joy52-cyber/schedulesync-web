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
  User,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function TeamMembers() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState({ email: '', role: 'member' });

  useEffect(() => {
    loadTeamMembers();
  }, [teamId]);

  const loadTeamMembers = async () => {
    try {
      const [teamRes, membersRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}`, { credentials: 'include' }),
        fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}/members`, { credentials: 'include' })
      ]);
      
      const teamData = await teamRes.json();
      const membersData = await membersRes.json();
      
      setTeam(teamData.team);
      setMembers(membersData.members || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newMember)
      });
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
      await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      loadTeamMembers();
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const handleToggleActive = async (memberId, isActive) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !isActive })
      });
      loadTeamMembers();
    } catch (error) {
      console.error('Error updating member:', error);
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Teams
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Team Members</h1>
              <p className="text-gray-600">{team?.name} - Manage your team members</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
            >
              <Plus className="h-5 w-5" />
              Add Member
            </button>
          </div>
        </div>

        {/* Members List */}
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
              <div
                key={member.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-2 border-gray-100 overflow-hidden"
              >
                <div className="p-6">
                  {/* Member Avatar */}
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

                  {/* Status Badge */}
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

                  {/* Stats */}
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

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={() => handleToggleActive(member.id, member.is_active)}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold"
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
    </div>
  );
}