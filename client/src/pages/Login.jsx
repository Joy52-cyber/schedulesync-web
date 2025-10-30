import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Calendar } from 'lucide-react';
import { auth } from '../utils/api';

export default function Login({ onLogin }) {
  const navigate = useNavigate();

  // This must match what's registered in Google console
  const redirectUri = `${window.location.origin}/login`;
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const urlParams = new URLSearchParams(window.location.search);
  const hasOAuthCode = urlParams.has('code');
  const sessionFlag = sessionStorage.getItem('processing-oauth') === 'true';

  const [processingOAuth, setProcessingOAuth] = useState(hasOAuthCode || sessionFlag);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const didProcessRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    // No code → make sure spinner is off
    if (!code) {
      setProcessingOAuth(false);
      sessionStorage.removeItem('processing-oauth');
      return;
    }

    if (didProcessRef.current) return;
    didProcessRef.current = true;

    sessionStorage.setItem('processing-oauth', 'true');
    setProcessingOAuth(true);
    setLoading(true);

    // Clean URL
    window.history.replaceState({}, document.title, '/login');

    (async () => {
      try {
        // IMPORTANT: send ONLY the code (original API shape)
        const response = await auth.googleLogin(code);

        onLogin(response.data.token, response.data.user);

        if (response?.data?.user?.calendarSyncEnabled) {
          localStorage.setItem('hasGoogleRefreshToken', 'true');
        }

        sessionStorage.removeItem('processing-oauth');
        setProcessingOAuth(false);
        setLoading(false);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('❌ OAuth failed:', err?.response?.data || err);
        setError('Authentication failed. Please try again.');
        sessionStorage.removeItem('processing-oauth');
        setProcessingOAuth(false);
        setLoading(false);
        didProcessRef.current = false;
      }
    })();
  }, [onLogin, navigate]);

  const handleEmailLogin = (e) => {
    e.preventDefault();
    setError('Email login not yet implemented. Please use Google.');
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setError('');

    const firstTime = localStorage.getItem('hasGoogleRefreshToken') !== 'true';

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',
      include_granted_scopes: 'true'
    });

    if (firstTime) {
      params.set('prompt', 'consent');
    }

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  if (processingOAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
        <div className="text-center animate-fadeIn">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">Completing sign in...</p>
          <p className="text-white/80 text-sm mt-2">Please wait while we authenticate you</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl px-10 py-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl mb-4 shadow-lg">
              <Calendar className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-blue-600 mb-2">ScheduleSync</h1>
            <p className="text-gray-500 text-lg">Welcome back!</p>
          </div>

          <div className="mb-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 text-gray-600 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span className="text-sm font-semibold text-gray-700">
                {loading ? 'Redirecting...' : 'Continue with Google'}
              </span>
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or sign in with email</span>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl animate-fadeIn">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="text-right">
              <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Forgot password?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
