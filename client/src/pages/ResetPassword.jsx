// client/src/pages/ResetPassword.jsx
import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../utils/api'; // we'll call the endpoint directly

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing reset token.');
      return;
    }

    if (password.length < 8) {
      setStatus('error');
      setMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirm) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    try {
      setStatus('loading');
      await api.post('/auth/reset-password', { token, password });
      setStatus('success');
      setMessage('Your password has been updated successfully.');

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      setStatus('error');
      setMessage(
        err.response?.data?.error ||
          'We could not reset your password. The link may have expired.'
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
            Set a new password
          </h1>
          <p className="text-sm text-gray-600 mb-6 text-center">
            Choose a strong password to secure your account.
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
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wide text-gray-600"
              >
                New password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="confirm"
                className="block text-xs font-semibold uppercase tracking-wide text-gray-600"
              >
                Confirm password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                  placeholder="••••••••"
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
                  Updating password…
                </>
              ) : (
                'Update password'
              )}
            </button>
          </form>

          <div className="mt-6 flex justify-between text-xs text-gray-500">
            <Link to="/login" className="hover:text-purple-600 font-medium">
              Back to login
            </Link>
            <Link to="/forgot-password" className="hover:text-purple-600 font-medium">
              Resend reset link
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
