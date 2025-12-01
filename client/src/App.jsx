// client/src/App.jsx
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
import EventTypeForm from './pages/EventTypeForm';
import EventTypeDetail from './pages/EventTypeDetail';
import Availability from './pages/Availability';
import CalendlyMigration from './pages/CalendlyMigration';
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

// ======================
// Login Wrapper
// ======================
function LoginWrapper({ Component }) {
  const { login } = useAuth();

  const handleLogin = (token, user) => {
    login(token, user);
    // Hard redirect so everything (contexts, etc.) sees the new auth state
    window.location.href = '/dashboard';
  };

  return <Component onLogin={handleLogin} />;
}

// ======================
// Main App Component
// ======================
function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            {/* Marketing / Auth */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Landing defaultLoginOpen />} />
            <Route path="/register" element={<LoginWrapper Component={Register} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            {/* Keep :token if your ResetPassword page expects it */}
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* OAuth Callbacks (Google / Microsoft / Calendly) */}
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
            {/* 
              IMPORTANT: Route order matters! More specific routes must come first.
              /book/team/:token - Team booking page (round-robin, no external redirects)
              /book/:username/:eventSlug - Event type booking by username
              /book/:token - Individual member booking (may redirect to Calendly)
            */}
            <Route path="/book/:username/:eventSlug" element={<BookingPage />} />
            <Route path="/book/:token" element={<BookingPage />} />
            <Route path="/book" element={<Book />} />
            <Route path="/manage/:token" element={<ManageBooking />} />
            <Route path="/payment/status" element={<PaymentStatus />} />
            <Route path="/booking-success" element={<BookingConfirmation />} />
            <Route path="/booking-confirmation" element={<BookingConfirmation />} />
            <Route path="/import/calendly" element={<CalendlyMigration />} />

            {/* Protected App Layout (keeps Navbar / sidebar from Layout.jsx) */}
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
              
              {/* Event Types */}
              <Route path="/events" element={<EventTypes />} />
              <Route path="/events/new" element={<EventTypeForm />} />
              <Route path="/events/:id" element={<EventTypeDetail />} />
              <Route path="/events/:id/edit" element={<EventTypeForm />} />

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
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;