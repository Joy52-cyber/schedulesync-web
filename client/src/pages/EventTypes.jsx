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
  ExternalLink
} from 'lucide-react';
import { events, auth } from '../utils/api';

export default function EventTypes() {
  const [eventTypesList, setEventTypesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 30,
    price: 0,
    location: '',
    is_active: true
  });

  useEffect(() => {
    loadEventTypes();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await auth.me();
      setUser(response.data.user || response.data);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadEventTypes = async () => {
    setLoading(true);
    try {
      const response = await events.getAll();
      console.log('📦 Event Types Response:', response.data);
      
      // Handle different response formats
      const data = response.data;
      const eventsList = data.event_types || data.eventTypes || data.data || data || [];
      
      setEventTypesList(Array.isArray(eventsList) ? eventsList : []);
    } catch (error) {
      console.error('Failed to load event types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingEvent(null);
    setFormData({
      name: '',
      description: '',
      duration: 30,
      price: 0,
      location: '',
      is_active: true
    });
    setShowCreateModal(true);
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name || '',
      description: event.description || '',
      duration: event.duration || 30,
      price: event.price || 0,
      location: event.location || '',
      is_active: event.is_active !== false
    });
    setShowCreateModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await events.update(editingEvent.id, formData);
      } else {
        await events.create(formData);
      }
      setShowCreateModal(false);
      loadEventTypes();
    } catch (error) {
      console.error('Failed to save event type:', error);
      alert('Failed to save event type: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event type?')) return;

    try {
      await events.delete(id);
      setEventTypesList(eventTypesList.filter((e) => e.id !== id));
    } catch (error) {
      console.error('Failed to delete event type:', error);
      alert('Failed to delete event type');
    }
  };

  const handleToggleActive = async (event) => {
    try {
      await events.toggle(event.id, !event.is_active);
      setEventTypesList(eventTypesList.map(e => 
        e.id === event.id ? { ...e, is_active: !e.is_active } : e
      ));
    } catch (error) {
      console.error('Failed to toggle event type:', error);
      alert('Failed to update event status');
    }
  };

  const copyBookingLink = (event) => {
    const link = `${window.location.origin}/book/${event.slug || event.id}`;
    navigator.clipboard.writeText(link);
    alert('Booking link copied to clipboard!');
  };

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
          onClick={handleCreate}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Create Event Type
        </button>
      </div>

      {/* Event Types List */}
      {eventTypesList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-200">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No event types yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first event type to start accepting bookings
          </p>
          <button
            onClick={handleCreate}
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
              {/* Event Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {event.name}
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
                    onClick={() => handleEdit(event)}
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

              {/* Event Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>{event.duration} minutes</span>
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
                    <span>Team Event</span>
                  </div>
                )}

                {event.location && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Settings className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
              </div>

              {/* Event Status & Actions */}
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
                    Preview <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
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
                  Event Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 30 Minute Consultation"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe what this event is about..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes) *
                  </label>
                  <select
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
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
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0 for free"
                    min="0"
                    step="0.01"
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
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Zoom, Google Meet, or address"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active (visible for booking)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingEvent ? 'Save Changes' : 'Create Event Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}