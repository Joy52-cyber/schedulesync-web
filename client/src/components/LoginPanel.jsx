import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';

export default function LoginPanel({ isOpen, onClose }) {
  const { login } = useAuth();

  const handleLogin = (token, user) => {
    // Same behavior as LoginWrapper
    login(token, user);
    window.location.href = '/dashboard';
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex">
        {/* Backdrop */}
        <div
          className="flex-1 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <div className="w-full max-w-sm sm:max-w-md h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-slide-in-right">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                SS
              </div>
              <span className="text-sm font-semibold text-gray-800">
                Log in to ScheduleSync
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <LoginForm onLogin={handleLogin} mode="panel" />
          </div>
        </div>
      </div>

      {/* Local animation styles */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
