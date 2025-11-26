import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit,
  Trash2,
  Clock,
  Calendar,
  DollarSign,
  Users,
  Loader2,
  Settings
} from 'lucide-react';
import { events, auth } from '../utils/api';  // ✅ FIXED: Changed eventTypes to events

export default function EventTypes() {
  const navigate = useNavigate();
  const [eventTypesList, setEventTypesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadEventTypes();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await auth.me();
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadEventTypes = async () => {
    setLoading(true);
    try {
      const response = await events.getAll();  // ✅ Use getAll() for all event types
      setEventTypesList(response.data.event_types || response.data.eventTypes || response.data || []);
    } catch (error) {
      console.error('Failed to load event types:', error);
    } finally {
      setLoading(false);
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
          onClick={() => navigate('/events/new')}
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
            onClick={() => navigate('/events/new')}
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
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => navigate(`/events/${event.id}/edit`)}
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

                {event.price && event.price > 0 && (
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

              {/* Event Status */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      event.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {event.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => navigate(`/events/${event.id}`)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}