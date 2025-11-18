import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { handleOrganizerOAuthCallback } from '../utils/api';

export default function OAuthCallback({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasProcessed = useRef(false);

  useEffect(() => {
    console.log('🔵 OAuthCallback mounted');
    
    // Prevent double processing
    if (hasProcessed.current) {
      console.log('⚠️ Already processed, skipping');
      return;
    }
    hasProcessed.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('🔍 OAuth params:', { 
      hasCode: !!code, 
      state, 
      error 
    });

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
        console.log('📡 Calling backend OAuth callback...');
        const response = await handleOrganizerOAuthCallback(code);
        
        console.log('✅ OAuth response:', {
          hasToken: !!response.token,
          hasUser: !!response.user,
          email: response.user?.email
        });
        
        if (!response.token || !response.user) {
          throw new Error('Invalid response from server');
        }
        
        // CRITICAL: Call the parent's onLogin to update app state
        console.log('🔐 Calling onLogin to update app state...');
        onLogin(response.token, response.user);
        
        console.log('✅ App state updated, forcing page reload...');
// Force full page reload to ensure token is set everywhere
window.location.href = '/dashboard';
        
      } catch (err) {
        console.error('❌ OAuth callback failed:', err);
        console.error('Error details:', err.response?.data || err.message);
        navigate('/login?error=auth_failed', { replace: true });
      }
    })();
  }, [navigate, searchParams, onLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
        <p className="text-white text-lg">Completing authentication...</p>
      </div>
    </div>
  );
}