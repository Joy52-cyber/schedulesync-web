import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import MyBookingLink from './components/MyBookingLink'; 

// Auth Pages 
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import OAuthCallback from './pages/OAuthCallback';

// Dashboard / App Pages 
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';

// Team & Member Management 
import Teams from './pages/Teams';
import TeamSettings from './pages/TeamSettings';
import TeamMembers from './pages/TeamMembers';
import MemberAvailability from './pages/MemberAvailability';

// User Settings 
import UserSettings from './pages/UserSettings';
import CalendarSettings from './pages/CalendarSettings';

// Public / Guest Flow 
import BookingPage from './pages/BookingPage';
import ManageBooking from './pages/ManageBooking';
import PaymentStatus from './pages/PaymentStatus';
import Book from './pages/Book';

// ✅ FIX: Import BookingConfirmation from the correct path (./components/)
import BookingConfirmation from './components/BookingConfirmation'; 

// ---------- Login Wrapper ----------
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

          <Route 
            path="/oauth/callback" 
            element={<LoginWrapper Component={OAuthCallback} />} 
          />

          {/* ============================================================
              2. PUBLIC GUEST FLOWS (No Login Required)
             ============================================================ */}
          
          <Route path="/book/:token" element={<BookingPage />} />
          <Route path="/book" element={<Book />} />
          <Route path="/manage/:token" element={<ManageBooking />} />

          {/* ✅ FIX: Route Confirmation pages to the component */}
          <Route path="/booking-success" element={<BookingConfirmation />} />
          <Route path="/booking-confirmation" element={<BookingConfirmation />} />

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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/my-booking-link" element={<MyBookingLink />} />

            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
            <Route path="/teams/:teamId/members" element={<TeamMembers />} />
            
            <Route 
              path="/teams/:teamId/members/:memberId/availability" 
              element={<MemberAvailability />} 
            />

            <Route path="/settings" element={<UserSettings />} />
            <Route path="/settings/calendar" element={<CalendarSettings />} />
          </Route>

          {/* ============================================================
              4. FALLBACKS
             ============================================================ */}
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

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