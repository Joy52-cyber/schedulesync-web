import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUpgrade } from '../context/UpgradeContext';
import {
  Mail,
  Sparkles,
  Loader2,
  Send,
  Link,
  Calendar,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Crown,
  MessageSquare,
  ArrowRight,
  User,
  CalendarDays,
  Inbox,
  FileText,
  Zap,
  X,
  RefreshCw,
  Edit3,
  CheckCircle,
  XCircle,
  Plus,
  Settings,
  Unplug
} from 'lucide-react';
import api from '../utils/api';

// Intent info for Quick Paste analysis
const INTENT_INFO = {
  request_meeting: { label: 'Meeting Request', color: 'blue', icon: Calendar },
  schedule_meeting: { label: 'Meeting Request', color: 'blue', icon: Calendar },
  propose_time: { label: 'Time Proposal', color: 'green', icon: Clock },
  confirm: { label: 'Confirmation', color: 'emerald', icon: Check },
  reschedule: { label: 'Reschedule Request', color: 'orange', icon: CalendarDays },
  cancel: { label: 'Cancellation', color: 'red', icon: AlertCircle },
  inquiry: { label: 'Inquiry', color: 'purple', icon: MessageSquare },
  none: { label: 'No Action', color: 'gray', icon: Mail }
};

export default function InboxAssistant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasProFeature, showUpgradeModal } = useUpgrade();

  // Email integration connections state
  const [emailConnections, setEmailConnections] = useState([]);
  const [detectedEmails, setDetectedEmails] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showConnectPanel, setShowConnectPanel] = useState(false);

  // Main inbox state
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

  // Quick Paste state
  const [quickPasteMode, setQuickPasteMode] = useState(false);
  const [pastedEmail, setPastedEmail] = useState('');
  const [quickAnalysis, setQuickAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [quickReply, setQuickReply] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check for connection success/error from OAuth redirect
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      // Show success message and refresh connections
      fetchEmailConnections();
    }
    if (error) {
      alert(`Failed to connect ${error.replace('_failed', '')}. Please try again.`);
    }
  }, [searchParams]);

  // Fetch email integration connections
  const fetchEmailConnections = async () => {
    try {
      const [connectionsRes, detectedRes] = await Promise.all([
        api.get('/email/connections'),
        api.get('/email/detected?status=pending')
      ]);
      setEmailConnections(connectionsRes.data.connections || []);
      setDetectedEmails(detectedRes.data.emails || []);
    } catch (error) {
      console.error('Failed to fetch email connections:', error);
    } finally {
      setConnectionsLoading(false);
    }
  };

  // Connect Gmail
  const connectGmail = async () => {
    try {
      const response = await api.get('/email/gmail/auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to start Gmail auth:', error);
      alert('Failed to connect Gmail. Please try again.');
    }
  };

  // Connect Outlook
  const connectOutlook = async () => {
    try {
      const response = await api.get('/email/outlook/auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to start Outlook auth:', error);
      alert('Failed to connect Outlook. Please try again.');
    }
  };

  // Sync emails manually
  const handleEmailSync = async () => {
    setSyncing(true);
    try {
      await api.post('/email/sync');
      await fetchEmailConnections();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Toggle monitoring for a connection
  const toggleMonitoring = async (connectionId) => {
    try {
      await api.patch(`/email/connections/${connectionId}/toggle`);
      fetchEmailConnections();
    } catch (error) {
      console.error('Failed to toggle monitoring:', error);
    }
  };

  // Disconnect email
  const disconnectEmail = async (connectionId) => {
    if (!confirm('Are you sure you want to disconnect this email account?')) return;
    try {
      await api.delete(`/email/connections/${connectionId}`);
      fetchEmailConnections();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  // Send detected email reply
  const handleDetectedReply = async (emailId, customReply = null) => {
    try {
      await api.post(`/email/detected/${emailId}/reply`, { customReply });
      fetchEmailConnections();
    } catch (error) {
      alert('Failed to send reply');
    }
  };

  // Dismiss detected email
  const handleDetectedDismiss = async (emailId) => {
    try {
      await api.post(`/email/detected/${emailId}/dismiss`);
      fetchEmailConnections();
    } catch (error) {
      console.error('Failed to dismiss:', error);
    }
  };

  useEffect(() => {
    fetchEmailConnections();
  }, []);

  useEffect(() => {
    if (!quickPasteMode) {
      fetchData();
    }
  }, [activeTab, quickPasteMode]);

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

  // Quick Paste functions
  const analyzeQuickEmail = async () => {
    if (!pastedEmail.trim()) return;

    setAnalyzing(true);
    setQuickAnalysis(null);
    setQuickReply('');

    try {
      const response = await api.post('/inbox/analyze-email', { email_text: pastedEmail });
      setQuickAnalysis(response.data);
    } catch (error) {
      console.error('Failed to analyze:', error);
      alert('Failed to analyze email');
    } finally {
      setAnalyzing(false);
    }
  };

  const generateQuickReply = async (action) => {
    setGeneratingReply(true);
    try {
      const response = await api.post('/inbox/generate-reply', {
        intent_type: quickAnalysis?.intent_type,
        sender_name: quickAnalysis?.extracted_data?.sender_name,
        booking_link: quickAnalysis?.booking_link,
        selected_action: action
      });
      setQuickReply(response.data.reply);
    } catch (error) {
      console.error('Failed to generate reply:', error);
    } finally {
      setGeneratingReply(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addToInbox = async () => {
    if (!quickAnalysis) return;
    try {
      // Parse email to get sender info
      const fromMatch = pastedEmail.match(/From:\s*(.+?)(?:\n|$)/i);
      const subjectMatch = pastedEmail.match(/Subject:\s*(.+?)(?:\n|$)/i);

      await api.post('/inbox/emails', {
        from_email: quickAnalysis.extracted_data?.sender_email || 'unknown@email.com',
        from_name: quickAnalysis.extracted_data?.sender_name || fromMatch?.[1]?.trim() || 'Unknown',
        subject: subjectMatch?.[1]?.trim() || 'No Subject',
        body_text: pastedEmail
      });

      // Switch to inbox view
      setQuickPasteMode(false);
      setPastedEmail('');
      setQuickAnalysis(null);
      setQuickReply('');
      fetchData();
    } catch (error) {
      console.error('Failed to add to inbox:', error);
      alert('Failed to add email to inbox');
    }
  };

  const getIntentBadge = (intent, confidence) => {
    const colors = {
      schedule_meeting: 'bg-green-100 text-green-800',
      request_meeting: 'bg-green-100 text-green-800',
      reschedule: 'bg-yellow-100 text-yellow-800',
      cancel: 'bg-red-100 text-red-800',
      inquiry: 'bg-blue-100 text-blue-800',
      none: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      schedule_meeting: 'Schedule',
      request_meeting: 'Schedule',
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

  // Pro gate
  if (!hasProFeature()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border-2 border-purple-200">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Inbox className="h-10 w-10 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Inbox Assistant
            </h1>

            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
              AI-powered email management. Auto-detect scheduling requests, generate smart replies, and streamline your inbox workflow.
            </p>

            <div className="bg-purple-50 rounded-2xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-purple-900 mb-4">What it can do:</h3>
              <ul className="space-y-2 text-purple-800">
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Auto-detect meeting requests in your inbox
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Generate smart draft responses
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  One-click approve or customize replies
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Quick paste analysis for any email
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Stats dashboard for inbox insights
                </li>
              </ul>
            </div>

            <button
              onClick={() => showUpgradeModal('email')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg flex items-center gap-2 mx-auto"
            >
              <Crown className="h-5 w-5" />
              Upgrade to Pro - $15/month
            </button>
          </div>
        </div>
      </div>
    );
  }

  const intentInfo = quickAnalysis?.intent_type ? INTENT_INFO[quickAnalysis.intent_type] : null;
  const IntentIcon = intentInfo?.icon || Mail;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Inbox className="h-7 w-7 text-purple-600" />
                Inbox Assistant
              </h1>
              <p className="text-gray-500 mt-1">AI-powered email response management</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {emailConnections.length > 0 && (
                <button
                  onClick={handleEmailSync}
                  disabled={syncing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Inbox'}
                </button>
              )}
              <button
                onClick={() => setQuickPasteMode(!quickPasteMode)}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                  quickPasteMode
                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FileText className="h-4 w-4" />
                Quick Paste
              </button>
              {!quickPasteMode && (
                <button
                  onClick={() => setShowAddEmail(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Email
                </button>
              )}
            </div>
          </div>

          {/* Email Connections Bar */}
          <div className="mt-4 pt-4 border-t">
            {emailConnections.length === 0 ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Mail className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Connect your email for automatic monitoring</p>
                    <p className="text-sm text-gray-500">AI will detect scheduling requests and generate replies</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={connectGmail}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                    </svg>
                    Gmail
                  </button>
                  <button
                    onClick={connectOutlook}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#0078D4" d="M24 7.387v10.478c0 .566-.46 1.025-1.025 1.025H15.07v-12.53h7.905c.566 0 1.025.46 1.025 1.027z"/>
                      <path fill="#0364B8" d="M15.07 6.36v12.53H1.025A1.025 1.025 0 0 1 0 17.865V7.387c0-.567.459-1.027 1.025-1.027H15.07z"/>
                    </svg>
                    Outlook
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm text-gray-500">Connected:</span>
                {emailConnections.map(conn => (
                  <div key={conn.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                    {conn.provider === 'gmail' ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#0078D4" d="M24 7.387v10.478c0 .566-.46 1.025-1.025 1.025H15.07v-12.53h7.905c.566 0 1.025.46 1.025 1.027z"/>
                        <path fill="#0364B8" d="M15.07 6.36v12.53H1.025A1.025 1.025 0 0 1 0 17.865V7.387c0-.567.459-1.027 1.025-1.027H15.07z"/>
                      </svg>
                    )}
                    <span className="text-sm font-medium text-gray-700">{conn.email_address}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${conn.monitoring_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {conn.monitoring_enabled ? 'Active' : 'Paused'}
                    </span>
                    <button
                      onClick={() => toggleMonitoring(conn.id)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title={conn.monitoring_enabled ? 'Pause monitoring' : 'Resume monitoring'}
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => disconnectEmail(conn.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Disconnect"
                    >
                      <Unplug className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {!emailConnections.find(c => c.provider === 'gmail') && (
                  <button onClick={connectGmail} className="text-sm text-purple-600 hover:text-purple-700">+ Gmail</button>
                )}
                {!emailConnections.find(c => c.provider === 'outlook') && (
                  <button onClick={connectOutlook} className="text-sm text-purple-600 hover:text-purple-700">+ Outlook</button>
                )}
              </div>
            )}
          </div>

          {/* Detected Scheduling Emails Banner */}
          {detectedEmails.length > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">
                    {detectedEmails.length} scheduling request{detectedEmails.length !== 1 ? 's' : ''} detected
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {detectedEmails.slice(0, 3).map(email => {
                  const intent = email.scheduling_intent || {};
                  const reply = email.suggested_reply ? JSON.parse(email.suggested_reply) : null;
                  return (
                    <div key={email.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-green-100">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="font-medium text-gray-900 truncate">{email.from_name || email.from_email}</p>
                        <p className="text-sm text-gray-500 truncate">{email.subject}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDetectedReply(email.id)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDetectedDismiss(email.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {detectedEmails.length > 3 && (
                  <p className="text-sm text-green-700 text-center">+{detectedEmails.length - 3} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Paste Mode */}
      {quickPasteMode ? (
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          {/* Quick Paste Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Quick Email Analysis
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Paste any email to instantly analyze and generate a reply
              </p>
            </div>
            <button
              onClick={() => {
                setQuickPasteMode(false);
                setPastedEmail('');
                setQuickAnalysis(null);
                setQuickReply('');
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Input Section */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 sm:p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Paste Email Content</h3>
            </div>

            <textarea
              value={pastedEmail}
              onChange={(e) => setPastedEmail(e.target.value)}
              placeholder="Paste the email you received here...

Example:
Hi! I'd love to schedule a call to discuss the project. Are you free sometime next week? Let me know what works for you.

Thanks,
John"
              rows={8}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none resize-none"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={analyzeQuickEmail}
                disabled={analyzing || !pastedEmail.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                {analyzing ? 'Analyzing...' : 'Analyze Email'}
              </button>
            </div>
          </div>

          {/* Analysis Results */}
          {quickAnalysis && (
            <div className="space-y-6">
              {/* Intent Card */}
              <div className={`bg-white rounded-2xl border-2 p-4 sm:p-6 ${
                quickAnalysis.has_scheduling_intent ? 'border-green-200' : 'border-gray-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    quickAnalysis.has_scheduling_intent
                      ? 'bg-green-100'
                      : 'bg-gray-100'
                  }`}>
                    <IntentIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${
                      quickAnalysis.has_scheduling_intent
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base sm:text-lg">
                      {quickAnalysis.has_scheduling_intent
                        ? `${intentInfo?.label || 'Scheduling'} Detected`
                        : 'No Scheduling Intent Detected'}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      {quickAnalysis.has_scheduling_intent
                        ? 'This email contains a scheduling-related request.'
                        : 'This email doesn\'t appear to be about scheduling a meeting.'}
                    </p>
                  </div>
                </div>

                {/* Extracted Data */}
                {quickAnalysis.extracted_data && Object.keys(quickAnalysis.extracted_data).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700 mb-2">Extracted Information:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickAnalysis.extracted_data.sender_name && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                          <User className="h-4 w-4 text-gray-500" />
                          {quickAnalysis.extracted_data.sender_name}
                        </span>
                      )}
                      {quickAnalysis.extracted_data.mentioned_dates?.map((date, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          <Calendar className="h-4 w-4" />
                          {date}
                        </span>
                      ))}
                      {quickAnalysis.extracted_data.duration && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                          <Clock className="h-4 w-4" />
                          {quickAnalysis.extracted_data.duration} min
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested Actions */}
              {quickAnalysis.has_scheduling_intent && quickAnalysis.suggested_actions?.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-purple-200 p-4 sm:p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm sm:text-base">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Suggested Actions
                  </h3>
                  <div className="grid gap-2 sm:gap-3">
                    {quickAnalysis.suggested_actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => generateQuickReply(action.action)}
                        disabled={generatingReply}
                        className="flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 hover:border-purple-300 rounded-xl transition-all text-left"
                      >
                        <span className="font-medium text-purple-900">{action.label}</span>
                        <ArrowRight className="h-5 w-5 text-purple-600" />
                      </button>
                    ))}
                  </div>

                  {/* Booking Link */}
                  {quickAnalysis.booking_link && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-2">Your booking link:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-purple-600 overflow-x-auto">
                          {quickAnalysis.booking_link}
                        </code>
                        <button
                          onClick={() => copyToClipboard(quickAnalysis.booking_link)}
                          className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg"
                        >
                          {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generated Reply */}
              {quickReply && (
                <div className="bg-white rounded-2xl border-2 border-green-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                      <Send className="h-5 w-5 text-green-600" />
                      Generated Reply
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(quickReply)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                      {quickReply}
                    </pre>
                  </div>

                  {/* Add to Inbox option */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={addToInbox}
                      className="w-full py-2 text-purple-600 hover:bg-purple-50 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add this email to Inbox for tracking
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Regular Inbox View */
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
          <div className="flex gap-2 mb-6 border-b overflow-x-auto">
            {['pending', 'draft_created', 'responded', 'all'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium transition border-b-2 -mb-px whitespace-nowrap ${
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
                  <div className="p-8 text-center text-gray-500">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Loading...
                  </div>
                ) : emails.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Mail className="w-12 h-12 mx-auto text-gray-300 mb-2" />
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
                      <div className="flex gap-2 items-center flex-wrap">
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
                      <X className="h-5 w-5" />
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
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleApproveDraft(selectedEmail.draft_id)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-1"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve & Send
                          </button>
                          <button
                            onClick={() => {
                              setEditingDraft({ id: selectedEmail.draft_id, body_text: selectedEmail.draft_body, subject: `Re: ${selectedEmail.subject}` });
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleRejectDraft(selectedEmail.draft_id)}
                            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t flex gap-2">
                    <button
                      onClick={() => handleReanalyze(selectedEmail.id)}
                      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
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
                <div className="h-full flex items-center justify-center text-gray-500 p-8 min-h-[400px]">
                  <div className="text-center">
                    <Inbox className="w-16 h-16 mx-auto text-gray-300 mb-4" />
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
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleApproveDraft(draft.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve & Send
                      </button>
                      <button
                        onClick={() => setEditingDraft(draft)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
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
      )}

      {/* Add Email Modal */}
      {showAddEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
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
