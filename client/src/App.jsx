import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import VerifyEmail from './pages/VerifyEmail';
import OAuthCallback from './pages/OAuthCallback';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import TeamMembers from './pages/TeamMembers';
import TeamSettings from './pages/TeamSettings';
import MemberAvailability from './pages/MemberAvailability';
import Bookings from './pages/Bookings';
import UserSettings from './pages/UserSettings';

// Public Pages
import BookingPage from './pages/BookingPage';
import ManageBooking from './pages/ManageBooking';


// Components
import Layout from './components/Layout';
import BookingConfirmation from './components/BookingConfirmation';
import MyBookingLink from './components/MyBookingLink';

// Utils
import api from './utils/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize authentication on app load
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('🔄 Starting auth initialization...');
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        console.log('🔍 Stored auth:', { hasToken: !!token, hasUser: !!storedUser });
        
        if (token && storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setUser(userData);
            setIsAuthenticated(true);
            console.log('✅ Auto-login successful for:', userData.email);
          } catch (error) {
            console.error('❌ Invalid stored data:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } else {
          console.log('ℹ️ No stored auth found');
        }
      } catch (error) {
        console.error('❌ Auth init error:', error);
      } finally {
        console.log('✅ Auth init complete');
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);

  // Handle login from Login/Register/OAuth pages
  const handleLogin = (token, userData) => {
    console.log('🔐 handleLogin called:', userData?.email);
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      setIsAuthenticated(true);
      console.log('✅ Login saved successfully');
    } catch (error) {
      console.error('❌ Login save error:', error);
    }
  };

  // Handle logout
  const handleLogout = () => {
    console.log('👋 Logging out...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setIsAuthenticated(false);
  };

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">Loading ScheduleSync...</p>
          <p className="text-white text-sm mt-2 opacity-75">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ==================== PUBLIC AUTH ROUTES ==================== */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Register onLogin={handleLogin} />
            )
          }
        />
        
        <Route
          path="/forgot-password"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ForgotPassword />
            )
          }
        />

        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/oauth/callback" element={<OAuthCallback onLogin={handleLogin} />} />
        
        {/* ==================== PUBLIC BOOKING ROUTES ==================== */}
       <Route path="/book/:token" element={<BookingPage />} />
        <Route path="/booking-confirmation" element={<BookingConfirmation />} />
        <Route path="/manage/:token" element={<ManageBooking />} />


        {/* ==================== PROTECTED ROUTES ==================== */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="teams" element={<Teams />} />
          <Route path="teams/:teamId/members" element={<TeamMembers />} />
          <Route path="teams/:teamId/settings" element={<TeamSettings />} />
          <Route path="teams/:teamId/members/:memberId/availability" element={<MemberAvailability />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="my-booking-link" element={<MyBookingLink />} />
          <Route path="user-settings" element={<UserSettings />} />
        </Route>
        
        {/* ==================== CATCH ALL ==================== */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;