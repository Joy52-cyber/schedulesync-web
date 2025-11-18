import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { handleOrganizerOAuthCallback } from '../utils/api';

// CRITICAL: Track processed codes globally to prevent double-processing
const processedCodes = new Set();

export default function OAuthCallback({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('🔵 OAuthCallback mounted');

    // Handle OAuth error
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

    // CRITICAL: Prevent processing the same code twice
    if (processedCodes.has(code)) {
      console.log('⚠️ Code already processed, skipping');
      return;
    }

    // Mark code as being processed
    processedCodes.add(code);
    console.log('✅ Code marked for processing');

    // Booking flow
    if (state?.startsWith('booking:')) {
      console.log('📋 Booking OAuth - redirecting to BookingPage');
      const parts = state.split(':');
      const bookingToken = parts[1];
      navigate(`/book/${bookingToken}?code=${code}&state=${state}`, { replace: true });
      return;
    }

    // Dashboard login flow
    console.log('🏠 Dashboard OAuth - processing login');
    
    (async () => {
      try {
        console.log('📡 Exchanging code for token...');
        const response = await handleOrganizerOAuthCallback(code);
        
        console.log('✅ OAuth successful:', response.user.email);
        
        if (!response.token || !response.user) {
          throw new Error('Invalid response from server');
        }
        
        // Call parent's onLogin to update app state
        console.log('🔐 Updating app state...');
        onLogin(response.token, response.user);
        
        console.log('✅ Redirecting to dashboard...');
        
        // Clear the code from URL before redirecting
        window.history.replaceState({}, '', '/oauth/callback');
        
        // Use setTimeout to ensure state is fully updated
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
        
      } catch (err) {
        console.error('❌ OAuth callback failed:', err);
        
        // Remove code from processed set on failure so user can retry
        processedCodes.delete(code);
        
        navigate('/login?error=auth_failed', { replace: true });
      }
    })();
  }, []); // Empty deps - only run once on mount

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
        <p className="text-white text-lg">Completing authentication...</p>
        <p className="text-white text-sm mt-2">Please wait...</p>
      </div>
    </div>
  );
}