// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import MyBookingLink from "./components/MyBookingLink";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";

import Dashboard from "./pages/Dashboard";
import Teams from "./pages/Teams";
import TeamMembers from "./pages/TeamMembers";
import TeamSettings from "./pages/TeamSettings";
import Bookings from "./pages/Bookings";
import UserSettings from "./pages/UserSettings";
import CalendarSettings from "./pages/CalendarSettings";
import Settings from "./pages/Settings";
import MemberAvailability from "./pages/MemberAvailability";

import BookingPage from "./pages/BookingPage";
import BookingSuccess from "./pages/BookingSuccess";
import ManageBooking from "./pages/ManageBooking";
import Book from "./pages/Book";

import OAuthCallback from "./pages/OAuthCallback";

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
          {/* Public auth */}
          <Route path="/login" element={<LoginWrapper Component={Login} />} />
          <Route path="/register" element={<LoginWrapper Component={Register} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* OAuth callback (organizer) */}
          <Route
            path="/oauth/callback"
            element={<LoginWrapper Component={OAuthCallback} />}
          />

          {/* Public booking flows */}
          <Route path="/book/:token" element={<BookingPage />} />
          <Route path="/booking-success" element={<BookingSuccess />} />
          <Route path="/booking-confirmation" element={<BookingSuccess />} />
          <Route path="/manage/:token" element={<ManageBooking />} />
          <Route path="/book" element={<Book />} />

          {/* Protected app routes */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:teamId/members" element={<TeamMembers />} />
            <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
            <Route
              path="/teams/:teamId/members/:memberId/availability"
              element={<MemberAvailability />}
            />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/settings" element={<UserSettings />} />
            <Route path="/settings/calendar" element={<CalendarSettings />} />
            <Route path="/settings-legacy" element={<Settings />} />
            <Route path="/my-booking-link" element={<MyBookingLink />} />
          </Route>

          {/* Default & 404 */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
