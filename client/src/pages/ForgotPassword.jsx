// client/src/pages/ForgotPassword.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { auth } from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      await auth.forgotPassword(email);
      setStatus('success');
      setMessage(
        'If this email is registered, we’ve sent a reset link to your inbox.'
      );
    } catch (err) {
      console.error('Forgot password error:', err);
      setStatus('error');
      setMessage(
        err.response?.data?.error ||
          'Something went wrong. Please try again in a moment.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-lg">ScheduleSync</span>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl border-2 border-white/20 shadow-xl rounded-2xl px-6 py-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-2 text-center">
            Forgot your password?
          </h1>
          <p className="text-sm text-gray-600 mb-6 text-center">
            Enter the email associated with your account and we’ll send you a reset link.
          </p>

          {status === 'success' && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5" />
              <p>{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wide text-gray-600"
              >
                Email address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-2xl hover:shadow-purple-200/50 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending reset link…
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          <div className="mt-6 flex justify-between text-xs text-gray-500">
            <Link to="/login" className="hover:text-purple-600 font-medium">
              Back to login
            </Link>
            <Link to="/register" className="hover:text-purple-600 font-medium">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
