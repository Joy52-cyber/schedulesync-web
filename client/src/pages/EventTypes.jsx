import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit, Trash2, Clock, Calendar, MapPin, 
  Copy, Check, ExternalLink, Loader2
} from 'lucide-react';
import { events, auth } from '../utils/api';

export default function EventTypes() {
  const navigate = useNavigate();
  const [eventTypesList, setEventTypesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [copiedId, setCopiedId] = useState(null); // Track which ID was copied

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
      const list = eventsRes.data.eventTypes || eventsRes.data.event_types || [];
      setEventTypesList(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (e, event) => {
    e.stopPropagation(); // Prevent card click
    // Assuming a route structure like: site.com/username/event-slug
    const username = user?.username || 'user'; 
    const link = `${window.location.origin}/${username}/${event.slug}`;
    
    navigator.clipboard.writeText(link);
    setCopiedId(event.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for color classes
  const getColorClass = (color) => {
    const map = {
      blue: 'bg-blue-500', purple: 'bg-purple-500', green: 'bg-green-500',
      red: 'bg-red-500', orange: 'bg-orange-500', gray: 'bg-gray-500'
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
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event Types</h1>
          <p className="text-gray-600 mt-2">Create templates to share your availability.</p>
        </div>
        <button onClick={() => navigate('/events/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-sm">
          <Plus className="h-5 w-5" /> New Event Type
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {eventTypesList.map((event) => (
          <div 
            key={event.id}
            onClick={() => navigate(`/events/${event.id}`, { state: { event } })}
            className={`group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer relative ${!event.is_active ? 'opacity-75 grayscale' : ''}`}
          >
            {/* Colored Top Bar */}
            <div className={`h-2 w-full ${getColorClass(event.color)}`} />

            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900 pr-2">{event.title}</h3>
                <div className="flex gap-2">
                  {/* Copy Link Button */}
                  <button
                    onClick={(e) => copyToClipboard(e, event)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Copy Booking Link"
                  >
                    {copiedId === event.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  {event.duration} min
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {event.location || 'No location set'}
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <ExternalLink className="h-4 w-4" />
                  /{event.slug || 'url-slug'}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}/edit`, { state: { event } }); }}
                  className="text-sm font-medium text-gray-600 hover:text-blue-600"
                >
                  Edit details
                </button>
                
                {/* Simple Toggle */}
                <button
                  onClick={(e) => handleToggleActive(e, event)}
                  className={`text-xs font-semibold px-2 py-1 rounded ${event.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {event.is_active ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}