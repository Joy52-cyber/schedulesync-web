import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Clock,
  Settings,
   Link2

} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { NotificationBell } from "../contexts/NotificationContext";

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Case-insensitive admin check
  const adminEmails = ['jaybersales95@gmail.com'];
  const userEmail = user?.email?.toLowerCase() || '';
  const isAdmin = adminEmails.includes(userEmail);

  const navigation = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Event Types", path: "/events", icon: Clock },
  { name: "Teams", path: "/teams", icon: Users },
  { name: "Bookings", path: "/bookings", icon: Calendar },
  { name: "My Link", path: "/my-booking-link", icon: Link2 },
  { name: "Settings", path: "/settings", icon: Settings },
];

  // Add Admin Panel to navigation if user is admin
  if (isAdmin) {
    navigation.push({ name: "Admin Panel", path: "/admin", icon: ShieldAlert });
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getUserInitials = () => {
    if (user?.name) {
      return user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/" className="flex items-center gap-2 sm:gap-3">
                <span className="text-base sm:text-lg font-bold tracking-tight text-gray-900">
                  ScheduleSync
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const isAdminLink = item.path === "/admin";
                
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 xl:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                      isActive
                        ? isAdminLink 
                          ? "bg-red-50 text-red-600" 
                          : "bg-blue-50 text-blue-600"
                        : isAdminLink
                          ? "text-red-600 hover:bg-red-50"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="h-4 w-4 xl:h-5 xl:w-5" />
                    <span className="hidden xl:inline">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3 sm:gap-4">
  {/* Notification Bell with proper spacing */}
  <div className="flex-shrink-0">
    <NotificationBell />
  </div>

              <div className="hidden sm:block text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[150px]">
                  {user?.name || "User"}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[150px]">
                  {user?.email}
                </p>
              </div>

              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-xs sm:text-sm">
                  {getUserInitials()}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="hidden lg:flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden xl:inline">Logout</span>
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                ) : (
                  <Menu className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        
        {mobileMenuOpen && (
  <div className="lg:hidden border-t border-gray-200 bg-white shadow-2xl">
    <div className="px-3 sm:px-4 py-3 space-y-2">
        <div className="sm:hidden px-4 py-3 bg-gray-50 rounded-lg mb-2">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>

              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const isAdminLink = item.path === "/admin";

                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                      isActive
                        ? isAdminLink 
                          ? "bg-red-50 text-red-600" 
                          : "bg-blue-50 text-blue-600"
                        : isAdminLink
                          ? "text-red-600 hover:bg-red-50"
                          : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                );
              })}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium mt-2"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-[1600px]">
        <Outlet />
      </main>
    </div>
  );
}