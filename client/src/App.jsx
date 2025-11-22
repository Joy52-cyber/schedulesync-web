// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Layout wrapper (contains navbar + Outlet)
import Layout from "./components/Layout";

// Protected route
import ProtectedRoute from "./components/ProtectedRoute";

// Components
import MyBookingLink from "./components/MyBookingLink";

// Auth pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";

// Dashboard / app pages
import Dashboard from "./pages/Dashboard";
import Teams from "./pages/Teams";
import TeamMembers from "./pages/TeamMembers";
import TeamSettings from "./pages/TeamSettings";
import Bookings from "./pages/Bookings";
import UserSettings from "./pages/UserSettings";
import CalendarSettings from "./pages/CalendarSettings";
import Settings from "./pages/Settings";
import MemberAvailability from "./pages/MemberAvailability";

// Public booking / flow pages
import BookingPage from "./pages/BookingPage";
import BookingSuccess from "./pages/BookingSuccess";
import ManageBooking from "./pages/ManageBooking";
import Book from "./pages/Book";

// OAuth callback
import OAuthCallback from "./pages/OAuthCallback";

// ---------- Wrapper to inject onLogin from AuthContext ----------
function LoginWrapper({ Component }) {
  const { login } = useAuth();

  const handleLogin = (token, user) => {
    login(token, user);
    window.location.href = "/dashboard";
  };

  return <Component onLogin={handleLogin} />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* ---------- Public Authentication Routes ---------- */}
          <Route path="/login" element={<LoginWrapper Component={Login} />} />
          <Route path="/register" element={<LoginWrapper Component={Register} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* ---------- OAuth Callback (no layout) ---------- */}
          <Route
            path="/oauth/callback"
            element={<LoginWrapper Component={OAuthCallback} />}
          />

          {/* ---------- Public Booking Routes (guest flows) ---------- */}
          <Route path="/book/:token" element={<BookingPage />} />
          <Route path="/booking-success" element={<BookingSuccess />} />
          {/* ✅ Also support /booking-confirmation since BookingPage navigates there */}
          <Route path="/booking-confirmation" element={<BookingSuccess />} />
          {/* ✅ Param name must match ManageBooking's useParams: { token } */}
          <Route path="/manage/:token" element={<ManageBooking />} />
          <Route path="/book" element={<Book />} />

          {/* ---------- Protected App Routes (with Layout + navbar) ---------- */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Teams */}
            <Route path="/teams" element={<Teams />} />
            {/* Team members (TeamMembers.jsx expects useParams().teamId) */}
            <Route path="/teams/:teamId/members" element={<TeamMembers />} />
            {/* Team settings (TeamSettings.jsx expects useParams().teamId) */}
            <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
            {/* Member availability (MemberAvailability.jsx expects teamId + memberId) */}
            <Route
              path="/teams/:teamId/members/:memberId/availability"
              element={<MemberAvailability />}
            />

            {/* Bookings */}
            <Route path="/bookings" element={<Bookings />} />

            {/* Settings */}
            <Route path="/settings" element={<UserSettings />} />
            <Route path="/settings/calendar" element={<CalendarSettings />} />
            {/* Old settings page, kept as legacy */}
            <Route path="/settings-legacy" element={<Settings />} />

            {/* My booking link */}
            <Route path="/my-booking-link" element={<MyBookingLink />} />
          </Route>

          {/* ---------- Default ---------- */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* ---------- 404 ---------- */}
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
                    className="text-blue-600 hover:text-blue-800"
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
