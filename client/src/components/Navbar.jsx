import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  Ticket, // For single-use links
  Plus,   // For quick actions
} from 'lucide-react';
import { useState } from 'react';
import { NotificationBell } from '../contexts/NotificationContext';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: Calendar },
    { path: '/availability', label: 'Availability', icon: Clock },
    { path: '/teams', label: 'Teams', icon: Users },
    { path: '/bookings', label: 'Bookings', icon: Calendar },
    { 
      path: '/my-booking-link', 
      label: 'My Links', 
      icon: Link2,
      dropdown: [
        { path: '/my-booking-link', label: 'Permanent Link', icon: Link2 },
        { path: '/single-use-links', label: 'Single-Use Links', icon: Ticket }
      ]
    },
    { path: '/email-templates', label: 'Templates', icon: Mail },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

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
              
              // If link has dropdown, show main link
              if (link.dropdown) {
                return (
                  <div key={link.path} className="relative group">
                    <Link
                      to={link.path}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive(link.path) || link.dropdown.some(item => isActive(item.path))
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                    
                    {/* Dropdown menu on hover */}
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      {link.dropdown.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors first:rounded-t-lg last:rounded-b-lg"
                          >
                            <ItemIcon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              
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
          </div>

          {/* User / Notifications (Desktop) */}
          <div className="hidden md:flex items-center gap-4">
            <NotificationBell />

            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {user.name || 'User'}
                </p>
                <p className="text-xs text-gray-600 leading-tight">
                  {user.email || ''}
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

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-200 mt-2 animate-fadeIn">
            {/* User Info Mobile */}
            <div className="flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-lg mb-2 mt-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user.name || 'User'}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {user.email || ''}
                </p>
              </div>
            </div>

            {/* Navigation Links Mobile */}
            <div className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                
                if (link.dropdown) {
                  return (
                    <div key={link.path} className="space-y-1">
                      <Link
                        to={link.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                          isActive(link.path)
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {link.label}
                      </Link>
                      
                      {/* Show dropdown items in mobile */}
                      <div className="pl-6 space-y-1">
                        {link.dropdown.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${
                                isActive(item.path)
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <ItemIcon className="h-4 w-4" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive(link.path)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                );
              })}

              {/* Logout Mobile */}
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </nav>
  );
}