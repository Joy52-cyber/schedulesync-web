import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Bookings from './pages/Bookings';
import BookingPage from './pages/BookingPage';
import OAuthCallback from './pages/OAuthCallback';
import CalendarSettings from './pages/CalendarSettings';
import BookingConfirmation from './pages/BookingConfirmation';
import TeamSettings from './pages/TeamSettings';
import Layout from './components/Layout';
import api from './utils/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const initAuth = () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    console.log('🔍 Checking stored auth:', { hasToken: !!token, hasUser: !!storedUser });
    
    if (token && storedUser) {
      try {
        // Set token in axios defaults
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Parse user data
        const userData = JSON.parse(storedUser);
        
        // Set state directly - no validation needed
        setUser(userData);
        setIsAuthenticated(true);
        console.log('✅ Auto-login successful for:', userData.email);
        
      } catch (error) {
        console.error('❌ Invalid stored user data, clearing...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
    setLoading(false);
  };
  
  initAuth();
}, []);

  const handleLogin = (token, userData) => {
    console.log('🔐 Saving login:', userData.email);
    
    // Save to localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Set in axios
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Update state
    setUser(userData);
    setIsAuthenticated(true);
    
    console.log('✅ Login saved successfully');
  };

  const handleLogout = () => {
    console.log('👋 Logging out...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">Loading ScheduleSync...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
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
        <Route path="/book/:token" element={<BookingPage />} />
        <Route path="/booking-confirmation" element={<BookingConfirmation />} />
        <Route path="/oauth/callback" element={<OAuthCallback onLogin={handleLogin} />} />
        {/* Protected Routes */}
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
          <Route path="teams/:teamId/settings" element={<TeamSettings />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="settings" element={<CalendarSettings />} />
        
          </Route>
        
        {/* Catch all */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;