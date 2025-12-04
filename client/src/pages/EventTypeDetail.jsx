// client/src/pages/EventTypeDetail.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Edit,
  Trash2,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Shield,
  Calendar,
  Sparkles,
  Video,
  Phone,
  Building2,
  Link as LinkIcon,
} from 'lucide-react';
import { events, auth } from '../utils/api';

// Location type icons
const locationIcons = {
  google_meet: Video,
  zoom: Video,
  phone: Phone,
  in_person: Building2,
  custom: LinkIcon,
};

// Color mapping
const colorClasses = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
  yellow: 'bg-yellow-500',
  gray: 'bg-gray-500',
};

export default function EventTypeDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  
  const [event, setEvent] = useState(location.state?.event || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!location.state?.event);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadUser();
    if (!location.state?.event) {
      loadEventTypeFromList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadUser = async () => {
    try {
      const response = await auth.me();
      setUser(response.data.user || response.data);
    } catch (error) {
      console.error('Failed to load user:', error);
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
      const found = list.find((e) => String(e.id) === String(id));
      if (found) setEvent(found);
      else navigate('/events');
    } catch (error) {
      console.error('Failed to load event type:', error);
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;

    try {
      // Make sure your events API has this method
      await events.delete(id);
      navigate('/events');
    } catch (error) {
      console.error('Failed to delete event type:', error);
      alert('Failed to delete: ' + (error.response?.data?.error || error.message));
    }
  };

  const getBookingLink = () => {
    const username = user?.username || user?.email?.split('@')[0] || 'user';
    const slug = event?.slug || '';
    return `${window.location.origin}/book/${username}/${slug}`;
  };

  const handleCopyLink = () => {
    const link = getBookingLink();
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleActive = async () => {
    if (!event) return;
    try {
      await events.update(id, { is_active: !event.is_active });
      setEvent({ ...event, is_active: !event.is_active });
    } catch (error) {
      console.error('Failed to update status', error);
      alert('Failed to update status');
    }
  };

  const LocationIcon = event?.location_type
    ? locationIcons[event.location_type] || MapPin
    : MapPin;

  if (loading || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  const colorClass = colorClasses[event.color] || colorClasses.blue;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Event Types
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${colorClass}`} />
              <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
              {event.is_active ? (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                  Active
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-2 text-sm">
              <span className="text-gray-400">/{event.slug}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleActive}
              className={`px-4 py-2 border rounded-xl font-medium transition-colors ${
                event.is_active
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              {event.is_active ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={() =>
                navigate(`/events/${id}/edit`, { state: { event } })
              }
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              <Edit className="h-4 w-4" /> Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-medium transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Event Overview
            </h2>

            {event.description ? (
              <p className="text-gray-600 mb-6">{event.description}</p>
            ) : (
              <p className="text-gray-400 italic mb-6">No description provided.</p>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="font-semibold text-gray-900">
                    {event.duration} min
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <LocationIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="font-semibold text-gray-900 truncate">
                    {event.location || 'Auto-generated'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Rules / Advanced Settings */}
          {(event.buffer_before > 0 ||
            event.buffer_after > 0 ||
            event.max_bookings_per_day ||
            event.require_approval) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-600" />
                Booking Rules
              </h2>

              <div className="space-y-3">
                {event.buffer_before > 0 && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Buffer before</span>
                    <span className="font-medium text-gray-900">
                      {event.buffer_before} min
                    </span>
                  </div>
                )}

                {event.buffer_after > 0 && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Buffer after</span>
                    <span className="font-medium text-gray-900">
                      {event.buffer_after} min
                    </span>
                  </div>
                )}

                {event.max_bookings_per_day && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Max bookings per day</span>
                    <span className="font-medium text-gray-900">
                      {event.max_bookings_per_day}
                    </span>
                  </div>
                )}

                {event.require_approval && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">Require approval</span>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                      Yes
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Share Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Globe className="h-5 w-5" /> Share Event
            </h2>
            <p className="text-xs sm:text-sm text-blue-700 mb-4">
              Share this link to let people book this specific meeting type.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-blue-200 rounded-xl hover:border-blue-300 transition-all text-blue-800 font-medium shadow-sm text-sm"
              >
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                {copied ? (
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <Copy className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                )}
              </button>

              <a
                href={getBookingLink()}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-md transition-colors text-sm"
              >
                <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Preview Page
              </a>
            </div>

            {/* Booking URL - wrapped, no overflow */}
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="bg-white rounded-lg p-2">
                <p className="text-[10px] sm:text-xs text-blue-600 break-all leading-snug">
                  {getBookingLink()}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Card (Future) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              Booking Stats
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Bookings</span>
                <span className="font-bold text-2xl text-gray-900">0</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">This month</span>
                <span className="font-semibold text-gray-700">0</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4 italic">
              Coming soon: View detailed booking analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
