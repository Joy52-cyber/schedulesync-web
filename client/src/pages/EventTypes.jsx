import { useState, useEffect } from 'react';
import { 
  Clock, Plus, Trash2, Copy, Check, Loader2
} from 'lucide-react';
import { eventTypes, auth } from '../utils/api'; // Added auth import

export default function EventTypes() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [userToken, setUserToken] = useState(null); // Store the main booking token

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    duration: 30,
    description: '',
    slug: '',
    color: 'blue'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsRes, userRes] = await Promise.all([
        eventTypes.getAll(),
        auth.me() // Fetch user info to get the main booking token
      ]);
      setEvents(eventsRes.data.eventTypes);
      setUserToken(userRes.data.user.booking_token); // Save the token
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await eventTypes.create(formData);
      setShowCreateModal(false);
      setFormData({ title: '', duration: 30, description: '', slug: '', color: 'blue' }); 
      // Reload just events, keep token
      const res = await eventTypes.getAll();
      setEvents(res.data.eventTypes);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create event');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event type?')) return;
    try {
      await eventTypes.delete(id);
      const res = await eventTypes.getAll();
      setEvents(res.data.eventTypes);
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  // ✅ FIX: Construct correct link (base_token + query_param)
  const copyLink = (slug, id) => {
    if (!userToken) return alert("Your personal booking link isn't set up yet. Visit the Dashboard first.");
    
    // Generates: https://.../book/joy-lacaba?type=30min
    const link = `${window.location.origin}/book/${userToken}?type=${slug}`;
    
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event Types</h1>
          <p className="text-gray-500 mt-1">Create and manage your meeting templates.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm"
        >
          <Plus size={20} /> New Event Type
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
            <div className={`h-2 w-full bg-${event.color || 'blue'}-500`} />
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-900">{event.title}</h3>
                <button onClick={() => handleDelete(event.id)} className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-gray-50 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
                <Clock size={16} />
                <span>{event.duration} mins</span>
                <span className="text-gray-300">|</span>
                <span className="truncate max-w-[150px]">/{event.slug}</span>
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <button 
                  onClick={() => copyLink(event.slug, event.id)}
                  className="text-blue-600 text-sm font-semibold flex items-center gap-2 hover:text-blue-700"
                >
                  {copiedId === event.id ? <Check size={16} /> : <Copy size={16} />}
                  {copiedId === event.id ? 'Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Add Event Type</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input required type="text" className="w-full p-2 border rounded-lg" placeholder="e.g. 15 Min Intro" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <input type="number" className="w-full p-2 border rounded-lg" value={formData.duration} onChange={e => setFormData({...formData, duration: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
                  <input type="text" className="w-full p-2 border rounded-lg" placeholder="15min" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}