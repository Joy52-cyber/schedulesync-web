import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  console.log('🔒 ProtectedRoute:', {
    loading,
    isAuthenticated,
    user: user?.email,
    onboarded: user?.onboarded,
    username: user?.username,
    path: location.pathname
  });

  if (loading) {
    console.log('⏳ ProtectedRoute: Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Checking your session…</p>
        </div>
      </div>
    );
  }

  /** 1. NOT LOGGED IN -> send to login */
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  /** 2. TRUE and Reliable onboarding check */
  const localKey = user ? `onboardingCompleted:${user.id || user.email}` : null;
  const localCompleted =
    localKey && localStorage.getItem(localKey) === "true";

  // Check both new 'onboarded' field and legacy 'hasCompletedOnboarding'
  // Also infer from username existence
  const hasCompletedOnboarding =
    user?.onboarded === true ||
    user?.hasCompletedOnboarding === true ||
    localCompleted ||
    !!user?.username;

  const onOnboardingPage = location.pathname === "/onboarding";

  console.log('📋 Onboarding check:', {
    localKey,
    localCompleted,
    userOnboarded: user?.onboarded,
    hasCompletedOnboarding,
    onOnboardingPage,
    willRedirect: !hasCompletedOnboarding && !onOnboardingPage ? 'to /onboarding' :
                  hasCompletedOnboarding && onOnboardingPage ? 'to /dashboard' :
                  'no redirect'
  });

  /** A: User NOT onboarded -> redirect to onboarding */
  if (!hasCompletedOnboarding && !onOnboardingPage) {
    return <Navigate to="/onboarding" replace />;
  }

  /** B: Already onboarded but trying to access onboarding -> send to dashboard */
  if (hasCompletedOnboarding && onOnboardingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
