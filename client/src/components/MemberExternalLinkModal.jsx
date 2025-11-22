import { useState } from 'react';
import { X, Link2, Globe2 } from 'lucide-react';

export default function MemberExternalLinkModal({ member, onSave, onClose }) {
  const [platform, setPlatform] = useState(
    member.external_booking_platform || 'calendly'
  );
  const [link, setLink] = useState(member.external_booking_link || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!link.trim()) {
      setError('Please enter a booking link.');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        external_booking_platform: platform,
        external_booking_link: link.trim(),
      });
    } catch (err) {
      console.error(err);
      setError('Something went wrong while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-600" />
            External Booking Link
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="text-sm text-gray-600 mb-2">
            {member.user_name || member.name || 'Member'}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Platform
            </label>
            <div className="relative">
              <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-sm"
              >
                <option value="calendly">Calendly</option>
                <option value="hubspot">HubSpot</option>
                <option value="calcom">Cal.com</option>
                <option value="google-calendar">Google Calendar Link</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Booking URL
            </label>
            <input
              type="url"
              placeholder="https://calendly.com/your-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
