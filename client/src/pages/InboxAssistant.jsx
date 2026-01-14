import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function InboxAssistant() {
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [newEmail, setNewEmail] = useState({ from_email: '', from_name: '', subject: '', body_text: '' });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emailsRes, draftsRes, statsRes] = await Promise.all([
        api.get(`/inbox/emails?status=${activeTab === 'all' ? '' : activeTab}`),
        api.get('/inbox/drafts'),
        api.get('/inbox/stats')
      ]);
      setEmails(emailsRes.data.emails || []);
      setDrafts(draftsRes.data.drafts || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch inbox data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inbox/emails', newEmail);
      setShowAddEmail(false);
      setNewEmail({ from_email: '', from_name: '', subject: '', body_text: '' });
      fetchData();
    } catch (error) {
      console.error('Failed to add email:', error);
      alert('Failed to process email');
    }
  };

  const handleApproveDraft = async (draftId) => {
    try {
      await api.post(`/inbox/drafts/${draftId}/approve`);
      fetchData();
      setSelectedDraft(null);
    } catch (error) {
      console.error('Failed to approve draft:', error);
      alert('Failed to send response');
    }
  };

  const handleRejectDraft = async (draftId) => {
    try {
      await api.post(`/inbox/drafts/${draftId}/reject`);
      fetchData();
      setSelectedDraft(null);
    } catch (error) {
      console.error('Failed to reject draft:', error);
    }
  };

  const handleSaveDraftEdit = async () => {
    if (!editingDraft) return;
    try {
      await api.put(`/inbox/drafts/${editingDraft.id}`, {
        body_text: editingDraft.body_text,
        subject: editingDraft.subject
      });
      fetchData();
      setEditingDraft(null);
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  const handleIgnoreEmail = async (emailId) => {
    try {
      await api.put(`/inbox/emails/${emailId}/status`, { status: 'ignored' });
      fetchData();
      setSelectedEmail(null);
    } catch (error) {
      console.error('Failed to ignore email:', error);
    }
  };

  const handleReanalyze = async (emailId) => {
    try {
      await api.post(`/inbox/emails/${emailId}/analyze`);
      fetchData();
    } catch (error) {
      console.error('Failed to reanalyze email:', error);
    }
  };

  const getIntentBadge = (intent, confidence) => {
    const colors = {
      schedule_meeting: 'bg-green-100 text-green-800',
      reschedule: 'bg-yellow-100 text-yellow-800',
      cancel: 'bg-red-100 text-red-800',
      inquiry: 'bg-blue-100 text-blue-800',
      none: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      schedule_meeting: 'Schedule',
      reschedule: 'Reschedule',
      cancel: 'Cancel',
      inquiry: 'Inquiry',
      none: 'No Action'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[intent] || colors.none}`}>
        {labels[intent] || intent} {confidence ? `(${Math.round(confidence * 100)}%)` : ''}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      draft_created: 'bg-blue-100 text-blue-800',
      responded: 'bg-green-100 text-green-800',
      ignored: 'bg-gray-100 text-gray-800',
      manual: 'bg-purple-100 text-purple-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inbox Assistant</h1>
              <p className="text-gray-500 mt-1">AI-powered email response management</p>
            </div>
            <button
              onClick={() => setShowAddEmail(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              + Add Email
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-yellow-600">{stats.emails?.pending || 0}</div>
              <div className="text-sm text-gray-500">Pending Review</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-blue-600">{stats.emails?.drafts_ready || 0}</div>
              <div className="text-sm text-gray-500">Drafts Ready</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-green-600">{stats.emails?.responded || 0}</div>
              <div className="text-sm text-gray-500">Responded</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-purple-600">{stats.emails?.scheduling_requests || 0}</div>
              <div className="text-sm text-gray-500">Scheduling Requests</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {['pending', 'draft_created', 'responded', 'all'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'draft_created' ? 'Drafts Ready' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email List */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Incoming Emails</h2>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : emails.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">
                    <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p>No emails in this category</p>
                  <button
                    onClick={() => setShowAddEmail(true)}
                    className="mt-4 text-purple-600 hover:text-purple-700"
                  >
                    Add an email manually
                  </button>
                </div>
              ) : (
                emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                      selectedEmail?.id === email.id ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-gray-900 truncate">
                        {email.from_name || email.from_email}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(email.received_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 truncate mb-2">{email.subject}</div>
                    <div className="flex gap-2 items-center">
                      {getIntentBadge(email.detected_intent, email.intent_confidence)}
                      {getStatusBadge(email.status)}
                      {email.priority === 'high' && (
                        <span className="text-red-500 text-xs font-medium">HIGH</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Email Detail / Draft Editor */}
          <div className="bg-white rounded-lg shadow-sm border">
            {selectedEmail ? (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="font-semibold text-gray-900">Email Details</h2>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    x
                  </button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                  <div className="mb-4">
                    <div className="text-sm text-gray-500">From</div>
                    <div className="font-medium">{selectedEmail.from_name || selectedEmail.from_email}</div>
                    <div className="text-sm text-gray-500">{selectedEmail.from_email}</div>
                  </div>
                  <div className="mb-4">
                    <div className="text-sm text-gray-500">Subject</div>
                    <div className="font-medium">{selectedEmail.subject}</div>
                  </div>
                  <div className="mb-4">
                    <div className="text-sm text-gray-500">Content</div>
                    <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {selectedEmail.body_text}
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-2">AI Analysis</div>
                    <div className="flex gap-2 flex-wrap">
                      {getIntentBadge(selectedEmail.detected_intent, selectedEmail.intent_confidence)}
                      {selectedEmail.extracted_data?.mentioned_times && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                          Times mentioned: {selectedEmail.extracted_data.mentioned_times.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Draft Preview */}
                  {selectedEmail.draft_id && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-sm font-medium text-green-800 mb-2">AI Draft Response Ready</div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap mb-4">
                        {selectedEmail.draft_body?.substring(0, 200)}...
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveDraft(selectedEmail.draft_id)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Approve & Send
                        </button>
                        <button
                          onClick={() => {
                            setEditingDraft({ id: selectedEmail.draft_id, body_text: selectedEmail.draft_body, subject: `Re: ${selectedEmail.subject}` });
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRejectDraft(selectedEmail.draft_id)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t flex gap-2">
                  <button
                    onClick={() => handleReanalyze(selectedEmail.id)}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Re-analyze
                  </button>
                  <button
                    onClick={() => handleIgnoreEmail(selectedEmail.id)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 p-8">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-lg font-medium">Select an email to view details</p>
                  <p className="text-sm mt-2">AI will analyze scheduling intent and generate draft responses</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pending Drafts Section */}
        {drafts.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Pending Draft Responses ({drafts.length})</h2>
            </div>
            <div className="divide-y">
              {drafts.map((draft) => (
                <div key={draft.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">To: {draft.to_name || draft.to_email}</div>
                      <div className="text-sm text-gray-500">{draft.subject}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(draft.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap mb-3 max-h-32 overflow-y-auto">
                    {draft.body_text}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveDraft(draft.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Approve & Send
                    </button>
                    <button
                      onClick={() => setEditingDraft(draft)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRejectDraft(draft.id)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Email Modal */}
      {showAddEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Email for Analysis</h3>
            <form onSubmit={handleAddEmail}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Email *</label>
                  <input
                    type="email"
                    required
                    value={newEmail.from_email}
                    onChange={(e) => setNewEmail({ ...newEmail, from_email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="sender@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                  <input
                    type="text"
                    value={newEmail.from_name}
                    onChange={(e) => setNewEmail({ ...newEmail, from_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    value={newEmail.subject}
                    onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Meeting request"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Body *</label>
                  <textarea
                    required
                    rows={5}
                    value={newEmail.body_text}
                    onChange={(e) => setNewEmail({ ...newEmail, body_text: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Hi, I'd like to schedule a meeting to discuss..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddEmail(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Analyze Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Draft Modal */}
      {editingDraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Draft Response</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={editingDraft.subject}
                  onChange={(e) => setEditingDraft({ ...editingDraft, subject: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Response</label>
                <textarea
                  rows={10}
                  value={editingDraft.body_text}
                  onChange={(e) => setEditingDraft({ ...editingDraft, body_text: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingDraft(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDraftEdit}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
