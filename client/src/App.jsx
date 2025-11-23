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

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* ============================================================
              1. PUBLIC AUTHENTICATION ROUTES
             ============================================================ */}
          <Route path="/login" element={<LoginWrapper Component={Login} />} />
          <Route path="/register" element={<LoginWrapper Component={Register} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Organizer OAuth Callback (Google Login/Connect) */}
          <Route 
            path="/oauth/callback" 
            element={<LoginWrapper Component={OAuthCallback} />} 
          />

          {/* ============================================================
              2. PUBLIC GUEST FLOWS (No Login Required)
             ============================================================ */}
          
          {/* Main Booking Page: /api/book/:token */}
          <Route path="/book/:token" element={<BookingPage />} />

          {/* Guest Management (Reschedule/Cancel): /api/bookings/manage/:token */}
          <Route path="/manage/:token" element={<ManageBooking />} />

          {/* Success Pages */}
          <Route path="/booking-success" element={<BookingSuccess />} />
          <Route path="/booking-confirmation" element={<BookingSuccess />} />

          {/* Stripe Payment Redirect Handling */}
          <Route path="/payment/status" element={<PaymentStatus />} />


          {/* ============================================================
              3. PROTECTED APP ROUTES (Dashboard)
             ============================================================ */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard (Stats + AI Assistant) */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Bookings (Organizer View) */}
            <Route path="/bookings" element={<Bookings />} />

            {/* Shortcuts */}
            <Route path="/my-booking-link" element={<MyBookingLink />} />

            {/* --- TEAM MANAGEMENT --- */}
            <Route path="/teams" element={<Teams />} />
            
            {/* Team Settings (General + Reminders) */}
            {/* Backend: PUT /api/teams/:id AND /api/teams/:id/reminder-settings */}
            <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
            
            {/* Member List */}
            <Route path="/teams/:teamId/members" element={<TeamMembers />} />

            {/* Member Details (Availability + Pricing) */}
            {/* Backend: PUT /api/team-members/:id/availability AND .../pricing */}
            <Route 
              path="/teams/:teamId/members/:memberId/availability" 
              element={<MemberAvailability />} 
            />

            {/* --- USER CONFIGURATION --- */}
            
            {/* General Profile + Timezone */}
            <Route path="/settings" element={<UserSettings />} />
            
            {/* Google Calendar Integrations */}
            {/* Backend: /api/auth/google/url */}
            <Route path="/settings/calendar" element={<CalendarSettings />} />

          </Route>

          {/* ============================================================
              4. FALLBACKS
             ============================================================ */}
          
          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 Page */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
                  <p className="text-xl text-gray-600 mb-8">Page Not Found</p>
                  <a
                    href="/dashboard"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
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