import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Globe,
  Loader2,
  Bot,
  Settings,
  TrendingUp,
  Zap,
  Mail,
  Star,
  CreditCard,
} from 'lucide-react';

import api, {
  auth,
  timezone as timezoneApi,
  chatgptIntegration,
} from '../utils/api';
import AISchedulerChat from '../components/AISchedulerChat';
import { useNotification } from '../contexts/NotificationContext';
import UsageWidget from '../components/UsageWidget';
import TestWidget from '../components/TestWidget';
import SubscriptionUpgradeModal from '../components/SubscriptionUpgradeModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    activeTeams: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('');
  const [user, setUser] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // ✅ ADD: Limit status state
  const [limitStatus, setLimitStatus] = useState({
    tier: 'free',
    current_bookings: 0,
    limits: { soft: 50, grace: 60, hard: 70 },
    status: { withinLimit: true },
    upgrade_recommended: false
  });

  // Simple ChatGPT status check
  const [chatgptConfigured, setChatgptConfigured] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadUserTimezone(),
      loadUserProfile(),
      loadLimitStatus(), // ✅ ADD: Load limit status
      checkChatGptStatus(),
    ]);
    setLoading(false);
  };

  const loadDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data.stats || { totalBookings: 0, upcomingBookings: 0, activeTeams: 0 });
      setRecentBookings(response.data.recentBookings || []);
    } catch (error) {
      console.error('Dashboard load error:', error);
      notify.error('Failed to load dashboard data');
    }
  };

  const loadUserTimezone = async () => {
  try {
    const response = await timezoneApi.get();
    console.log('🌍 RAW response:', response);
    console.log('🌍 response.data type:', typeof response.data);
    console.log('🌍 response.data:', response.data);
    
    // Try to extract timezone
    let tz = '';
    
    // If response.data is a string like '{"timezone":"America/Los_Angeles"}'
    if (typeof response.data === 'string') {
      try {
        const parsed = JSON.parse(response.data);
        tz = parsed.timezone || response.data;
      } catch {
        tz = response.data;
      }
    } 
    // If response.data is already an object
    else if (response.data && typeof response.data === 'object') {
      tz = response.data.timezone || '';
    }
    
    console.log('🌍 Final timezone:', tz);
    setTimezone(tz);
  } catch (error) {
    console.error('Timezone load error:', error);
    setTimezone('America/Los_Angeles');
  }
};

  const loadUserProfile = async () => {
    try {
      // Load user profile
      const response = await auth.me();
      const u = response.data.user || null;
      setUser(u);
      
      // ✅ ADD: Load fresh usage data separately  
      const usageResponse = await api.user.usage();
      setUser(prevUser => ({
        ...prevUser,
        usage: {
          ai_queries_used: usageResponse.data.ai_queries_used,
          ai_queries_limit: usageResponse.data.ai_queries_limit,
          chatgpt_used: usageResponse.data.ai_queries_used, // For compatibility
          chatgpt_limit: usageResponse.data.ai_queries_limit, // For compatibility
          chatgpt_queries_used: usageResponse.data.ai_queries_used, // For compatibility
          chatgpt_queries_limit: usageResponse.data.ai_queries_limit // For compatibility
        }
      }));
      
    } catch (error) {
      console.error('Profile load error:', error);
      notify.error('Failed to load profile');
    }
  };

  // ✅ ADD: Load limit status
  const loadLimitStatus = async () => {
    try {
      const response = await api.user.limits();
      setLimitStatus(response.data);
    } catch (error) {
      console.error('Limit status load error:', error);
      // Set fallback data if API fails
      setLimitStatus(prev => ({
        ...prev,
        current_bookings: stats.totalBookings,
      }));
    }
  };

  // Simple check if ChatGPT is configured
  const checkChatGptStatus = async () => {
    try {
      const response = await chatgptIntegration.getToken();
      setChatgptConfigured(!!response.data.jwt_token);
    } catch (error) {
      setChatgptConfigured(false);
    }
  };

  const getTimezoneName = (tz) => {
    const timezoneNames = {
      'America/New_York': 'Eastern Time (ET)',
      'America/Chicago': 'Central Time (CT)',
      'America/Denver': 'Mountain Time (MT)',
      'America/Los_Angeles': 'Pacific Time (PT)',
      'Europe/London': 'London (GMT)',
      'Europe/Paris': 'Paris (CET)',
      'Asia/Singapore': 'Singapore (SGT)',
      'Asia/Tokyo': 'Tokyo (JST)',
      'Asia/Shanghai': 'Shanghai (CST)',
      'Asia/Manila': 'Manila (PHT)',
      'Australia/Sydney': 'Sydney (AEDT)',
    };
    return timezoneNames[tz] || tz || 'Not set';
  };

  const getStatusIcon = (status) => {
    const icons = {
      confirmed: <CheckCircle2 className="h-4 w-4" />,
      pending: <AlertCircle className="h-4 w-4" />,
      cancelled: <XCircle className="h-4 w-4" />,
    };
    return icons[status] || icons.confirmed;
  };

  const getStatusColor = (status) => {
    const colors = {
      confirmed: 'bg-green-100 text-green-700 border-green-200',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || colors.confirmed;
  };

  // ✅ ADD: Critical warning banner component
  const LimitWarningBanner = () => {
    const { current_bookings, limits, status, tier } = limitStatus;
    
    if (tier !== 'free' || status.withinLimit) return null;

    if (status.overGraceLimit || status.hardBlocked) {
      return (
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 rounded-xl mb-6 border-2 border-red-400 animate-pulse">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                ⛔ Account Limited - Immediate Action Required
              </h3>
              <p className="text-red-100">
                You've used {current_bookings}/{limits.grace} bookings and exceeded your grace period. 
                New bookings are blocked and AI scheduling is disabled.
              </p>
            </div>
            <button 
              onClick={() => navigate('/billing')}
              className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 transition-colors"
            >
              🚨 Upgrade Now
            </button>
          </div>
        </div>
      );
    }

    if (status.inGracePeriod) {
      return (
        <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white p-4 rounded-xl mb-6 border-2 border-orange-400">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                ⚠️ Over Booking Limit - Grace Period Active
              </h3>
              <p className="text-orange-100">
                You've exceeded your {limits.soft} booking limit ({current_bookings}/{limits.grace}). 
                AI scheduling is now disabled. Only {limits.grace - current_bookings} bookings remaining before account suspension.
              </p>
            </div>
            <button 
              onClick={() => navigate('/billing')}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg font-bold hover:bg-orange-50 transition-colors"
            >
              ⚡ Upgrade to Pro
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Bookings', value: stats.totalBookings, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Upcoming', value: stats.upcomingBookings, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Active Teams', value: stats.activeTeams, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  // Helper to determine current tier and usage
  // ✅ Better tier detection
const currentTier = limitStatus?.tier || user?.subscription_tier || user?.tier || 'free';
  const usage = user?.usage || { ai_queries_used: 0, ai_queries_limit: 10 }; // ✅ Updated default limit
  const bookingCount = limitStatus?.current_bookings || stats.totalBookings;
  
  // ✅ UPDATED LIMITS (Better Strategy)
  const bookingLimit = currentTier === 'free' ? 50 : currentTier === 'pro' ? 999999 : 999999; // 50 for free, unlimited for paid

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50/30">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm">
                  Welcome back{user?.name ? `, ${user.name}` : ''}! Here&apos;s what&apos;s happening today.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/availability')}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold flex items-center gap-2 shadow-sm"
              >
                <Clock className="h-4 w-4" />
                Availability
              </button>

              {/* ChatGPT Status Indicator */}
              {chatgptConfigured ? (
                <button
                  onClick={() => navigate('/settings?tab=integrations')}
                  className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 transition-all text-sm font-medium flex items-center gap-2"
                >
                  <Bot className="h-4 w-4" />
                  ChatGPT ✓
                </button>
              ) : (
                <button
                  onClick={() => navigate('/settings?tab=integrations')}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all text-sm font-medium flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Setup ChatGPT
                </button>
              )}
              
              {/* Enhanced Usage Indicator */}
              {currentTier !== 'team' && currentTier !== 'pro' && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                  limitStatus.status?.inGracePeriod || limitStatus.status?.overGraceLimit
                    ? 'bg-red-50 border-red-200'
                    : limitStatus.status?.upgrade_recommended || (usage.ai_queries_used >= usage.ai_queries_limit - 2)
                      ? 'bg-orange-50 border-orange-200' 
                      : 'bg-purple-50 border-purple-200'
                }`}>
                  <span className={`text-sm font-medium ${
                    limitStatus.status?.inGracePeriod || limitStatus.status?.overGraceLimit
                      ? 'text-red-700'
                      : limitStatus.status?.upgrade_recommended || (usage.ai_queries_used >= usage.ai_queries_limit - 2)
                        ? 'text-orange-700'
                        : 'text-purple-700'
                  }`}>
                    {Math.min(usage.ai_queries_used || 0, usage.ai_queries_limit || 10)}/{usage.ai_queries_limit || 10}{(usage.ai_queries_used || 0) > (usage.ai_queries_limit || 10) ? '+' : ''} AI queries
                  </span>
                  {((usage.ai_queries_used || 0) >= (usage.ai_queries_limit || 10) - 2 || limitStatus.status?.upgrade_recommended) && (
                    <button 
                      onClick={() => navigate('/billing')}
                      className={`text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
                        limitStatus.status?.inGracePeriod || limitStatus.status?.overGraceLimit
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {limitStatus.status?.inGracePeriod || limitStatus.status?.overGraceLimit ? 'Restore' : 'Upgrade'}
                    </button>
                  )}
                </div>
              )}

              {/* Billing Link for Paid Users */}
              {(currentTier === 'pro' || currentTier === 'team') && (
                <button
                  onClick={() => navigate('/billing')}
                  className="px-3 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-all text-sm font-medium flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  {currentTier === 'pro' ? 'Pro' : 'Team'} ✓
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
   
      <main className="w-full">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-6">
            
            {/* ✅ ADD: Critical warning banner */}
            <LimitWarningBanner />
            
            {/* Enhanced Usage Section with Updated Limits */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-purple-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  📊 Usage This Month
                </h3>
                {currentTier !== 'team' && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    limitStatus.status?.overGraceLimit || limitStatus.status?.hardBlocked
                      ? 'bg-red-100 text-red-700'
                      : limitStatus.status?.inGracePeriod 
                        ? 'bg-orange-100 text-orange-700'
                        : currentTier === 'free' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-green-100 text-green-700'
                  }`}>
                    {currentTier === 'free' ? 'Free Plan' : currentTier === 'pro' ? 'Pro Plan' : 'Team Plan'}
                    {limitStatus.status?.inGracePeriod && ' - Grace Period'}
                    {(limitStatus.status?.overGraceLimit || limitStatus.status?.hardBlocked) && ' - Limited'}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI Queries with Enhanced Status */}
                <div className={`bg-white rounded-lg p-4 border-2 ${
                  limitStatus.status?.inGracePeriod || limitStatus.status?.overGraceLimit
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      🤖 AI Queries
                    </span>
                    {limitStatus.status?.inGracePeriod && (
                      <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded font-medium">
                        DISABLED
                      </span>
                    )}
                    {currentTier === 'free' && !limitStatus.status?.inGracePeriod && (
  <>
    {usage.ai_queries_used >= usage.ai_queries_limit && (
      <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded font-medium">
        Limit reached!
      </span>
    )}
    {usage.ai_queries_used >= (usage.ai_queries_limit - 2) && usage.ai_queries_used < usage.ai_queries_limit && (
      <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded font-medium">
        Almost full!
      </span>
                    )}
                  </div>
                  <div className="text-xl font-bold text-gray-900">
                    {currentTier === 'team' || currentTier === 'pro' 
                      ? '∞ Unlimited' 
                      : `${usage.ai_queries_used || 0}/${usage.ai_queries_limit || 10}`} {/* ✅ Updated default */}
                  </div>
                  {currentTier !== 'team' && currentTier !== 'pro' && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          limitStatus.status?.inGracePeriod ? 'bg-red-500' : 'bg-purple-600'
                        }`}
                        style={{width: `${Math.min(100, ((usage.ai_queries_used || 0) / (usage.ai_queries_limit || 10)) * 100)}%`}}
                      />
                    </div>
                  )}
                  {limitStatus.status?.inGracePeriod && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      AI disabled due to booking limit exceeded
                    </p>
                  )}
                </div>

                {/* Bookings with Enhanced Status */}
                <div className={`bg-white rounded-lg p-4 border-2 ${
                  limitStatus.status?.overGraceLimit || limitStatus.status?.hardBlocked
                    ? 'border-red-300 bg-red-50'
                    : limitStatus.status?.inGracePeriod 
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      📅 Bookings
                    </span>
                    {limitStatus.status?.overGraceLimit && (
                      <span className="text-xs text-red-700 bg-red-200 px-2 py-1 rounded font-bold">
                        BLOCKED
                      </span>
                    )}
                    {limitStatus.status?.inGracePeriod && (
                      <span className="text-xs text-orange-700 bg-orange-200 px-2 py-1 rounded font-medium">
                        OVER LIMIT
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xl font-bold text-gray-900 mb-1">
                    {currentTier === 'team' || currentTier === 'pro' 
                      ? '∞ Unlimited' 
                      : `${bookingCount}/${
                        limitStatus.status?.inGracePeriod || limitStatus.status?.overGraceLimit 
                          ? limitStatus.limits?.grace || 60
                          : limitStatus.limits?.soft || 50
                      }`} {/* ✅ Updated limits */}
                  </div>
                  
                  {/* Enhanced Progress Bar */}
                  {currentTier !== 'team' && currentTier !== 'pro' && (
                    <div className="space-y-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            limitStatus.status?.overGraceLimit || limitStatus.status?.hardBlocked
                              ? 'bg-red-600'
                              : limitStatus.status?.inGracePeriod 
                                ? 'bg-orange-500'
                                : bookingCount >= (limitStatus.limits?.soft || 50) * 0.8
                                  ? 'bg-yellow-500'
                                  : 'bg-blue-600'
                          }`}
                          style={{width: `${Math.min(100, (bookingCount / (
                            limitStatus.status?.inGracePeriod || limitStatus.status?.overGraceLimit 
                              ? limitStatus.limits?.grace || 60
                              : limitStatus.limits?.soft || 50
                          )) * 100)}%`}}
                        />
                      </div>
                      
                      {/* Status Text */}
                      {limitStatus.status?.overGraceLimit && (
                        <p className="text-xs text-red-700 font-bold">
                          Account limited - New bookings blocked
                        </p>
                      )}
                      {limitStatus.status?.inGracePeriod && (
                        <p className="text-xs text-orange-700 font-medium">
                          Grace period - {(limitStatus.limits?.grace || 60) - bookingCount} remaining before suspension
                        </p>
                      )}
                      {bookingCount >= (limitStatus.limits?.soft || 50) * 0.8 && limitStatus.status?.withinLimit && (
                        <p className="text-xs text-yellow-700 font-medium">
                          Approaching limit - Consider upgrading
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Upgrade CTA */}
              {currentTier !== 'team' && currentTier !== 'pro' && (limitStatus.status?.upgrade_recommended || usage.ai_queries_used >= (usage.ai_queries_limit - 3) || bookingCount >= (limitStatus.limits?.soft || 50) * 0.8) && (
                <div className={`mt-4 rounded-lg p-4 text-white ${
                  limitStatus.status?.overGraceLimit || limitStatus.status?.hardBlocked
                    ? 'bg-gradient-to-r from-red-600 to-red-700'
                    : limitStatus.status?.inGracePeriod
                      ? 'bg-gradient-to-r from-orange-600 to-red-600'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {limitStatus.status?.overGraceLimit || limitStatus.status?.hardBlocked ? (
                          <>🚨 Immediate Upgrade Required</>
                        ) : limitStatus.status?.inGracePeriod ? (
                          <>⚠️ Upgrade to Restore Features</>
                        ) : (
                          <>⚡ Upgrade Recommended</>
                        )}
                      </p>
                      <p className="text-sm opacity-90">
                        {limitStatus.status?.overGraceLimit || limitStatus.status?.hardBlocked
                          ? 'Your account is suspended. Upgrade to restore access.'
                          : limitStatus.status?.inGracePeriod 
                            ? 'You\'re in grace period. Upgrade to restore AI + get unlimited bookings.'
                            : 'Get unlimited AI queries + unlimited bookings with Pro plan for just $12/month.'
                        }
                      </p>
                    </div>
                    <button 
                      onClick={() => navigate('/billing')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                        limitStatus.status?.overGraceLimit || limitStatus.status?.hardBlocked
                          ? 'bg-white text-red-600 hover:bg-red-50'
                          : 'bg-white text-purple-600 hover:bg-gray-100'
                      }`}
                    >
                      {limitStatus.status?.overGraceLimit || limitStatus.status?.hardBlocked 
                        ? '🚨 Restore Access' 
                        : limitStatus.status?.inGracePeriod 
                          ? '⚡ Restore Features'
                          : '⚡ Upgrade - $12/mo'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upgrade Card for Free Users (Only show if not in critical state) */}
            {currentTier === 'free' && !limitStatus.status?.inGracePeriod && !limitStatus.status?.overGraceLimit && (
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      🎯 Supercharge Your Scheduling
                    </h3>
                    <p className="text-purple-100 mb-4">
                      Unlimited AI assistance + unlimited bookings + advanced features for busy professionals
                    </p>
                    <ul className="text-sm text-purple-100 space-y-1 mb-4">
                      <li className="flex items-center gap-2">
                        <Zap className="h-3 w-3" />
                        ✨ Unlimited AI queries (vs {usage.ai_queries_limit || 10}/month)
                      </li>
                      <li className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        📅 Unlimited bookings (vs {limitStatus.limits?.soft || 50}/month)
                      </li>
                      <li className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        📧 Advanced email templates
                      </li>
                      <li className="flex items-center gap-2">
                        <Settings className="h-3 w-3" />
                        ⚡ Priority support
                      </li>
                    </ul>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">$12</div>
                    <div className="text-sm text-purple-200">per month</div>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/billing')}
                  className="w-full bg-white text-purple-600 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors mt-4"
                >
                  Upgrade to Pro - Only $12/month
                </button>
              </div>
            )}

            {/* Timezone Display */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Your Timezone</h3>
                 <p className="text-sm text-gray-600">
  {(() => {
    let tz = timezone;
    if (typeof tz === 'string' && tz.includes('{')) {
      try {
        const parsed = JSON.parse(tz);
        tz = parsed.timezone;
      } catch {}
    } else if (tz && typeof tz === 'object' && tz.timezone) {
      tz = tz.timezone;
    }
    return getTimezoneName(tz);
  })()}
</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:gap-2 transition-all"
              >
                Change
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((stat, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
                      <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                    <div className={`${stat.bg} h-14 w-14 rounded-xl flex items-center justify-center shadow-md`}>
                      <stat.icon className={`h-7 w-7 ${stat.color}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Recent Bookings</h3>
                  <button
                    onClick={() => navigate('/bookings')}
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-1"
                  >
                    View All <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {recentBookings.length === 0 ? (
                  <div className="text-center py-10">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No bookings yet</p>
                    <p className="text-gray-400 text-sm mt-1">Share your booking link to get started</p>
                    {currentTier === 'free' && (
                      <p className="text-gray-400 text-xs mt-2">
                        💡 Upgrade to Pro for unlimited AI scheduling assistance
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentBookings.slice(0, 5).map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 transition-all cursor-pointer"
                        onClick={() => navigate('/bookings')}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                            {booking.attendee_name?.charAt(0)?.toUpperCase() || 'G'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-gray-900 font-bold truncate">{booking.attendee_name}</p>
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(booking.status)}`}>
                                {getStatusIcon(booking.status)} {booking.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 text-sm">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(booking.start_time).toLocaleDateString()}
                              </span>
                              <span className="text-gray-400">•</span>
                              <span>{new Date(booking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Upgrade hint for free users approaching limits */}
                    {currentTier === 'free' && bookingCount >= (limitStatus.limits?.soft || 50) * 0.6 && !limitStatus.status?.inGracePeriod && (
                      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm text-purple-800 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          💡 You're at {bookingCount}/{limitStatus.limits?.soft || 50} bookings this month. 
                          <button 
                            onClick={() => navigate('/billing')}
                            className="text-purple-600 underline ml-1 font-medium hover:text-purple-700"
                          >
                            Upgrade to Pro
                          </button> 
                          for unlimited bookings + AI queries for just $12/month.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ✅ Subscription Upgrade Modal */}
      <SubscriptionUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={currentTier}
      />

      <AISchedulerChat />
    </div>
  );
}