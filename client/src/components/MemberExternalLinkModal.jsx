import { useState, useEffect } from 'react';
import { Link2, Save, X } from 'lucide-react';

export default function MemberExternalLinkModal({ member, onSave, onClose }) {
  const [formData, setFormData] = useState({
    external_booking_link: member?.external_booking_link || '',
    external_booking_platform: member?.external_booking_platform || 'calendly'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // keep in sync when switching members
  useEffect(() => {
    setFormData({
      external_booking_link: member?.external_booking_link || '',
      external_booking_platform: member?.external_booking_platform || 'calendly'
    });
  }, [member]);

  const platforms = [
    { value: 'calendly', label: 'Calendly', placeholder: 'https://calendly.com/yourname/30min' },
    { value: 'hubspot', label: 'HubSpot Meetings', placeholder: 'https://meetings.hubspot.com/yourname' },
    { value: 'cal.com', label: 'Cal.com', placeholder: 'https://cal.com/yourname/30min' },
    { value: 'other', label: 'Other', placeholder: 'https://your-booking-link.com' }
  ];

  const selectedPlatform =
    platforms.find((p) => p.value === formData.external_booking_platform) || platforms[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // normalize URL
    let url = formData.external_booking_link.trim();
    if (url) {
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      try {
        new URL(url);
      } catch (err) {
        setError('Please enter a valid URL');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        external_booking_link: url,
      });
      onClose();
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Link2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">External Booking Link</h2>
              {member?.email && <p className="text-sm text-gray-600">{member.email}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Tip */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
            <strong>💡 Tip:</strong> Add your Calendly, HubSpot, Cal.com, or any booking link. Guests will see it on
            your public booking page.
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
            <div className="grid grid-cols-2 gap-3">
              {platforms.map((platform) => {
                const selected = formData.external_booking_platform === platform.value;
                return (
                  <button
                    key={platform.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        external_booking_platform: platform.value,
                      }))
                    }
                    className={`p-4 border-2 rounded-xl transition-all text-left ${
                      selected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selected ? 'border-blue-500' : 'border-gray-300'
                        }`}
                      >
                        {selected && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                      </div>
                      <span className="font-medium text-gray-900">{platform.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Booking Link</label>
            <input
              type="url"
              value={formData.external_booking_link}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  external_booking_link: e.target.value,
                }))
              }
              placeholder={selectedPlatform.placeholder}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-2 text-sm text-gray-500">Paste your {selectedPlatform.label} link here</p>
          </div>

          {/* Preview */}
          {formData.external_booking_link && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
              <a
                href={formData.external_booking_link}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline break-all"
              >
                {formData.external_booking_link}
              </a>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Link
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
