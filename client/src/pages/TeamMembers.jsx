import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus, Mail, Trash2, Link2, MoreVertical,
  CheckCircle, AlertCircle, Loader2, ArrowLeft
} from 'lucide-react';
import api from '../utils/api';
// ✅ Import the Modal
import MemberExternalLinkModal from '../components/MemberExternalLinkModal';

export default function TeamMembers() {
  const { teamId } = useParams();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal States
  const [selectedMember, setSelectedMember] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // New Member Form State
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [teamId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await api.teams.getMembers(teamId);
      setMembers(response.data.members || []);
    } catch (err) {
      console.error('Error loading members:', err);
      setError('Failed to load team members.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail) return;

    try {
      setAdding(true);
      await api.teams.addMember(teamId, {
        email: newMemberEmail,
        name: newMemberName,
      });
      
      setNewMemberEmail('');
      setNewMemberName('');
      loadMembers(); // Refresh list
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  // ✅ Handle Saving the External Link
  const handleSaveExternalLink = async (data) => {
    if (!selectedMember) return;
    
    // Call API to update member
    await api.teams.updateMemberExternalLink(teamId, selectedMember.id, data);
    
    // Refresh local state
    loadMembers();
    setShowLinkModal(false);
    setSelectedMember(null);
  };

  const openLinkModal = (member) => {
    setSelectedMember(member);
    setShowLinkModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
            <p className="text-gray-600">Manage who can be booked in this team</p>
          </div>
        </div>

        {/* Add Member Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            Add New Member
          </h2>
          <form onSubmit={handleAddMember} className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Name (Optional)"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-blue-500 outline-none transition-all"
            />
            <input
              type="email"
              placeholder="Email Address"
              required
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-blue-500 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={adding}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add Member'}
            </button>
          </form>
        </div>

        {/* Members List */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            No members yet. Add someone above!
          </div>
        ) : (
          <div className="grid gap-4">
            {members.map((member) => (
              <div 
                key={member.id} 
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Member Info */}
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xl">
                    {member.name?.[0] || member.email[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{member.name || 'Unknown Name'}</h3>
                    <p className="text-sm text-gray-500">{member.email}</p>
                    
                    {/* Status Badges */}
                    <div className="flex items-center gap-2 mt-1">
                      {member.external_booking_link ? (
                         <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                           <Link2 className="h-3 w-3" />
                           External Link Active
                         </span>
                      ) : (
                         <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                           <CheckCircle className="h-3 w-3" />
                           ScheduleSync Booking
                         </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                  {/* Configure External Link Button */}
                  <button
                    onClick={() => openLinkModal(member)}
                    className="flex-1 md:flex-none px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:border-purple-300 hover:text-purple-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Link2 className="h-4 w-4" />
                    {member.external_booking_link ? 'Edit Link' : 'Add External Link'}
                  </button>

                  {/* Availability Button */}
                  <button
                    onClick={() => navigate(`/teams/${teamId}/members/${member.id}/availability`)}
                    className="flex-1 md:flex-none px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-all"
                  >
                    Availability
                  </button>
                  
                  {/* Delete */}
                  <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ✅ Render the Modal */}
        {showLinkModal && selectedMember && (
          <MemberExternalLinkModal
            member={selectedMember}
            onClose={() => setShowLinkModal(false)}
            onSave={handleSaveExternalLink}
          />
        )}
      </div>
    </div>
  );
}