import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Auth Pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Bookings from './pages/Bookings';
import Settings from './pages/Settings';
import BookingLink from './pages/BookingLink';
import OAuthCallback from './pages/OAuthCallback';

// Booking Pages
import BookingPage from './pages/BookingPage';
import BookingManagement from './pages/BookingManagement';
import BookingSuccess from './pages/BookingSuccess';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes - Authentication */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          
          {/* OAuth Callback */}
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          
          {/* Public Booking Routes */}
          <Route path="/book/:token" element={<BookingPage />} />
          <Route path="/booking/success" element={<BookingSuccess />} />
          <Route path="/manage/:bookingToken" element={<BookingManagement />} />
          
          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/teams" element={
            <ProtectedRoute>
              <Teams />
            </ProtectedRoute>
          } />
          
          <Route path="/teams/:id" element={
            <ProtectedRoute>
              <TeamDetail />
            </ProtectedRoute>
          } />
          
          <Route path="/bookings" element={
            <ProtectedRoute>
              <Bookings />
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          
          <Route path="/my-booking-link" element={
            <ProtectedRoute>
              <BookingLink />
            </ProtectedRoute>
          } />
          
          {/* Root Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* 404 - Catch all */}
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404 - Page Not Found</h1>
                <a href="/dashboard" className="text-purple-600 hover:text-purple-700">
                  Go to Dashboard
                </a>
              </div>
            </div>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;