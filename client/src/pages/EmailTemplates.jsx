import { useState, useEffect } from 'react';
import {
  Mail,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  Search,
  Star,
  Sparkles,
  FileText,
  Bot,
  Eye,
} from 'lucide-react';
import api from '../utils/api';

// Template Types - Simple and focused
const TEMPLATE_TYPES = [
  { id: 'reminder', label: 'Reminder', emoji: '⏰' },
  { id: 'confirmation', label: 'Confirmation', emoji: '✅' },
  { id: 'follow_up', label: 'Follow-up', emoji: '👋' },
  { id: 'reschedule', label: 'Reschedule', emoji: '🔄' },
  { id: 'cancellation', label: 'Cancellation', emoji: '❌' },
  { id: 'other', label: 'Other', emoji: '📧' },
];

// Available Variables for personalization
const VARIABLES = [
  { key: 'guestName', label: 'Guest Name' },
  { key: 'guestEmail', label: 'Guest Email' },
  { key: 'organizerName', label: 'Your Name' },
  { key: 'meetingDate', label: 'Meeting Date' },
  { key: 'meetingTime', label: 'Meeting Time' },
  { key: 'meetingLink', label: 'Meeting Link' },
  { key: 'bookingLink', label: 'Booking Link' },
];

// Default starter templates
const DEFAULT_TEMPLATES = [
  {
    id: 'default_1',
    name: 'Friendly Reminder',
    type: 'reminder',
    subject: 'Quick reminder: We meet tomorrow! 👋',
    body: `Hey {{guestName}}!

Just a friendly heads up – we're scheduled to meet tomorrow!

📅 {{meetingDate}} at {{meetingTime}}
🔗 {{meetingLink}}

Looking forward to it!

{{organizerName}}`,
    is_default: true,
    is_favorite: true,
  },
  {
    id: 'default_2',
    name: 'Professional Reminder',
    type: 'reminder',
    subject: 'Reminder: Upcoming meeting on {{meetingDate}}',
    body: `Dear {{guestName}},

This is a reminder about your upcoming meeting.

Date: {{meetingDate}}
Time: {{meetingTime}}
Meeting Link: {{meetingLink}}

Best regards,
{{organizerName}}`,
    is_default: true,
    is_favorite: false,
  },
  {
    id: 'default_3',
    name: 'Thank You Follow-up',
    type: 'follow_up',
    subject: 'Great talking with you! 🙌',
    body: `Hi {{guestName}},

Thank you for taking the time to meet with me today! I really enjoyed our conversation.

If you need anything else, feel free to book another time: {{bookingLink}}

Talk soon!
{{organizerName}}`,
    is_default: true,
    is_favorite: false,
  },
  {
    id: 'default_4',
    name: 'Meeting Confirmed',
    type: 'confirmation',
    subject: 'Your meeting is confirmed! ✅',
    body: `Hi {{guestName}},

Great news! Your meeting has been confirmed.

📅 {{meetingDate}}
🕐 {{meetingTime}}
🔗 {{meetingLink}}

See you soon!
{{organizerName}}`,
    is_default: true,
    is_favorite: false,
  },
  {
    id: 'default_5',
    name: 'Need to Reschedule',
    type: 'reschedule',
    subject: 'Can we reschedule?',
    body: `Hi {{guestName}},

I'm sorry, but I need to reschedule our meeting on {{meetingDate}}.

Please pick a new time that works for you: {{bookingLink}}

Apologies for any inconvenience!
{{organizerName}}`,
    is_default: true,
    is_favorite: false,
  },
];

export default function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  // Editor
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await api.get('/email-templates');
      const userTemplates = response.data.templates || [];
      
      // Combine defaults with user templates
      const allTemplates = [
        ...DEFAULT_TEMPLATES,
        ...userTemplates.map(t => ({ ...t, is_default: false }))
      ];
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates(DEFAULT_TEMPLATES);
    } finally {
      setLoading(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = searchQuery === '' || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  // Sort: favorites first, then by name
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return a.name.localeCompare(b.name);
  });

  const toggleFavorite = async (templateId) => {
    const template = templates.find(t => t.id === templateId);
    
    setTemplates(prev => prev.map(t => 
      t.id === templateId ? { ...t, is_favorite: !t.is_favorite } : t
    ));
    
    // Save to API if user template
    if (template && !template.is_default) {
      try {
        await api.patch(`/email-templates/${templateId}/favorite`);
      } catch (error) {
        console.error('Failed to update favorite:', error);
      }
    }
  };

  const openEditor = (template = null) => {
    if (template) {
      // Editing existing or duplicating default
      setEditingTemplate({ 
        ...template, 
        id: template.is_default ? null : template.id,
        name: template.is_default ? `${template.name} (My Version)` : template.name,
        is_default: false 
      });
    } else {
      // New template
      setEditingTemplate({
        id: null,
        name: '',
        type: 'other',
        subject: '',
        body: '',
        is_favorite: false,
      });
    }
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!editingTemplate.name || !editingTemplate.subject || !editingTemplate.body) {
      alert('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate.id) {
        await api.put(`/email-templates/${editingTemplate.id}`, editingTemplate);
      } else {
        await api.post('/email-templates', editingTemplate);
      }
      await loadTemplates();
      setShowEditor(false);
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    
    try {
      await api.delete(`/email-templates/${id}`);
      await loadTemplates();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const insertVariable = (varKey) => {
    const textarea = document.getElementById('template-body');
    if (!textarea || !editingTemplate) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingTemplate.body;
    const newBody = text.substring(0, start) + `{{${varKey}}}` + text.substring(end);
    
    setEditingTemplate({ ...editingTemplate, body: newBody });
    
    setTimeout(() => {
      textarea.focus();
      const newPos = start + varKey.length + 4;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const getTypeEmoji = (type) => {
    return TEMPLATE_TYPES.find(t => t.id === type)?.emoji || '📧';
  };

  const previewWithSampleData = (template) => {
    const sampleData = {
      guestName: 'John Smith',
      guestEmail: 'john@example.com',
      organizerName: 'You',
      meetingDate: 'Monday, Jan 20, 2025',
      meetingTime: '2:00 PM',
      meetingLink: 'https://meet.google.com/abc-xyz',
      bookingLink: 'https://schedulesync.app/book/you',
    };
    
    let subject = template.subject;
    let body = template.body;
    
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });
    
    setPreviewTemplate({ ...template, subject, body });
    setShowPreview(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-600" />
              Email Templates
            </h1>
            <p className="text-gray-600 mt-1 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Your AI assistant uses these when sending emails
            </p>
          </div>
          <button
            onClick={() => openEditor()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 font-semibold shadow-sm"
          >
            <Plus className="h-5 w-5" />
            New Template
          </button>
        </div>

        {/* AI Tip */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-purple-900">How it works with AI</p>
              <p className="text-sm text-purple-700 mt-1">
                Say: <span className="font-mono bg-white px-2 py-0.5 rounded">"Send John a friendly reminder about tomorrow"</span>
                <br />
                Your AI will use your "Friendly Reminder" template automatically!
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none bg-white"
          >
            <option value="all">All Types</option>
            {TEMPLATE_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.emoji} {type.label}</option>
            ))}
          </select>
        </div>

        {/* Templates List */}
        {sortedTemplates.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No templates found</p>
            <button
              onClick={() => openEditor()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
            >
              Create One
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-xl border-2 border-gray-100 hover:border-blue-200 transition-all overflow-hidden"
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Emoji & Name */}
                  <div className="text-2xl">{getTypeEmoji(template.type)}</div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                      {template.is_default && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          Built-in
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{template.subject}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleFavorite(template.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title={template.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className={`h-5 w-5 ${template.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                    </button>
                    <button
                      onClick={() => previewWithSampleData(template)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Preview"
                    >
                      <Eye className="h-5 w-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => openEditor(template)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title={template.is_default ? 'Duplicate & Edit' : 'Edit'}
                    >
                      <Edit2 className="h-5 w-5 text-gray-500" />
                    </button>
                    {!template.is_default && (
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingTemplate.id ? 'Edit Template' : 'New Template'}
              </h2>
              <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  placeholder="e.g., Friendly Reminder"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setEditingTemplate({ ...editingTemplate, type: type.id })}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        editingTemplate.type === type.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {type.emoji} {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  placeholder="e.g., Quick reminder about tomorrow! 👋"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Body *
                </label>
                <textarea
                  id="template-body"
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  rows={8}
                  placeholder="Write your email here..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none resize-none"
                />
              </div>

              {/* Variables */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Insert Variables (click to add)
                </p>
                <div className="flex flex-wrap gap-2">
                  {VARIABLES.map(v => (
                    <button
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:bg-blue-50 hover:border-blue-300 transition-all"
                    >
                      <span className="font-mono text-blue-600">{`{{${v.key}}}`}</span>
                      <span className="text-gray-400 ml-1">({v.label})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 flex items-center justify-between border-b">
              <div>
                <p className="text-xs text-gray-500">Preview</p>
                <p className="font-semibold text-gray-900">{previewTemplate.name}</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-1">SUBJECT</p>
                <p className="text-gray-900 font-medium">{previewTemplate.subject}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">BODY</p>
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-800 text-sm">
                  {previewTemplate.body}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => {
                  setShowPreview(false);
                  const originalTemplate = templates.find(t => t.id === previewTemplate.id || t.name === previewTemplate.name);
                  if (originalTemplate) openEditor(originalTemplate);
                }}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
              >
                Edit This Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}