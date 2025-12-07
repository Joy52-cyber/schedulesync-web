import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Calendar, Mail, Lock, User, Eye, EyeOff, ArrowRight, Sparkles, Check } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://schedulesync-api-production.up.railway.app';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const getInitialTab = () => {
    if (location.pathname === '/login') return 'login';
    if (location.pathname === '/register' || location.pathname === '/signup') return 'signup';
    return 'login';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  useEffect(() => {
    const newPath = activeTab === 'login' ? '/login' : '/register';
    if (location.pathname !== newPath) {
      navigate(newPath, { replace: true });
    }
  }, [activeTab]);

  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [location.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (activeTab === 'login') {
        const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          navigate('/dashboard');
        }
      } else {
        if (!agreeTerms) {
          setError('Please agree to the Terms of Service and Privacy Policy');
          setIsLoading(false);
          return;
        }
        const response = await axios.post(`${API_BASE_URL}/api/auth/register`, { name, email, password });
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          navigate('/dashboard');
        } else {
          setSuccess('Account created! Please check your email to verify.');
          setActiveTab('login');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (provider) => {
    window.location.href = `${API_BASE_URL}/api/auth/${provider}`;
  };

  const features = [
    'AI-powered scheduling assistant',
    'Google & Outlook calendar sync',
    'Team scheduling & round-robin',
    'Custom booking pages',
    'Email reminders & templates'
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8 bg-white">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link to="/" className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">ScheduleSync</span>
          </Link>

          {/* Tab Switcher */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign up
            </button>
          </div>

          <h2 className="text-center text-2xl font-bold text-gray-900 mb-2">
            {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-center text-sm text-gray-500 mb-6">
            {activeTab === 'login' ? 'Log in to manage your scheduling' : 'Get started free — no credit card required'}
          </p>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button onClick={() => handleOAuthLogin('google')} className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <button onClick={() => handleOAuthLogin('microsoft')} className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              Continue with Microsoft
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 bg-white text-gray-400 uppercase tracking-wide">Or continue with email</span></div>
          </div>

          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-100 text-green-600 text-sm">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" required />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" required />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                {activeTab === 'login' && <Link to="/forgot-password" className="text-sm text-purple-600 hover:text-purple-700 font-medium">Forgot password?</Link>}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {activeTab === 'signup' && (
              <div className="flex items-start gap-2">
                <input type="checkbox" id="terms" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                <label htmlFor="terms" className="text-sm text-gray-500">
                  I agree to the <Link to="/terms" className="text-purple-600 hover:text-purple-700 font-medium">Terms of Service</Link> and <Link to="/privacy" className="text-purple-600 hover:text-purple-700 font-medium">Privacy Policy</Link>
                </label>
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{activeTab === 'login' ? 'Log in' : 'Create account'}<ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            {activeTab === 'login' ? <>Don't have an account? <button onClick={() => setActiveTab('signup')} className="text-purple-600 hover:text-purple-700 font-semibold">Sign up free</button></> : <>Already have an account? <button onClick={() => setActiveTab('login')} className="text-purple-600 hover:text-purple-700 font-semibold">Log in</button></>}
          </p>
        </div>
      </div>

      {/* Right Panel - Feature Showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl"></div>
        </div>
        <div className="relative flex flex-col justify-center px-12 py-16">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-6 h-6 text-pink-300" />
              <span className="text-pink-200 font-medium text-sm uppercase tracking-wide">AI-Powered Scheduling</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">Scheduling made<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-200 to-white">effortless</span></h1>
            <p className="text-lg text-purple-100 mb-8 leading-relaxed">Join thousands of professionals who save hours every week with intelligent scheduling.</p>
            <ul className="space-y-4">
              {features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-white/90">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><Check className="w-4 h-4 text-white" /></div>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}