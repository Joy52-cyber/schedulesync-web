import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Loader2, AlertCircle } from 'lucide-react';
import BookingPageLayout from '../components/BookingPageLayout';
import EventTypeCard from '../components/EventTypeCard';

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

      // Filter out system/default event types
      const visibleEvents = (data.eventTypes || []).filter(
        et => !et.name?.toLowerCase().includes('default') &&
              !et.name?.toLowerCase().includes('magic link') &&
              !et.name?.toLowerCase().includes('quick link') &&
              et.is_active !== false
      );
      setEventTypes(visibleEvents);

      // Set branding if available
      if (data.branding) {
        setBranding({
          logo_url: data.branding.logo_url || null,
          primary_color: data.branding.primary_color || '#8B5CF6',
          accent_color: data.branding.accent_color || '#EC4899',
          hide_powered_by: data.branding.hide_powered_by || false,
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

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${branding.primary_color}10, ${branding.accent_color}10, #fafafa)` }}
      >
        <div className="text-center">
          <Loader2
            className="h-10 w-10 animate-spin mx-auto mb-4"
            style={{ color: branding.primary_color }}
          />
          <p className="text-gray-500">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center px-4">
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
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <BookingPageLayout user={profile} branding={branding}>
      {eventTypes.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No meetings available right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Select a meeting type
          </h2>
          {eventTypes.map((eventType) => (
            <EventTypeCard
              key={eventType.id}
              event={eventType}
              onClick={() => handleSelectEvent(eventType)}
              branding={branding}
            />
          ))}
        </div>
      )}
    </BookingPageLayout>
  );
}
