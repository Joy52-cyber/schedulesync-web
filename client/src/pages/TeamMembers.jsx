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
  Copy,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import api, { teams } from '../utils/api';
import TeamMemberEditModal from '../components/TeamMemberEditModal';

export default function TeamMembers() {
  const { teamId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [newMember, setNewMember] = useState({
    email: '',
    name: '',
    role: 'member',
  });

  // Booking stats state
  const [bookingStats, setBookingStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('month');
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch booking stats
  const fetchBookingStats = async () => {
    if (!teamId) return;
    setStatsLoading(true);
    try {
      const response = await api.get(`/teams/${teamId}/booking-stats?period=${statsPeriod}`);
      setBookingStats(response.data);
    } catch (error) {
      console.error('Failed to fetch booking stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadTeamMembers();
  }, [teamId]);

  useEffect(() => {
    fetchBookingStats();
  }, [teamId, statsPeriod]);

  const loadTeamMembers = async () => {
    try {
      const [teamRes, membersRes] = await Promise.all([
        teams.getAll(),
        teams.getMembers(teamId),
      ]);

      const teamData = teamRes.data.teams.find(
        (t) => t.id === parseInt(teamId, 10)
      );
      setTeam(teamData || null);
      setMembers(membersRes.data.members || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoading(false);
    }
  };

 const handleAddMember = async (e) => {
  e.preventDefault();

  if (!newMember.email) {
    alert('Email is required');
    return;
  }

  try {
    const response = await api.post(`/teams/${teamId}/members`, {
      email: newMember.email,
      name: newMember.name || null,
      role: newMember.role,
    });

    // New endpoint creates invitation, not direct member
    setShowAddModal(false);
    setNewMember({ email: '', name: '', role: 'member' });
    alert('✉️ Invitation sent to ' + newMember.email + '! They will appear as a member once they accept.');
    } catch (error) {
      console.error('Error adding member:', error);
      const errorMessage = error.response?.data?.error || 'Failed to add member';
      if (errorMessage.includes('already exists')) {
        alert('⚠️ This member already exists in the team!');
      } else {
        alert(`Error: ${errorMessage}`);
      }
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the team?')) return;

    try {
      await teams.removeMember(teamId, memberId);
      loadTeamMembers();
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const handleToggleActive = async (memberId, isActive) => {
    try {
      await teams.updateMemberStatus(teamId, memberId, !isActive);
      loadTeamMembers();
    } catch (error) {
      console.error('Error updating member:', error);
    }
  };

  const handleCopyBookingLink = (bookingToken) => {
    if (!bookingToken) return;
    const bookingUrl = `${window.location.origin}/book/${bookingToken}`;
    navigator.clipboard.writeText(bookingUrl);
    alert('Booking link copied to clipboard!');
  };

  const openEditModal = (member) => {
    setSelectedMember(member);
    setShowEditModal(true);
  };

  const handleSaveMember = (updatedMember) => {
    setMembers(members.map(m => 
      m.id === updatedMember.id ? { ...m, ...updatedMember } : m
    ));
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                Team Members
              </h1>
              <p className="text-gray-600">
                {team?.name || 'Team'} • Manage your team members
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/teams/${teamId}/settings`)}
                className="bg-white border-2 border-gray-300 text-gray-700 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2 font-semibold"
              >
                <Settings className="h-5 w-5" />
                <span className="hidden sm:inline">Team Settings</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
              >
                <Plus className="h-5 w-5" />
                Add Member
              </button>
            </div>
          </div>
        </div>

        {/* Load Balancing Stats */}
        {bookingStats && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Booking Distribution
              </h3>
              <select
                value={statsPeriod}
                onChange={(e) => setStatsPeriod(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 font-medium">Total Bookings</p>
                <p className="text-2xl font-bold text-blue-900">{bookingStats.summary.total_bookings}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium">Avg per Member</p>
                <p className="text-2xl font-bold text-green-900">{bookingStats.summary.average_per_member}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs text-purple-600 font-medium">Team Size</p>
                <p className="text-2xl font-bold text-purple-900">{bookingStats.summary.total_members}</p>
              </div>
              <div className={`rounded-lg p-3 ${
                bookingStats.summary.fairness_status === 'even' ? 'bg-green-50' :
                bookingStats.summary.fairness_status === 'moderate' ? 'bg-yellow-50' : 'bg-red-50'
              }`}>
                <p className={`text-xs font-medium ${
                  bookingStats.summary.fairness_status === 'even' ? 'text-green-600' :
                  bookingStats.summary.fairness_status === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                }`}>Distribution</p>
                <p className={`text-lg font-bold flex items-center gap-1 ${
                  bookingStats.summary.fairness_status === 'even' ? 'text-green-900' :
                  bookingStats.summary.fairness_status === 'moderate' ? 'text-yellow-900' : 'text-red-900'
                }`}>
                  {bookingStats.summary.fairness_status === 'even' ? (
                    <><CheckCircle className="h-5 w-5" /> Even</>
                  ) : bookingStats.summary.fairness_status === 'moderate' ? (
                    <><AlertTriangle className="h-5 w-5" /> Moderate</>
                  ) : (
                    <><AlertTriangle className="h-5 w-5" /> Uneven</>
                  )}
                </p>
              </div>
            </div>

            {/* Distribution Bars */}
            <div className="space-y-3">
              {bookingStats.members.map((member) => {
                const maxBookings = Math.max(...bookingStats.members.map(m => parseInt(m.total_bookings) || 0), 1);
                const percentage = ((parseInt(member.total_bookings) || 0) / maxBookings) * 100;

                return (
                  <div key={member.member_id} className="flex items-center gap-3">
                    <div className="w-32 truncate text-sm font-medium text-gray-700">
                      {member.member_name}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full flex items-center justify-end px-2 transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      >
                        <span className="text-xs font-bold text-white">
                          {member.total_bookings}
                        </span>
                      </div>
                    </div>
                    <div className="w-20 text-right text-xs text-gray-500">
                      {Math.round(parseInt(member.total_minutes) / 60)}h booked
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Members grid */}
        {members.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center border-2 border-gray-100">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No members yet
            </h2>
            <p className="text-gray-600 mb-6">
              Add team members to start scheduling
            </p>
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
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-2 border-gray-100 overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {member.user_name?.charAt(0) || member.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 truncate">
                          {member.user_name || member.name || 'Unknown'}
                        </h3>
                        {member.role === 'admin' && (
                          <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {member.user_email || member.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  {/* Status badges */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {member.is_active ? (
                      <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs font-semibold">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                    <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold capitalize">
                      <Shield className="h-3 w-3" />
                      {member.role || 'member'}
                    </span>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-xl font-bold text-gray-900">
                        {member.booking_count || 0}
                      </p>
                      <p className="text-xs text-gray-500">Bookings</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-xl font-bold text-gray-900">
                        {member.priority || 1}
                      </p>
                      <p className="text-xs text-gray-500">Priority</p>
                    </div>
                  </div>

                  {/* Booking Link Info */}
                  <div className="mb-4">
                    {member.booking_token ? (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-blue-700 font-mono truncate">
                            /book/{member.booking_token.substring(0, 12)}...
                          </span>
                          <button
                            onClick={() => handleCopyBookingLink(member.booking_token)}
                            className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-colors font-medium flex-shrink-0"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <span className="text-xs text-gray-400">No booking link yet</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={() => openEditModal(member)}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2.5 rounded-xl hover:shadow-lg transition-all text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Member Settings
                    </button>

                    <button
                      onClick={() => navigate(`/teams/${teamId}/members/${member.id}/availability`)}
                      className="w-full bg-blue-50 text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Calendar className="h-4 w-4" />
                      Availability
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(member.id, member.is_active)}
                        className={`flex-1 px-4 py-2 rounded-xl transition-colors text-sm font-semibold ${
                          member.is_active
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {member.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Add Team Member
            </h2>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </span>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Role
                  </span>
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
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-semibold transition-all"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Settings Modal */}
      <TeamMemberEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
        teamId={parseInt(teamId, 10)}
        onSave={handleSaveMember}
      />
    </div>
  );
}