import { useState } from 'react';
import { Loader2, Sparkles, Calendar, Users, Zap, CheckCircle, Star, TrendingUp, Shield, Clock, Link as LinkIcon, Bell, Mail, Lock } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginMode, setLoginMode] = useState('google'); // 'google' or 'email'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🔵 Initiating Google OAuth...');

      const apiUrl = import.meta.env.VITE_API_URL || 'https://schedulesync-web-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/google/url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.url) {
        console.log('✅ Redirecting to Google OAuth');
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL received from server');
      }
    } catch (error) {
      console.error('❌ Google auth error:', error);
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('Email/password login coming soon! For now, please use Google Sign-In.');
    // TODO: Implement email/password authentication
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="w-full max-w-md">
          
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-xl">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome to ScheduleSync</h1>
            <p className="text-gray-600 text-lg">
              Sign in to manage your schedule smarter
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 border-2 border-gray-100">
            
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Login Mode Tabs */}
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setLoginMode('google')}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all ${
                  loginMode === 'google'
                    ? 'bg-white shadow-md text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Connect to Google
              </button>
              <button
                onClick={() => setLoginMode('email')}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all ${
                  loginMode === 'email'
                    ? 'bg-white shadow-md text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Email & Password
              </button>
            </div>

            {/* Google Sign In */}
            {loginMode === 'google' && (
              <>
                {/* Value Proposition */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 mb-1">Why Connect Google?</h3>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        Instantly sync your calendar, see real availability, and let AI find perfect meeting times automatically.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Google Button */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-2xl transition-all font-bold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg group hover:scale-[1.02]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="h-6 w-6" viewBox="0 0 24 24">
                        <path fill="#FFFFFF" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#FFFFFF" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FFFFFF" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#FFFFFF" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span>Connect with Google</span>
                    </>
                  )}
                </button>
              </>
            )}

            {/* Email/Password Form */}
            {loginMode === 'email' && (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </div>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Password
                    </div>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500" />
                    <span className="text-sm text-gray-600">Remember me</span>
                  </label>
                  <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-2xl transition-all font-bold text-lg hover:scale-[1.02]"
                >
                  Sign In
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500 font-semibold">or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold flex items-center justify-center gap-3"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
              </form>
            )}

            {/* Benefits - Only show for Google mode */}
            {loginMode === 'google' && (
              <div className="mt-8 pt-6 border-t-2 border-gray-100">
                <p className="text-xs font-bold text-gray-700 mb-4 text-center uppercase tracking-wide">What You Get</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Auto Calendar Sync</p>
                      <p className="text-xs text-gray-600">Real-time availability from Google Calendar</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">AI Scheduling Assistant</p>
                      <p className="text-xs text-gray-600">Natural language booking in seconds</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <LinkIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Shareable Links</p>
                      <p className="text-xs text-gray-600">Let others book instantly</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Time Savings */}
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border-2 border-yellow-300">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-6 w-6 text-orange-600" />
                <p className="text-lg font-bold text-gray-900">Save 5+ Hours Per Week</p>
              </div>
              <p className="text-xs text-center text-gray-700">
                Stop endless email threads. Automate your scheduling.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => loginMode === 'google' ? handleGoogleAuth() : null}
                className="text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                Sign up free
              </button>
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Shield className="h-4 w-4" />
              <span>Enterprise-grade security & privacy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Keep existing advertisement section... */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-12 items-center justify-center relative overflow-hidden">
        {/* ... (keep all the existing right side content) ... */}
      </div>
    </div>
  );
}