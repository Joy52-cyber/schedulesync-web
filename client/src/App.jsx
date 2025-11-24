import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import MyBookingLink from './components/MyBookingLink';

// Auth / Marketing pages
import Landing from './pages/Landing';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import OAuthCallback from './pages/OAuthCallback';
import OnboardingWizard from './pages/OnboardingWizard'; // <--- NEW IMPORT

// Dashboard / App Pages
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';

// Team & Member Management
import Teams from './pages/Teams';
import TeamSettings from './pages/TeamSettings';
import TeamMembers from './pages/TeamMembers';
import MemberAvailability from './pages/MemberAvailability';

// User Settings
import UserSettings from './pages/UserSettings';
import CalendarSettings from './pages/CalendarSettings';

// Public / Guest Flow
import BookingPage from './pages/BookingPage';
import ManageBooking from './pages/ManageBooking';
import PaymentStatus from './pages/PaymentStatus';
import Book from './pages/Book';

// Components
import BookingConfirmation from './components/BookingConfirmation';

// ---------- Login Wrapper ----------
function LoginWrapper({ Component }) {
  const { login } = useAuth();

  const handleLogin = (token, user) => {
    login(token, user);
    // If the user hasn't completed onboarding, you might want to redirect to /onboarding here
    // checking a user flag like user.hasOnboarded.
    // For now, we keep the default to dashboard, and let the dashboard or verify email redirect.
    window.location.href = '/dashboard';
  };

  return <Component onLogin={handleLogin} />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* ============================================================
              0. MARKETING / AUTH ENTRY
             ============================================================ */}
          {/* Main landing */}
          <Route path="/" element={<Landing />} />
          {/* Direct /login link -> landing + login slide-over open */}
          <Route path="/login" element={<Landing defaultLoginOpen />} />
          <Route path="/register" element={<LoginWrapper Component={Register} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route
            path="/oauth/callback"
            element={<LoginWrapper Component={OAuthCallback} />}
          />

          {/* ============================================================
              1. NEW ONBOARDING FLOW (Protected but No Sidebar Layout)
             ============================================================ */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingWizard />
              </ProtectedRoute>
            }
          />

          {/* ============================================================
              2. PUBLIC GUEST FLOWS (No Login Required)
             ============================================================ */}
          <Route path="/book/:token" element={<BookingPage />} />
          <Route path="/book" element={<Book />} />
          <Route path="/manage/:token" element={<ManageBooking />} />
          <Route path="/booking-success" element={<BookingConfirmation />} />
          <Route path="/booking-confirmation" element={<BookingConfirmation />} />
          <Route path="/payment/status" element={<PaymentStatus />} />

          {/* ============================================================
              3. PROTECTED APP ROUTES (Dashboard with Layout)
             ============================================================ */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/my-booking-link" element={<MyBookingLink />} />

            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
            <Route path="/teams/:teamId/members" element={<TeamMembers />} />
            <Route
              path="/teams/:teamId/members/:memberId/availability"
              element={<MemberAvailability />}
            />

            <Route path="/settings" element={<UserSettings />} />
            <Route path="/settings/calendar" element={<CalendarSettings />} />
          </Route>

          {/* ============================================================
              4. FALLBACKS
             ============================================================ */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}