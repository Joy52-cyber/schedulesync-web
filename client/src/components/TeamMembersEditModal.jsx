import { useState, useEffect } from 'react';
import {
  X,
  User,
  Calendar,
  ExternalLink,
  Clock,
  Globe,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Link as LinkIcon
} from 'lucide-react';
import { teams } from '../utils/api';

// Platform options with their details
const EXTERNAL_PLATFORMS = [
  { 
    id: 'calendly', 
    name: 'Calendly', 
    placeholder: 'https://calendly.com/username/30min',
    color: '#006BFF',
    logo: '📅'
  },
  { 
    id: 'cal.com', 
    name: 'Cal.com', 
    placeholder: 'https://cal.com/username/meeting',
    color: '#292929',
    logo: '📆'
  },
  { 
    id: 'acuity', 
    name: 'Acuity Scheduling', 
    placeholder: 'https://acuityscheduling.com/schedule.php?owner=...',
    color: '#1A73E8',
    logo: '🗓️'
  },
  { 
    id: 'hubspot', 
    name: 'HubSpot Meetings', 
    placeholder: 'https://meetings.hubspot.com/username',
    color: '#FF7A59',
    logo: '🟠'
  },
  { 
    id: 'custom', 
    name: 'Custom URL', 
    placeholder: 'https://your-booking-page.com',
    color: '#6B7280',
    logo: '🔗'
  },
];

export default function TeamMemberEditModal({ 
  isOpen, 
  onClose, 
  member, 
  teamId,
  onSave 
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [bookingMethod, setBookingMethod] = useState('native'); // 'native' or 'external'
  const [externalPlatform, setExternalPlatform] = useState('calendly');
  const [externalLink, setExternalLink] = useState('');
  
  // Additional settings
  const [workingHours, setWorkingHours] = useState(null);
  const [timezone, setTimezone] = useState('');
  const [bufferTime, setBufferTime] = useState(0);
  const [bookingHorizon, setBookingHorizon] = useState(30);

  // Initialize form with member data
  useEffect(() => {
    if (member) {
      // Determine booking method
      const hasExternalLink = member.external_booking_link && member.external_booking_link.trim() !== '';
      setBookingMethod(hasExternalLink ? 'external' : 'native');
      
      // External booking settings
      setExternalPlatform(member.external_booking_platform || 'calendly');
      setExternalLink(member.external_booking_link || '');
      
      // Other settings
      setWorkingHours(member.working_hours || null);
      setTimezone(member.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setBufferTime(member.buffer_time || 0);
      setBookingHorizon(member.booking_horizon_days || 30);
    }
  }, [member]);

  const validateUrl = (url) => {
    if (!url) return true; // Empty is okay if native
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    // Validate external link if external method selected
    if (bookingMethod === 'external') {
      if (!externalLink.trim()) {
        setError('Please enter a booking link');
        return;
      }
      if (!validateUrl(externalLink)) {
        setError('Please enter a valid URL (including https://)');
        return;
      }
    }

    setSaving(true);

    try {
      const updateData = {
        external_booking_platform: bookingMethod === 'external' ? externalPlatform : null,
        external_booking_link: bookingMethod === 'external' ? externalLink.trim() : null,
        buffer_time: bufferTime,
        booking_horizon_days: bookingHorizon,
        timezone: timezone,
      };

      console.log('📝 Updating member:', member.id, updateData);

      // Call API to update member
      await teams.updateMember(teamId, member.id, updateData);

      setSuccess('Settings saved successfully!');
      
      // Notify parent component
      if (onSave) {
        onSave({
          ...member,
          ...updateData,
        });
      }

      // Close after short delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Failed to save member settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectedPlatform = EXTERNAL_PLATFORMS.find(p => p.id === externalPlatform);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              {member?.name?.[0]?.toUpperCase() || member?.user_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {member?.name || member?.user_name || 'Team Member'}
              </h2>
              <p className="text-sm text-gray-500">{member?.email || member?.user_email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Booking Method Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Booking Method
            </label>
            <div className="space-y-3">
              {/* Native Option */}
              <label 
                className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  bookingMethod === 'native' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="bookingMethod"
                  value="native"
                  checked={bookingMethod === 'native'}
                  onChange={(e) => setBookingMethod(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Use ScheduleSync</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Visitors book directly through your ScheduleSync page
                  </p>
                </div>
              </label>

              {/* External Option */}
              <label 
                className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  bookingMethod === 'external' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="bookingMethod"
                  value="external"
                  checked={bookingMethod === 'external'}
                  onChange={(e) => setBookingMethod(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold text-gray-900">Use External Scheduler</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Redirect visitors to Calendly, Cal.com, or another booking tool
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* External Scheduler Settings */}
          {bookingMethod === 'external' && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl space-y-4">
              {/* Platform Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EXTERNAL_PLATFORMS.map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => setExternalPlatform(platform.id)}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                        externalPlatform === platform.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{platform.logo}</span>
                      <span className={`text-sm font-medium ${
                        externalPlatform === platform.id ? 'text-purple-700' : 'text-gray-700'
                      }`}>
                        {platform.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Booking Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Booking Link
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="url"
                    value={externalLink}
                    onChange={(e) => setExternalLink(e.target.value)}
                    placeholder={selectedPlatform?.placeholder || 'https://...'}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none transition-colors"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Visitors will be automatically redirected to this URL when they try to book with this member
                </p>
              </div>

              {/* Preview */}
              {externalLink && validateUrl(externalLink) && (
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Preview redirect:</p>
                  <a 
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 truncate"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    {externalLink}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Native Booking Settings (shown when native is selected) */}
          {bookingMethod === 'native' && (
            <div className="space-y-4">
              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Globe className="h-4 w-4 inline mr-1" />
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                >
                  <optgroup label="Americas">
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  </optgroup>
                  <optgroup label="Europe">
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Europe/Berlin">Berlin (CET)</option>
                  </optgroup>
                  <optgroup label="Asia">
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                    <option value="Asia/Manila">Manila (PHT)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Asia/Shanghai">Shanghai (CST)</option>
                    <option value="Asia/Dubai">Dubai (GST)</option>
                    <option value="Asia/Kolkata">India (IST)</option>
                  </optgroup>
                  <optgroup label="Pacific">
                    <option value="Australia/Sydney">Sydney (AEST)</option>
                    <option value="Pacific/Auckland">Auckland (NZST)</option>
                  </optgroup>
                </select>
              </div>

              {/* Buffer Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Buffer Time Between Meetings
                </label>
                <select
                  value={bufferTime}
                  onChange={(e) => setBufferTime(Number(e.target.value))}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                >
                  <option value={0}>No buffer</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Time blocked before and after each meeting
                </p>
              </div>

              {/* Booking Horizon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Booking Window
                </label>
                <select
                  value={bookingHorizon}
                  onChange={(e) => setBookingHorizon(Number(e.target.value))}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                >
                  <option value={7}>1 week ahead</option>
                  <option value={14}>2 weeks ahead</option>
                  <option value={30}>1 month ahead</option>
                  <option value={60}>2 months ahead</option>
                  <option value={90}>3 months ahead</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  How far in advance people can book
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}