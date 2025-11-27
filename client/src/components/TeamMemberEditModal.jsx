import { useState, useEffect } from 'react';
import { X, ExternalLink, Link2, Loader2, Check, User } from 'lucide-react';
import { teams } from '../utils/api';

const PLATFORMS = [
  { id: 'calendly', name: 'Calendly' },
  { id: 'cal.com', name: 'Cal.com' },
  { id: 'acuity', name: 'Acuity' },
  { id: 'hubspot', name: 'HubSpot' },
  { id: 'custom', name: 'Other' },
];

export default function TeamMemberEditModal({ isOpen, onClose, member, teamId, onSave }) {
  const [platform, setPlatform] = useState('calendly');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when member changes
  useEffect(() => {
    if (member) {
      setPlatform(member.external_booking_platform || 'calendly');
      setLink(member.external_booking_link || '');
      setError('');
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const validateUrl = (url) => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (link && !validateUrl(link)) {
      setError('Please enter a valid URL');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data = {
        external_booking_link: link.trim() || null,
        external_booking_platform: link.trim() ? platform : null,
      };

      await teams.updateMemberExternalLink(teamId, member.id, data);
      
      // Update local state
      onSave({
        ...member,
        external_booking_link: data.external_booking_link,
        external_booking_platform: data.external_booking_platform,
      });
      
      onClose();
    } catch (err) {
      console.error('Error saving member settings:', err);
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await teams.updateMemberExternalLink(teamId, member.id, {
        external_booking_link: null,
        external_booking_platform: null,
      });
      
      onSave({
        ...member,
        external_booking_link: null,
        external_booking_platform: null,
      });
      
      setLink('');
      setPlatform('calendly');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Member Settings</h2>
                <p className="text-blue-100 text-sm">{member.user_name || member.name || member.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* External Booking Link Section */}
          <div className="border-2 border-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">External Booking Link</h3>
            </div>

            {/* Info Box */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-purple-800">
                Redirect bookings to an external scheduling tool like Calendly or Cal.com.
              </p>
            </div>

            {/* Platform Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      platform === p.id
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Link Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking URL
              </label>
              <input
                type="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError('');
                }}
                placeholder={
                  platform === 'calendly'
                    ? 'https://calendly.com/username/30min'
                    : platform === 'cal.com'
                    ? 'https://cal.com/username/meeting'
                    : platform === 'acuity'
                    ? 'https://acuityscheduling.com/...'
                    : platform === 'hubspot'
                    ? 'https://meetings.hubspot.com/username'
                    : 'https://...'
                }
                className={`w-full px-4 py-2.5 border-2 rounded-xl outline-none transition-all text-sm ${
                  error
                    ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                    : 'border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100'
                }`}
              />
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            {/* Preview */}
            {link && validateUrl(link) && (
              <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Preview</p>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-purple-600 hover:text-purple-800 text-sm font-medium break-all"
                >
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                  {link}
                </a>
              </div>
            )}

            {/* Current Status */}
            {member.external_booking_link && (
              <div className="mt-4 flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800 font-medium">
                    Redirecting to {member.external_booking_platform || 'external'}
                  </span>
                </div>
                <button
                  onClick={handleClear}
                  disabled={saving}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}