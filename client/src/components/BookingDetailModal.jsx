import { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Video,
  FileText,
  CheckSquare,
  User2,
  Sparkles,
  Loader2,
  Copy,
  ExternalLink,
  Ban,
} from 'lucide-react';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

export default function BookingDetailModal({ booking, onClose, onCancel, onCopyManageLink }) {
  const [meetingContext, setMeetingContext] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [attendeeHistory, setAttendeeHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const notify = useNotification();

  useEffect(() => {
    if (booking) {
      loadBookingDetails();
    }
  }, [booking]);

  const loadBookingDetails = async () => {
    setLoading(true);
    try {
      // Load meeting context, action items, and attendee history in parallel
      const [contextRes, actionItemsRes, attendeeRes] = await Promise.allSettled([
        api.meetingContext.get(booking.id).catch(() => null),
        api.actionItems.getForBooking(booking.id).catch(() => null),
        booking.attendee_email ? api.attendees.getByEmail(booking.attendee_email).catch(() => null) : Promise.resolve(null),
      ]);

      if (contextRes.status === 'fulfilled' && contextRes.value?.data) {
        setMeetingContext(contextRes.value.data);
      }

      if (actionItemsRes.status === 'fulfilled' && actionItemsRes.value?.data) {
        setActionItems(actionItemsRes.value.data);
      }

      if (attendeeRes.status === 'fulfilled' && attendeeRes.value?.data) {
        setAttendeeHistory(attendeeRes.value.data);
      }
    } catch (error) {
      console.error('Failed to load booking details:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActionItem = async (itemId, currentStatus) => {
    try {
      if (currentStatus) {
        await api.actionItems.uncomplete(itemId);
      } else {
        await api.actionItems.complete(itemId);
      }

      // Update local state
      setActionItems(prev =>
        prev.map(item =>
          item.id === itemId
            ? { ...item, completed: !currentStatus, completed_at: !currentStatus ? new Date().toISOString() : null }
            : item
        )
      );

      notify.success(currentStatus ? 'Marked as incomplete' : 'Marked as complete');
    } catch (err) {
      console.error('Failed to toggle action item:', err);
      notify.error('Failed to update action item');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isPastBooking = (booking) => {
    return new Date(booking.end_time) < new Date();
  };

  const handleCancel = async () => {
    if (!booking) return;
    setCancellingId(booking.id);
    try {
      await onCancel(booking);
    } finally {
      setCancellingId(null);
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;

    // Basic markdown rendering: split by newlines and handle ** bold **
    const lines = text.split('\n');
    return (
      <div className="space-y-2">
        {lines.map((line, idx) => {
          // Handle bold text **text**
          const boldRegex = /\*\*(.*?)\*\*/g;
          const parts = [];
          let lastIndex = 0;
          let match;

          while ((match = boldRegex.exec(line)) !== null) {
            if (match.index > lastIndex) {
              parts.push(line.substring(lastIndex, match.index));
            }
            parts.push(<strong key={match.index}>{match[1]}</strong>);
            lastIndex = match.index + match[0].length;
          }

          if (lastIndex < line.length) {
            parts.push(line.substring(lastIndex));
          }

          return (
            <p key={idx} className="text-sm text-gray-700">
              {parts.length > 0 ? parts : line}
            </p>
          );
        })}
      </div>
    );
  };

  if (!booking) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
        {/* Modal header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex items-center justify-between shadow-lg z-10">
          <h2 className="text-2xl font-bold text-white">Booking Details</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-all hover:scale-110"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Modal content */}
        <div className="p-6 space-y-6">
          {/* Meeting Info */}
          <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-6 rounded-xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">{booking.title || 'Meeting'}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-700">
                <Calendar className="h-5 w-5 text-purple-600" />
                <span className="font-medium">{formatDate(booking.start_time)}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Clock className="h-5 w-5 text-purple-600" />
                <span className="font-medium">
                  {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <User className="h-5 w-5 text-purple-600" />
                <div>
                  <span className="font-medium">{booking.attendee_name}</span>
                  <span className="text-sm text-gray-600 ml-2">({booking.attendee_email})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attendee History */}
          {attendeeHistory && attendeeHistory.profile && attendeeHistory.profile.meeting_count > 1 && (
            <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <User2 className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Relationship History</p>
                  <p className="text-sm text-blue-800 mt-1">
                    You've met with {booking.attendee_name} <strong>{attendeeHistory.profile.meeting_count} times</strong>.
                    {attendeeHistory.profile.last_meeting_date && (
                      <> Last meeting: {formatDate(attendeeHistory.profile.last_meeting_date)}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI-Generated Agenda */}
          {meetingContext?.generated_agenda && (
            <div className="bg-green-50 border-2 border-green-200 p-5 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-green-900">Meeting Agenda</h4>
                <Sparkles className="h-4 w-4 text-green-500 ml-auto" />
              </div>
              <div className="prose prose-sm max-w-none">
                {renderMarkdown(meetingContext.generated_agenda)}
              </div>
            </div>
          )}

          {/* Action Items */}
          {actionItems.length > 0 && (
            <div className="bg-white border-2 border-gray-200 p-5 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-gray-900">Action Items</h4>
                <span className="ml-auto text-xs text-gray-500">
                  {actionItems.filter(item => item.completed).length} / {actionItems.length} completed
                </span>
              </div>
              <div className="space-y-2">
                {actionItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleActionItem(item.id, item.completed)}
                      className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.description}
                      </p>
                      {(item.due_date || item.assigned_to) && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {item.due_date && (
                            <span>Due: {new Date(item.due_date).toLocaleDateString()}</span>
                          )}
                          {item.assigned_to && (
                            <span>• {item.assigned_to}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meeting Summary (post-meeting) */}
          {booking.meeting_summary && (
            <div className="bg-purple-50 border-2 border-purple-200 p-5 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-purple-900">Meeting Summary</h4>
                <Sparkles className="h-4 w-4 text-purple-500 ml-auto" />
              </div>
              <div className="prose prose-sm max-w-none">
                {renderMarkdown(booking.meeting_summary)}
              </div>
            </div>
          )}

          {/* Video Link */}
          {booking.meet_link && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl border border-green-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md flex-shrink-0">
                  <Video className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 mb-2">Video Conference</p>
                  <a
                    href={booking.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 hover:text-green-900 underline text-sm break-all inline-flex items-center gap-2"
                  >
                    {booking.meet_link}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div className="bg-gradient-to-br from-gray-50 to-purple-50/30 p-5 rounded-xl border border-gray-200">
              <p className="font-bold text-gray-900 mb-2">Notes</p>
              <p className="text-gray-700 leading-relaxed text-sm">{booking.notes}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-4 space-y-3 border-t border-gray-200">
            {booking.manage_token && (
              <div className="flex gap-3">
                <button
                  onClick={() => onCopyManageLink(booking)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-200/50 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
                >
                  <Copy className="h-4 w-4" />
                  Copy Manage Link
                </button>
                <button
                  onClick={() => {
                    const manageUrl = `${window.location.origin}/manage/${booking.manage_token}`;
                    window.open(manageUrl, '_blank');
                  }}
                  className="px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-200/50 transition-all flex items-center gap-2 hover:-translate-y-0.5"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            )}

            {booking.status === 'confirmed' && !isPastBooking(booking) && (
              <button
                onClick={handleCancel}
                disabled={cancellingId === booking.id}
                className="w-full px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancellingId === booking.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    Cancel Booking
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
