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
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="w-full max-w-md h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {/* App logo icon only */}
            <AppLogo showText={false} size={28} />
            <span className="text-sm font-semibold text-gray-800">
              Log in
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
