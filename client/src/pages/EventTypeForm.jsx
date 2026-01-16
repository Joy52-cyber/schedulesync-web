import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useUpgrade } from '../context/UpgradeContext';
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
  MessageSquare,
  CalendarClock,
} from 'lucide-react';
import { events } from '../utils/api';
import CustomQuestionsEditor from '../components/CustomQuestionsEditor';

const colors = [
  { name: 'blue', bg: 'bg-blue-500' },
  { name: 'purple', bg: 'bg-purple-500' },
  { name: 'green', bg: 'bg-green-500' },
  { name: 'red', bg: 'bg-red-500' },
  { name: 'orange', bg: 'bg-orange-500' },
  { name: 'pink', bg: 'bg-pink-500' },
  { name: 'indigo', bg: 'bg-indigo-500' },
  { name: 'yellow', bg: 'bg-yellow-500' },
];

const locationTypes = [
  { value: 'google_meet', label: 'Google Meet', icon: Video, auto: true },
  { value: 'zoom', label: 'Zoom', icon: Video, auto: false },
  { value: 'phone', label: 'Phone Call', icon: Phone, auto: false },
  { value: 'in_person', label: 'In Person', icon: Building2, auto: false },
  { value: 'custom', label: 'Custom Link', icon: Globe, auto: false },
];

const templates = [
  { name: '15-min Quick Chat', duration: 15, slug: 'quick-chat', description: 'Brief introductory conversation' },
  { name: '30-min Meeting', duration: 30, slug: 'meeting', description: 'Standard meeting for discussions' },
  { name: '60-min Consultation', duration: 60, slug: 'consultation', description: 'In-depth consultation session' },
  { name: '45-min Discovery Call', duration: 45, slug: 'discovery', description: 'Learn about needs and goals' },
];

export default function EventTypeForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { showUpgradeModal } = useUpgrade();
  
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
    buffer_before: 0,
    buffer_after: 0,
    max_bookings_per_day: null,
    require_approval: false,
    price: 0,
    currency: 'USD',
    custom_questions: [],
    pre_meeting_instructions: '',
    confirmation_message: '',
    min_notice_hours: 1,
    max_days_ahead: 60,
  });

  useEffect(() => {
    if (isEditing) {
      if (location.state?.event) {
        populateForm(location.state.event);
      } else {
        loadEventTypeFromList();
      }
    }
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
      custom_questions: event.custom_questions || [],
      pre_meeting_instructions: event.pre_meeting_instructions || '',
      confirmation_message: event.confirmation_message || '',
      min_notice_hours: event.min_notice_hours ?? 1,
      max_days_ahead: event.max_days_ahead ?? 60,
    });

    if (event.buffer_before || event.buffer_after || event.max_bookings_per_day || event.require_approval ||
        event.min_notice_hours > 1 || event.max_days_ahead !== 60) {
      setShowAdvanced(true);
    }
  };

  const loadEventTypeFromList = async () => {
    setLoading(true);
    try {
      const response = await events.getAll();
      const list = response.data.eventTypes || response.data.event_types || response.data || [];
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

  const handleTitleChange = (e) => {
    const title = e.target.value;
    if (!formData.slug || formData.slug === slugify(formData.title)) {
      setFormData((prev) => ({ ...prev, title, slug: slugify(title) }));
    } else {
      setFormData((prev) => ({ ...prev, title }));
    }
  };

  const applyTemplate = (template) => {
    if (!window.confirm(`Apply template "${template.name}"? This will overwrite some fields.`)) return;
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
    
    if (!formData.title.trim()) {
      alert('Event name is required');
      return;
    }
    if (!formData.slug.trim()) {
      alert('URL Slug is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        location: formData.location.trim(),
        buffer_before: parseInt(formData.buffer_before) || 0,
        buffer_after: parseInt(formData.buffer_after) || 0,
        max_bookings_per_day: formData.max_bookings_per_day ? parseInt(formData.max_bookings_per_day) : null,
        price: parseFloat(formData.price) || 0,
        custom_questions: formData.custom_questions || [],
        pre_meeting_instructions: formData.pre_meeting_instructions?.trim() || '',
        confirmation_message: formData.confirmation_message?.trim() || '',
        min_notice_hours: parseInt(formData.min_notice_hours) || 1,
        max_days_ahead: parseInt(formData.max_days_ahead) || 60,
      };

      if (isEditing) {
        await events.update(id, payload);
      } else {
        await events.create(payload);
      }
      navigate('/events');
    } catch (error) {
      console.error('Failed to save:', error);
      
      // Show upgrade modal for limit errors
      if (error.response?.status === 403 && error.response?.data?.upgrade) {
        showUpgradeModal('event_types');
      } else {
        alert(error.response?.data?.message || error.response?.data?.error || 'Failed to save event type');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <Loader2 className="animate-spin text-purple-600 h-8 w-8 relative z-10" />
      </div>
    );
  }

  const selectedLocationType = locationTypes.find((t) => t.value === formData.location_type);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8 overflow-x-hidden relative z-10">
      {/* Header */}
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
          {isEditing ? 'Update the settings for this meeting template.' : 'Define a new meeting template with custom settings.'}
        </p>
      </div>

      {/* Quick Templates (only for new events) */}
      {!isEditing && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border-2 border-white/20 shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 transition-all p-4 sm:p-6 mb-6 overflow-hidden">
          <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-600" />
            Quick Start Templates
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {templates.map((template, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(template)}
                className="p-3 bg-white border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:shadow-lg hover:shadow-purple-200/50 hover:-translate-y-0.5 transition-all text-left min-w-0"
              >
                <p className="font-semibold text-gray-900 text-sm truncate">{template.name}</p>
                <p className="text-xs text-gray-500 mt-1">{template.duration} min</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 border-2 border-white/20 transition-all p-4 sm:p-6 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600 flex-shrink-0" />
            Basic Information
          </h2>

          <div className="space-y-5">
            {/* Event Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                Event Name *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={handleTitleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., 30-Minute Strategy Session"
                required
              />
            </div>

            {/* URL Slug */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <LinkIcon className="h-4 w-4 text-gray-400" />
                URL Slug *
              </label>
              <div className="flex items-center min-w-0">
                <span className="hidden sm:block px-4 py-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-xl text-gray-500 text-sm font-medium whitespace-nowrap">
                  yourname/
                </span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: slugify(e.target.value) })}
                  className="flex-1 min-w-0 px-4 py-3 border border-gray-300 rounded-xl sm:rounded-r-xl sm:rounded-l-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="strategy-session"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">This will be the shareable booking link.</p>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
                placeholder="What should invitees know about this meeting?"
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <Palette className="h-4 w-4 text-gray-400" />
                Event Color
              </label>
              <div className="flex flex-wrap gap-3 max-w-full">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: c.name })}
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
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 border-2 border-white/20 transition-all p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-600 flex-shrink-0" />
            Meeting Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Duration */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4 text-gray-400" />
                Duration *
              </label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            {/* Location Type */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                Location Type
              </label>
              <select
                value={formData.location_type}
                onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {locationTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} {type.auto ? '(Auto)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location Details (if not auto) */}
          {!selectedLocationType?.auto && (
            <div className="mt-5">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Location Details</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder={
                  formData.location_type === 'phone' ? 'Phone number or instructions' :
                  formData.location_type === 'zoom' ? 'Zoom meeting link' :
                  formData.location_type === 'in_person' ? 'Address or meeting place' :
                  'Enter custom location or link'
                }
              />
            </div>
          )}

          {/* Advanced Settings Toggle */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Advanced settings</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              {showAdvanced ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 border-2 border-white/20 transition-all p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600 flex-shrink-0" />
              Advanced Booking Rules
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Buffer Before */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Buffer Before (minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={formData.buffer_before}
                  onChange={(e) => setFormData({ ...formData, buffer_before: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1.5">Time before the meeting starts.</p>
              </div>

              {/* Buffer After */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Buffer After (minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={formData.buffer_after}
                  onChange={(e) => setFormData({ ...formData, buffer_after: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1.5">Time after the meeting ends.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              {/* Max Bookings Per Day */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Max Bookings Per Day</label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_bookings_per_day || ''}
                  onChange={(e) => setFormData({ ...formData, max_bookings_per_day: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  placeholder="Unlimited"
                />
                <p className="text-xs text-gray-500 mt-1.5">Leave empty for unlimited bookings.</p>
              </div>

              {/* Require Approval */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Booking Approval</label>
                <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.require_approval}
                    onChange={(e) => setFormData({ ...formData, require_approval: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Require manual approval</span>
                </label>
              </div>
            </div>

            {/* Scheduling Window */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              {/* Minimum Notice */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Minimum Notice</label>
                <select
                  value={formData.min_notice_hours}
                  onChange={(e) => setFormData({ ...formData, min_notice_hours: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                >
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={4}>4 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours (1 day)</option>
                  <option value={48}>48 hours (2 days)</option>
                  <option value={72}>72 hours (3 days)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1.5">How far in advance guests must book.</p>
              </div>

              {/* Max Days Ahead */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Scheduling Window</label>
                <select
                  value={formData.max_days_ahead}
                  onChange={(e) => setFormData({ ...formData, max_days_ahead: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                >
                  <option value={7}>1 week</option>
                  <option value={14}>2 weeks</option>
                  <option value={30}>1 month</option>
                  <option value={60}>2 months</option>
                  <option value={90}>3 months</option>
                  <option value={180}>6 months</option>
                  <option value={365}>1 year</option>
                </select>
                <p className="text-xs text-gray-500 mt-1.5">How far into the future guests can book.</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex gap-3 mt-5">
              <AlertCircle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-purple-900">Advanced Settings Info</p>
                <p className="text-xs text-purple-700 mt-1">
                  Buffer times prevent back-to-back meetings. Booking limits help manage your availability.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Custom Questions */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 border-2 border-white/20 transition-all p-4 sm:p-6">
          <CustomQuestionsEditor
            questions={formData.custom_questions}
            onChange={(questions) => setFormData({ ...formData, custom_questions: questions })}
          />
        </div>

        {/* Pre-Meeting Instructions & Confirmation Message */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-200/30 border-2 border-white/20 transition-all p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-600 flex-shrink-0" />
            Guest Communication
          </h2>

          <div className="space-y-5">
            {/* Pre-Meeting Instructions */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Pre-Meeting Instructions</label>
              <textarea
                value={formData.pre_meeting_instructions}
                onChange={(e) => setFormData({ ...formData, pre_meeting_instructions: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
                placeholder="Instructions guests should follow before the meeting (e.g., 'Please prepare a brief summary of your project')"
              />
              <p className="text-xs text-gray-500 mt-1.5">Shown on the booking page before they confirm.</p>
            </div>

            {/* Confirmation Message */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Confirmation Message</label>
              <textarea
                value={formData.confirmation_message}
                onChange={(e) => setFormData({ ...formData, confirmation_message: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
                placeholder="Custom message shown after booking (e.g., 'Looking forward to our call! I'll send the agenda 24 hours before.')"
              />
              <p className="text-xs text-gray-500 mt-1.5">Displayed on the confirmation page after booking.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
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
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-2xl hover:shadow-purple-200/50 hover:-translate-y-0.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
    </div>
  );
}