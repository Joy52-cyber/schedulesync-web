import { createContext, useContext, useState, useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X, Bell, Loader2 } from 'lucide-react';
import { notifications as notificationsAPI } from '../utils/api';

// Create Notification Context
const NotificationContext = createContext(null);

// Notification Types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
};

// Toast Component
const Toast = ({ notification, onClose }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
  };

  useEffect(() => {
    if (notification.duration === Infinity) return;
    
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, notification.duration || 5000);

    return () => clearTimeout(timer);
  }, [notification.id, notification.duration, onClose]);

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${
        bgColors[notification.type]
      } animate-in slide-in-from-right duration-300`}
    >
      {icons[notification.type]}
      <div className="flex-1">
        {notification.title && (
          <h4 className="font-semibold text-gray-900 mb-1">{notification.title}</h4>
        )}
        <p className="text-sm text-gray-700">{notification.message}</p>
        {notification.action && (
          <button
            onClick={notification.action.onClick}
            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {notification.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onClose(notification.id)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Notification Provider Component
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  // Add a toast notification (temporary)
  const addNotification = (notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: NOTIFICATION_TYPES.INFO,
      duration: 5000,
      ...notification,
    };
    setNotifications((prev) => [...prev, newNotification]);
    return id;
  };

  // Remove a notification
  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Success notification
  const success = (message, title = 'Success', options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.SUCCESS,
      title,
      message,
      ...options,
    });
  };

  // Error notification
  const error = (message, title = 'Error', options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.ERROR,
      title,
      message,
      duration: 7000,
      ...options,
    });
  };

  // Info notification
  const info = (message, title = 'Info', options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.INFO,
      title,
      message,
      ...options,
    });
  };

  // Warning notification
  const warning = (message, title = 'Warning', options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.WARNING,
      title,
      message,
      duration: 6000,
      ...options,
    });
  };

  // Booking-specific notifications
  const bookingCreated = (bookingDetails) => {
    return success(
      `Meeting scheduled with ${bookingDetails.attendee_name} on ${new Date(
        bookingDetails.start_time
      ).toLocaleDateString()}`,
      '📅 Booking Confirmed',
      {
        action: bookingDetails.id ? {
          label: 'View Details',
          onClick: () => {
            window.location.href = `/bookings/${bookingDetails.id}`;
          },
        } : undefined,
      }
    );
  };

  const bookingCancelled = (bookingDetails) => {
    return info(
      `Meeting with ${bookingDetails.attendee_name} has been cancelled`,
      '❌ Booking Cancelled',
      {
        action: {
          label: 'View Calendar',
          onClick: () => {
            window.location.href = '/bookings';
          },
        },
      }
    );
  };

  const bookingRescheduled = (bookingDetails) => {
    return info(
      `Meeting rescheduled to ${new Date(bookingDetails.start_time).toLocaleDateString()} at ${new Date(
        bookingDetails.start_time
      ).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      '🔄 Booking Rescheduled',
      {
        action: bookingDetails.id ? {
          label: 'View Details',
          onClick: () => {
            window.location.href = `/bookings/${bookingDetails.id}`;
          },
        } : undefined,
      }
    );
  };

  const reminderSent = (bookingDetails, hoursBefore) => {
    return info(
      `Reminder sent for meeting with ${bookingDetails.attendee_name} (${hoursBefore}h before)`,
      '⏰ Reminder Sent'
    );
  };

  const paymentReceived = (amount, currency) => {
    return success(
      `Payment of ${currency.toUpperCase()} ${amount} received successfully`,
      '💰 Payment Confirmed'
    );
  };

  const value = {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    info,
    warning,
    bookingCreated,
    bookingCancelled,
    bookingRescheduled,
    reminderSent,
    paymentReceived,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

// Custom Hook
export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

// Helper function to format timestamps
function formatTimestamp(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

// Enhanced Notification Bell Component - Fetches real notifications from backend
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const context = useContext(NotificationContext);
  
  if (!context) {
    console.error('NotificationBell must be used within NotificationProvider');
    return null;
  }

  // Fetch notifications when bell is opened
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationsAPI.list();
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count on mount and every 30 seconds
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await notificationsAPI.getUnreadCount();
        setUnreadCount(response.data.count || 0);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleBellClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      await notificationsAPI.markAsRead(notification.id);
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Navigate if there's a link
      if (notification.link) {
        window.location.href = notification.link;
      }
      
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      context.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      context.error('Failed to mark all as read');
    }
  };

  const handleDeleteNotification = async (notificationId, event) => {
    event.stopPropagation(); // Prevent notification click
    try {
      await notificationsAPI.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      context.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      context.error('Failed to delete notification');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleBellClick}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Loading...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No notifications yet</p>
                  <p className="text-sm mt-1">We'll notify you when something happens</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors relative ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm text-gray-900">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-400">
                              {formatTimestamp(notification.created_at)}
                            </p>
                            <button
                              onClick={(e) => handleDeleteNotification(notification.id, e)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t bg-gray-50">
                <a
                  href="/notifications"
                  className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  View all notifications
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}