import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Clock, MapPin, Edit, Trash2, Loader2, 
  Copy, Check, ExternalLink, Globe
} from 'lucide-react';
import { events, auth } from '../utils/api';

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
      const list = response.data.event_types || response.data || [];
      const found = list.find(e => String(e.id) === String(id));
      if (found) setEvent(found);
      else navigate('/events');
    } catch (error) {
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure? This deletes the booking page forever.')) return;
    try {
      await events.delete(id);
      navigate('/events');
    } catch (error) {
      alert('Failed to delete');
    }
  };

  const getBookingLink = () => {
    const username = user?.username || 'user';
    return `${window.location.origin}/${username}/${event?.slug || ''}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getBookingLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !event) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button onClick={() => navigate('/events')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Event Types
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {/* Color Dot */}
              <div className={`w-4 h-4 rounded-full bg-${event.color || 'blue'}-500`} />
              <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
            </div>
            <p className="text-gray-500 mt-1 ml-7">/{event.slug}</p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => navigate(`/events/${id}/edit`, { state: { event } })} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">
              <Edit className="h-4 w-4" /> Edit
            </button>
            <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-medium">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Details</h2>
            <div className="space-y-4">
              <p className="text-gray-600">{event.description || 'No description provided.'}</p>
              
              <div className="flex gap-6 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">{event.duration} min</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">{event.location || 'No location'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sharing Sidebar */}
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5" /> Share Event
            </h2>
            <p className="text-sm text-blue-700 mb-4">
              Share this link to let people book this specific meeting type.
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={handleCopyLink}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-blue-200 rounded-xl hover:border-blue-300 transition-all text-blue-800 font-medium"
              >
                <span>Copy Link</span>
                {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
              </button>

              <a 
                href={getBookingLink()} 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Preview Page
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}