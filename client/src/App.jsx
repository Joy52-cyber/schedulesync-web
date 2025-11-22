import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout'; // 👈 IMPORTANT

// Auth pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';

// Dashboard pages
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Bookings from './pages/Bookings';
import UserSettings from './pages/UserSettings';
import CalendarSettings from './pages/CalendarSettings';
import TeamSettings from './pages/TeamSettings';
import TeamMembers from './pages/TeamMembers';
import OAuthCallback from './pages/OAuthCallback';

// Booking pages
import BookingPage from './pages/BookingPage';
import ManageBooking from './pages/ManageBooking';

function App() {
  // Handle login for OAuth callback
  const handleLogin = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Force reload to update auth state
    window.location.href = '/dashboard';
  };

  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public: Authentication */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* OAuth redirect page - no navbar here */}
          <Route
            path="/oauth/callback"
            element={<OAuthCallback onLogin={handleLogin} />}
          />

          {/* Public booking routes (no dashboard layout) */}
          <Route path="/book/:token" element={<BookingPage />} />
          <Route path="/manage/:bookingToken" element={<ManageBooking />} />

          {/* Protected: Dashboard / App (WITH layout + navbar) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <Layout>
                  <Teams />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/teams/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <TeamMembers />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/teams/:id/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <TeamSettings />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Bookings />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <UserSettings />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings/calendar"
            element={
              <ProtectedRoute>
                <Layout>
                  <CalendarSettings />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Default route → Dashboard (still protected) */}
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />

          {/* 404 Page */}
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
