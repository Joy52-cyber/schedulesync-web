import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { handleOrganizerOAuthCallback } from '../utils/api';

// CRITICAL: Module-level guard survives component re-renders
const processedCodes = new Set();
let isProcessing = false;

export default function OAuthCallback({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('🔵 OAuthCallback mounted:', { hasCode: !!code, state, error });

    // Handle OAuth error from Google
    if (error) {
      console.error('❌ OAuth error from Google:', error);
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
    console.log('🔒 Code marked as processing');

    // Clear URL immediately
    window.history.replaceState({}, '', '/oauth/callback');

    // Booking flow
    if (state?.startsWith('booking:')) {
      console.log('📋 Booking OAuth flow');
      const bookingToken = state.split(':')[1];
      isProcessing = false; // Release lock
      navigate(`/book/${bookingToken}?code=${code}&state=${state}`, { replace: true });
      return;
    }

    // Dashboard login flow
    console.log('🏠 Dashboard OAuth flow - processing login');

    (async () => {
      try {
        console.log('📡 Calling backend /auth/google/callback ...');
        const response = await handleOrganizerOAuthCallback(code);

        console.log('✅ Raw OAuth backend response:', response);

        // Try to normalize different possible backend shapes
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

        if (!user) {
          console.error('❌ Backend did not return a user object:', response);

          isProcessing = false;
          processedCodes.delete(code);

          const msg =
            response?.message ||
            response?.error ||
            'Authentication failed. Please sign in again.';
          navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true });
          return;
        }

        // If token is missing but backend uses httpOnly cookies,
        // we can still proceed; /auth/me should work later.
        if (!token) {
          console.warn('⚠️ No token in OAuth response, proceeding with user only');
        }

        console.log('🔐 Updating app state via onLogin...');
        if (typeof onLogin === 'function') {
          onLogin(token || '', user);
        } else {
          console.warn('⚠️ onLogin prop is not a function');
        }

        // Release lock and redirect
        isProcessing = false;
        navigate('/dashboard', { replace: true });
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
        navigate(`/login?error=${encodeURIComponent(errorMsg)}`, { replace: true });
      }
    })();

    return () => {
      console.log('🧹 OAuthCallback unmounting');
    };
  }, [navigate, searchParams, onLogin]);

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
