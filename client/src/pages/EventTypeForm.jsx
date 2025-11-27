import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  MapPin,
  FileText,
  Loader2,
  Save,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { events } from '../utils/api';

export default function EventTypeForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 30,
    location: '',
    is_active: true
  });

  useEffect(() => {
    if (isEditing) {
      // Try to get from navigation state first
      if (location.state?.event) {
        const event = location.state.event;
        setFormData({
          title: event.title || event.name || '',
          description: event.description || '',
          duration: event.duration || 30,
          location: event.location || '',
          is_active: event.is_active !== false
        });
      } else {
        loadEventTypeFromList();
      }
    }
  }, [id]);

  const loadEventTypeFromList = async () => {
    setLoading(true);
    try {
      const response = await events.getAll();
      const list = response.data.event_types || response.data.eventTypes || response.data || [];
      const event = list.find(e => String(e.id) === String(id));
      
      if (event) {
        setFormData({
          title: event.title || event.name || '',
          description: event.description || '',
          duration: event.duration || 30,
          location: event.location || '',
          is_active: event.is_active !== false
        });
      } else {
        alert('Event type not found');
        navigate('/events');
      }
    } catch (error) {
      console.error('Failed to load event type:', error);
      alert('Failed to load event type');
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Event name is required');
      return;
    }
    
    setSaving(true);

    try {
      // Send data with the correct field name
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        duration: formData.duration,
        location: formData.location.trim(),
        is_active: formData.is_active
      };

      console.log('Saving event type:', payload);

      if (isEditing) {
        await events.update(id, payload);
      } else {
        await events.create(payload);
      }
      navigate('/events');
    } catch (error) {
      console.error('Failed to save event type:', error);
      alert('Failed to save event type: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Event Types
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'Edit Event Type' : 'Create Event Type'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditing
            ? 'Update your event type settings'
            : 'Set up a new event type for your calendar'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Event Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <FileText className="h-4 w-4 text-gray-400" />
            Event Name *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., 30 Minute Consultation"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <FileText className="h-4 w-4 text-gray-400" />
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe what this event is about..."
            rows={4}
          />
        </div>

        {/* Duration */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Clock className="h-4 w-4 text-gray-400" />
            Duration *
          </label>
          <select
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
            <option value={90}>90 minutes</option>
            <option value={120}>2 hours</option>
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Zoom, Google Meet, or physical address"
          />
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="font-medium text-gray-900">Active Status</p>
            <p className="text-sm text-gray-600">
              {formData.is_active
                ? 'This event is visible and can be booked'
                : 'This event is hidden from your booking page'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
              formData.is_active
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {formData.is_active ? (
              <>
                <ToggleRight className="h-5 w-5" />
                Active
              </>
            ) : (
              <>
                <ToggleLeft className="h-5 w-5" />
                Inactive
              </>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
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
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {isEditing ? 'Save Changes' : 'Create Event Type'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}