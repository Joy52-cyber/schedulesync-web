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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-lg">ScheduleSync</span>
        </div>

        {/* Card */}
        <div className="bg-white/90 border border-purple-100 shadow-lg rounded-2xl px-6 py-8">
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
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
