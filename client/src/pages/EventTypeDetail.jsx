import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  DollarSign,
  MapPin,
  Calendar,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Users,
  CheckCircle
} from 'lucide-react';
import { events, auth } from '../utils/api';

export default function EventTypeDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadEventType();
    loadUser();
  }, [id]);

  const loadUser = async () => {
    try {
      const response = await auth.me();
      setUser(response.data.user || response.data);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadEventType = async () => {
    setLoading(true);
    try {
      const response = await events.get(id);
      const eventData = response.data.event_type || response.data.eventType || response.data;
      setEvent(eventData);
    } catch (error) {
      console.error('Failed to load event type:', error);
      alert('Failed to load event type');
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event type? This action cannot be undone.')) {
      return;
    }

    try {
      await events.delete(id);
      navigate('/events');
    } catch (error) {
      console.error('Failed to delete event type:', error);
      alert('Failed to delete event type');
    }
  };

  const handleToggleActive = async () => {
    try {
      await events.toggle(id, !event.is_active);
      setEvent({ ...event, is_active: !event.is_active });
    } catch (error) {
      console.error('Failed to toggle event type:', error);
      alert('Failed to update event status');
    }
  };

  // ✅ FIXED: Correct URL format /book/:username/:eventSlug
  const getBookingLink = () => {
    if (!event) return '';
    const username = user?.username || user?.name?.toLowerCase().replace(/\s+/g, '') || 'user';
    const eventSlug = event.slug || event.name?.toLowerCase().replace(/\s+/g, '-') || event.id;
    return `${window.location.origin}/book/${username}/${eventSlug}`;
  };

  const copyBookingLink = () => {
    const link = getBookingLink();
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Event type not found</p>
      </div>
    );
  }

  const bookingLink = getBookingLink();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Event Types
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
            <p className="text-gray-600 mt-2">{event.description || 'No description'}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/events/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 font-medium"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Details Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Details</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="text-lg font-semibold text-gray-900">{event.duration} minutes</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="p-3 bg-green-100 rounded-xl">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Price</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {event.price > 0 ? `$${event.price}` : 'Free'}
                  </p>
                </div>
              </div>

              {event.location && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <MapPin className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="text-lg font-semibold text-gray-900">{event.location}</p>
                  </div>
                </div>
              )}

              {event.team_id && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="text-lg font-semibold text-gray-900">Team Event</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Booking Link Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Link</h2>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={bookingLink}
                readOnly
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-mono text-sm"
              />
              <button
                onClick={copyBookingLink}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
                  copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-5 w-5" />
                    Copy
                  </>
                )}
              </button>
              <a
                href={bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
              >
                <ExternalLink className="h-5 w-5" />
                Preview
              </a>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>

            <button
              onClick={handleToggleActive}
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                event.is_active
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {event.is_active ? (
                  <ToggleRight className="h-6 w-6 text-green-600" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-gray-400" />
                )}
                <div className="text-left">
                  <p className={`font-semibold ${event.is_active ? 'text-green-700' : 'text-gray-600'}`}>
                    {event.is_active ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {event.is_active ? 'Accepting bookings' : 'Not visible'}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Quick Stats Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Created</span>
                <span className="font-medium text-gray-900">
                  {event.created_at
                    ? new Date(event.created_at).toLocaleDateString()
                    : 'Unknown'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Updated</span>
                <span className="font-medium text-gray-900">
                  {event.updated_at
                    ? new Date(event.updated_at).toLocaleDateString()
                    : 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

            <div className="space-y-3">
              <button
                onClick={() => navigate(`/events/${id}/edit`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <Edit className="h-5 w-5 text-gray-400" />
                Edit Event Type
              </button>
              <button
                onClick={copyBookingLink}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <Copy className="h-5 w-5 text-gray-400" />
                Copy Booking Link
              </button>
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 className="h-5 w-5" />
                Delete Event Type
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}