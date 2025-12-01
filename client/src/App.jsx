import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// ... all your other imports remain the same ...

// ======================
// Login Wrapper (now can use useNavigate)
// ======================
function LoginWrapper({ Component }) {
  const { login } = useAuth();
  const navigate = useNavigate(); // ✅ Now this will work

  const handleLogin = (token, user) => {
    console.log('🔐 LoginWrapper received:', { 
      token: token?.substring(0, 20) + '...', 
      user: user?.email 
    });
    
    login(token, user);
    // Use React Router navigation instead of hard redirect
    navigate('/dashboard', { replace: true });
  };

  return <Component onLogin={handleLogin} />;
}

// ======================
// Inner App (inside Router context)
// ======================
function InnerApp() {
  return (
    <AuthProvider>
      <NotificationProvider>
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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