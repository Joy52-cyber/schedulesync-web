// client/src/pages/EventTypes.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Clock, Check, X } from 'lucide-react';
import api from '../utils/api';

export default function EventTypes() {
  const navigate = useNavigate();
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    duration: 30,
    description: '',
    color: 'blue',
    slug: '',
  });

  const colors = [
    { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
    { value: 'green', label: 'Green', class: 'bg-green-500' },
    { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
    { value: 'red', label: 'Red', class: 'bg-red-500' },
    { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
    { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  ];

  useEffect(() => {
    loadEventTypes();
  }, []);

  const loadEventTypes = async () => {
    try {
      setLoading(true);
      // ✅ FIXED: Use api helper, no /api prefix
      const response = await api.eventTypes.getAll();
      console.log('📋 Event types loaded:', response.data);
      setEventTypes(response.data.eventTypes || []);
    } catch (err) {
      console.error('❌ Failed to load event types:', err);
      console.error('Error details:', err.response?.data);
      setError('Failed to load event types');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Auto-generate slug from title if not provided
      const slug = formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      if (editingEvent) {
        // ✅ FIXED: Use api helper
        await api.eventTypes.update(editingEvent.id, { ...formData, slug });
        console.log('✅ Event type updated');
      } else {
        // ✅ FIXED: Use api helper
        await api.eventTypes.create({ ...formData, slug });
        console.log('✅ Event type created');
      }

      setShowModal(false);
      setEditingEvent(null);
      resetForm();
      loadEventTypes();
    } catch (err) {
      console.error('❌ Failed to save event type:', err);
      console.error('Error details:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to save event type');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event type?')) return;

    try {
      // ✅ FIXED: Use api helper
      await api.eventTypes.delete(id);
      console.log('✅ Event type deleted');
      loadEventTypes();
    } catch (err) {
      console.error('❌ Failed to delete event type:', err);
      setError('Failed to delete event type');
    }
  };

  const handleToggleActive = async (eventType) => {
    try {
      // ✅ FIXED: Use api helper
      await api.eventTypes.update(eventType.id, {
        is_active: !eventType.is_active,
      });
      console.log('✅ Event type toggled');
      loadEventTypes();
    } catch (err) {
      console.error('❌ Failed to toggle event type:', err);
      setError('Failed to update event type');
    }
  };

  const openEditModal = (eventType) => {
    setEditingEvent(eventType);
    setFormData({
      title: eventType.title,
      duration: eventType.duration,
      description: eventType.description || '',
      color: eventType.color,
      slug: eventType.slug,
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      duration: 30,
      description: '',
      color: 'blue',
      slug: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event Types</h1>
          <p className="text-gray-600 mt-1">
            Create different meeting types with custom durations
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Event Type
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Event Types List */}
      <div className="grid gap-4">
        {eventTypes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No event types yet
            </h3>
            <p className="text-gray-600 mb-4">
              Create your first event type to get started
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="h-5 w-5" />
              Create Event Type
            </button>
          </div>
        ) : (
          eventTypes.map((eventType) => (
            <div
              key={eventType.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Color Indicator */}
                  <div
                    className={`w-12 h-12 rounded-lg ${
                      colors.find((c) => c.value === eventType.color)?.class ||
                      'bg-blue-500'
                    } flex items-center justify-center`}
                  >
                    <Clock className="h-6 w-6 text-white" />
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {eventType.title}
                      </h3>
                      {!eventType.is_active && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Clock className="h-4 w-4" />
                      {eventType.duration} minutes
                    </div>
                    {eventType.description && (
                      <p className="text-sm text-gray-600">
                        {eventType.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Link: /book/your-link/{eventType.slug}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(eventType)}
                    className={`p-2 rounded-lg transition-colors ${
                      eventType.is_active
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                    title={eventType.is_active ? 'Active' : 'Inactive'}
                  >
                    {eventType.is_active ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <X className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(eventType)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(eventType.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingEvent ? 'Edit Event Type' : 'New Event Type'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="30 Min Meeting"
                  required
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                  <option value="120">120 minutes</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows="3"
                  placeholder="A standard 30 minute meeting"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, color: color.value })
                      }
                      className={`w-10 h-10 rounded-lg ${color.class} ${
                        formData.color === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-900'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Slug (Advanced) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  URL Slug (optional)
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="30min-meeting"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to auto-generate from title
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEvent(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {editingEvent ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}