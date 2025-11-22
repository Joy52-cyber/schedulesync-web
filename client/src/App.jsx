// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

// Layout / wrappers
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import MyBookingLink from './components/MyBookingLink';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';

// Dashboard pages
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import TeamMembers from './pages/TeamMembers';
import TeamSettings from './pages/TeamSettings';
import Bookings from './pages/Bookings';
import UserSettings from './pages/UserSettings';
import CalendarSettings from './pages/CalendarSettings';
import Settings from './pages/Settings'; // optional / legacy

// Booking / public pages
import BookingPage from './pages/BookingPage';
import BookingSuccess from './pages/BookingSuccess';
import ManageBooking from './pages/ManageBooking';
import MemberAvailability from './pages/MemberAvailability';
import Book from './pages/Book';

// OAuth callback
import OAuthCallback from './pages/OAuthCallback';

function App() {
  // Shared login handler (email login + OAuth)
  const handleLogin = (token, user) => {
    if (token) {
      localStorage.setItem('token', token);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    // Full reload so AuthProvider picks up new state
    window.location.href = '/dashboard';
  };

  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* ---------- Public auth routes ---------- */}
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* ---------- OAuth callback (no layout) ---------- */}
          <Route
            path="/oauth/callback"
            element={<OAuthCallback onLogin={handleLogin} />}
          />

          {/* ---------- Public booking routes (no dashboard layout) ---------- */}
          <Route path="/book/:token" element={<BookingPage />} />
          <Route path="/booking-success" element={<BookingSuccess />} />
          <Route path="/manage/:bookingToken" element={<ManageBooking />} />
          <Route path="/member-availability/:id" element={<MemberAvailability />} />
          <Route path="/book" element={<Book />} />

          {/* ---------- Protected dashboard routes (Layout + Navbar + Outlet) ---------- */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Teams list */}
            <Route path="/teams" element={<Teams />} />

            {/* Manage team (TeamMembers) */}
            {/* Support both /teams/:id and /teams/:id/members */}
            <Route path="/teams/:id" element={<TeamMembers />} />
            <Route path="/teams/:id/members" element={<TeamMembers />} />

            {/* Team settings */}
            <Route path="/teams/:id/settings" element={<TeamSettings />} />

            {/* Bookings */}
            <Route path="/bookings" element={<Bookings />} />

            {/* Settings */}
            <Route path="/settings" element={<UserSettings />} />
            <Route path="/settings/calendar" element={<CalendarSettings />} />

            {/* Optional legacy/general settings page */}
            <Route path="/settings-legacy" element={<Settings />} />

            {/* My booking link (component in /components) */}
            <Route path="/my-booking-link" element={<MyBookingLink />} />
          </Route>

          {/* ---------- Default ---------- */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* ---------- 404 fallback ---------- */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    404 - Page Not Found
                  </h1>
                  <a
                    href="/dashboard"
                    className="text-purple-600 hover:text-purple-700"
                  >
                    Go to Dashboard
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
