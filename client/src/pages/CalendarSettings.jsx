import { useState, useEffect } from 'react';
import { 
  Calendar,
  RefreshCw,
  Trash2,
  Plus,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

export default function CalendarSettings() {
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadCalendars();
  }, []);

  const loadCalendars = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/calendars`, {
        credentials: 'include'
      });
      const data = await response.json();
      setCalendars(data.calendars || []);
    } catch (error) {
      console.error('Error loading calendars:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google/calendar`;
  };

  const handleSync = async (calendarId) => {
    try {
      setSyncing(true);
      await fetch(`${import.meta.env.VITE_API_URL}/api/calendars/${calendarId}/sync`, {
        method: 'POST',
        credentials: 'include'
      });
      loadCalendars();
    } catch (error) {
      console.error('Error syncing calendar:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (calendarId) => {
    if (!confirm('Disconnect this calendar? Your availability will no longer sync.')) return;
    
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/calendars/${calendarId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      loadCalendars();
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Calendar Settings</h1>
          <p className="text-gray-600">Connect and manage your calendar integrations</p>
        </div>

        {/* Connected Calendars */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-gray-100 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Connected Calendars
            </h2>
          </div>

          <div className="p-8">
            {calendars.length === 0 ? (
             <div className="text-center py-8 sm:py-12 px-4">
  <Calendar className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-4" />
  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No calendars connected</h3>
  <p className="text-sm sm:text-base text-gray-600 mb-6">Connect your calendar to sync availability</p>
  <button
    onClick={handleConnectGoogle}
    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl hover:shadow-lg transition-all inline-flex items-center gap-2 font-semibold text-sm sm:text-base"
  >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Connect Google Calendar
                </button>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
  {calendars.map((calendar) => (
    <div
      key={calendar.id}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
    >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          {calendar.calendar_name || 'Primary Calendar'}
                          {calendar.is_primary && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                              Primary
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">{calendar.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {calendar.sync_status === 'active' ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              Synced
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-yellow-600">
                              <AlertCircle className="h-3 w-3" />
                              Sync pending
                            </span>
                          )}
                          {calendar.last_sync && (
                            <span className="text-xs text-gray-500">
                              Last sync: {new Date(calendar.last_sync).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
  <button
    onClick={() => handleSync(calendar.id)}
    disabled={syncing}
    className="p-2 sm:p-2.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                    title="Sync now"
                      >
                        <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDisconnect(calendar.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="Disconnect"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleConnectGoogle}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-600 hover:text-blue-600 font-semibold flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Another Calendar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            How Calendar Sync Works
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>We only check if you're free or busy - event details stay private</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Bookings are automatically synced to your calendar</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Changes update in real-time to prevent double-booking</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>You can disconnect at any time from this page</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}