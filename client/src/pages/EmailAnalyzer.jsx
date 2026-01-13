import { useState } from 'react';
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
  CalendarDays
} from 'lucide-react';
import api from '../utils/api';

const INTENT_INFO = {
  request_meeting: { label: 'Meeting Request', color: 'blue', icon: Calendar },
  propose_time: { label: 'Time Proposal', color: 'green', icon: Clock },
  confirm: { label: 'Confirmation', color: 'emerald', icon: Check },
  reschedule: { label: 'Reschedule Request', color: 'orange', icon: CalendarDays },
  cancel: { label: 'Cancellation', color: 'red', icon: AlertCircle },
};

export default function EmailAnalyzer() {
  const { hasProFeature, showUpgradeModal, currentTier } = useUpgrade();
  const [emailText, setEmailText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reply, setReply] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyzeEmail = async () => {
    if (!emailText.trim()) return;

    setAnalyzing(true);
    setAnalysis(null);
    setReply('');

    try {
      const response = await api.post('/analyze-email', { email_text: emailText });
      setAnalysis(response.data);
    } catch (error) {
      console.error('Failed to analyze:', error);
      alert('Failed to analyze email');
    } finally {
      setAnalyzing(false);
    }
  };

  const generateReply = async (action) => {
    setGeneratingReply(true);
    try {
      const response = await api.post('/generate-reply', {
        intent_type: analysis?.intent_type,
        sender_name: analysis?.extracted_data?.sender_name,
        booking_link: analysis?.booking_link,
        selected_action: action
      });
      setReply(response.data.reply);
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

  // Pro gate
  if (!hasProFeature()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border-2 border-purple-200">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="h-10 w-10 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Email Assistant
            </h1>

            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
              Paste any email and let AI detect scheduling intent, then generate the perfect reply with your booking link.
            </p>

            <div className="bg-purple-50 rounded-2xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-purple-900 mb-4">What it can do:</h3>
              <ul className="space-y-2 text-purple-800">
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Detect meeting requests in emails
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Extract proposed times and dates
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Generate replies with your booking link
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Handle reschedule and cancellation requests
                </li>
              </ul>
            </div>

            <button
              onClick={() => showUpgradeModal('email')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg flex items-center gap-2 mx-auto"
            >
              <Crown className="h-5 w-5" />
              Upgrade to Pro - $12/month
            </button>
          </div>
        </div>
      </div>
    );
  }

  const intentInfo = analysis?.intent_type ? INTENT_INFO[analysis.intent_type] : null;
  const IntentIcon = intentInfo?.icon || Mail;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Mail className="h-8 w-8 text-blue-600" />
            Email Assistant
          </h1>
          <p className="text-gray-600 mt-1">
            Paste an email to detect scheduling intent and generate a reply
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Paste Email Content</h2>
          </div>

          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            placeholder="Paste the email you received here...

Example:
Hi! I'd love to schedule a call to discuss the project. Are you free sometime next week? Let me know what works for you.

Thanks,
John"
            rows={8}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none resize-none"
          />

          <button
            onClick={analyzeEmail}
            disabled={analyzing || !emailText.trim()}
            className="mt-4 w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {analyzing ? 'Analyzing...' : 'Analyze Email'}
          </button>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-6">
            {/* Intent Card */}
            <div className={`bg-white rounded-2xl border-2 p-6 ${
              analysis.has_scheduling_intent ? 'border-green-200' : 'border-gray-200'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  analysis.has_scheduling_intent
                    ? `bg-${intentInfo?.color || 'blue'}-100`
                    : 'bg-gray-100'
                }`}>
                  <IntentIcon className={`h-6 w-6 ${
                    analysis.has_scheduling_intent
                      ? `text-${intentInfo?.color || 'blue'}-600`
                      : 'text-gray-400'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">
                    {analysis.has_scheduling_intent
                      ? `${intentInfo?.label || 'Scheduling'} Detected`
                      : 'No Scheduling Intent Detected'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {analysis.has_scheduling_intent
                      ? 'This email contains a scheduling-related request.'
                      : 'This email doesn\'t appear to be about scheduling a meeting.'}
                  </p>
                </div>
              </div>

              {/* Extracted Data */}
              {analysis.extracted_data && Object.keys(analysis.extracted_data).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-2">Extracted Information:</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.extracted_data.sender_name && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                        <User className="h-4 w-4 text-gray-500" />
                        {analysis.extracted_data.sender_name}
                      </span>
                    )}
                    {analysis.extracted_data.mentioned_dates?.map((date, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        <Calendar className="h-4 w-4" />
                        {date}
                      </span>
                    ))}
                    {analysis.extracted_data.duration && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        <Clock className="h-4 w-4" />
                        {analysis.extracted_data.duration} min
                      </span>
                    )}
                    {analysis.extracted_data.emails?.map((email, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                        <Mail className="h-4 w-4" />
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Actions */}
            {analysis.has_scheduling_intent && analysis.suggested_actions?.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-purple-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Suggested Actions
                </h3>
                <div className="grid gap-3">
                  {analysis.suggested_actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => generateReply(action.action)}
                      disabled={generatingReply}
                      className="flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 hover:border-purple-300 rounded-xl transition-all text-left"
                    >
                      <span className="font-medium text-purple-900">{action.label}</span>
                      <ArrowRight className="h-5 w-5 text-purple-600" />
                    </button>
                  ))}
                </div>

                {/* Your Booking Link */}
                {analysis.booking_link && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-2">Your booking link:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-blue-600 overflow-x-auto">
                        {analysis.booking_link}
                      </code>
                      <button
                        onClick={() => copyToClipboard(analysis.booking_link)}
                        className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg"
                      >
                        {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Generated Reply */}
            {reply && (
              <div className="bg-white rounded-2xl border-2 border-green-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Send className="h-5 w-5 text-green-600" />
                    Generated Reply
                  </h3>
                  <button
                    onClick={() => copyToClipboard(reply)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                    {reply}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
