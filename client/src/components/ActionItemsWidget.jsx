import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Calendar, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

export default function ActionItemsWidget() {
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const notify = useNotification();

  useEffect(() => {
    loadActionItems();
  }, []);

  const loadActionItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.actionItems.getMyTasks();
      // Show only pending items, limit to top 5
      const pending = response.data.filter(item => !item.completed).slice(0, 5);
      setActionItems(pending);
    } catch (err) {
      console.error('Failed to load action items:', err);
      setError('Failed to load action items');
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async (itemId, currentStatus) => {
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
        ).filter(item => !item.completed) // Remove completed items from pending list
      );

      notify.success(currentStatus ? 'Marked as incomplete' : 'Marked as complete');
    } catch (err) {
      console.error('Failed to toggle action item:', err);
      notify.error('Failed to update action item');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;

    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if date is today
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }

    // Check if date is tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    // Check if date is in the past
    if (date < today) {
      return 'Overdue';
    }

    // Otherwise show formatted date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDueDateClass = (dueDate) => {
    if (!dueDate) return 'text-gray-500';

    const date = new Date(dueDate);
    const today = new Date();

    if (date < today) {
      return 'text-red-600 font-semibold';
    }

    if (date.toDateString() === today.toDateString()) {
      return 'text-orange-600 font-semibold';
    }

    return 'text-gray-500';
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl relative z-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-purple-600" />
          Action Items
        </h3>
        {actionItems.length > 0 && (
          <button
            onClick={() => navigate('/action-items')}
            className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            View All
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {actionItems.length === 0 ? (
        <div className="text-center py-8">
          <CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No pending action items</p>
          <p className="text-gray-400 text-xs mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actionItems.map(item => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggleComplete(item.id, item.completed)}
                className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.description}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  {item.due_date && (
                    <div className={`flex items-center gap-1 ${getDueDateClass(item.due_date)}`}>
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(item.due_date)}</span>
                    </div>
                  )}
                  {item.assigned_to && (
                    <span className="text-gray-500">
                      • {item.assigned_to}
                    </span>
                  )}
                  {item.booking_title && (
                    <button
                      onClick={() => navigate(`/bookings?id=${item.booking_id}`)}
                      className="text-purple-600 hover:text-purple-700 hover:underline"
                    >
                      • From "{item.booking_title}"
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
