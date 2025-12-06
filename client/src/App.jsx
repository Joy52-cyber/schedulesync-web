// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SubscriptionProvider } from './hooks/useSubscription';
import { UpgradeProvider } from './context/UpgradeContext';
import UpgradeModal from './components/UpgradeModal';

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
import EmailTemplates from './pages/EmailTemplates';
import MyLinks from './pages/MyLinks';
import BillingSettings from './pages/BillingSettings';
import BillingPage from './pages/BillingPage';

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
import UserProfilePage from './pages/UserProfilePage';

// ======================
// Login Wrapper
// ======================
function LoginWrapper({ Component }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (token, user) => {
    console.log('🔐 LoginWrapper received:', { 
      token: token?.substring(0, 20) + '...', 
      user: user?.email 
    });
    
    login(token, user);
    navigate('/dashboard', { replace: true });
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
            <Routes>
              {/* Marketing / Auth */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Landing defaultLoginOpen />} />
              <Route path="/register" element={<LoginWrapper Component={Register} />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />

              {/* OAuth Callbacks */}
              <Route path="/oauth/callback" element={<LoginWrapper Component={OAuthCallback} />} />
              <Route path="/oauth/callback/microsoft" element={<LoginWrapper Component={OAuthCallback} />} />
              <Route path="/oauth/callback/calendly" element={<LoginWrapper Component={OAuthCallback} />} />
              <Route path="/oauth/callback/google/guest" element={<OAuthCallback />} />
              <Route path="/oauth/callback/microsoft/guest" element={<OAuthCallback />} />

              {/* Onboarding */}
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <OnboardingWizard />
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
              <Route path="/book" element={<Book />} />
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
                <Route path="/availability" element={<Availability />} />
                <Route path="/email-templates" element={<EmailTemplates />} />
                <Route path="/my-links" element={<MyLinks />} />
                <Route path="/billing" element={<BillingPage />} />

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
    <Router>
      <InnerApp />
    </Router>
  );
}

export default App;