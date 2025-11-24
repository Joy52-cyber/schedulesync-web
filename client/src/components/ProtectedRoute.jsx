import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth(); // Destructure 'user'
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Checking your session…</p>
        </div>
      </div>
    );
  }

  // 1. Basic Authentication Check
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // 2. Onboarding Check (The "Gatekeeper")
  // We check if the user has a 'username'. 
  // If your backend returns a 'username' only AFTER setup, this works perfectly.
  const hasCompletedOnboarding = user?.username && user.username.trim() !== "";
  
  const isOnOnboardingPage = location.pathname === "/onboarding";

  // Scenario A: User needs to onboard but is trying to go somewhere else (e.g. Dashboard)
  if (!hasCompletedOnboarding && !isOnOnboardingPage) {
    return <Navigate to="/onboarding" replace />;
  }

  // Scenario B: User has ALREADY onboarded but is trying to go back to the wizard
  if (hasCompletedOnboarding && isOnOnboardingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}