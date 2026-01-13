import { useState, useEffect } from 'react';
import { useUpgrade } from '../context/UpgradeContext';
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
  Target,
  Lightbulb,
  Wand2,
  Check,
  Crown,
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
  { key: 'manageLink', label: 'Manage Booking Link' },
  { key: 'bookingLink', label: 'Book Again Link' },
];

// Tone options for AI generation
const TONE_OPTIONS = [
  { id: 'professional', label: 'Professional', emoji: '💼' },
  { id: 'professional but friendly', label: 'Professional & Friendly', emoji: '😊' },
  { id: 'casual', label: 'Casual', emoji: '👋' },
  { id: 'warm', label: 'Warm', emoji: '🤗' },
  { id: 'formal', label: 'Formal', emoji: '🎩' },
];

// Default templates - one per auto-sent type (confirmation, reminder, cancellation, reschedule)
const DEFAULT_TEMPLATES = [
  {
    id: 'default_confirmation',
    name: 'Meeting Confirmed',
    type: 'confirmation',
    subject: 'Your meeting is confirmed - {{meetingDate}}',
    body: `Hi {{guestName}},

Your meeting has been confirmed!

Date: {{meetingDate}}
Time: {{meetingTime}}
Meeting Link: {{meetingLink}}

To reschedule or cancel: {{manageLink}}

See you soon!
{{organizerName}}`,
    is_default: true,
  },
  {
    id: 'default_reminder',
    name: 'Meeting Reminder',
    type: 'reminder',
    subject: 'Reminder: Meeting tomorrow with {{organizerName}}',
    body: `Hi {{guestName}},

Friendly reminder about your upcoming meeting.

Date: {{meetingDate}}
Time: {{meetingTime}}
Meeting Link: {{meetingLink}}

See you soon!
{{organizerName}}`,
    is_default: true,
  },
  {
    id: 'default_cancellation',
    name: 'Meeting Cancelled',
    type: 'cancellation',
    subject: 'Meeting cancelled - {{meetingDate}}',
    body: `Hi {{guestName}},

Your meeting on {{meetingDate}} at {{meetingTime}} has been cancelled.

To book a new time: {{bookingLink}}

{{organizerName}}`,
    is_default: true,
  },
  {
    id: 'default_reschedule',
    name: 'Meeting Rescheduled',
    type: 'reschedule',
    subject: 'Meeting rescheduled - {{meetingDate}}',
    body: `Hi {{guestName}},

Your meeting has been rescheduled.

New Date: {{meetingDate}}
New Time: {{meetingTime}}
Meeting Link: {{meetingLink}}

To make changes: {{manageLink}}

{{organizerName}}`,
    is_default: true,
  },
];

export default function EmailTemplates() {
  const { showUpgradeModal, hasProFeature, currentTier, loading: tierLoading } = useUpgrade();
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
  
  // AI Generation
  const [editorMode, setEditorMode] = useState('manual'); // 'manual' or 'ai'
  const [generating, setGenerating] = useState(false);
  const [generatorForm, setGeneratorForm] = useState({
    description: '',
    type: 'other',
    tone: 'professional but friendly'
  });
  
  // Smart suggestions
  const [smartSuggestions, setSmartSuggestions] = useState([]);

  useEffect(() => {
    if (hasProFeature()) {
      loadTemplates();
      loadSmartSuggestions();
    } else {
      setLoading(false);
    }
  }, [hasProFeature]);

  // ========================================
  // PRO FEATURE GATE
  // ========================================
 if (tierLoading) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
}
  
  if (!hasProFeature()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border-2 border-purple-200">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="h-10 w-10 text-white" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Email Templates
            </h1>
            
            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
              Create beautiful, personalized email templates for confirmations, 
              reminders, follow-ups, and more.
            </p>

            <div className="bg-purple-50 rounded-2xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-purple-900 mb-4">What you get with Pro:</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  Unlimited custom email templates
                </li>
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  AI-powered template generation
                </li>
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  Smart personalization variables
                </li>
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  Template analytics & effectiveness tracking
                </li>
                <li className="flex items-center gap-3 text-purple-800">
                  <Check className="h-5 w-5 text-purple-600" />
                  Works with AI scheduling assistant
                </li>
              </ul>
            </div>

            <button
              onClick={() => showUpgradeModal('templates')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg flex items-center gap-2 mx-auto"
            >
              <Crown className="h-5 w-5" />
              Upgrade to Pro - $12/month
            </button>
            
            <p className="text-sm text-gray-500 mt-4">
              Currently on: <span className="font-medium capitalize">{currentTier}</span> plan
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // REST OF COMPONENT (Pro users only)
  // ========================================

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

  // Load context-aware smart suggestions
  const loadSmartSuggestions = async () => {
    try {
      const timeOfDay = new Date().getHours();

      // Simple smart suggestion logic based on time of day
      const suggestions = [];

      if (timeOfDay >= 9 && timeOfDay <= 11) {
        // Morning - suggest reminders
        suggestions.push({
          template: DEFAULT_TEMPLATES.find(t => t.type === 'reminder'),
          reason: 'Perfect timing for meeting reminders',
        });
      }

      // Always suggest confirmation template
      suggestions.push({
        template: DEFAULT_TEMPLATES.find(t => t.type === 'confirmation'),
        reason: 'Most commonly used template',
      });

      // Filter out any undefined templates and limit to 2
      setSmartSuggestions(suggestions.filter(s => s.template).slice(0, 2));
    } catch (error) {
      console.error('Failed to load smart suggestions:', error);
    }
  };

  // Generate template with AI
  const generateTemplate = async () => {
    if (!generatorForm.description.trim()) {
      alert('Please describe the template you want to create');
      return;
    }

    setGenerating(true);
    try {
      const response = await api.post('/ai/generate-template', generatorForm);
      const aiTemplate = response.data.template;

      // Populate the editor with generated template
      setEditingTemplate({
        ...aiTemplate,
        id: null,
        is_default: false,
        is_favorite: false,
        generated_by_ai: true,
      });

      // Switch to manual mode to show the populated fields
      setEditorMode('manual');

      // Reset the generator form
      setGeneratorForm({
        description: '',
        type: 'other',
        tone: 'professional but friendly',
      });
    } catch (error) {
      console.error('AI generation failed:', error);
      alert(error.response?.data?.error || 'Failed to generate template');
    } finally {
      setGenerating(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      searchQuery === '' ||
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
    const template = templates.find((t) => t.id === templateId);
    
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId ? { ...t, is_favorite: !t.is_favorite } : t
      )
    );
    
    // Save to API if user template
    if (template && !template.is_default) {
      try {
        await api.patch(`/email-templates/${templateId}/favorite`);
      } catch (error) {
        console.error('Failed to update favorite:', error);
      }
    }
  };

  const openEditor = (template = null, mode = 'manual') => {
    if (template) {
      // Editing existing or duplicating default
      setEditingTemplate({
        ...template,
        id: template.is_default ? null : template.id,
        name: template.is_default ? `${template.name} (My Version)` : template.name,
        is_default: false,
      });
      setEditorMode('manual'); // Always manual when editing existing
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
      setEditorMode(mode);
      // Reset generator form when opening in AI mode
      if (mode === 'ai') {
        setGeneratorForm({
          description: '',
          type: 'other',
          tone: 'professional but friendly',
        });
      }
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
    const newBody =
      text.substring(0, start) + `{{${varKey}}}` + text.substring(end);
    
    setEditingTemplate({ ...editingTemplate, body: newBody });
    
    setTimeout(() => {
      textarea.focus();
      const newPos = start + varKey.length + 4;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const getTypeEmoji = (type) => {
    return TEMPLATE_TYPES.find((t) => t.id === type)?.emoji || '📧';
  };

  const previewWithSampleData = (template) => {
    const sampleData = {
      guestName: 'John Smith',
      guestEmail: 'john@example.com',
      organizerName: 'You',
      meetingDate: 'Monday, Jan 20, 2025',
      meetingTime: '2:00 PM',
      meetingLink: 'https://meet.google.com/abc-xyz',
      manageLink: 'https://trucal.xyz/manage/abc123',
      bookingLink: 'https://trucal.xyz/book/you',
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

        {/* AI Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Smart Suggestions */}
          {smartSuggestions.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-900 mb-2">
                    🎯 Recommended for you:
                  </p>
                  <div className="space-y-2">
                    {smartSuggestions.map((suggestion, i) => (
                      <div
                        key={i}
                        className="bg-white p-2 rounded-lg border border-green-200"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-900">
                              {suggestion.template?.name}
                            </p>
                            <p className="text-xs text-green-700">
                              {suggestion.reason}
                            </p>
                          </div>
                          <button
                            onClick={() => openEditor(suggestion.template)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Integration Info */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-purple-900">
                  How it works with AI
                </p>
                <p className="text-sm text-purple-700 mt-1">
                  Say:{' '}
                  <span className="font-mono bg-white px-2 py-0.5 rounded">
                    "Send John a friendly reminder"
                  </span>
                  <br />
                  Your AI picks the best template automatically!
                </p>
              </div>
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
            {TEMPLATE_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.emoji} {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Templates List */}
        {sortedTemplates.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No templates found</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => openEditor(null, 'ai')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium"
              >
                ✨ Generate with AI
              </button>
              <button
                onClick={() => openEditor()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
              >
                Create Manual
              </button>
            </div>
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
                  <div className="text-2xl">
                    {getTypeEmoji(template.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {template.name}
                      </h3>
                      {template.is_default && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          Built-in
                        </span>
                      )}
                      {template.generated_by_ai && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full flex items-center gap-1">
                          <Wand2 className="h-3 w-3" />
                          AI
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {template.subject}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleFavorite(template.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title={
                        template.is_favorite
                          ? 'Remove from favorites'
                          : 'Add to favorites'
                      }
                    >
                      <Star
                        className={`h-5 w-5 ${
                          template.is_favorite
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-400'
                        }`}
                      />
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
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {editingTemplate.generated_by_ai && (
                  <Wand2 className="h-5 w-5 text-purple-600" />
                )}
                {editingTemplate.id ? 'Edit Template' : 'New Template'}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Mode Toggle - Only show when creating new template */}
              {!editingTemplate.id && !editingTemplate.generated_by_ai && (
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-1 flex">
                  <button
                    onClick={() => setEditorMode('manual')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      editorMode === 'manual'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Edit2 className="h-4 w-4" />
                    Start from scratch
                  </button>
                  <button
                    onClick={() => setEditorMode('ai')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      editorMode === 'ai'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate with AI
                  </button>
                </div>
              )}

              {/* AI Generated Banner */}
              {editingTemplate.generated_by_ai && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <p className="text-sm font-medium text-purple-900">
                      Generated by AI - Feel free to customize as needed!
                    </p>
                  </div>
                </div>
              )}

              {/* AI Generation Form */}
              {editorMode === 'ai' && !editingTemplate.id && !editingTemplate.generated_by_ai && (
                <div className="space-y-5">
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Describe your template *
                    </label>
                    <textarea
                      value={generatorForm.description}
                      onChange={(e) =>
                        setGeneratorForm({
                          ...generatorForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="e.g., Professional follow-up for sales meetings with warm tone"
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Be specific about purpose, tone, and style
                    </p>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Template Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TEMPLATE_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() =>
                            setGeneratorForm({ ...generatorForm, type: type.id })
                          }
                          className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            generatorForm.type === type.id
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {type.emoji} {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tone
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TONE_OPTIONS.map((tone) => (
                        <button
                          key={tone.id}
                          onClick={() =>
                            setGeneratorForm({ ...generatorForm, tone: tone.id })
                          }
                          className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            generatorForm.tone === tone.id
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {tone.emoji} {tone.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={generateTemplate}
                    disabled={generating || !generatorForm.description.trim()}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Sparkles className="h-5 w-5" />
                    )}
                    {generating ? 'Generating...' : 'Generate Template'}
                  </button>
                </div>
              )}

              {/* Manual Form Fields - Show when in manual mode OR when editing */}
              {(editorMode === 'manual' || editingTemplate.id || editingTemplate.generated_by_ai) && (
                <>
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          name: e.target.value,
                        })
                      }
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
                      {TEMPLATE_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() =>
                            setEditingTemplate({
                              ...editingTemplate,
                              type: type.id,
                            })
                          }
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
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          subject: e.target.value,
                        })
                      }
                      placeholder="e.g., Reminder about our meeting tomorrow"
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
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          body: e.target.value,
                        })
                      }
                      rows={8}
                      placeholder="Write your email here..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none resize-none"
                    />
                  </div>

                  {/* Variables */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Insert Variables (click to add)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {VARIABLES.map((v) => (
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
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              {/* Only show Save button when in manual mode or editing existing template */}
              {(editorMode === 'manual' || editingTemplate.id || editingTemplate.generated_by_ai) && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              )}
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
                <p className="font-semibold text-gray-900">
                  {previewTemplate.name}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  SUBJECT
                </p>
                <p className="text-gray-900 font-medium">
                  {previewTemplate.subject}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  BODY
                </p>
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-800 text-sm">
                  {previewTemplate.body}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => {
                  setShowPreview(false);
                  const originalTemplate = templates.find(
                    (t) =>
                      t.id === previewTemplate.id ||
                      t.name === previewTemplate.name
                  );
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