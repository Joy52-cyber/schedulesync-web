// Add these new imports at the top of Navbar.jsx
import {
  LogOut,
  Calendar,
  Users,
  Link2,
  Settings,
  Menu,
  X,
  Clock,
  Mail,
  Copy,
  Check,
  Ticket,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { NotificationBell } from '../contexts/NotificationContext';
import api, { singleUseLinks } from '../utils/api'; // Add this import

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // ADD THESE NEW STATE VARIABLES:
  const [showLinksDropdown, setShowLinksDropdown] = useState(false);
  const [bookingLink, setBookingLink] = useState('');
  const [copied, setCopied] = useState('');
  const [user, setUser] = useState(null);

  // ADD THIS useEffect:
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data.user;
      setUser(userData);
      if (userData?.booking_token) {
        setBookingLink(`${window.location.origin}/book/${userData.booking_token}`);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleCopyLink = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink);
    setCopied('permanent');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleCreateLink = async () => {
    try {
      await api.get('/my-booking-link');
      await loadUserProfile();
    } catch (error) {
      console.error('Generate link error:', error);
    }
  };

  // UPDATE YOUR navLinks TO REPLACE THE My Link ITEM:
  const navLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: Calendar },
    { path: '/availability', label: 'Availability', icon: Clock },
    { path: '/teams', label: 'Teams', icon: Users },
    { path: '/bookings', label: 'Bookings', icon: Calendar },
    // REPLACE this line with the dropdown version below
    // { path: '/my-booking-link', label: 'My Link', icon: Link2 },
    { path: '/email-templates', label: 'Templates', icon: Mail },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  // YOUR EXISTING handleLogout function...

  const isActive = (path) => location.pathname === path;

  // REPLACE your existing user JSON.parse line with:
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <nav className="bg-white border-b-2 border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <span className="text-base sm:text-lg font-bold tracking-tight text-gray-900">
              ScheduleSync
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(link.path)
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}

            {/* ADD MY LINKS DROPDOWN HERE */}
            <div className="relative">
              <button
                onClick={() => setShowLinksDropdown(!showLinksDropdown)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-all"
              >
                <Link2 className="h-4 w-4" />
                My Links
              </button>

              {/* Links Dropdown */}
              {showLinksDropdown && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  <div className="p-4">
                    
                    {/* Permanent Link Section */}
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Permanent Link
                      </h3>
                      
                      {bookingLink ? (
                        <div className="space-y-2">
                          <div className="font-mono text-xs text-gray-600 bg-gray-50 border rounded-lg px-3 py-2 break-all">
                            {bookingLink}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleCopyLink}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                              {copied === 'permanent' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              {copied === 'permanent' ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                              onClick={() => window.open(bookingLink, '_blank')}
                              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleCreateLink}
                          className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
                        >
                          Create Link
                        </button>
                      )}
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Ticket className="h-4 w-4" />
                          Single-Use Links
                        </h3>
                        <button
                          onClick={() => {
                            navigate('/single-use-links');
                            setShowLinksDropdown(false);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Manage All →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User / Notifications (Desktop) - YOUR EXISTING CODE */}
          <div className="hidden md:flex items-center gap-4">
            <NotificationBell />

            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {storedUser.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {storedUser.name || 'User'}
                </p>
                <p className="text-xs text-gray-600 leading-tight">
                  {storedUser.email || ''}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>

        {/* Mobile Menu - YOUR EXISTING CODE BUT ADD LINK MANAGEMENT */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-200 mt-2 animate-fadeIn">
            {/* Your existing mobile menu code... */}
            
            {/* ADD MOBILE LINK MANAGEMENT */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Quick Links</h3>
              {bookingLink && (
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
                >
                  {copied === 'permanent' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy My Link
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Close dropdown when clicking outside */}
      {showLinksDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowLinksDropdown(false)}
        />
      )}

      {/* Your existing styles */}
    </nav>
  );
}