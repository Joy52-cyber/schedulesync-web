import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { handleOrganizerOAuthCallback } from '../utils/api';

export default function OAuthCallback({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution
    if (hasProcessed.current) {
      console.log('⚠️ Already processed, skipping');
      return;
    }
    hasProcessed.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('🔵 OAuthCallback started:', { 
      hasCode: !!code, 
      state, 
      error 
    });

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

    // Check if already processed in this session
    const processedKey = `oauth_processed_${code}`;
    if (sessionStorage.getItem(processedKey)) {
      console.log('⚠️ Code already processed in this session');
      navigate('/dashboard', { replace: true });
      return;
    }

    // Mark as processing immediately
    sessionStorage.setItem(processedKey, 'true');
    console.log('🔒 Code marked as processing');

    // Clear URL to prevent reprocessing on refresh
    window.history.replaceState({}, '', '/oauth/callback');

    // Handle booking flow (guest OAuth)
    if (state?.startsWith('booking:')) {
      console.log('📋 Booking OAuth flow detected');
      const bookingToken = state.split(':')[1];
      navigate(`/book/${bookingToken}?code=${code}&state=${state}`, { replace: true });
      return;
    }

    // Handle dashboard login flow
    console.log('🏠 Dashboard OAuth flow - processing login');
    
    (async () => {
      try {
        console.log('📡 Exchanging code for tokens...');
        const response = await handleOrganizerOAuthCallback(code);
        
        console.log('✅ OAuth successful:', response.user.email);
        
        if (!response.token || !response.user) {
          throw new Error('Invalid response: missing token or user data');
        }
        
        // Update app state via parent component
        console.log('🔐 Updating app authentication state...');
        onLogin(response.token, response.user);
        
        console.log('✅ Authentication complete, redirecting to dashboard...');
        
        // Small delay to ensure state is saved
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
        
      } catch (err) {
        console.error('❌ OAuth callback failed:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        
        // Clear processed flag on error so user can retry
        sessionStorage.removeItem(processedKey);
        
        // Show appropriate error message
        const errorMsg = err.response?.data?.hint || 'Authentication failed. Please try again.';
        navigate(`/login?error=${encodeURIComponent(errorMsg)}`, { replace: true });
      }
    })();

  }, []); // Empty deps - run once only

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
        <p className="text-white text-lg font-medium">Signing you in...</p>
        <p className="text-white text-sm mt-2 opacity-80">This should only take a moment</p>
      </div>
    </div>
  );
}