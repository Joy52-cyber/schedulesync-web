import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  MapPin,
  FileText,
  Loader2,
  Save,
  Link as LinkIcon,
  Palette
} from 'lucide-react';
import { events } from '../utils/api';

export default function EventTypeForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '', // URL identifier
    description: '',
    duration: 30,
    location: '',
    color: 'blue', // Visual distinction
    is_active: true
  });

  const colors = [
    { name: 'blue', hex: 'bg-blue-500' },
    { name: 'purple', hex: 'bg-purple-500' },
    { name: 'green', hex: 'bg-green-500' },
    { name: 'red', hex: 'bg-red-500' },
    { name: 'orange', hex: 'bg-orange-500' },
    { name: 'gray', hex: 'bg-gray-500' },
  ];

  useEffect(() => {
    if (isEditing) {
      if (location.state?.event) {
        populateForm(location.state.event);
      } else {
        loadEventTypeFromList();
      }
    }
  }, [id]);

  const populateForm = (event) => {
    setFormData({
      title: event.title || event.name || '',
      slug: event.slug || '',
      description: event.description || '',
      duration: event.duration || 30,
      location: event.location || '',
      color: event.color || 'blue',
      is_active: event.is_active !== false
    });
  };

  const loadEventTypeFromList = async () => {
    setLoading(true);
    try {
      const response = await events.getAll();
      const list = response.data.event_types || response.data || [];
      const event = list.find(e => String(e.id) === String(id));
      
      if (event) {
        populateForm(event);
      } else {
        alert('Event type not found');
        navigate('/events');
      }
    } catch (error) {
      console.error('Failed to load event type:', error);
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate slug from title if slug is empty
  const handleTitleChange = (e) => {
    const title = e.target.value;
    // If slug was empty or matched the old title slugified, update it
    if (!formData.slug || formData.slug === slugify(formData.title)) {
      setFormData(prev => ({ ...prev, title, slug: slugify(title) }));
    } else {
      setFormData(prev => ({ ...prev, title }));
    }
  };

  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/[^\w-]+/g, '')  // Remove non-word chars
      .replace(/--+/g, '-');    // Replace multiple - with single -
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return alert('Event name is required');
    if (!formData.slug.trim()) return alert('URL Slug is required');
    
    setSaving(true);
    try {
      const payload = {
        ...formData,
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        location: formData.location.trim(),
      };

      if (isEditing) {
        await events.update(id, payload);
      } else {
        await events.create(payload);
      }
      navigate('/events');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button onClick={() => navigate('/events')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{isEditing ? 'Edit Event Type' : 'Create Event Type'}</h1>
        <p className="text-gray-600 mt-2">Define the rules and settings for this meeting template.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        
        {/* Title & Slug Section */}
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 text-gray-400" /> Event Name *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={handleTitleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 15 Minute Discovery Call"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <LinkIcon className="h-4 w-4 text-gray-400" /> URL Slug *
            </label>
            <div className="flex items-center">
              <span className="px-4 py-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-xl text-gray-500 text-sm">
                /
              </span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: slugify(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-r-xl focus:ring-2 focus:ring-blue-500"
                placeholder="discovery-call"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">This will be the link you share with invitees.</p>
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Palette className="h-4 w-4 text-gray-400" /> Event Color
          </label>
          <div className="flex gap-3">
            {colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setFormData({ ...formData, color: c.name })}
                className={`w-8 h-8 rounded-full ${c.hex} transition-all ${
                  formData.color === c.name ? 'ring-4 ring-offset-2 ring-gray-200 scale-110' : 'hover:scale-105'
                }`}
                aria-label={`Select ${c.name}`}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 my-4"></div>

        {/* Duration & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Clock className="h-4 w-4 text-gray-400" /> Duration *
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>1.5 hrs</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MapPin className="h-4 w-4 text-gray-400" /> Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Google Meet"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Instructions for your invitee..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <button type="button" onClick={() => navigate('/events')} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <><Save className="h-5 w-5" /> Save Event Type</>}
          </button>
        </div>
      </form>
    </div>
  );
}