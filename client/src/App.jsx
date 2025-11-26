// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Layout / Shell
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Auth / Marketing pages
import Landing from './pages/Landing';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import OAuthCallback from './pages/OAuthCallback';
import OnboardingWizard from './pages/OnboardingWizard';
import AdminPanel from './pages/AdminPanel';

// Dashboard pages
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import EventTypes from './pages/EventTypes';
import Availability from './pages/Availability';

// Team
import Teams from './pages/Teams';
import TeamSettings from './pages/TeamSettings';
import TeamMembers from './pages/TeamMembers';
import MemberAvailability from './pages/MemberAvailability';

// Settings
import UserSettings from './pages/UserSettings';
import CalendarSettings from './pages/CalendarSettings';

// Guest / Public
import BookingPage from './pages/BookingPage';
import ManageBooking from './pages/ManageBooking';
import PaymentStatus from './pages/PaymentStatus';
import Book from './pages/Book';
import BookingConfirmation from './components/BookingConfirmation';

// -------------------------
// Login wrapper for pages that receive onLogin
// -------------------------
function LoginWrapper({ Component }) {
  const { login } = useAuth();

  const handleLogin = (token, user) => {
    // Let AuthContext know
    login(token, user);
    // Then send them into the app shell
    window.location.href = '/dashboard';
  };

  return <Component onLogin={handleLogin} />;
}

// -------------------------
// Main App
// -------------------------
function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            {/* Marketing / Auth */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Landing defaultLoginOpen />} />
            <Route
              path="/register"
              element={<LoginWrapper Component={Register} />}
            />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* OAuth Callbacks (Google, Microsoft, Calendly) */}
            <Route
              path="/oauth/callback"
              element={<LoginWrapper Component={OAuthCallback} />}
            />
            <Route
              path="/oauth/callback/microsoft"
              element={<LoginWrapper Component={OAuthCallback} />}
            />
            <Route
              path="/oauth/callback/calendly"
              element={<LoginWrapper Component={OAuthCallback} />}
            />

            {/* Onboarding */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingWizard />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />

            {/* Public Guest Routes */}
            <Route path="/book/:token" element={<BookingPage />} />
            <Route path="/book" element={<Book />} />
            <Route path="/manage/:token" element={<ManageBooking />} />
            <Route path="/payment/status" element={<PaymentStatus />} />
            <Route path="/booking-success" element={<BookingConfirmation />} />

            {/* Protected app shell (shows Navbar/Layout) */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/availability" element={<Availability />} />

              {/* Event Types – support both /events and /event-types */}
              <Route path="/events" element={<EventTypes />} />
              <Route path="/event-types" element={<EventTypes />} />

              {/* Teams */}
              <Route path="/teams" element={<Teams />} />
              <Route
                path="/teams/:teamId/settings"
                element={<TeamSettings />}
              />
              <Route path="/teams/:teamId/members" element={<TeamMembers />} />
              <Route
                path="/teams/:teamId/members/:memberId/availability"
                element={<MemberAvailability />}
              />

              {/* Settings */}
              <Route path="/settings" element={<UserSettings />} />
              <Route
                path="/settings/calendar"
                element={<CalendarSettings />}
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
