import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle OAuth errors
        if (error) {
          console.error('OAuth error:', error);
          navigate('/');
          return;
        }

        if (!code || !state) {
          console.error('Missing code or state');
          navigate('/');
          return;
        }

        // Extract booking token from state
        // Format: "booking:TOKEN" or "booking:TOKEN:google"
        const parts = state.split(':');
        const bookingToken = parts[1];
        const provider = parts[2] || 'google';

        if (!bookingToken) {
          console.error('Invalid state parameter');
          navigate('/');
          return;
        }

        console.log('🔐 Processing OAuth callback:', { provider, bookingToken });

        // Call backend to exchange code for tokens
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        const resp = await fetch(`${apiUrl}/book/auth/${provider}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            code, 
            bookingToken 
          }),
        });

        if (!resp.ok) {
          throw new Error('Authentication failed');
        }

        const data = await resp.json();

console.log('✅ OAuth successful:', data);

navigate(`/book/${bookingToken}?oauth=success&provider=${provider}`, {
  replace: true,
  state: { 
    guestAuth: {
      signedIn: true,
      hasCalendarAccess: data.hasCalendarAccess || false,
      provider: provider,
      email: data.email || '',
      name: data.name || '',
      accessToken: data.accessToken,  // ← ADD THIS
      refreshToken: data.refreshToken,  // ← ADD THIS
    }
  }
});

      } catch (error) {
        console.error('❌ OAuth callback error:', error);
        navigate('/?error=oauth_failed');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
        <p className="text-white text-lg font-medium">Connecting your calendar...</p>
        <p className="text-white/80 text-sm mt-2">Please wait</p>
      </div>
    </div>
  );
}