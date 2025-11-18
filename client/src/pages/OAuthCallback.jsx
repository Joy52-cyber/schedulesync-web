import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { handleOrganizerOAuthCallback } from '../utils/api';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('🔍 OAuthCallback:', { code: !!code, state, error });

    // Handle OAuth error
    if (error) {
      console.error('❌ OAuth error:', error);
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    // No code = something went wrong
    if (!code) {
      console.error('❌ No OAuth code received');
      navigate('/login', { replace: true });
      return;
    }

    // Booking flow - redirect to BookingPage with code
    if (state?.startsWith('booking:')) {
      console.log('📋 Booking OAuth - redirecting to BookingPage');
      const parts = state.split(':');
      const bookingToken = parts[1];
      navigate(`/book/${bookingToken}?code=${code}&state=${state}`, { replace: true });
      return;
    }

    // Dashboard login flow - process OAuth
    console.log('🏠 Dashboard OAuth - processing login');
    
    (async () => {
      try {
        const response = await handleOrganizerOAuthCallback(code);
        
        console.log('✅ OAuth successful:', response.user.email);
        
        // Save auth data
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('❌ OAuth callback failed:', err);
        navigate('/login?error=auth_failed', { replace: true });
      }
    })();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
        <p className="text-white text-lg">Completing authentication...</p>
      </div>
    </div>
  );
}