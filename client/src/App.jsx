@'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Auth Pages (these exist)
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';

// Dashboard Pages (these exist)
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Bookings from './pages/Bookings';
import UserSettings from './pages/UserSettings';
import CalendarSettings from './pages/CalendarSettings';
import TeamSettings from './pages/TeamSettings';
import TeamMembers from './pages/TeamMembers';
import OAuthCallback from './pages/OAuthCallback';

// Booking Pages (these exist with different names)
import BookingPage from './pages/BookingPage'; // This is .js not .jsx
import ManageBooking from './pages/ManageBooking';

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
          <Route path="/manage/:bookingToken" element={<ManageBooking />} />
          
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
              <TeamMembers />
            </ProtectedRoute>
          } />
          
          <Route path="/teams/:id/settings" element={
            <ProtectedRoute>
              <TeamSettings />
            </ProtectedRoute>
          } />
          
          <Route path="/bookings" element={
            <ProtectedRoute>
              <Bookings />
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <UserSettings />
            </ProtectedRoute>
          } />
          
          <Route path="/settings/calendar" element={
            <ProtectedRoute>
              <CalendarSettings />
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
'@ | Set-Content -Path "client/src/App.jsx" -Encoding UTF8