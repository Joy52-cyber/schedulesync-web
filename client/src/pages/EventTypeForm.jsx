// client/src/pages/EventTypeForm.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  MapPin,
  FileText,
  Loader2,
  Save,
  Link as LinkIcon,
  Palette,
  Shield,
  Video,
  Phone,
  Building2,
  Globe,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { events } from '../utils/api';

export default function EventTypeForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    duration: 30,
    location: '',
    location_type: 'google_meet',
    color: 'blue',
    is_active: true,

    // Advanced settings
    buffer_before: 0,
    buffer_after: 0,
    max_bookings_per_day: null,
    require_approval: false,

    // Pricing (already used in populateForm + handleSubmit)
    price: 0,
    currency: 'USD',
  });

  const colors = [
    { name: 'blue', hex: '#3B82F6', bg: 'bg-blue-500' },
    { name: 'purple', hex: '#A855F7', bg: 'bg-purple-500' },
    { name: 'green', hex: '#10B981', bg: 'bg-green-500' },
    { name: 'red', hex: '#EF4444', bg: 'bg-red-500' },
    { name: 'orange', hex: '#F97316', bg: 'bg-orange-500' },
    { name: 'pink', hex: '#EC4899', bg: 'bg-pink-500' },
    { name: 'indigo', hex: '#6366F1', bg: 'bg-indigo-500' },
    { name: 'yellow', hex: '#EAB308', bg: 'bg-yellow-500' },
  ];

  const locationTypes = [
    { value: 'google_meet', label: 'Google Meet', icon: Video, auto: true },
    { value: 'zoom', label: 'Zoom', icon: Video, auto: false },
    { value: 'phone', label: 'Phone Call', icon: Phone, auto: false },
    { value: 'in_person', label: 'In Person', icon: Building2, auto: false },
    { value: 'custom', label: 'Custom Link', icon: Globe, auto: false },
  ];

  const templates = [
    {
      name: '15-min Quick Chat',
      duration: 15,
      slug: 'quick-chat',
      description: 'Brief introductory conversation',
    },
    {
      name: '30-min Meeting',
      duration: 30,
      slug: 'meeting',
      description: 'Standard meeting for discussions',
    },
    {
      name: '60-min Consultation',
      duration: 60,
      slug: 'consultation',
      description: 'In-depth consultation session',
    },
    {
      name: '45-min Discovery Call',
      duration: 45,
      slug: 'discovery',
      description: 'Learn about needs and goals',
    },
  ];

  useEffect(() => {
    if (isEditing) {
      if (location.state?.event) {
        populateForm(location.state.event);
      } else {
        loadEventTypeFromList();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const populateForm = (event) => {
    setFormData({
      title: event.title || event.name || '',
      slug: event.slug || '',
      description: event.description || '',
      duration: event.duration || 30,
      location: event.location || '',
      location_type: event.location_type || 'google_meet',
      color: event.color || 'blue',
      is_active: event.is_active !== false,
      buffer_before: event.buffer_before || 0,
      buffer_after: event.buffer_after || 0,
      max_bookings_per_day: event.max_bookings_per_day || null,
      require_approval: event.require_approval || false,
      price: event.price || 0,
      currency: event.currency || 'USD',
    });

    if (
      event.buffer_before ||
      event.buffer_after ||
      event.max_bookings_per_day ||
      event.require_approval
    ) {
      setShowAdvanced(true);
    }
  };

  const loadEventTypeFromList = async () => {
    setLoading(true);
    try {
      const response = await events.getAll();
      const list =
        response.data.eventTypes ||
        response.data.event_types ||
        response.data ||
        [];
      const event = list.find((e) => String(e.id) === String(id));

      if (event) {
        populateForm(event);
      } else {
        alert('Event type not found');
        navigate('/events');
      }
    } catch (error) {
      console.error('Failed to load event type:', error);
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    if (!formData.slug || formData.slug === slugify(formData.title)) {
      setFormData((prev) => ({ ...prev, title, slug: slugify(title) }));
    } else {
      setFormData((prev) => ({ ...prev, title }));
    }
  };

  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const applyTemplate = (template) => {
    if (
      !window.confirm(
        `Apply template "${template.name}"? This will overwrite some fields.`
      )
    )
      return;
    setFormData((prev) => ({
      ...prev,
      title: template.name,
      slug: template.slug,
      duration: template.duration,
      description: template.description,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return alert('Event name is required');
    if (!formData.slug.trim()) return alert('URL Slug is required');

    setSaving(true);
    try {
      const payload = {
        ...formData,
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        location: formData.location.trim(),
        buffer_before: parseInt(formData.buffer_before) || 0,
        buffer_after: parseInt(formData.buffer_after) || 0,
        max_bookings_per_day: formData.max_bookings_per_day
          ? parseInt(formData.max_bookings_per_day)
          : null,
        price: parseFloat(formData.price) || 0,
      };

      if (isEditing) {
        await events.update(id, payload);
      } else {
        await events.create(payload);
      }
      navigate('/events');
    } catch (error) {
      console.error('Failed to save:', error);
      alert(
        'Failed to save: ' +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  const selectedLocationType = locationTypes.find(
    (t) => t.value === formData.location_type
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 overflow-x-hidden">
      <div className="mb-8 min-w-0">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {isEditing ? 'Edit Event Type' : 'Create Event Type'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditing
            ? 'Update the settings for this meeting template.'
            : 'Define a new meeting template with custom settings.'}
        </p>
      </div>

      {/* Quick Templates */}
      {!isEditing && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 sm:p-6 mb-6 overflow-hidden">
          <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Quick Start Templates
          </h3>
          {/* ✅ FIXED: Better mobile grid - single column on mobile, 2 on small, 4 on medium+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {templates.map((template, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(template)}
                className="p-3 bg-white border border-blue-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all text-left min-w-0"
              >
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {template.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {template.duration} min
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
            Basic Information
          </h2>

          <div className="space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                Event Name *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={handleTitleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 30-Minute Strategy Session"
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <LinkIcon className="h-4 w-4 text-gray-400" />
                URL Slug *
              </label>
              {/* ✅ FIXED: Better mobile layout for URL slug input */}
              <div className="flex items-center min-w-0">
                <span className="hidden sm:block px-4 py-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-xl text-gray-500 text-sm font-medium whitespace-nowrap">
                  yourname/
                </span>
                {/* Show prefix above input on mobile */}
                <div className="block sm:hidden w-full mb-2">
                  <span className="text-xs text-gray-500">yourname/</span>
                </div>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      slug: slugify(e.target.value),
                    })
                  }
                  className="flex-1 min-w-0 px-4 py-3 border border-gray-300 rounded-xl sm:rounded-r-xl sm:rounded-l-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="strategy-session"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                This will be the shareable booking link.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="What should invitees know about this meeting?"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <Palette className="h-4 w-4 text-gray-400" />
                Event Color
              </label>
              {/* ✅ FIXED: Better mobile color picker with wrapping */}
              <div className="flex flex-wrap gap-3 max-w-full">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, color: c.name })
                    }
                    className={`w-10 h-10 rounded-full ${c.bg} transition-all flex-shrink-0 ${
                      formData.color === c.name
                        ? 'ring-4 ring-offset-2 ring-gray-300 scale-110'
                        : 'hover:scale-105 opacity-70 hover:opacity-100'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Meeting Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-600 flex-shrink-0" />
            Meeting Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4 text-gray-400" />
                Duration *
              </label>
              <select
                value={formData.duration}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                Location Type
              </label>
              <select
                value={formData.location_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    location_type: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {locationTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} {type.auto ? '(Auto)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!selectedLocationType?.auto && (
            <div className="mt-5">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Location Details
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={
                  formData.location_type === 'phone'
                    ? 'Phone number or instructions'
                    : formData.location_type === 'zoom'
                    ? 'Zoom meeting link'
                    : formData.location_type === 'in_person'
                    ? 'Address or meeting place'
                    : 'Enter custom location or link'
                }
              />
            </div>
          )}

          {/* Advanced Settings Toggle */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Advanced settings
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {showAdvanced ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Advanced Settings Card */}
        {showAdvanced && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-600 flex-shrink-0" />
              Advanced Booking Rules
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Buffer Before (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={formData.buffer_before}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      buffer_before: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Time before the meeting starts.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Buffer After (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={formData.buffer_after}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      buffer_after: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Time after the meeting ends.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Max Bookings Per Day
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_bookings_per_day || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_bookings_per_day: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Unlimited"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Leave empty for unlimited bookings.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Booking Approval
                </label>
                <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.require_approval}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        require_approval: e.target.checked,
                      })
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Require manual approval
                  </span>
                </label>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 mt-5">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-900">
                  Advanced Settings Info
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Buffer times prevent back-to-back meetings. Booking limits
                  help manage your availability.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ✅ FIXED: Better mobile button layout */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={() => navigate('/events')}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {isEditing ? 'Update Event Type' : 'Create Event Type'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}