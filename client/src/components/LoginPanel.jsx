// client/src/components/LoginPanel.jsx
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';
import { Calendar } from 'lucide-react';

export default function LoginPanel({ isOpen, onClose }) {
  const { login } = useAuth();

  const handleLogin = (token, user) => {
    login(token, user);
    window.location.href = '/dashboard';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end">
      {/* Backdrop */}
      <div
        className="flex-1 h-full bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Floating Panel */}
      <div className="w-full max-w-sm h-auto max-h-[calc(100vh-2rem)] my-4 mr-4 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-800">
              Log in to ScheduleSync
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <LoginForm onLogin={handleLogin} mode="panel" />
        </div>
      </div>
    </div>
  );
}
