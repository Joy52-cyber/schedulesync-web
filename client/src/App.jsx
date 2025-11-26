import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Layouts
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

// Dashboard Pages
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

// Guest
import BookingPage from './pages/BookingPage';
import ManageBooking from './pages/ManageBooking';
import PaymentStatus from './pages/PaymentStatus';
import Book from './pages/Book';
import BookingConfirmation from './components/BookingConfirmation';

// Wrap any page that needs to call onLogin (Login/OAuth)
function LoginWrapper({ Component }) {
  const { login } = useAuth();

  const handleLogin = (token, user) => {
    if (token) {
      localStorage.setItem('token', token);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    login(token, user);
    window.location.href = '/dashboard';
  };

  return <Component onLogin={handleLogin} />;
}

function App() {
  return (
    <Router>
      {/* ✅ FIX: NotificationProvider MUST be the outer wrapper */}
      <NotificationProvider>
        {/* AuthProvider is now a CHILD of NotificationProvider, so it can use notifications */}
        <AuthProvider>
          <Routes>
            {/* Marketing / Auth entry points */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Landing defaultLoginOpen />} />
            <Route path="/register" element={<LoginWrapper Component={Register} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* OAuth callbacks (Google / Microsoft / Calendly) */}
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

            {/* Public guest routes */}
            <Route path="/book/:token" element={<BookingPage />} />
            <Route path="/book" element={<Book />} />
            <Route path="/manage/:token" element={<ManageBooking />} />
            <Route path="/payment/status" element={<PaymentStatus />} />
            <Route path="/booking-success" element={<BookingConfirmation />} />

            {/* Protected app layout (Navbar / sidebar inside Layout) */}
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

              {/* Event types */}
              <Route path="/events" element={<EventTypes />} />
              <Route path="/events/new" element={<EventTypes />} />
              <Route path="/events/:eventId" element={<EventTypes />} />
              <Route path="/events/:eventId/edit" element={<EventTypes />} />

              {/* Teams */}
              <Route path="/teams" element={<Teams />} />
              <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
              <Route path="/teams/:teamId/members" element={<TeamMembers />} />
              <Route
                path="/teams/:teamId/members/:memberId/availability"
                element={<MemberAvailability />}
              />

              {/* Settings */}
              <Route path="/settings" element={<UserSettings />} />
              <Route path="/settings/calendar" element={<CalendarSettings />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </NotificationProvider>
    </Router>
  );
}

export default App;