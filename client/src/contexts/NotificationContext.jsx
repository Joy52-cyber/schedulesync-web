import { createContext, useContext, useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Info, 
  AlertTriangle, 
  X, 
  Bell, 
  Loader2,
  Calendar,
  DollarSign,
  Clock,
  Users,
  RefreshCw
} from 'lucide-react';
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

// Toast Component - Premium Design with Mobile Responsiveness
const Toast = ({ notification, onClose }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0" />,
    info: <Info className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 flex-shrink-0" />,
  };

  const styles = {
    success: 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300/50 shadow-green-100/50',
    error: 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300/50 shadow-red-100/50',
    info: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300/50 shadow-blue-100/50',
    warning: 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300/50 shadow-amber-100/50',
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
      className={`flex items-start gap-3 p-3 sm:p-4 rounded-xl border-2 backdrop-blur-xl shadow-2xl ${
        styles[notification.type]
      } animate-in slide-in-from-right duration-500 max-w-[calc(100vw-2rem)] sm:max-w-sm hover:scale-105 transition-transform`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[notification.type]}
      </div>
      <div className="flex-1 min-w-0">
        {notification.title && (
          <h4 className="font-bold text-gray-900 text-sm sm:text-base truncate mb-0.5">{notification.title}</h4>
        )}
        <p className="text-xs sm:text-sm text-gray-700 line-clamp-2 leading-relaxed">{notification.message}</p>
      </div>
      <button
        onClick={() => onClose(notification.id)}
        className="text-gray-400 hover:text-gray-700 hover:bg-white/50 rounded-lg p-1 flex-shrink-0 transition-all"
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

  const calendarSyncFailed = (errorMsg) => {
    error(
      errorMsg || 'Failed to sync calendar. Please try again.',
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
      
      {/* Toast Container - Mobile Responsive */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-[99999] space-y-2 pointer-events-none max-w-full">
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

// ✅ Helper to clean broken emojis from database text
const cleanText = (text) => {
  if (!text) return '';
  // Remove common broken emoji patterns (?, ??, boxes, etc.)
  return text
    .replace(/^[\?\s]+/, '') // Remove leading ? marks
    .replace(/[\uFFFD\u0000-\u001F]/g, '') // Remove replacement chars and control chars
    .trim();
};

// ✅ Get icon component instead of emoji (more reliable)
const NotificationIcon = ({ type }) => {
  const iconClass = "w-5 h-5";
  
  switch (type) {
    case 'booking':
    case 'booking_created':
    case 'booking_confirmed':
      return <Calendar className={`${iconClass} text-blue-500`} />;
    case 'booking_cancelled':
      return <XCircle className={`${iconClass} text-red-500`} />;
    case 'booking_rescheduled':
      return <RefreshCw className={`${iconClass} text-orange-500`} />;
    case 'payment':
    case 'payment_received':
      return <DollarSign className={`${iconClass} text-green-500`} />;
    case 'reminder':
    case 'reminder_sent':
      return <Clock className={`${iconClass} text-yellow-500`} />;
    case 'team':
      return <Users className={`${iconClass} text-purple-500`} />;
    case 'calendar':
      return <Calendar className={`${iconClass} text-indigo-500`} />;
    default:
      return <Bell className={`${iconClass} text-gray-500`} />;
  }
};

// Enhanced Notification Bell Component - Mobile Responsive
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const context = useContext(NotificationContext);
  
  if (!context) {
    console.error('NotificationBell must be used within NotificationProvider');
    return null;
  }

  const displayLimit = 10;
  const displayedNotifications = showAll 
    ? notifications 
    : notifications.slice(0, displayLimit);
  const hasMore = notifications.length > displayLimit && !showAll;

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
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      setShowAll(false);
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

  return (
    <div className="relative">
      {/* Premium Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-purple-600 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 rounded-xl transition-all duration-300 group"
      >
        <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-pink-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg animate-pulse">
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

          {/* Premium Mobile-Responsive Notification Panel */}
          <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-0 top-14 sm:top-auto sm:mt-2 w-auto sm:w-80 md:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-purple-100/50 z-50 max-h-[70vh] sm:max-h-[600px] flex flex-col overflow-hidden">
            {/* Premium Header with Gradient */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-b-2 border-purple-100/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                  Notifications
                  {notifications.length > 0 && (
                    <span className="ml-2 text-xs sm:text-sm text-gray-600 font-medium">
                      ({notifications.length})
                    </span>
                  )}
                </h3>
              </div>
              {notifications.length > 0 && unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs sm:text-sm text-purple-600 hover:text-purple-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-white/50 transition-all"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center">
                    <Bell className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />
                  </div>
                  <p className="font-bold text-gray-900 text-sm sm:text-base mb-1">No notifications yet</p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    We'll notify you when something happens
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-purple-100/30">
                  {displayedNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 sm:p-4 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all duration-300 cursor-pointer group ${
                        !notification.is_read ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-l-4 border-blue-400' : ''
                      }`}
                    >
                      <div className="flex gap-2 sm:gap-3">
                        {/* Premium Icon with Background */}
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            !notification.is_read
                              ? 'bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg'
                              : 'bg-gray-100 group-hover:bg-gradient-to-br group-hover:from-purple-100 group-hover:to-pink-100'
                          } transition-all`}>
                            <div className={!notification.is_read ? 'text-white' : ''}>
                              <NotificationIcon type={notification.type} />
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                {cleanText(notification.title) || 'New Notification'}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">
                                {cleanText(notification.message)}
                              </p>
                              <p className="text-xs text-gray-500 mt-1.5 font-medium">
                                {formatTimeAgo(notification.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.is_read && (
                                <button
                                  onClick={(e) => handleMarkAsRead(e, notification)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                                  title="Mark as read"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => handleDelete(e, notification.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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

            {/* Premium Footer - Show More Button */}
            {hasMore && (
              <div className="p-3 sm:p-4 border-t-2 border-purple-100/50 bg-gradient-to-r from-purple-50/50 to-pink-50/50">
                <button
                  onClick={() => setShowAll(true)}
                  className="block w-full text-center text-xs sm:text-sm text-purple-600 hover:text-purple-800 font-bold py-2 rounded-lg hover:bg-white/80 transition-all"
                >
                  Show {notifications.length - displayLimit} more notifications
                </button>
              </div>
            )}

            {/* Premium Footer - Collapse Button */}
            {showAll && notifications.length > displayLimit && (
              <div className="p-3 sm:p-4 border-t-2 border-purple-100/50 bg-gradient-to-r from-purple-50/50 to-pink-50/50">
                <button
                  onClick={() => setShowAll(false)}
                  className="block w-full text-center text-xs sm:text-sm text-gray-600 hover:text-gray-900 font-semibold py-2 rounded-lg hover:bg-white/80 transition-all"
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