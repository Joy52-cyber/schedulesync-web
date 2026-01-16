import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Users,
  Mail,
  Check,
  X,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Lock,
  ArrowRight,
  Building2,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';
import api from '../utils/api';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  
  // For signup flow
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // State
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/invitations/${token}`);
      setInvitation(response.data.invitation);
      setName(response.data.invitation.name || '');
    } catch (err) {
      console.error('Load invitation error:', err);
      setError(err.response?.data?.error || 'Failed to load invitation');
      setErrorCode(err.response?.data?.code);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptLoggedIn = async () => {
    try {
      setAccepting(true);
      const response = await api.post(`/invitations/${token}/accept`);
      setSuccess(true);
      setSuccessMessage(response.data.message || `You've joined ${invitation.team.name}!`);
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Accept error:', err);
      setError(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleAcceptSignup = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    try {
      setAccepting(true);
      setError(null);
      
      const response = await api.post(`/invitations/${token}/accept-signup`, {
        name,
        password
      });
      
      // Store the token
      localStorage.setItem('token', response.data.token);
      
      setSuccess(true);
      setSuccessMessage(response.data.message || `Welcome to ${invitation.team.name}!`);
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.response?.data?.error || 'Failed to create account');
      
      // If account exists, suggest login
      if (err.response?.data?.code === 'ACCOUNT_EXISTS') {
        setErrorCode('ACCOUNT_EXISTS');
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;
    
    try {
      setDeclining(true);
      await api.post(`/invitations/${token}/decline`);
      setError('Invitation declined');
      setErrorCode('DECLINED');
    } catch (err) {
      console.error('Decline error:', err);
    } finally {
      setDeclining(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background Blobs */}
        <style>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }
        `}</style>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <div className="text-center relative z-10">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {errorCode === 'EXPIRED' ? (
              <Clock className="h-8 w-8 text-red-600" />
            ) : errorCode === 'ALREADY_ACCEPTED' ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {errorCode === 'EXPIRED' && 'Invitation Expired'}
            {errorCode === 'ALREADY_ACCEPTED' && 'Already Accepted'}
            {errorCode === 'DECLINED' && 'Invitation Declined'}
            {errorCode === 'NOT_FOUND' && 'Invitation Not Found'}
            {!errorCode && 'Something Went Wrong'}
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Go to Login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the Team! 🎉</h1>
          <p className="text-gray-600 mb-4">{successMessage}</p>
          <div className="flex items-center justify-center gap-2 text-purple-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Redirecting to dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  // Main invitation view
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-lg w-full">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-8 text-center text-white">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">You're Invited!</h1>
          <p className="text-indigo-100">Join {invitation.inviter.name}'s team</p>
        </div>

        {/* Content */}
        <div className="p-8">
          
          {/* Team Info */}
          <div className="bg-indigo-50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{invitation.team.name}</h2>
                {invitation.team.description && (
                  <p className="text-gray-600 text-sm mt-1">{invitation.team.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {invitation.team.member_count} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Invited by {invitation.inviter.name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">{error}</p>
                {errorCode === 'ACCOUNT_EXISTS' && (
                  <Link to={`/login?redirect=/invite/${token}`} className="text-red-600 underline text-sm">
                    Click here to log in
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Logged In Flow */}
          {isLoggedIn && invitation.has_account && (
            <div className="space-y-4">
              <p className="text-center text-gray-600">
                Click below to join <strong>{invitation.team.name}</strong> as <strong>{invitation.email}</strong>
              </p>
              
              <button
                onClick={handleAcceptLoggedIn}
                disabled={accepting}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {accepting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Accept & Join Team
                  </>
                )}
              </button>

              <button
                onClick={handleDecline}
                disabled={declining}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                {declining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Decline Invitation
                  </>
                )}
              </button>
            </div>
          )}

          {/* Login Required Flow */}
          {!isLoggedIn && invitation.has_account && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-amber-800">
                  An account exists for <strong>{invitation.email}</strong>. Please log in to accept this invitation.
                </p>
              </div>
              
              <Link
                to={`/login?redirect=/invite/${token}`}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Log In to Accept
                <ArrowRight className="h-5 w-5" />
              </Link>

              <button
                onClick={handleDecline}
                disabled={declining}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Decline Invitation
              </button>
            </div>
          )}

          {/* Signup Flow (No Account) */}
          {!invitation.has_account && (
            <form onSubmit={handleAcceptSignup} className="space-y-4">
              <p className="text-center text-gray-600 mb-4">
                Create your account to join <strong>{invitation.team.name}</strong>
              </p>

              {/* Email (readonly) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={invitation.email}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Create Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={accepting}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {accepting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Create Account & Join
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDecline}
                disabled={declining}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Decline Invitation
              </button>

              <p className="text-center text-xs text-gray-500">
                By creating an account, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <Calendar className="h-3 w-3" />
            Powered by TruCal
          </p>
        </div>
      </div>
    </div>
  );
}