// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SubscriptionProvider } from './hooks/useSubscription';
import { UpgradeProvider } from './context/UpgradeContext';
import { WalkthroughProvider } from './context/WalkthroughContext';
import { ThemeProvider } from './context/ThemeContext';
import UpgradeModal from './components/UpgradeModal';

// Styles
import './styles/animations.css';

// Layouts
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Auth / Marketing pages
import Landing from './pages/Landing';
import AuthPage from './pages/AuthPage';
import DemoPage from './pages/DemoPage';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import OAuthCallback from './pages/OAuthCallback';
import OnboardingWizard from './pages/OnboardingWizard';
import Onboarding from './pages/Onboarding';
import AdminPanel from './pages/AdminPanel';
import AcceptInvite from './pages/AcceptInvite';

// Legal / Info Pages
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import About from './pages/About';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import Analytics from './pages/Analytics';
import EventTypes from './pages/EventTypes';
import EventTypeForm from './pages/EventTypeForm';
import EventTypeDetail from './pages/EventTypeDetail';
import Availability from './pages/Availability';
import CalendlyMigration from './pages/CalendlyMigration';
import EmailTemplates from './pages/EmailTemplates';
import SchedulingRules from './pages/SchedulingRules';
import MyLinks from './pages/MyLinks';
import BillingSettings from './pages/BillingSettings';
import BillingPage from './pages/BillingPage';
import Pricing from './pages/Pricing';
import AttendeeProfiles from './pages/AttendeeProfiles';
import MeetingTemplates from './pages/MeetingTemplates';

// Team
import Teams from './pages/Teams';
import TeamSettings from './pages/TeamSettings';
import TeamMembers from './pages/TeamMembers';
import MemberAvailability from './pages/MemberAvailability';

// Settings
import UserSettings from './pages/UserSettings';
import CalendarSettings from './pages/CalendarSettings';
import AutonomousSettings from './pages/AutonomousSettings';

// Guest
import BookingPage from './pages/BookingPage';
import QuickLinkBooking from './pages/QuickLinkBooking';
import ManageBooking from './pages/ManageBooking';
import PaymentStatus from './pages/PaymentStatus';
import Book from './pages/Book';
import BookingConfirmation from './components/BookingConfirmation';
import UserProfilePage from './pages/UserProfilePage';
import QuickBook from './pages/QuickBook';

// ======================
// Login Wrapper
// ======================
function LoginWrapper({ Component }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (token, user) => {
    console.log('🔐 LoginWrapper received:', {
      token: token?.substring(0, 20) + '...',
      user: user?.email,
      onboarded: user?.onboarded
    });

    login(token, user);

    // Check if user needs to complete onboarding
    if (user?.onboarded === false) {
      navigate('/onboarding', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return <Component onLogin={handleLogin} />;
}

// ======================
// Inner App
// ======================
function InnerApp() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <SubscriptionProvider>
          <UpgradeProvider>
            <WalkthroughProvider>
              <Routes>
              {/* Marketing / Auth */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/register" element={<AuthPage />} />
              <Route path="/signup" element={<AuthPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />

              {/* Legal / Info Pages */}
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/about" element={<About />} />
              <Route path="/pricing" element={<Pricing />} />

              {/* OAuth Callbacks */}
              <Route path="/oauth/callback" element={<LoginWrapper Component={OAuthCallback} />} />
              <Route path="/oauth/callback/microsoft" element={<LoginWrapper Component={OAuthCallback} />} />
              <Route path="/oauth/callback/calendly" element={<LoginWrapper Component={OAuthCallback} />} />
              <Route path="/oauth/callback/google/guest" element={<OAuthCallback />} />
              <Route path="/oauth/callback/microsoft/guest" element={<OAuthCallback />} />

              {/* Onboarding */}
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } />

              {/* Admin */}
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminPanel />
                </ProtectedRoute>
              } />

              {/* Public Guest Routes */}
              <Route path="/book/:username/:eventSlug" element={<BookingPage />} />
              <Route path="/book/:token" element={<BookingPage />} />
              <Route path="/m/:token" element={<QuickLinkBooking />} />
              <Route path="/book" element={<Book />} />
              <Route path="/quick-book" element={<QuickBook />} />
              <Route path="/manage/:token" element={<ManageBooking />} />
              <Route path="/payment/status" element={<PaymentStatus />} />
              <Route path="/booking-success" element={<BookingConfirmation />} />
              <Route path="/booking-confirmation" element={<BookingConfirmation />} />
              <Route path="/import/calendly" element={<CalendlyMigration />} />

              {/* Protected App Layout */}
              <Route element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/availability" element={<Availability />} />
                <Route path="/templates" element={<EmailTemplates />} />
                <Route path="/meeting-templates" element={<MeetingTemplates />} />
                <Route path="/rules" element={<SchedulingRules />} />
                <Route path="/autonomous" element={<AutonomousSettings />} />
                <Route path="/my-links" element={<MyLinks />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/relationships" element={<AttendeeProfiles />} />
                <Route path="/contacts" element={<AttendeeProfiles />} />

                {/* Event Types */}
                <Route path="/events" element={<EventTypes />} />
                <Route path="/events/new" element={<EventTypeForm />} />
                <Route path="/events/:id" element={<EventTypeDetail />} />
                <Route path="/events/:id/edit" element={<EventTypeForm />} />
                
                {/* Teams */}
                <Route path="/teams" element={<Teams />} />
                <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
                <Route path="/teams/:teamId/members" element={<TeamMembers />} />
                <Route path="/teams/:teamId/members/:memberId/availability" element={<MemberAvailability />} />
                <Route path="/invite/:token" element={<AcceptInvite />} />

                {/* Settings */}
                <Route path="/settings" element={<UserSettings />} />
                <Route path="/settings/calendar" element={<CalendarSettings />} />
              </Route>

              {/* Username-based public booking page - MUST be before catch-all */}
              <Route path="/:username" element={<UserProfilePage />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <UpgradeModal />
            </WalkthroughProvider>
          </UpgradeProvider>
        </SubscriptionProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

// ======================
// Main App Component
// ======================
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <InnerApp />
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;