import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  Calendar,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  CheckSquare,
  Users,
  Search,
  X,
  Loader2,
  BookOpen
} from 'lucide-react';
import api from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

export default function MeetingTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const navigate = useNavigate();
  const notify = useNotification();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/meeting-templates');
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      notify.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUseTemplate = (template) => {
    // Store template in sessionStorage and redirect to booking page
    sessionStorage.setItem('selectedTemplate', JSON.stringify(template));
    navigate('/bookings/new');
  };

  const handleDelete = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/meeting-templates/${templateId}`);
      notify.success('Template deleted successfully');
      loadTemplates();
    } catch (error) {
      notify.error('Failed to delete template');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-purple-600">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-xl font-semibold">Loading templates...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-white/50 p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Meeting Templates
                </h1>
              </div>
              <p className="text-gray-600 ml-15">
                Save time with pre-configured meeting templates
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all"
            >
              <Plus className="h-5 w-5" />
              Create Template
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-white/50 p-12 text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {searchQuery ? 'No templates found' : 'No templates yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first template to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all"
              >
                Create Your First Template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={handleUseTemplate}
                onEdit={setEditingTemplate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingTemplate) && (
          <TemplateModal
            template={editingTemplate}
            onClose={() => {
              setShowCreateModal(false);
              setEditingTemplate(null);
            }}
            onSave={() => {
              setShowCreateModal(false);
              setEditingTemplate(null);
              loadTemplates();
            }}
          />
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template, onUse, onEdit, onDelete }) {
  const isDefaultTemplate = template.id?.toString().startsWith('default-');
  const actionItemCount = template.default_action_items?.length || 0;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border-2 border-white/50 overflow-hidden hover:shadow-2xl transition-all group">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-1">{template.name}</h3>
            {template.description && (
              <p className="text-purple-100 text-sm line-clamp-2">{template.description}</p>
            )}
          </div>
          {isDefaultTemplate && (
            <div className="ml-2 px-2 py-1 bg-white/20 rounded-full">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Metadata */}
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{template.duration || 30} min</span>
          </div>
          {actionItemCount > 0 && (
            <div className="flex items-center gap-1">
              <CheckSquare className="h-4 w-4" />
              <span>{actionItemCount} action items</span>
            </div>
          )}
          {template.use_count > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>Used {template.use_count}x</span>
            </div>
          )}
        </div>

        {/* Agenda Preview */}
        {template.pre_agenda && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-1">Agenda Preview:</p>
            <p className="text-sm text-gray-600 line-clamp-3">
              {template.pre_agenda.substring(0, 150)}...
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onUse(template)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all"
          >
            <Calendar className="h-4 w-4" />
            Use Template
          </button>
          {!isDefaultTemplate && (
            <>
              <button
                onClick={() => onEdit(template)}
                className="p-2 border-2 border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all"
              >
                <Edit className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={() => onDelete(template.id)}
                className="p-2 border-2 border-gray-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all"
              >
                <Trash2 className="h-4 w-4 text-gray-600" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateModal({ template, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    duration: template?.duration || 30,
    pre_agenda: template?.pre_agenda || '',
    default_action_items: template?.default_action_items || [],
    is_public: template?.is_public || false
  });
  const [saving, setSaving] = useState(false);
  const [newActionItem, setNewActionItem] = useState('');
  const notify = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      notify.error('Template name is required');
      return;
    }

    try {
      setSaving(true);
      if (template?.id) {
        await api.put(`/meeting-templates/${template.id}`, formData);
        notify.success('Template updated successfully');
      } else {
        await api.post('/meeting-templates', formData);
        notify.success('Template created successfully');
      }
      onSave();
    } catch (error) {
      notify.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const addActionItem = () => {
    if (!newActionItem.trim()) return;
    setFormData({
      ...formData,
      default_action_items: [
        ...formData.default_action_items,
        { description: newActionItem, assigned_to: 'host' }
      ]
    });
    setNewActionItem('');
  };

  const removeActionItem = (index) => {
    setFormData({
      ...formData,
      default_action_items: formData.default_action_items.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {template ? 'Edit Template' : 'Create Template'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-all"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sales Discovery Call"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this template"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          {/* Pre-Agenda */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Meeting Agenda
            </label>
            <textarea
              value={formData.pre_agenda}
              onChange={(e) => setFormData({ ...formData, pre_agenda: e.target.value })}
              placeholder="Enter meeting agenda (supports markdown)..."
              rows={8}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tip: Use markdown for formatting (**bold**, - bullet points)
            </p>
          </div>

          {/* Default Action Items */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Default Action Items
            </label>
            <div className="space-y-2 mb-3">
              {formData.default_action_items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-purple-50 border-2 border-purple-100 rounded-lg"
                >
                  <CheckSquare className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <span className="flex-1 text-sm">{item.description}</span>
                  <button
                    type="button"
                    onClick={() => removeActionItem(index)}
                    className="p-1 hover:bg-purple-200 rounded transition-all"
                  >
                    <X className="h-4 w-4 text-purple-600" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newActionItem}
                onChange={(e) => setNewActionItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addActionItem())}
                placeholder="Add action item..."
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={addActionItem}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Public Toggle */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              id="is_public"
              checked={formData.is_public}
              onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
              className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="is_public" className="text-sm text-gray-700">
              Make this template public (visible to all team members)
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </span>
              ) : (
                template ? 'Update Template' : 'Create Template'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
