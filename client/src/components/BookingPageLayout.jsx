import { Globe, Sparkles } from 'lucide-react';

export default function BookingPageLayout({ children, user, badge, branding }) {
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  // Use branding colors if provided, otherwise defaults
  const primaryColor = branding?.primary_color || '#8B5CF6';
  const accentColor = branding?.accent_color || '#EC4899';
  const hidePoweredBy = branding?.hide_powered_by || false;

  const gradientStyle = {
    background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: `linear-gradient(135deg, ${primaryColor}08, ${accentColor}08, #fafafa)` }}
    >
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header gradient */}
          <div className="h-24 relative" style={gradientStyle}>
            {badge && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                {badge}
              </div>
            )}
          </div>

          {/* Profile Section */}
          <div className="px-8 pb-8">
            <div className="flex items-end gap-4 -mt-12 mb-6 relative z-10">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user?.name}
                  className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg object-cover bg-white relative z-10"
                />
              ) : branding?.logo_url ? (
                <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg bg-white flex items-center justify-center relative z-10">
                  <img
                    src={branding.logo_url}
                    alt="Logo"
                    className="w-16 h-16 object-contain"
                  />
                </div>
              ) : (
                <div
                  className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center relative z-10"
                  style={gradientStyle}
                >
                  <span className="text-3xl font-bold text-white">{getInitials(user?.name)}</span>
                </div>
              )}
              <div className="pb-2">
                <h1 className="text-2xl font-bold text-gray-900">{user?.name || 'Book a Meeting'}</h1>
                {user?.bio && <p className="text-gray-500 text-sm mt-1">{user.bio}</p>}
              </div>
            </div>

            {/* Timezone */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
              <Globe className="h-4 w-4" />
              <span>Times shown in your local timezone</span>
            </div>

            {/* Content */}
            {children}
          </div>
        </div>

        {/* Footer */}
        {!hidePoweredBy && (
          <div className="text-center mt-8">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-purple-600 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span>Powered by <span className="font-semibold">TruCal</span></span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
