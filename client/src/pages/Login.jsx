import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  ArrowRight,
  Calendar,
  Users,
  Sparkles,
  Zap,
} from 'lucide-react';
import api from '../utils/api';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('📤 Attempting login:', email);
      const response = await api.auth.login(email, password);

      console.log('📥 Login response:', response.data);

      if (response.data.success) {
        onLogin(response.data.token, response.data.user);
        navigate('/dashboard');
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      const response = await api.oauth.getGoogleUrl();
      window.location.href = response.data.url;
    } catch (err) {
      console.error('Google auth error:', err);
      setError('Failed to start Google login');
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Logo / Brand */}
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <Calendar className="h-7 w-7 text-white" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Welcome back
            </h1>
            <p className="text-gray-600 text-sm">
              Sign in to your ScheduleSync workspace
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Login Card */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-lg p-6 space-y-6">
            <form onSubmit={handleEmailLogin} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>Email address</span>
                  </div>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-sm"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-gray-500" />
                    <span>Password</span>
                  </div>
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-sm"
                  required
                />
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-purple-600 hover:text-purple-700 font-semibold"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {loading ? 'Signing in...' : 'Sign in'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs font-medium text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-white border border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-2 text-sm"
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
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-gray-600 text-xs sm:text-sm">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="text-purple-600 hover:text-purple-700 font-semibold"
            >
              Create a free workspace
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Promo / Marketing Panel */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-10 items-center justify-center relative overflow-hidden">
        {/* Glow background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-20 -left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-lg text-white space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur">
            <Sparkles className="h-4 w-4" />
            <span>Built for teams that live in their calendar</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              Turn scheduling chaos into a shared, smart calendar brain.
            </h2>
            <p className="text-sm sm:text-base text-white/85">
              ScheduleSync connects your team&apos;s availability, external
              booking links, and AI recommendations so you stop playing meeting
              Tetris in your inbox.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">Multi-member routing</p>
                <p className="text-xs text-white/80">
                  Individual, round-robin, collective, and first-available
                  modes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">AI slot suggestions</p>
                <p className="text-xs text-white/80">
                  Ranked time slots based on conflicts, priorities, and
                  preferences.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/20">
            <p className="text-xs text-white/70">
              “We cut our back-and-forth scheduling emails by more than 70% in
              the first week.”
            </p>
            <p className="text-xs font-semibold mt-1">
              — ScheduleSync early access team
            </p>
          </div>
                    {/* Promo CTA */}
          <div className="pt-4 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 text-white/90 text-xs border border-white/20 hover:bg-white/15 transition"
            >
              Learn more on homepage
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
