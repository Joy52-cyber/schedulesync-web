// client/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';

// Auth / OAuth pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import OAuthCallback from './pages/OAuthCallback';

// Dashboard pages
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Bookings from './pages/Bookings';
import UserSettings from './pages/UserSettings';
import CalendarSettings from './pages/CalendarSettings';
import TeamSettings from './pages/TeamSettings';
import TeamMembers from './pages/TeamMembers';

// Booking pages
import BookingPage from './pages/BookingPage';
import ManageBooking from './pages/ManageBooking';

function App() {
  // Runs after Google / Microsoft / Calendly OAuth logins
  const handleOAuthLogin = (token, user) => {
    if (token) {
      localStorage.setItem('token', token);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    window.location.href = '/dashboard';
  };

  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            {/* Root → Login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* OAuth Providers */}
            <Route
              path="/oauth/callback"
              element={<OAuthCallback onLogin={handleOAuthLogin} />}
            />
            <Route
              path="/oauth/callback/microsoft"
              element={<OAuthCallback onLogin={handleOAuthLogin} />}
            />
            <Route
              path="/oauth/callback/calendly"
              element={<OAuthCallback onLogin={handleOAuthLogin} />}
            />

            {/* Dashboard (Protected) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teams"
              element={
                <ProtectedRoute>
                  <Teams />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings"
              element={
                <ProtectedRoute>
                  <Bookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/profile"
              element={
                <ProtectedRoute>
                  <UserSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/calendar"
              element={
                <ProtectedRoute>
                  <CalendarSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/team"
              element={
                <ProtectedRoute>
                  <TeamSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teams/:teamId/members"
              element={
                <ProtectedRoute>
                  <TeamMembers />
                </ProtectedRoute>
              }
            />

            {/* Public booking links */}
            <Route path="/book/:bookingToken" element={<BookingPage />} />
            <Route path="/manage/:bookingId" element={<ManageBooking />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
