import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit, Clock, MapPin, Copy, Check, 
  ExternalLink, Loader2, Video, Phone, Building2, 
  Globe, Sparkles, TrendingUp, Calendar  // ✅ ADD THIS
} from 'lucide-react';
import { events, auth } from '../utils/api';

const locationIcons = {
  google_meet: Video,
  zoom: Video,
  phone: Phone,
  in_person: Building2,
  custom: Globe,
};

export default function EventTypes() {
  const navigate = useNavigate();
  const [eventTypesList, setEventTypesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, eventsRes] = await Promise.all([
        auth.me(),
        events.getAll()
      ]);
      setUser(userRes.data.user || userRes.data);
      const list = eventsRes.data.eventTypes || eventsRes.data.event_types || eventsRes.data || [];
      setEventTypesList(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (e, event) => {
  e.stopPropagation();
  const username = user?.username || user?.email?.split('@')[0] || 'user';
  const link = `${window.location.origin}/book/${username}/${event.slug}`;  // ✅ ADD /book
  
  navigator.clipboard.writeText(link);
  setCopiedId(event.id);
  setTimeout(() => setCopiedId(null), 2000);
};

  const getColorClass = (color) => {
    const map = {
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      green: 'bg-green-500',
      red: 'bg-red-500',
      orange: 'bg-orange-500',
      pink: 'bg-pink-500',
      indigo: 'bg-indigo-500',
      yellow: 'bg-yellow-500',
      gray: 'bg-gray-500'
    };
    return map[color] || map.blue;
  };

  const handleToggleActive = async (e, event) => {
    e.stopPropagation();
    try {
      await events.toggle(event.id, !event.is_active);
      setEventTypesList(prev => prev.map(ev => 
        ev.id === event.id ? { ...ev, is_active: !ev.is_active } : ev
      ));
    } catch (error) {
      console.error('Failed to toggle', error);
      alert('Failed to update status');
    }
  };

  const LocationIcon = (locationType) => {
    return locationIcons[locationType] || MapPin;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            Event Types
          </h1>
          <p className="text-gray-600 mt-2">
            Create templates to share your availability with different durations and settings.
          </p>
        </div>
        <button 
          onClick={() => navigate('/events/new')} 
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="h-5 w-5" /> New Event Type
        </button>
      </div>

      {/* Stats Overview */}
      {eventTypesList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Event Types</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{eventTypesList.length}</p>
              </div>
              <Sparkles className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Active</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {eventTypesList.filter(e => e.is_active).length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Avg Duration</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {Math.round(eventTypesList.reduce((sum, e) => sum + e.duration, 0) / eventTypesList.length)} min
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-600 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Event Types Grid */}
      {eventTypesList.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Event Types Yet</h3>
          <p className="text-gray-600 mb-6">Create your first event type to start accepting bookings.</p>
          <button 
            onClick={() => navigate('/events/new')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" /> Create Event Type
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventTypesList.map((event) => {
            const LocIcon = LocationIcon(event.location_type);
            const colorClass = getColorClass(event.color);
            
            return (
              <div 
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`, { state: { event } })}
                className={`group bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer ${!event.is_active ? 'opacity-60' : ''}`}
              >
                {/* Colored Top Bar */}
                <div className={`h-2 w-full ${colorClass}`} />

                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {event.title}
                      </h3>
                      {event.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{event.duration} minutes</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <LocIcon className="h-4 w-4 text-purple-500" />
                      <span>{event.location || 'Google Meet'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-400">
                      <ExternalLink className="h-4 w-4" />
                      <span className="font-mono text-xs">/{event.slug}</span>
                    </div>
                  </div>

                  {/* Advanced Settings Indicators */}
                  {(event.buffer_before > 0 || event.buffer_after > 0 || event.max_bookings_per_day || event.require_approval) && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex flex-wrap gap-1.5">
                        {event.buffer_before > 0 && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                            {event.buffer_before}m buffer
                          </span>
                        )}
                        {event.max_bookings_per_day && (
                          <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded">
                            Max {event.max_bookings_per_day}/day
                          </span>
                        )}
                        {event.require_approval && (
                          <span className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs font-medium rounded">
                            Approval required
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}/edit`, { state: { event } }); }}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      
                      <button
                        onClick={(e) => copyToClipboard(e, event)}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
                        title="Copy Booking Link"
                      >
                        {copiedId === event.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-green-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    
                    <button
                      onClick={(e) => handleToggleActive(e, event)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        event.is_active 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {event.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}