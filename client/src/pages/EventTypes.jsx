// client/src/pages/EventTypes.jsx - WITH SLUG PREVIEW
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Clock, Check, X, ChevronDown, Link } from 'lucide-react';
import api from '../utils/api';

export default function EventTypes() {
  const navigate = useNavigate();
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    duration: 30,
    description: '',
    color: 'blue',
    slug: '',
  });

  const colors = [
    { value: 'blue', label: 'Blue', class: 'bg-blue-500', lightClass: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'green', label: 'Green', class: 'bg-green-500', lightClass: 'bg-green-100 text-green-700 border-green-200' },
    { value: 'purple', label: 'Purple', class: 'bg-purple-500', lightClass: 'bg-purple-100 text-purple-700 border-purple-200' },
    { value: 'red', label: 'Red', class: 'bg-red-500', lightClass: 'bg-red-100 text-red-700 border-red-200' },
    { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500', lightClass: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    { value: 'pink', label: 'Pink', class: 'bg-pink-500', lightClass: 'bg-pink-100 text-pink-700 border-pink-200' },
  ];

  // Generate slug from title
  const generateSlug = (title) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  // Get the slug that will be used (custom or auto-generated)
  const getEffectiveSlug = () => {
    return formData.slug || generateSlug(formData.title);
  };

  useEffect(() => {
    loadEventTypes();
  }, []);

  const loadEventTypes = async () => {
    try {
      setLoading(true);
      const response = await api.eventTypes.getAll();
      console.log('📋 Event types loaded:', response.data);
      setEventTypes(response.data.eventTypes || []);
    } catch (err) {
      console.error('❌ Failed to load event types:', err);
      setError('Failed to load event types');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Auto-generate slug from title if not provided
      const slug = formData.slug || generateSlug(formData.title);
      
      if (editingEvent) {
        await api.eventTypes.update(editingEvent.id, { ...formData, slug });
        console.log('✅ Event type updated');
      } else {
        await api.eventTypes.create({ ...formData, slug });
        console.log('✅ Event type created');
      }

      setShowModal(false);
      setEditingEvent(null);
      setShowAdvanced(false);
      resetForm();
      loadEventTypes();
    } catch (err) {
      console.error('❌ Failed to save event type:', err);
      setError(err.response?.data?.error || 'Failed to save event type');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event type?')) return;

    try {
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
    setShowAdvanced(false);
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
            Create meeting types with different durations
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
          eventTypes.map((eventType) => {
            const colorConfig = colors.find((c) => c.value === eventType.color) || colors[0];
            return (
              <div
                key={eventType.id}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Color Badge */}
                    <div className={`px-3 py-1.5 rounded-lg ${colorConfig.lightClass} border font-medium text-sm`}>
                      {eventType.duration}m
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {eventType.title}
                        </h3>
                        {!eventType.is_active && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {eventType.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {eventType.description}
                        </p>
                      )}
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
            );
          })
        )}
      </div>

      {/* Create/Edit Modal - WITH SLUG PREVIEW */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingEvent ? 'Edit Event Type' : 'New Event Type'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title & Duration - Side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="30 Min Meeting"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  >
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
              </div>

              {/* URL Preview - ALWAYS VISIBLE */}
              {formData.title && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Link className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-purple-900 mb-1">
                        Booking URL Preview
                      </p>
                      <p className="text-sm text-purple-700 break-all font-mono">
                        /book/<span className="text-purple-900 font-semibold">you</span>/{getEffectiveSlug()}
                      </p>
                      {!formData.slug && (
                        <p className="text-xs text-purple-600 mt-1">
                          ✨ Auto-generated from title
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Color - Compact */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
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
                      className={`w-8 h-8 rounded-lg ${color.class} ${
                        formData.color === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-900'
                          : ''
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Visual identifier on booking page
                </p>
              </div>

              {/* Description - Optional */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  rows="2"
                  placeholder="A quick 30 minute call"
                />
              </div>

              {/* Advanced Options - Collapsible */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                  Customize URL slug
                </button>
                
                {showAdvanced && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Custom URL Slug
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({ ...formData, slug: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono"
                      placeholder={generateSlug(formData.title) || "custom-slug"}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Override the auto-generated slug above
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEvent(null);
                    setShowAdvanced(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
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