import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Link as LinkIcon, Loader2 } from 'lucide-react';
import api from '../utils/api';
import MemberExternalLinkModal from '../components/MemberExternalLinkModal';

export default function TeamMembers() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    loadMembers();
  }, [teamId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/teams/${teamId}/members`);
      setMembers(response.data.members || []);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExternalLink = async (formData) => {
    try {
      await api.put(`/teams/${teamId}/members/${selectedMember.id}/external-link`, formData);
      await loadMembers();
      setSelectedMember(null);
    } catch (error) {
      console.error('Error saving external link:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {member.name?.[0] || member.email?.[0] || '?'}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {member.name || member.email}
                </h3>
                <p className="text-sm text-gray-600">{member.email}</p>
                {member.external_booking_link && (
                  <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                    <LinkIcon className="h-3 w-3" />
                    External link configured
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* External Link Button */}
              <button
                onClick={() => setSelectedMember(member)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <LinkIcon className="h-4 w-4" />
                External Link
              </button>

              {/* Settings Button - NEW! */}
              <button
                onClick={() => navigate(`/teams/${teamId}/members/${member.id}/availability`)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-medium"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
            </div>
          </div>
        ))}

        {members.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No team members yet. Add some members to get started!
          </div>
        )}
      </div>

      {selectedMember && (
        <MemberExternalLinkModal
          member={selectedMember}
          onSave={handleSaveExternalLink}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </>
  );
}