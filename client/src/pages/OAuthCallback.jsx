import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('🔍 OAuthCallback - code:', code ? 'present' : 'missing');
    console.log('🔍 OAuthCallback - state:', state);
    console.log('🔍 OAuthCallback - error:', error);

    // Handle OAuth error
    if (error) {
      console.error('❌ OAuth error:', error);
      navigate('/login?error=oauth_failed');
      return;
    }

    // No code means something went wrong
    if (!code) {
      console.error('❌ No OAuth code received');
      navigate('/login');
      return;
    }

    // Booking flow - pass code to BookingPage
    if (state?.startsWith('booking:')) {
      console.log('📋 Booking OAuth detected');
      const parts = state.split(':');
      const bookingToken = parts[1];
      
      console.log('🔀 Redirecting to booking page with code');
      // Pass the code and state as URL params to BookingPage
      navigate(`/book/${bookingToken}?code=${code}&state=${state}`, { replace: true });
      return;
    }

    // Regular dashboard login flow
    console.log('🏠 Dashboard OAuth detected');
    
    (async () => {
      try {
        const provider = state?.includes('microsoft') ? 'microsoft' : 'google';
        
        const resp = await fetch(`${import.meta.env.VITE_API_URL}/auth/${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!resp.ok) throw new Error('Auth failed');

        const data = await resp.json();
        localStorage.setItem('token', data.token);
        navigate('/dashboard');
      } catch (err) {
        console.error('❌ Dashboard auth failed:', err);
        navigate('/login?error=auth_failed');
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