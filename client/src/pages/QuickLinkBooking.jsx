import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Loader2, Clock, AlertCircle, User } from 'lucide-react';
import BookingPageLayout from '../components/BookingPageLayout';
import EventTypeCard from '../components/EventTypeCard';

export default function QuickLinkBooking() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLinkData();
  }, [token]);

  const fetchLinkData = async () => {
    try {
      // Try the magic-link endpoint first, then fall back to book endpoint
      let response = await fetch(`/api/magic-links/validate/${token}`);

      if (!response.ok) {
        // Fall back to the book endpoint
        response = await fetch(`/api/book/${token}`);
      }

      if (!response.ok) {
        if (response.status === 410) {
          setError({ type: 'expired', message: 'This link has expired' });
        } else if (response.status === 404) {
          setError({ type: 'not_found', message: 'This link is invalid or has already been used' });
        } else {
          setError({ type: 'error', message: 'Something went wrong' });
        }
        return;
      }

      const result = await response.json();

      // Handle different response formats
      if (result.data) {
        // Format from /api/book/:token
        setData({
          user: result.data.member || result.data.user,
          eventType: result.data.eventType,
          quickLink: result.data.magicLink || result.data.quickLink,
        });
      } else {
        // Format from /api/magic-links/validate/:token
        setData({
          user: result.user || result.member,
          eventType: result.eventType || result.event_type,
          quickLink: result.magicLink || result.quickLink || result,
        });
      }
    } catch (err) {
      console.error('Error loading quick link:', err);
      setError({ type: 'error', message: 'Failed to load booking page' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error.type === 'expired' ? 'Link Expired' : 'Link Not Found'}
          </h1>
          <p className="text-gray-500 mb-6">{error.message}</p>
          <p className="text-sm text-gray-400">
            Please contact the person who sent you this link for a new one.
          </p>
        </div>
      </div>
    );
  }

  const { user, eventType, quickLink } = data || {};

  // Determine badge
  let badge = null;
  if (quickLink?.attendee_name) {
    badge = `For ${quickLink.attendee_name}`;
  } else if (quickLink?.usage_limit === 1 || quickLink?.is_single_use) {
    badge = 'Single use';
  }

  // Create event object for the card
  const eventForCard = eventType ? {
    id: eventType.id,
    name: eventType.name || eventType.title || 'Meeting',
    description: eventType.description,
    duration: eventType.duration || 30,
    location: eventType.location || eventType.location_type,
    location_type: eventType.location_type,
  } : {
    id: 1,
    name: quickLink?.name || 'Quick Meeting',
    description: quickLink?.description || `Meeting with ${user?.name}`,
    duration: quickLink?.duration || 30,
    location: 'video',
  };

  return (
    <BookingPageLayout user={user} badge={badge}>
      {/* Personalized greeting */}
      {quickLink?.attendee_name && (
        <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-purple-900">
                Hi {quickLink.attendee_name}!
              </p>
              <p className="text-sm text-purple-700">
                {user?.name} has invited you to book a meeting
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Event Type Card */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          {quickLink?.attendee_name ? 'Your meeting' : 'Book a meeting'}
        </h2>
        <EventTypeCard
          event={eventForCard}
          onClick={() => {
            // Navigate to the full booking page with the token
            // This will use the existing BookingPage.jsx flow
            navigate(`/book/${token}?continue=true`);
          }}
        />
      </div>

      {/* Link info */}
      {quickLink?.expires_at && (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Link expires {new Date(quickLink.expires_at).toLocaleDateString()}
          </span>
        </div>
      )}
    </BookingPageLayout>
  );
}
