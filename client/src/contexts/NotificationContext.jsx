import React, { createContext, useContext, useState, useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X, Bell } from 'lucide-react';

// Create Notification Context
const NotificationContext = createContext();

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
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, notification.duration || 5000);

    return () => clearTimeout(timer);
  }, [notification, onClose]);

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
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Notification Provider Component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [persistentNotifications, setPersistentNotifications] = useState([]);

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
      duration: 7000, // Longer duration for errors
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
        action: {
          label: 'View Details',
          onClick: () => {
            // Navigate to booking details
            window.location.href = `/bookings/${bookingDetails.id}`;
          },
        },
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
        action: {
          label: 'View Details',
          onClick: () => {
            window.location.href = `/bookings/${bookingDetails.id}`;
          },
        },
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
    // Booking-specific helpers
    bookingCreated,
    bookingCancelled,
    bookingRescheduled,
    reminderSent,
    paymentReceived,
    // Persistent notifications (for notification center)
    persistentNotifications,
    setPersistentNotifications,
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
};

// Custom Hook
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

// Notification Bell Component (for navbar)
export const NotificationBell = () => {
  const { persistentNotifications } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = persistentNotifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
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
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {persistentNotifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                persistentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationContext;