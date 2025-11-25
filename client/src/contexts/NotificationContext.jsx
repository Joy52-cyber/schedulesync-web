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
          <h4 className="font-semibold text-gray-900">{notification.title}</h4>
        )}
        <p className="text-sm text-gray-600">{notification.message}</p>
      </div>
      <button
        onClick={() => onClose(notification.id)}
        className="text-gray-400 hover:text-gray-600"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Notification Provider
export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showNotification = (type, message, title = '', duration = 5000) => {
    const id = Date.now();
    const notification = {
      id,
      type,
      message,
      title,
      duration,
    };
    setToasts((prev) => [...prev, notification]);
  };

  const notifications = useState([]);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const success = (message, title = 'Success') =>
    showNotification(NOTIFICATION_TYPES.SUCCESS, message, title);

  const error = (message, title = 'Error') =>
    showNotification(NOTIFICATION_TYPES.ERROR, message, title);

  const info = (message, title = 'Info') =>
    showNotification(NOTIFICATION_TYPES.INFO, message, title);

  const warning = (message, title = 'Warning') =>
    showNotification(NOTIFICATION_TYPES.WARNING, message, title);

  const notify = (type, message, title, duration) =>
    showNotification(type, message, title, duration);

  // Advanced notification options
  const confirm = async (message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      const id = Date.now();
      const notification = {
        id,
        type: NOTIFICATION_TYPES.WARNING,
        message,
        title,
        duration: Infinity,
        actions: [
          {
            label: 'Confirm',
            onClick: () => {
              removeToast(id);
              resolve(true);
            },
            className: 'bg-blue-600 text-white',
          },
          {
            label: 'Cancel',
            onClick: () => {
              removeToast(id);
              resolve(false);
            },
            className: 'bg-gray-200 text-gray-800',
          },
        ],
      };
      setToasts((prev) => [...prev, notification]);
    });
  };

  const prompt = async (message, title = 'Input Required', defaultValue = '') => {
    return new Promise((resolve) => {
      // This is a simplified version - you might want to create a custom modal
      const result = window.prompt(message, defaultValue);
      resolve(result);
    });
  };

  // Booking-specific notifications
  const bookingCreated = (bookingDetails) => {
    success(
      `Booking confirmed for ${bookingDetails.date} at ${bookingDetails.time}`,
      'Booking Confirmed'
    );
  };

  const bookingCancelled = (bookingDetails) => {
    info(
      `Your booking for ${bookingDetails.date} has been cancelled`,
      'Booking Cancelled'
    );
  };

  const bookingUpdated = (bookingDetails) => {
    info(
      `Your booking has been updated to ${bookingDetails.date} at ${bookingDetails.time}`,
      'Booking Updated'
    );
  };

  const paymentSuccess = (amount) => {
    success(
      `Payment of $${amount} processed successfully`,
      'Payment Successful'
    );
  };

  const paymentFailed = (reason) => {
    error(
      reason || 'Payment could not be processed. Please try again.',
      'Payment Failed'
    );
  };

  // Team notifications
  const teamInvite = (teamName) => {
    info(
      `You've been invited to join ${teamName}`,
      'Team Invitation'
    );
  };

  const teamMemberAdded = (memberName) => {
    success(
      `${memberName} has been added to the team`,
      'Team Updated'
    );
  };

  // Calendar sync notifications
  const calendarSynced = () => {
    success(
      'Your calendar has been synchronized successfully',
      'Calendar Synced'
    );
  };

  const calendarSyncFailed = (error) => {
    error(
      error || 'Failed to sync calendar. Please try again.',
      'Sync Failed'
    );
  };

  const value = {
    // Core methods
    success,
    error,
    info,
    warning,
    notify,
    
    // Advanced methods
    confirm,
    prompt,
    
    // Booking methods
    bookingCreated,
    bookingCancelled,
    bookingUpdated,
    paymentSuccess,
    paymentFailed,
    
    // Team methods
    teamInvite,
    teamMemberAdded,
    
    // Calendar methods
    calendarSynced,
    calendarSyncFailed,
    
    // State
    notifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        <div className="pointer-events-auto space-y-2">
          {toasts.map((notification) => (
            <Toast
              key={notification.id}
              notification={notification}
              onClose={removeToast}
            />
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
}

// Hook to use notifications
export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

// Enhanced Notification Bell Component - With pagination (10 at a time)
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false); // ✅ Track if showing all
  const context = useContext(NotificationContext);
  
  if (!context) {
    console.error('NotificationBell must be used within NotificationProvider');
    return null;
  }

  // ✅ Limit to 10 notifications initially
  const displayLimit = 10;
  const displayedNotifications = showAll 
    ? notifications 
    : notifications.slice(0, displayLimit);
  const hasMore = notifications.length > displayLimit && !showAll;

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

  // Fetch unread count periodically
  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      setShowAll(false); // Reset to showing limited when reopening
    }
  }, [isOpen]);

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const handleMarkAsRead = async (e, notification) => {
    e.stopPropagation();
    try {
      await notificationsAPI.markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
      context.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      context.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      context.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    try {
      await notificationsAPI.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      context.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      context.error('Failed to delete notification');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking':
        return '📅';
      case 'payment':
        return '💰';
      case 'reminder':
        return '⏰';
      case 'team':
        return '👥';
      case 'calendar':
        return '📆';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Notification Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Notifications
                {notifications.length > 0 && (
                  <span className="ml-2 text-sm text-gray-500 font-normal">
                    ({notifications.length})
                  </span>
                )}
              </h3>
              {notifications.length > 0 && unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No notifications yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    We'll notify you when something happens
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {displayedNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.is_read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 text-2xl">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-0.5">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatTimeAgo(notification.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {!notification.is_read && (
                                <button
                                  onClick={(e) => handleMarkAsRead(e, notification)}
                                  className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                  title="Mark as read"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => handleDelete(e, notification.id)}
                                className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                                title="Delete"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer - Show More Button */}
            {hasMore && (
              <div className="p-3 border-t bg-gray-50">
                <button
                  onClick={() => setShowAll(true)}
                  className="block w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium py-1"
                >
                  Show {notifications.length - displayLimit} more notifications
                </button>
              </div>
            )}

            {/* Footer - Collapse Button (when showing all) */}
            {showAll && notifications.length > displayLimit && (
              <div className="p-3 border-t bg-gray-50">
                <button
                  onClick={() => setShowAll(false)}
                  className="block w-full text-center text-sm text-gray-600 hover:text-gray-800 font-medium py-1"
                >
                  Show less
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationContext;