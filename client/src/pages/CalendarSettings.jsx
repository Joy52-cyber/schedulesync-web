import { useState, useEffect, useRef } from 'react';
import { Calendar, Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { getOrganizerOAuthUrl, handleOrganizerOAuthCallback } from '../utils/api';

export default function CalendarSettings() {
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const didProcessRef = useRef(false);

  useEffect(() => {
    checkCalendarStatus();
    handleOAuthCallback();
  }, []);

  const checkCalendarStatus = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.calendar_sync_enabled) {
      setCalendarConnected(true);
      setCalendarEmail(user.email);
    }
  };

  const handleOAuthCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code || didProcessRef.current) return;
    didProcessRef.current = true;

    setProcessing(true);
    setLoading(true);

    // Clean URL
    window.history.replaceState({}, document.title, '/settings');

    try {
      const response = await handleOrganizerOAuthCallback(code);
      
      // Update user in localStorage
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('token', response.token);
      
      setCalendarConnected(true);
      setCalendarEmail(response.user.email);
      setError('');
    } catch (err) {
      console.error('❌ Calendar connection failed:', err);
      setError('Failed to connect calendar. Please try again.');
    } finally {
      setProcessing(false);
      setLoading(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await getOrganizerOAuthUrl();
      window.location.href = response.url;
    } catch (err) {
      console.error('❌ Failed to get OAuth URL:', err);
      setError('Failed to initiate calendar connection. Please try again.');
      setLoading(false);
    }
  };

  const handleDisconnectCalendar = () => {
    if (!confirm('Disconnect your Google Calendar? You won\'t be able to create calendar events automatically.')) return;
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    user.calendar_sync_enabled = false;
    localStorage.setItem('user', JSON.stringify(user));
    
    setCalendarConnected(false);
    setCalendarEmail('');
  };

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center animate-fadeIn">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg font-medium">Connecting your calendar...</p>
          <p className="text-gray-500 text-sm mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Calendar Settings</h1>
                <p className="text-blue-100 mt-1">Connect your Google Calendar to enable automatic event creation</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fadeIn">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 font-medium">Connection Failed</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Calendar Status */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Connection Status</h2>
              
              {calendarConnected ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-green-900 mb-1">✅ Calendar Connected</h3>
                      <p className="text-green-700 mb-3">
                        Connected as <strong>{calendarEmail}</strong>
                      </p>
                      <p className="text-green-600 text-sm mb-4">
                        Calendar events will be automatically created when guests book meetings with you.
                      </p>
                      <button
                        onClick={handleDisconnectCalendar}
                        className="px-4 py-2 bg-white border-2 border-green-600 text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors"
                      >
                        Disconnect Calendar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-yellow-900 mb-1">⚠️ Calendar Not Connected</h3>
                      <p className="text-yellow-700 mb-4">
                        Connect your Google Calendar to automatically create events when guests book with you.
                      </p>
                      <button
                        onClick={handleConnectCalendar}
                        disabled={loading}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Calendar className="h-5 w-5" />
                            Connect Google Calendar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Features List */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">What happens when you connect?</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Automatic calendar events created when guests book</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Calendar invites sent to guests automatically</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Automatic reminders (24 hours and 30 minutes before)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Meeting details and notes included in event description</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}