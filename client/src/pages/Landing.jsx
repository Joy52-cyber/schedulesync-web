// client/src/pages/Landing.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Zap, Share2 } from 'lucide-react';
import LoginPanel from '../components/LoginPanel';

export default function Landing({ defaultLoginOpen = false }) {
  const [isLoginOpen, setIsLoginOpen] = useState(defaultLoginOpen);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Floating login panel */}
      <LoginPanel isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-purple-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm sm:text-base">
              ScheduleSync
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLoginOpen(true)}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Log in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm font-semibold text-white rounded-full px-4 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-sm"
            >
              Start free
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      {/* ... keep the rest of your Landing code as-is ... */}
      {/* (your hero, cards, etc. are already fine and don't use AppLogo) */}
    </div>
  );
}
