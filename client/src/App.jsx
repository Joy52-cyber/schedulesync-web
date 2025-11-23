import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import OAuthCallback from './pages/OAuthCallback'; // Handles POST to /auth/google/callback

// Dashboard / App Pages
import Dashboard from './pages/Dashboard'; // Contains AI Widget
import Bookings from './pages/Bookings';   // Internal Booking List
import MyBookingLink from './components/MyBookingLink'; // Personal shortcut

// Team & Member Management
import Teams from './pages/Teams';
import TeamSettings from './pages/TeamSettings'; // Handles General + Reminders API
import TeamMembers from './pages/TeamMembers';
import MemberAvailability from './pages/MemberAvailability'; // Handles Availability + Pricing API

// User Settings
import UserSettings from './pages/UserSettings'; // Profile + Timezone
import CalendarSettings from './pages/CalendarSettings'; // Google Calendar Connection

// Public / Guest Flow
import BookingPage from './pages/BookingPage'; // Main booking UI
import ManageBooking from './pages/ManageBooking'; // Guest Cancel/Reschedule
import BookingSuccess from './pages/BookingSuccess'; // Success State
import PaymentStatus from './pages/PaymentStatus'; // Stripe Redirect Handler

// ---------- Login Wrapper ----------
// Helper to inject auth state after successful login
function LoginWrapper({ Component }) {
  const { login } = useAuth();

  const handleLogin = (token, user) => {
    login(token, user);
    window.location.href = '/dashboard';
  };

  return <Component onLogin={handleLogin} />;
}

// client/src/App.jsx

// ... imports stay the same ...

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

          {/* ✅ OAuth Callback - ONLY for organizer dashboard login */}
          <Route
            path="/oauth/callback"
            element={<LoginWrapper Component={OAuthCallback} />}
          />

          {/* ---------- Public Booking Routes ---------- */}
          {/* ✅ Guest booking OAuth happens on /book/:token route */}
          <Route path="/book/:token" element={<BookingPage />} />
          <Route path="/booking-success" element={<BookingSuccess />} />
          <Route path="/booking-confirmation" element={<BookingSuccess />} />
          <Route path="/manage/:token" element={<ManageBooking />} />
          <Route path="/book" element={<Book />} />

          {/* ... rest of routes stay the same ... */}
        </Routes>
      </AuthProvider>
    </Router>
  );
}