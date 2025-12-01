// client/src/pages/OAuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { oauth } from '../utils/api';

// CRITICAL: Module-level guard survives component re-renders
const processedCodes = new Set();
let isProcessing = false;

export default function OAuthCallback({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Detect provider from path
    const path = location.pathname || '';
    let provider = 'google';
    if (path.includes('microsoft')) {
      provider = 'microsoft';
    } else if (path.includes('calendly')) {
      provider = 'calendly';
    }

    console.log('🔵 OAuthCallback mounted:', {
      hasCode: !!code,
      state,
      error,
      provider,
      path,
    });

    // Handle OAuth error sent back from provider
    if (error) {
      console.error('❌ OAuth error from provider:', error);
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    // No code = something went wrong
    if (!code) {
      console.error('❌ No OAuth code in URL');
      navigate('/login', { replace: true });
      return;
    }

    // Already processing any code
    if (isProcessing) {
      console.log('⚠️ Already processing a request, ignoring duplicate');
      return;
    }

    // This code already processed
    if (processedCodes.has(code)) {
      console.log('⚠️ This code already processed, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

    // Mark as processing IMMEDIATELY
    isProcessing = true;
    processedCodes.add(code);
    console.log('🔒 Code marked as processing for provider:', provider);

    // Clear query string but keep the provider-specific path
    window.history.replaceState({}, '', location.pathname);

    // 1️⃣ Booking flow (guest OAuth for booking pages)
    if (state?.startsWith('guest-booking:')) {
      console.log('📋 Booking OAuth flow');

      const parts = state.split(':');
      const bookingToken = parts[1];
      const provider = parts[2];

      // Get stored return URL or fallback to token-based URL
      const returnUrl = sessionStorage.getItem('booking-oauth-return-url') || `/book/${bookingToken}`;
      sessionStorage.removeItem('booking-oauth-return-url');

      console.log('🔙 Redirecting back to:', returnUrl);

      isProcessing = false; // Release lock
      navigate(`${returnUrl}?code=${code}&state=${state}`, {
        replace: true,
      });
      return;
    }

    // 2️⃣ Dashboard login / account connect flow
    console.log('🏠 Dashboard OAuth flow - processing login for:', provider);

    (async () => {
      try {
        let res;

        if (provider === 'google') {
          console.log('📡 Calling backend /auth/google/callback ...');
          res = await oauth.handleGoogleCallback(code);
        } else if (provider === 'microsoft') {
          console.log('📡 Calling backend /auth/microsoft/callback ...');
          res = await oauth.handleMicrosoftCallback(code);
        } else if (provider === 'calendly') {
          console.log('📡 Calling backend /auth/calendly/callback ...');
          res = await oauth.handleCalendlyCallback(code);
        } else {
          throw new Error(`Unsupported provider: ${provider}`);
        }

        const response = res.data;
        console.log('✅ Raw OAuth backend response:', response);

        // Normalize token & user shapes from different backends
        let token =
          response?.token ??
          response?.accessToken ??
          response?.jwt ??
          response?.data?.token ??
          null;

        let user =
          response?.user ??
          response?.data?.user ??
          response?.currentUser ??
          null;

        // Some providers (e.g., Calendly connect) might not return a "user" for app login
        if (!user) {
          console.warn(
            `⚠️ No user object returned for provider ${provider}. Response:`,
            response
          );

          isProcessing = false;
          processedCodes.delete(code);

          const msg =
            response?.message ||
            response?.error ||
            'Authentication failed. Please sign in again.';
          navigate(`/login?error=${encodeURIComponent(msg)}`, {
            replace: true,
          });
          return;
        }

        // If token is missing but backend uses httpOnly cookies,
        // we can still proceed; /auth/me should work later.
        if (!token) {
          console.warn(
            `⚠️ No token in OAuth response for ${provider}, proceeding with user only`
          );
        }

        console.log('🔐 Updating app state via onLogin...');
        if (typeof onLogin === 'function') {
          onLogin(token || '', user);
        } else {
          console.warn('⚠️ onLogin prop is not a function');
        }

        // Release lock; navigation is likely handled upstream
        isProcessing = false;
      } catch (err) {
        console.error('❌ OAuth failed:', {
          message: err.message,
          response: err.response?.data,
        });

        isProcessing = false;
        processedCodes.delete(code);

        const errorMsg =
          err.response?.data?.hint ||
          err.response?.data?.error ||
          'Authentication failed. Please try again.';
        navigate(`/login?error=${encodeURIComponent(errorMsg)}`, {
          replace: true,
        });
      }
    })();

    return () => {
      console.log('🧹 OAuthCallback unmounting');
    };
  }, [navigate, searchParams, location, onLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
        <p className="text-white text-lg font-medium">Signing you in...</p>
        <p className="text-white text-sm mt-2 opacity-80">
          This should only take a moment
        </p>
      </div>
    </div>
  );
}