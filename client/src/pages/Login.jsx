import { useState } from 'react';
import { Loader2, Sparkles, Calendar, Users, Zap, CheckCircle, Star, TrendingUp, Shield } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🔵 Initiating Google OAuth...');

      const apiUrl = import.meta.env.VITE_API_URL || 'https://schedulesync-web-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/google/url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.url) {
        console.log('✅ Redirecting to Google OAuth');
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL received from server');
      }
    } catch (error) {
      console.error('❌ Google auth error:', error);
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="w-full max-w-md">
          
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-xl">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600 text-lg">
              Sign in to ScheduleSync
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 border-2 border-gray-100">
            
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full bg-white border-2 border-gray-300 text-gray-700 py-4 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg group"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-base">Continue with Google</span>
                </>
              )}
            </button>

            {/* Benefits */}
            <div className="mt-8 pt-6 border-t-2 border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-4 text-center">Why Sign In?</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-700">Manage your team schedules</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-700">Automatic calendar sync</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-700">Smart booking management</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
         
<div className="mt-6 text-center space-y-3">
  <p className="text-sm text-gray-600">
    Don't have an account?{' '}
    <button
      onClick={handleGoogleAuth}
      className="text-blue-600 hover:text-blue-700 font-semibold"
    >
      Sign up with Google
    </button>
  </p>
  <p className="text-xs text-gray-500">
    🔒 Secure authentication powered by Google
  </p>
</div>
        </div>
      </div>

      {/* Right Side - Advertisement Section */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-12 items-center justify-center relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-white rounded-full blur-3xl"></div>
        </div>

        {/* Ad Content */}
        <div className="relative z-10 max-w-lg space-y-8 text-white">
          {/* Header */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              AI-Powered Scheduling
            </div>
            <h2 className="text-5xl font-bold text-white leading-tight">
              Smart Meeting Coordination
            </h2>
            <p className="text-white/90 text-xl leading-relaxed">
              Let our intelligent system find the perfect meeting times. Save hours every week with automated scheduling.
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
              <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg mb-1">AI Recommendations</h4>
                <p className="text-white/80 text-sm">
                  Get ranked time suggestions based on everyone's availability
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
              <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg mb-1">Team Management</h4>
                <p className="text-white/80 text-sm">
                  Coordinate multiple team members with ease
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
              <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg mb-1">Instant Sync</h4>
                <p className="text-white/80 text-sm">
                  Automatic integration with Google Calendar
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <p className="text-4xl font-bold text-white">10K+</p>
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <p className="text-white/70 text-sm">Active Users</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <p className="text-4xl font-bold text-white">99%</p>
                <Star className="h-5 w-5 text-white fill-white" />
              </div>
              <p className="text-white/70 text-sm">Satisfaction</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <p className="text-4xl font-bold text-white">5hrs</p>
                <Zap className="h-5 w-5 text-white" />
              </div>
              <p className="text-white/70 text-sm">Saved/Week</p>
            </div>
          </div>

          {/* Testimonial */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xl font-bold">
                MR
              </div>
              <div>
                <p className="text-white font-bold">Michael Rodriguez</p>
                <p className="text-white/70 text-sm">Product Manager at TechCorp</p>
              </div>
            </div>
            <div className="flex gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <p className="text-white/90 text-sm leading-relaxed italic">
              "ScheduleSync transformed how our team coordinates meetings. The AI recommendations are incredibly accurate and save us hours every week!"
            </p>
          </div>

          {/* Trust Badge */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <Shield className="h-5 w-5 text-white/70" />
            <p className="text-white/70 text-sm">Enterprise-grade security & privacy</p>
          </div>
        </div>
      </div>
    </div>
  );
}