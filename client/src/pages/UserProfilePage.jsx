import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Video,
  Phone,
  MapPin,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export default function UserProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [branding, setBranding] = useState({
    logo_url: null,
    primary_color: '#8B5CF6',
    accent_color: '#EC4899',
    hide_powered_by: false,
  });

  useEffect(() => {
    fetchUserProfile();
  }, [username]);

  const fetchUserProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/book/user/${username}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'User not found');
      }
      
      setProfile(data.user);
      setEventTypes(data.eventTypes || []);
      
      // Set branding if available
      if (data.user?.branding) {
        setBranding({
          logo_url: data.user.branding.logo_url || null,
          primary_color: data.user.branding.primary_color || '#8B5CF6',
          accent_color: data.user.branding.accent_color || '#EC4899',
          hide_powered_by: data.user.branding.hide_powered_by || false,
        });
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setError(err.message || 'Failed to load booking page');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (eventType) => {
    navigate(`/book/${username}/${eventType.slug}`);
  };

  const getLocationIcon = (locationType) => {
    switch (locationType) {
      case 'video':
      case 'google_meet':
      case 'zoom':
        return <Video className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      case 'in_person':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Video className="h-4 w-4" />;
    }
  };

  const getLocationLabel = (locationType) => {
    switch (locationType) {
      case 'video':
      case 'google_meet':
        return 'Google Meet';
      case 'zoom':
        return 'Zoom';
      case 'phone':
        return 'Phone call';
      case 'in_person':
        return 'In person';
      default:
        return 'Video call';
    }
  };

  // Generate gradient style from branding colors
  const gradientStyle = {
    background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.accent_color})`,
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${branding.primary_color}15, ${branding.accent_color}15)` }}
      >
        <div className="text-center">
          <Loader2 
            className="h-12 w-12 animate-spin mx-auto mb-4" 
            style={{ color: branding.primary_color }}
          />
          <p className="text-gray-600">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-600 mb-6">
            {error === 'User not found' 
              ? `We couldn't find a user with the username "${username}".`
              : error}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 text-white rounded-xl font-semibold transition-colors"
            style={gradientStyle}
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{ background: `linear-gradient(135deg, ${branding.primary_color}10, ${branding.accent_color}10, white)` }}
    >
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {branding.logo_url ? (
                <img 
                  src={branding.logo_url} 
                  alt="Logo" 
                  className="h-8 w-8 object-contain rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div 
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={gradientStyle}
                >
                  <Calendar className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="font-bold text-gray-900">
                {profile?.name || username}
              </span>
            </div>
            <a 
              href="/"
              className="text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: branding.primary_color }}
            >
              Create your own →
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
          <div 
            className="px-8 py-12 text-center"
            style={gradientStyle}
          >
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.name}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : branding.logo_url ? (
                <img 
                  src={branding.logo_url} 
                  alt="Logo"
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <User className="h-12 w-12" style={{ color: branding.primary_color }} />
              )}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {profile?.name || profile?.username || username}
            </h1>
            {profile?.bio && (
              <p className="text-white/90 max-w-md mx-auto">
                {profile.bio}
              </p>
            )}
          </div>

          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5" style={{ color: branding.primary_color }} />
              Select a Meeting Type
            </h2>

            {eventTypes.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No meeting types available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {eventTypes.map((eventType) => (
                  <button
                    key={eventType.id}
                    onClick={() => handleSelectEvent(eventType)}
                    className="w-full text-left p-6 rounded-2xl border-2 border-gray-100 hover:shadow-lg transition-all group"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = branding.primary_color + '50';
                      e.currentTarget.style.backgroundColor = branding.primary_color + '08';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#f3f4f6';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: eventType.color || branding.primary_color }}
                          />
                          <h3 className="text-lg font-bold text-gray-900 group-hover:opacity-90 transition-colors">
                            {eventType.name}
                          </h3>
                        </div>
                        
                        {eventType.description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {eventType.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {eventType.duration} min
                          </span>
                          <span className="flex items-center gap-1">
                            {getLocationIcon(eventType.location_type)}
                            {getLocationLabel(eventType.location_type)}
                          </span>
                          {eventType.price > 0 && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              ${eventType.price}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4 flex items-center">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                          style={{ backgroundColor: branding.primary_color + '20' }}
                        >
                          <ArrowRight 
                            className="h-5 w-5" 
                            style={{ color: branding.primary_color }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer - conditionally shown based on branding */}
        {!branding.hide_powered_by && (
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Powered by{' '}
              <a 
                href="/" 
                className="font-medium hover:opacity-80 transition-opacity"
                style={{ color: branding.primary_color }}
              >
                ScheduleSync
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}