import React, { useEffect, useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { notifications as notificationsApi } from '../utils/api';
import { Bell, Check, Trash2, CheckCheck } from 'lucide-react';

/**
 * Enhanced Notification Center Component
 * Shows how to integrate persistent notifications from the backend
 */
export function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const notify = useNotification();

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
    loadUnreadCount();

    // Optionally: Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationsApi.list();
      setNotifications(response.data.notifications);
      notify.setPersistentNotifications(response.data.notifications);
    } catch (error) {
      notify.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await notificationsApi.getUnreadCount();
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      notify.success('Marked as read');
    } catch (error) {
      notify.error('Failed to mark as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      notify.success('All notifications marked as read');
    } catch (error) {
      notify.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationsApi.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      loadUnreadCount();
      notify.success('Notification deleted');
    } catch (error) {
      notify.error('Failed to delete notification');
    }
  };

  const handleDeleteRead = async () => {
    if (!confirm('Delete all read notifications?')) return;
    
    try {
      await notificationsApi.deleteRead();
      setNotifications((prev) => prev.filter((n) => !n.read));
      notify.success('Read notifications deleted');
    } catch (error) {
      notify.error('Failed to delete notifications');
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      booking_created: '📅',
      booking_cancelled: '❌',
      booking_rescheduled: '🔄',
      payment_received: '💰',
      reminder_sent: '⏰',
    };
    return icons[type] || '🔔';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
          <button
            onClick={handleDeleteRead}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`
                p-4 rounded-lg border transition-all hover:shadow-md
                ${
                  notification.read
                    ? 'bg-white border-gray-200'
                    : 'bg-blue-50 border-blue-200'
                }
              `}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="text-2xl">
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                        {notification.link && (
                          <a
                            href={notification.link}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View Details →
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {!notification.read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notification.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Example: Using Notifications in a Booking Component
 */
export function BookingFormExample() {
  const notify = useNotification();

  const handleSubmit = async (formData) => {
    try {
      // Show loading toast
      notify.info('Creating booking...', 'Please wait');

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Booking failed');

      const data = await response.json();

      // ✅ Show success notification with action button
      notify.bookingCreated(data.booking);

      // Or use custom success:
      // notify.success(
      //   `Meeting scheduled for ${new Date(data.booking.start_time).toLocaleDateString()}`,
      //   'Booking Confirmed! 🎉',
      //   {
      //     duration: 7000,
      //     action: {
      //       label: 'View Details',
      //       onClick: () => {
      //         window.location.href = `/bookings/${data.booking.id}`;
      //       },
      //     },
      //   }
      // );
    } catch (error) {
      // ❌ Show error notification
      notify.error(error.message || 'Failed to create booking', 'Booking Failed');
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(/* ... */); }}>
      {/* Form fields */}
      <button type="submit">Book Now</button>
    </form>
  );
}

/**
 * Example: Using Notifications for Cancellation
 */
export function CancelBookingExample({ bookingId }) {
  const notify = useNotification();

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ reason: 'User cancelled' }),
      });

      // ✅ Show cancellation notification
      notify.bookingCancelled({
        attendee_name: 'John Doe',
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = '/bookings';
      }, 2000);
    } catch (error) {
      notify.error('Failed to cancel booking');
    }
  };

  return (
    <button
      onClick={handleCancel}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
    >
      Cancel Booking
    </button>
  );
}

export default NotificationCenter;