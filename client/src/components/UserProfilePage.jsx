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
  Star,
  CheckCircle,
} from 'lucide-react';

export default function UserProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);

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
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setError(err.message || 'Failed to load booking page');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (eventType) => {
    // Navigate to the booking page for this event type
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4">
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
            className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-purple-600" />
              <span className="font-bold text-gray-900">TruCal</span>
            </div>
            <a 
              href="/"
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Create your own →
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-12 text-center">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.name}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-purple-600" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {profile?.name || profile?.username || username}
            </h1>
            {profile?.bio && (
              <p className="text-purple-100 max-w-md mx-auto">
                {profile.bio}
              </p>
            )}
          </div>

          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
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
                    className="w-full text-left p-6 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: eventType.color || '#8B5CF6' }}
                          />
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-700 transition-colors">
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
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                          <ArrowRight className="h-5 w-5 text-purple-600" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Powered by{' '}
            <a href="/" className="text-purple-600 hover:text-purple-700 font-medium">
              TruCal
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}