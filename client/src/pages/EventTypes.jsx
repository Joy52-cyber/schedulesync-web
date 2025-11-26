// client/src/pages/EventTypes.jsx
import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Clock,
  Calendar,
  DollarSign,
  Users,
  Loader2,
  Settings,
  ToggleLeft,
  ToggleRight,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { eventTypes, auth } from '../utils/api';

export default function EventTypes() {
  const [eventTypesList, setEventTypesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 30,
    price: 0,
    location: '',
    is_active: true,
  });

  // ---------------- LOAD DATA ----------------
  useEffect(() => {
    loadUser();
    loadEventTypes();
  }, []);

  const loadUser = async () => {
    try {
      const res = await auth.me();
      setUser(res.data.user || res.data);
    } catch (err) {
      console.error('Failed to load user:', err);
    }
  };

  const loadEventTypes = async () => {
    setLoading(true);
    try {
      // Prefer /event-types without params
      const res = await eventTypes.getAll();
      console.log('📦 Event types raw response:', res.data);

      const raw = res.data;

      // Be defensive about backend shape
      const items =
        raw?.event_types ||
        raw?.eventTypes ||
        raw?.events ||
        raw?.data ||
        (Array.isArray(raw) ? raw : []);

      setEventTypesList(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to load event types:', err);
      setEventTypesList([]);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- CREATE / EDIT ----------------
  const openCreateModal = () => {
    setEditingEvent(null);
    setFormData({
      name: '',
      description: '',
      duration: 30,
      price: 0,
      location: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name || event.title || '',
      description: event.description || '',
      duration: event.duration || 30,
      price: event.price || 0,
      location: event.location || '',
      is_active: event.is_active !== false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await eventTypes.update(editingEvent.id, formData);
      } else {
        await eventTypes.create(formData);
      }
      setShowModal(false);
      await loadEventTypes();
    } catch (err) {
      console.error('Failed to save event type:', err);
      alert(
        'Failed to save event type: ' +
          (err.response?.data?.error || err.message),
      );
    }
  };

  // ---------------- DELETE / TOGGLE ----------------
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event type?')) return;

    try {
      await eventTypes.delete(id);
      setEventTypesList((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Failed to delete event type:', err);
      alert('Failed to delete event type');
    }
  };

  const handleToggleActive = async (event) => {
    try {
      await eventTypes.toggle(event.id, !event.is_active);
      setEventTypesList((prev) =>
        prev.map((e) =>
          e.id === event.id ? { ...e, is_active: !e.is_active } : e,
        ),
      );
    } catch (err) {
      console.error('Failed to toggle event type:', err);
      alert('Failed to update event status');
    }
  };

  // ---------------- VIEW / COPY LINKS ----------------
  const copyBookingLink = (event) => {
    const token = event.slug || event.id;
    const link = `${window.location.origin}/book/${token}`;
    navigator.clipboard.writeText(link);
    alert('Booking link copied to clipboard!');
  };

  // ---------------- RENDER ----------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event Types</h1>
          <p className="text-gray-600 mt-2">
            Manage your booking event types and availability
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Create Event Type
        </button>
      </div>

      {/* Empty state */}
      {eventTypesList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-200">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No event types yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first event type to start accepting bookings.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Create Event Type
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventTypesList.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {event.name || event.title || 'Untitled event'}
                  </h3>
                  {event.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 ml-4">
                  <button
                    onClick={() => copyBookingLink(event)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy booking link"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(event)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>{event.duration || 30} minutes</span>
                </div>

                {event.price > 0 && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span>${event.price}</span>
                  </div>
                )}

                {event.team_id && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span>Team event</span>
                  </div>
                )}

                {event.location && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Settings className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
              </div>

              {/* Status & View link */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleToggleActive(event)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      event.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {event.is_active ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                    {event.is_active ? 'Active' : 'Inactive'}
                  </button>

                  <a
                    href={`/book/${event.slug || event.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View details <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingEvent ? 'Edit Event Type' : 'Create Event Type'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 30 Minute Consultation"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Describe what this event is about..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes) *
                  </label>
                  <select
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        duration: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        price: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0 for free"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, location: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Zoom, Google Meet, phone, or address"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, is_active: e.target.checked }))
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="is_active"
                  className="text-sm font-medium text-gray-700"
                >
                  Active (visible for booking)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingEvent ? 'Save changes' : 'Create event type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
