import { useState, useEffect } from 'react';
import { Bell, Clock, CheckCircle, AlertCircle, Send, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function ReminderStatus() {
  const [reminders, setReminders] = useState({
    pending: [],
    sent: [],
    failed: [],
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reminders/status');
      setReminders(response.data);
    } catch (error) {
      console.error('Failed to load reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestReminder = async () => {
    try {
      setSending(true);
      await api.post('/admin/send-reminders');
      await loadReminders();
      alert('✅ Reminder check completed!');
    } catch (error) {
      alert('❌ Failed to send reminders: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const getTimeUntil = (dateString) => {
    const now = new Date();
    const future = new Date(dateString);
    const hours = Math.round((future - now) / (1000 * 60 * 60));
    
    if (hours < 0) return 'Past';
    if (hours === 0) return 'Now';
    if (hours === 1) return '1 hour';
    if (hours < 24) return `${hours} hours`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Reminder Status</h3>
            <p className="text-sm text-gray-600">Automatic 24h reminders</p>
          </div>
        </div>

        <button
          onClick={handleSendTestReminder}
          disabled={sending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Check Now
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <p className="text-xs font-semibold text-amber-900 uppercase">Pending</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{reminders.pending.length}</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-xs font-semibold text-green-900 uppercase">Sent</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{reminders.sent.length}</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-xs font-semibold text-red-900 uppercase">Failed</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{reminders.failed.length}</p>
        </div>
      </div>

      {/* Pending Reminders */}
      {reminders.pending.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Upcoming Reminders
          </h4>
          <div className="space-y-2">
            {reminders.pending.slice(0, 5).map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{booking.attendee_name}</p>
                  <p className="text-sm text-gray-600">
                    {formatTime(booking.start_time)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-amber-700 uppercase">
                    In {getTimeUntil(booking.start_time)}
                  </p>
                  <p className="text-xs text-gray-500">Reminder pending</p>
                </div>
              </div>
            ))}
            {reminders.pending.length > 5 && (
              <p className="text-sm text-gray-500 text-center py-2">
                + {reminders.pending.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recently Sent */}
      {reminders.sent.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Recently Sent
          </h4>
          <div className="space-y-2">
            {reminders.sent.slice(0, 3).map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{booking.attendee_name}</p>
                  <p className="text-sm text-gray-600">
                    {formatTime(booking.start_time)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-green-700">
                    ✓ Sent
                  </p>
                  <p className="text-xs text-gray-500">
                    {booking.reminder_sent_at ? formatTime(booking.reminder_sent_at) : 'Recently'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {reminders.pending.length === 0 && reminders.sent.length === 0 && (
        <div className="text-center py-8">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No upcoming reminders</p>
          <p className="text-sm text-gray-500 mt-1">
            Reminders are sent 24 hours before meetings
          </p>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 pt-6 border-t-2 border-gray-200">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p>
            Automatic reminders run every hour. Emails are sent 24 hours before each meeting to both organizer and attendee.
          </p>
        </div>
      </div>
    </div>
  );
}