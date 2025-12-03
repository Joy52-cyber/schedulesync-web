import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Plus, Edit2, Trash2, Copy, Eye, Save, X,
  Loader2, Check, AlertTriangle, RefreshCw, ChevronDown
} from 'lucide-react';
import api from '../utils/api';

const TEMPLATE_TYPES = [
  { value: 'booking_confirmation_guest', label: 'Booking Confirmation (Guest)', icon: '✅' },
  { value: 'booking_confirmation_organizer', label: 'Booking Confirmation (Organizer)', icon: '📅' },
  { value: 'booking_reminder', label: 'Booking Reminder', icon: '⏰' },
  { value: 'booking_cancellation', label: 'Booking Cancellation', icon: '❌' },
  { value: 'booking_reschedule', label: 'Booking Rescheduled', icon: '🔄' },
  { value: 'team_invitation', label: 'Team Invitation', icon: '👥' },
  { value: 'payment_confirmation', label: 'Payment Confirmation', icon: '💳' },
];

const AVAILABLE_VARIABLES = [
  { name: 'attendee_name', description: 'Guest name' },
  { name: 'attendee_email', description: 'Guest email' },
  { name: 'organizer_name', description: 'Your name' },
  { name: 'organizer_email', description: 'Your email' },
  { name: 'team_name', description: 'Team name' },
  { name: 'date', description: 'Meeting date' },
  { name: 'time', description: 'Meeting time' },
  { name: 'duration', description: 'Meeting duration' },
  { name: 'start_time', description: 'Start datetime' },
  { name: 'end_time', description: 'End datetime' },
  { name: 'meeting_link', description: 'Video call link' },
  { name: 'manage_url', description: 'Booking management URL' },
  { name: 'notes', description: 'Meeting notes' },
  { name: 'cancellation_reason', description: 'Cancellation reason' },
  { name: 'old_time', description: 'Previous time (reschedule)' },
  { name: 'new_time', description: 'New time (reschedule)' },
];

export default function EmailTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  
  const [editingTemplate, setEditingTemplate] = useState({
    id: null,
    name: '',
    type: 'booking_confirmation_guest',
    subject: '',
    body: '',
    is_default: false,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await api.get('/email-templates');
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingTemplate.name || !editingTemplate.subject || !editingTemplate.body) {
      alert('Please fill in all required fields');
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
      resetEditor();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await api.delete(`/email-templates/${id}`);
      await loadTemplates();
    } catch (error) {
      alert('Failed to delete template');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await api.post(`/email-templates/${id}/duplicate`);
      await loadTemplates();
    } catch (error) {
      alert('Failed to duplicate template');
    }
  };

  const handlePreview = async () => {
    try {
      const response = await api.post('/email-templates/preview', {
        subject: editingTemplate.subject,
        body: editingTemplate.body,
      });
      setPreviewSubject(response.data.preview.subject);
      setPreviewHtml(response.data.preview.body);
      setShowPreview(true);
    } catch (error) {
      alert('Failed to generate preview');
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('This will delete all your custom templates and restore defaults. Continue?')) return;
    
    try {
      await api.post('/email-templates/reset-defaults');
      await loadTemplates();
    } catch (error) {
      alert('Failed to reset templates');
    }
  };

  const resetEditor = () => {
    setEditingTemplate({
      id: null,
      name: '',
      type: 'booking_confirmation_guest',
      subject: '',
      body: '',
      is_default: false,
    });
  };

  const openEditor = (template = null) => {
    if (template) {
      setEditingTemplate({ ...template });
    } else {
      resetEditor();
    }
    setShowEditor(true);
  };

  const insertVariable = (variable) => {
    const textarea = document.getElementById('template-body');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = editingTemplate.body;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newBody = `${before}{{${variable}}}${after}`;
      setEditingTemplate({ ...editingTemplate, body: newBody });
      
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
      }, 0);
    }
  };

  const filteredTemplates = selectedType === 'all' 
    ? templates 
    : templates.filter(t => t.type === selectedType);

  const getTypeInfo = (type) => TEMPLATE_TYPES.find(t => t.value === type) || { label: type, icon: '📧' };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-600" />
              Email Templates
            </h1>
            <p className="text-gray-600 mt-1">Customize the emails sent to you and your guests</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleResetDefaults}
              className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 flex items-center gap-2 font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Reset Defaults
            </button>
            <button
              onClick={() => openEditor()}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 font-semibold"
            >
              <Plus className="h-4 w-4" />
              New Template
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Filter by type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">All Templates</option>
              {TEMPLATE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">No templates yet</h2>
            <p className="text-gray-600 mb-6">Create your first custom email template</p>
            <button
              onClick={() => openEditor()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
            >
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const typeInfo = getTypeInfo(template.type);
              return (
                <div
                  key={template.id}
                  className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{typeInfo.icon}</span>
                        <div>
                          <h3 className="font-bold text-gray-900">{template.name}</h3>
                          <p className="text-xs text-gray-500">{typeInfo.label}</p>
                        </div>
                      </div>
                      {template.is_default && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-600 font-medium truncate">
                        Subject: {template.subject}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditor(template)}
                        className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-1"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(template.id)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTemplate.id ? 'Edit Template' : 'Create Template'}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    placeholder="My Custom Confirmation"
                    className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Template Type *
                  </label>
                  <select
                    value={editingTemplate.type}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, type: e.target.value })}
                    disabled={!!editingTemplate.id}
                    className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none disabled:bg-gray-100"
                  >
                    {TEMPLATE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  placeholder="✅ Booking Confirmed with {{organizer_name}}"
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Email Body (HTML) *
                  </label>
                  <button
                    onClick={handlePreview}
                    className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                </div>
                <textarea
                  id="template-body"
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  rows={12}
                  placeholder="<div>Your HTML email content here...</div>"
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 outline-none font-mono text-sm"
                />
              </div>

              {/* Variables Reference */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Available Variables (click to insert)</h4>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_VARIABLES.map(v => (
                    <button
                      key={v.name}
                      onClick={() => insertVariable(v.name)}
                      className="px-2 py-1 bg-white border border-blue-200 rounded text-xs font-mono hover:bg-blue-100 transition-colors"
                      title={v.description}
                    >
                      {`{{${v.name}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={editingTemplate.is_default}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, is_default: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <label htmlFor="is_default" className="text-sm text-gray-700">
                  Set as default template for this type
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="bg-gray-100 px-6 py-4 flex items-center justify-between border-b">
              <div>
                <p className="text-xs text-gray-500 font-medium">PREVIEW</p>
                <p className="font-semibold text-gray-900">{previewSubject}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div 
                className="email-preview"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}