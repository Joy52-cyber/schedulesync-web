import { useState, useEffect } from 'react';
import MemberExternalLinkModal from '../components/MemberExternalLinkModal';
import { members } from '../utils/api'; // assume you have this

export default function TeamMembers() {
  const [list, setList] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const res = await members.list();
    setList(res.data);
  };

  const handleSaveExternalLink = async (formData) => {
    await members.update(selectedMember.id, formData);
    await load(); // refresh to show new icon
  };

  return (
    <>
      {/* your table of members */}
      {list.map((m) => (
        <div key={m.id} className="flex items-center justify-between">
          <span>{m.email}</span>
          <button
            className="text-sm text-blue-600"
            onClick={() => setSelectedMember(m)}
          >
            Set external link
          </button>
        </div>
      ))}

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
