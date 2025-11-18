import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { handleOrganizerOAuthCallback } from '../utils/api';

export default function OAuthCallback({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('🔵 OAuthCallback:', { code: code?.substring(0, 10) + '...', state, error });

    // Handle OAuth error
    if (error) {
      console.error('❌ OAuth error:', error);
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    if (!code) {
      console.error('❌ No code in URL');
      navigate('/login', { replace: true });
      return;
    }

    // CRITICAL: Check if this code was already processed
    const processedKey = `oauth_processed_${code}`;
    if (sessionStorage.getItem(processedKey)) {
      console.log('⚠️ Code already processed in this session, redirecting...');
      navigate('/dashboard', { replace: true });
      return;
    }

    // Mark as processing IMMEDIATELY
    sessionStorage.setItem(processedKey, 'true');
    console.log('🔒 Code locked for processing');

    // Booking flow
    if (state?.startsWith('booking:')) {
      console.log('📋 Booking flow detected');
      const bookingToken = state.split(':')[1];
      navigate(`/book/${bookingToken}?code=${code}&state=${state}`, { replace: true });
      return;
    }

    // Dashboard login
    console.log('🏠 Processing dashboard login...');
    
    // Clean URL immediately to prevent back button issues
    window.history.replaceState({}, '', '/oauth/callback');
    
    (async () => {
      try {
        console.log('📡 Calling backend...');
        const response = await handleOrganizerOAuthCallback(code);
        
        console.log('✅ Response received:', response.user.email);
        
        // Update app state
        onLogin(response.token, response.user);
        
        console.log('✅ State updated, redirecting...');
        
        // Force full reload
        window.location.href = '/dashboard';
        
      } catch (err) {
        console.error('❌ Failed:', err.response?.data || err.message);
        
        // Clear the processed flag on error so user can retry
        sessionStorage.removeItem(processedKey);
        
        navigate('/login?error=auth_failed', { replace: true });
      }
    })();

    // Cleanup function
    return () => {
      console.log('🧹 OAuthCallback unmounting');
    };
  }, []); // EMPTY DEPS - run once only

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