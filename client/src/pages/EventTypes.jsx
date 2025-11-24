import { useState, useEffect } from 'react';
import { 
  Clock, 
  Plus, 
  MoreVertical, 
  Copy, 
  Check, 
  Loader2,
  Search,
  ExternalLink,
  User,
  Settings,
  ShieldCheck, // ✅ Added icons for Single Use
  RefreshCw,
  Link as LinkIcon
} from 'lucide-react';
import { eventTypes, auth, api } from '../utils/api'; // Ensure api is imported for the POST call

export default function EventTypes() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // ✅ TAB STATE
  const [activeTab, setActiveTab] = useState('event-types');

  // ✅ SINGLE USE LINK STATE
  const [singleUseLink, setSingleUseLink] = useState('');
  const [loadingSingleUse, setLoadingSingleUse] = useState(false);
  const [copiedSingleUse, setCopiedSingleUse] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);

  const [copiedId, setCopiedId] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const initialFormState = {
    title: '',
    duration: 30,
    description: '',
    slug: '',
    color: 'purple'
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsRes, userRes] = await Promise.all([
        eventTypes.getAll(),
        auth.me()
      ]);
      setEvents(eventsRes.data.eventTypes);
      setUserToken(userRes.data.user.booking_token);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  // --- SINGLE USE LINK HANDLERS ---
  const handleGenerateSingleUse = async () => {
    setLoadingSingleUse(true);
    setSingleUseLink('');
    try {
      // Calls your backend to generate a token
      // Assuming a direct api call here:
      const response = await api.post('/single-use-links');

      const token = response.data.token || response.data.data?.token;
      if (token) {
        const fullLink = `${window.location.origin}/book/${token}`;
        setSingleUseLink(fullLink);
      }
    } catch (error) {
      console.error("Failed to create link", error);
    } finally {
      setLoadingSingleUse(false);
    }
  };

  const handleCopySingleUse = () => {
    if (!singleUseLink) return;
    navigator.clipboard.writeText(singleUseLink);
    setCopiedSingleUse(true);
    setTimeout(() => setCopiedSingleUse(false), 2000);
  };
  // --------------------------------

  const openCreateModal = () => {
    setIsEditing(false);
    setFormData(initialFormState);
    setShowModal(true);
  };

  const openEditModal = (event) => {
    setIsEditing(true);
    setCurrentId(event.id);
    setFormData({
      title: event.title,
      duration: event.duration,
      description: event.description || '',
      slug: event.slug,
      color: event.color || 'purple'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await eventTypes.update(currentId, formData);
      } else {
        await eventTypes.create(formData);
      }

      setShowModal(false);
      const res = await eventTypes.getAll();
      setEvents(res.data.eventTypes);
    } catch (error) {
      alert(error.response?.data?.error || 'Operation failed');
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

  const copyLink = (slug, id) => {
    if (!userToken) return alert("Your personal booking link isn't set up yet. Visit the Dashboard first.");
    const link = `${window.location.origin}/book/${userToken}?type=${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEvents = events.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scheduling</h1>
          <p className="text-gray-500 mt-1">Manage your event types and booking links.</p>
        </div>
        
        {/* Only show Create button on Event Types tab */}
        {activeTab === 'event-types' && (
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full hover:bg-blue-700 transition-colors font-semibold shadow-sm text-sm"
          >
            <Plus size={18} /> Create
          </button>
        )}
      </div>

      {/* ✅ FUNCTIONAL TABS */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6 text-sm font-medium text-gray-500">
          <button 
            onClick={() => setActiveTab('event-types')}
            className={`pb-3 transition-colors ${activeTab === 'event-types' ? 'text-blue-600 border-b-2 border-blue-600' : 'hover:text-gray-700'}`}
          >
            Event types
          </button>
          <button 
            onClick={() => setActiveTab('single-use')}
            className={`pb-3 transition-colors ${activeTab === 'single-use' ? 'text-blue-600 border-b-2 border-blue-600' : 'hover:text-gray-700'}`}
          >
            Single-use links
          </button>
        </div>
      </div>

      {/* ================= CONTENT: EVENT TYPES ================= */}
      {activeTab === 'event-types' && (
        <>
          {/* Search Bar */}
          <div className="relative mb-8">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search event types"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            />
          </div>

          {/* User Row */}
          <div className="flex items-center justify-between mb-4 px-1">
             <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                     ME
                 </div>
                 <span className="text-sm font-medium text-gray-700">My Event Types</span>
             </div>
             {userToken && (
                 <a href={`/book/${userToken}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                     <ExternalLink size={14} /> View booking page
                 </a>
             )}
          </div>

          {/* List View */}
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col sm:flex-row relative group">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-${event.color || 'purple'}-600`} />
                
                <div className="p-5 pl-7 flex-1">
                   <div className="flex justify-between items-start">
                       <div>
                           <h3 className="text-lg font-bold text-gray-900 mb-1">{event.title}</h3>
                           <p className="text-sm text-gray-500 flex items-center gap-3">
                               <span>{event.duration} min</span>
                               <span>•</span>
                               <span>One-on-One</span>
                           </p>
                           <button 
                             onClick={() => openEditModal(event)}
                             className="text-xs text-blue-600 mt-3 flex items-center gap-1 hover:underline font-medium"
                           >
                               <Settings size={12} /> Edit / View Details
                           </button>
                       </div>
                       <button onClick={() => handleDelete(event.id)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                           <MoreVertical size={20} />
                       </button>
                   </div>

                   <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                       <div className="flex gap-3 text-gray-400">
                           <button className="hover:text-gray-600"><Copy size={16} /></button>
                       </div>
                       <button 
                         onClick={() => copyLink(event.slug, event.id)}
                         className="text-blue-600 text-xs font-bold border border-blue-600 rounded-full px-4 py-1.5 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                       >
                         {copiedId === event.id ? <Check size={14} /> : <Copy size={14} />}
                         {copiedId === event.id ? 'Copied' : 'Copy link'}
                       </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= CONTENT: SINGLE USE LINKS ================= */}
      {activeTab === 'single-use' && (
        <div className="max-w-2xl mx-auto pt-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
             <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-8 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                   <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">One-Time Booking Link</h2>
                <p className="text-purple-100">Generate a secure link that expires immediately after one booking.</p>
             </div>

             <div className="p-8">
                {!singleUseLink ? (
                   <div className="text-center py-6">
                      <p className="text-gray-500 mb-6 text-sm">
                        Perfect for VIPs or overriding your standard schedule limits. 
                        <br />The recipient gets exclusive access to book exactly one slot.
                      </p>
                      <button 
                        onClick={handleGenerateSingleUse}
                        disabled={loadingSingleUse}
                        className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        {loadingSingleUse ? <Loader2 className="animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                        {loadingSingleUse ? 'Generating...' : 'Generate Single-Use Link'}
                      </button>
                   </div>
                ) : (
                   <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-start gap-3">
                         <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                         <p className="text-sm text-green-800">
                            <strong>Link Generated!</strong> This URL works for exactly one booking. Once used, it becomes invalid.
                         </p>
                      </div>

                      <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Secure URL</label>
                         <div className="flex gap-2">
                            <div className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-700 font-mono text-sm truncate">
                               {singleUseLink}
                            </div>
                            <button 
                               onClick={handleCopySingleUse}
                               className="bg-gray-900 text-white px-6 rounded-xl font-bold hover:bg-black transition-colors flex items-center gap-2"
                            >
                               {copiedSingleUse ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                               {copiedSingleUse ? 'Copied' : 'Copy'}
                            </button>
                         </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100 text-center">
                         <button 
                           onClick={handleGenerateSingleUse}
                           className="text-purple-600 text-sm font-semibold hover:text-purple-700 flex items-center justify-center gap-1"
                         >
                            <RefreshCw className="h-3 w-3" /> Generate a different link
                         </button>
                      </div>
                   </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold mb-4">{isEditing ? 'Edit Event Type' : 'Add Event Type'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Color Theme</label>
                 <select 
                    value={formData.color} 
                    onChange={e => setFormData({...formData, color: e.target.value})}
                    className="w-full p-2 border rounded-lg bg-white"
                 >
                    <option value="purple">Purple</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="red">Red</option>
                 </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    {isEditing ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}