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
  Link2,
  Zap,
  Bot,
  Inbox,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { NotificationBell } from "../contexts/NotificationContext";
import { useUpgrade } from "../context/UpgradeContext";
import AISchedulerChat from "./AISchedulerChat";
import ThemeToggle from "./ThemeToggle";
import OnboardingWalkthrough from "./OnboardingWalkthrough";
import api from "../utils/api";

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hasProFeature, hasTeamFeature } = useUpgrade();

  // Check for new user onboarding
  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed');
    const skipped = localStorage.getItem('onboarding_skipped');

    if (!completed && !skipped) {
      // Check if user has any event types set up
      api.get('/event-types').then(res => {
        if (res.data.length === 0) {
          setShowOnboarding(true);
        }
      }).catch(() => {});
    }
  }, []);

  // Admin check - use is_admin flag or fallback to email list
  const adminEmails = ['jaybersales95@gmail.com'];
  const userEmail = user?.email?.toLowerCase() || '';
  const isAdmin = user?.is_admin || adminEmails.includes(userEmail);

  // Helper to check if badge should show (hide if user already has access)
  const shouldShowBadge = (requiredTier) => {
    if (requiredTier === 'pro' && hasProFeature()) return false;
    if (requiredTier === 'team' && hasTeamFeature()) return false;
    return true;
  };

  // Main navigation items
  const mainNavigation = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, walkthrough: "dashboard-nav" },
    { name: "Event Types", path: "/events", icon: Clock, walkthrough: "events-nav" },
    { name: "Bookings", path: "/bookings", icon: Calendar, walkthrough: "bookings-nav" },
    { name: "Booking Links", path: "/my-links", icon: Link2, walkthrough: "my-links-nav" },
    { name: "Teams", path: "/teams", icon: Users, walkthrough: "teams-nav" },
    { name: "Settings", path: "/settings", icon: Settings, walkthrough: "settings-nav" },
  ];

  // AI Features with required tier (badges shown conditionally)
  const aiFeatures = [
    { name: "Inbox Assistant", path: "/inbox-assistant", icon: Inbox, walkthrough: "inbox-nav", requiredTier: "pro" },
    { name: "Smart Rules", path: "/rules", icon: Zap, walkthrough: "rules-nav", requiredTier: "pro" },
    { name: "Autonomous", path: "/autonomous", icon: Bot, walkthrough: "autonomous-nav", requiredTier: "team" },
  ];

  // Admin navigation
  const adminNavigation = isAdmin ? [
    { name: "Admin Panel", path: "/admin", icon: ShieldAlert, walkthrough: "admin-nav" }
  ] : [];

  // Check if current path is an AI feature
  const isAiFeatureActive = aiFeatures.some(item => location.pathname === item.path);

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

  const NavLink = ({ item, onClick, compact = false }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const isAdminLink = item.path === "/admin";
    const showBadge = item.requiredTier && shouldShowBadge(item.requiredTier);

    return (
      <Link
        to={item.path}
        data-walkthrough={item.walkthrough}
        onClick={onClick}
        className={`flex items-center gap-2 ${compact ? 'px-3 py-2' : 'px-3 xl:px-4 py-2'} rounded-lg font-medium transition-colors text-sm ${
          isActive
            ? isAdminLink
              ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            : isAdminLink
              ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
        }`}
      >
        <Icon className={compact ? "h-4 w-4" : "h-4 w-4 xl:h-5 xl:w-5"} />
        <span className={compact ? "flex-1" : "hidden xl:inline"}>{item.name}</span>
        {showBadge && (
          <span className={`${compact ? '' : 'hidden xl:inline'} text-xs ${
            item.requiredTier === 'team' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
          } px-1.5 py-0.5 rounded font-semibold`}>
            {item.requiredTier === 'team' ? 'TEAM' : 'PRO'}
          </span>
        )}
      </Link>
    );
  };

  const MobileNavLink = ({ item, onClick }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const isAdminLink = item.path === "/admin";
    const showBadge = item.requiredTier && shouldShowBadge(item.requiredTier);

    return (
      <Link
        to={item.path}
        data-walkthrough={item.walkthrough}
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
          isActive
            ? isAdminLink
              ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            : isAdminLink
              ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm flex-1">{item.name}</span>
        {showBadge && (
          <span className={`text-xs ${
            item.requiredTier === 'team' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
          } px-1.5 py-0.5 rounded font-semibold`}>
            {item.requiredTier === 'team' ? 'TEAM' : 'PRO'}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Onboarding Walkthrough for new users */}
      {showOnboarding && (
        <OnboardingWalkthrough
          onComplete={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 shadow-sm transition-colors">
        <div className="mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/" className="flex items-center gap-2 sm:gap-3">
                <span className="text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                  ScheduleSync
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {/* Main Nav Items */}
              {mainNavigation.map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {/* AI Tools Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setAiExpanded(!aiExpanded)}
                  className={`flex items-center gap-2 px-3 xl:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                    isAiFeatureActive
                      ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Sparkles className="h-4 w-4 xl:h-5 xl:w-5" />
                  <span className="hidden xl:inline">AI Tools</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${aiExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {aiExpanded && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setAiExpanded(false)}
                    />
                    {/* Menu */}
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-20">
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI-Powered Features</p>
                      </div>
                      {aiFeatures.map((item) => (
                        <NavLink
                          key={item.path}
                          item={item}
                          onClick={() => setAiExpanded(false)}
                          compact
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Admin Nav */}
              {adminNavigation.map((item) => (
                <NavLink key={item.path} item={item} />
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Notification Bell */}
              <div className="flex-shrink-0">
                <NotificationBell />
              </div>

              <div className="hidden sm:block text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                  {user?.name || "User"}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
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
                className="hidden lg:flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden xl:inline">Logout</span>
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 dark:text-gray-300" />
                ) : (
                  <Menu className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 dark:text-gray-300" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
            <div className="px-3 sm:px-4 py-3 space-y-1">
              <div className="sm:hidden px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>

              {/* Main Nav Items */}
              {mainNavigation.map((item) => (
                <MobileNavLink
                  key={item.path}
                  item={item}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}

              {/* AI Tools Section */}
              <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setAiExpanded(!aiExpanded)}
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium">AI Tools</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${aiExpanded ? 'rotate-180' : ''}`} />
                </button>

                {aiExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-purple-100 dark:border-purple-800 pl-4">
                    {aiFeatures.map((item) => (
                      <MobileNavLink
                        key={item.path}
                        item={item}
                        onClick={() => setMobileMenuOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Admin Nav */}
              {adminNavigation.map((item) => (
                <MobileNavLink
                  key={item.path}
                  item={item}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium mt-2"
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

      {/* AI Assistant - Available on all protected pages */}
      <AISchedulerChat />
    </div>
  );
}
