import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Calendar } from 'lucide-react';
import { auth } from '../utils/api';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  
  // Check for OAuth code immediately to prevent flash
  const urlParams = new URLSearchParams(window.location.search);
  const hasOAuthCode = urlParams.has('code');
  
  // State management
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processingOAuth, setProcessingOAuth] = useState(hasOAuthCode);
  
  // Ref to prevent double processing in development (React.StrictMode)
  const isProcessingRef = useRef(false);
  const hasProcessedRef = useRef(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const redirectUri = `${window.location.origin}/login`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    // Only process if we have a code and haven't processed it yet
    if (code && !hasProcessedRef.current && !isProcessingRef.current) {
      // Mark as processing immediately
      isProcessingRef.current = true;
      hasProcessedRef.current = true;
      
      // Check sessionStorage as additional safety
      const alreadyProcessing = sessionStorage.getItem('oauth-processing');
      if (alreadyProcessing === code) {
        console.log('OAuth code already processed, skipping...');
        return;
      }
      
      // Store the code in sessionStorage to prevent reprocessing
      sessionStorage.setItem('oauth-processing', code);
      
      // Clean URL immediately to prevent browser refresh issues
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const handleOAuth = async () => {
        try {
          console.log('🔄 Processing OAuth code (single execution)...');
          
          // Call the backend to exchange code for tokens
          const response = await auth.googleLogin(code);
          
          if (response.data && response.data.token) {
            console.log('✅ OAuth successful!');
            
            // Store credentials
            onLogin(response.data.token, response.data.user);
            
            // Clean up
            sessionStorage.removeItem('oauth-processing');
            
            // Navigate to dashboard
            navigate('/dashboard', { replace: true });
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (err) {
          console.error('❌ OAuth failed:', {
            error: err.response?.data?.error || err.message,
            details: err.response?.data?.error_description,
            status: err.response?.status
          });
          
          // Determine user-friendly error message
          let errorMessage = 'Authentication failed. Please try again.';
          
          if (err.response?.data?.error === 'invalid_grant') {
            errorMessage = 'Login session expired. Please try again.';
          } else if (err.response?.status === 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (err.response?.data?.message) {
            errorMessage = err.response.data.message;
          }
          
          setError(errorMessage);
          setLoading(false);
          setProcessingOAuth(false);
          
          // Clean up
          sessionStorage.removeItem('oauth-processing');
          isProcessingRef.current = false;
        }
      };
      
      // Small delay to ensure state is set
      setTimeout(handleOAuth, 100);
    } else if (code && hasProcessedRef.current) {
      console.log('OAuth code already processed in this session');
      // Clean URL if code is still there
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []); // Empty dependency array - run only once

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    // You can implement email login here later
    setError('Email login coming soon. Please use Google Sign-In.');
  };

  const handleGoogleLogin = () => {
  setLoading(true);
  setError('');
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${googleClientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events` + // ✅ ADD .events
    `&access_type=offline` +
    `&prompt=consent`;
  
  window.location.href = authUrl;
};
    
    // Build OAuth URL without prompt=consent (only show consent when needed)
    const authParams = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',
      // Only use prompt=select_account if you want account chooser
      // prompt: 'select_account'
    });
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
    
    // Redirect to Google OAuth
    window.location.href = authUrl;
  };

  // Show loading screen immediately when processing OAuth (prevents flash)
  if (processingOAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
        <div className="text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
            <p className="text-white text-lg font-medium">Completing sign in...</p>
            <p className="text-white/80 text-sm mt-2">Please wait while we authenticate you</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl px-10 py-12 animate-fadeIn">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl mb-4 shadow-lg transform hover:scale-105 transition-transform">
              <Calendar className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-blue-600 mb-2">ScheduleSync</h1>
            <p className="text-gray-500 text-lg">Welcome back!</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl animate-fadeIn">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          {/* Google Sign-In Button */}
          <div className="mb-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
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
              <span className="text-base font-semibold text-gray-700 group-hover:text-gray-900">
                {loading ? 'Redirecting...' : 'Continue with Google'}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or sign in with email</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
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
              <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign In with Email
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              By signing in, you agree to our{' '}
              <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
              {' and '}
              <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add this to your global CSS for smooth animations
/*
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}
*/