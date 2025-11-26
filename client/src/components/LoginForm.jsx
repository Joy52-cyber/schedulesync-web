// client/src/components/LoginForm.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import api from '../utils/api';

export default function LoginForm({ onLogin, mode = 'page' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isPanel = mode === 'panel';

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('📤 Attempting login:', email);
      const response = await api.auth.login(email, password);

      console.log('📥 Login response:', response.data);

      if (response.data.success && onLogin) {
        onLogin(response.data.token, response.data.user);
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setError(
        err.response?.data?.error || 'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      console.log('🟢 Google login clicked');
      const response = await api.oauth.getGoogleUrl();
      console.log('🟢 Google OAuth URL response:', response.data);
      
      if (response.data.url) {
        console.log('🟢 Redirecting to:', response.data.url);
        window.location.href = response.data.url;
      } else {
        throw new Error('No URL in response');
      }
    } catch (err) {
      console.error('❌ Google auth error:', err);
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to start Google login');
    }
  };

  // ✅ Updated with detailed logging and better error handling
  const handleCalendlyConnect = async () => {
    try {
      setError('');
      setLoading(true);
      console.log('🟣 Calendly connect clicked');
      console.log('🟣 API Base URL:', api.defaults.baseURL);

      const response = await api.oauth.getCalendlyUrl();
      console.log('🟣 Calendly OAuth URL response:', response.data);

      if (response.data.error) {
        setError(response.data.message || response.data.error);
        console.error('🟣 Calendly returned error:', response.data);
        setLoading(false);
        return;
      }

      if (response.data.url) {
        console.log('🟣 Redirecting to:', response.data.url);
        window.location.href = response.data.url;
      } else {
        throw new Error('No URL in response');
      }
    } catch (err) {
      console.error('❌ Calendly auth error:', err);
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText
      });
      
      // Handle 503 Service Unavailable (not configured)
      if (err.response?.status === 503) {
        setError('⚠️ Calendly integration is not yet configured. Please contact support or use another sign-in method.');
      } else {
        setError(
          err.response?.data?.message || 
          err.response?.data?.error || 
          'Failed to start Calendly login. Please try again or use another method.'
        );
      }
      setLoading(false);
    }
  };

  // ✅ Updated with detailed logging and better error handling
  const handleMicrosoftLogin = async () => {
    try {
      setError('');
      setLoading(true);
      console.log('🟦 Microsoft login clicked');
      console.log('🟦 API Base URL:', api.defaults.baseURL);

      const response = await api.oauth.getMicrosoftUrl();
      console.log('🟦 Microsoft OAuth URL response:', response.data);

      if (response.data.error) {
        setError(response.data.message || response.data.error);
        console.error('🟦 Microsoft returned error:', response.data);
        setLoading(false);
        return;
      }

      if (response.data.url) {
        console.log('🟦 Redirecting to:', response.data.url);
        window.location.href = response.data.url;
      } else {
        throw new Error('No URL in response');
      }
    } catch (err) {
      console.error('❌ Microsoft auth error:', err);
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText
      });
      
      // Handle 503 Service Unavailable (not configured)
      if (err.response?.status === 503) {
        setError('⚠️ Microsoft integration is not yet configured. Please contact support or use another sign-in method.');
      } else {
        setError(
          err.response?.data?.message || 
          err.response?.data?.error || 
          'Failed to start Microsoft login. Please try again or use another method.'
        );
      }
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header – only for full-page mode */}
      {!isPanel && (
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4 mt-4">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Mail className="h-5 w-5 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-600 text-sm">
            Sign in to your ScheduleSync account
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border-2 border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="p-3 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-xl text-sm">
          Connecting to OAuth provider...
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-md p-5">
        <form onSubmit={handleEmailLogin} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-gray-700"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm transition-all"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm transition-all"
              required
            />
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-xs text-gray-600">Remember me</span>
            </label>

            <Link
              to="/forgot-password"
              className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? 'Signing in...' : 'Sign in'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-[11px] text-gray-500 uppercase tracking-wide">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google + Calendly + Microsoft */}
        <div className="space-y-2">
          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white border-2 border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

          {/* Calendly */}
          <button
            type="button"
            onClick={handleCalendlyConnect}
            disabled={loading}
            className="w-full bg-white border-2 border-sky-200 text-sky-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-sky-50 hover:border-sky-300 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            Connect Calendly
          </button>

          {/* Microsoft */}
          <button
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full bg-white border-2 border-indigo-200 text-indigo-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex h-3.5 w-3.5 flex-wrap gap-[1px]">
              <span className="h-1.5 w-1.5 bg-red-500" />
              <span className="h-1.5 w-1.5 bg-green-500" />
              <span className="h-1.5 w-1.5 bg-blue-500" />
              <span className="h-1.5 w-1.5 bg-yellow-400" />
            </span>
            Continue with Microsoft
          </button>
        </div>
      </div>

      {/* Sign up link */}
      <p
        className={
          'text-xs text-gray-600 ' + (isPanel ? 'text-left' : 'text-center')
        }
      >
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="text-purple-600 hover:text-purple-700 font-semibold"
        >
          Sign up for free
        </Link>
      </p>
    </div>
  );
}