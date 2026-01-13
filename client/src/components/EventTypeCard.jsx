import { Clock, Video, Phone, MapPin, ChevronRight, Calendar } from 'lucide-react';

export default function EventTypeCard({ event, onClick, branding }) {
  const getLocationIcon = (location) => {
    const loc = (location || '').toLowerCase();
    if (loc.includes('zoom') || loc.includes('meet') || loc.includes('video') || loc.includes('google')) {
      return <Video className="h-4 w-4" />;
    }
    if (loc.includes('phone')) {
      return <Phone className="h-4 w-4" />;
    }
    if (loc.includes('person') || loc.includes('office')) {
      return <MapPin className="h-4 w-4" />;
    }
    return <Video className="h-4 w-4" />;
  };

  const getLocationText = (location, locationType) => {
    // First check locationType
    if (locationType) {
      switch (locationType) {
        case 'google_meet': return 'Google Meet';
        case 'zoom': return 'Zoom';
        case 'teams': return 'MS Teams';
        case 'phone': return 'Phone call';
        case 'in_person': return 'In person';
        default: break;
      }
    }
    // Then check location string
    if (!location) return 'Video call';
    const loc = location.toLowerCase();
    if (loc.includes('zoom')) return 'Zoom';
    if (loc.includes('meet') || loc.includes('google')) return 'Google Meet';
    if (loc.includes('teams')) return 'MS Teams';
    if (loc.includes('phone')) return 'Phone call';
    if (loc.includes('person') || loc.includes('office')) return 'In person';
    return 'Video call';
  };

  // Generate a color based on event or use branding
  const primaryColor = branding?.primary_color || '#8B5CF6';
  const accentColor = branding?.accent_color || '#EC4899';

  const colors = [
    `from-purple-500 to-pink-500`,
    `from-blue-500 to-cyan-500`,
    `from-green-500 to-emerald-500`,
    `from-orange-500 to-red-500`,
    `from-indigo-500 to-purple-500`,
  ];

  // Use event color if available, otherwise use gradient based on index
  const colorIndex = (event.id || 0) % colors.length;
  const eventColor = event.color || primaryColor;

  return (
    <button
      onClick={onClick}
      className="w-full group text-left"
    >
      <div className="flex items-center gap-4 p-5 bg-gray-50 hover:bg-white rounded-2xl border-2 border-gray-100 hover:border-purple-200 hover:shadow-lg transition-all duration-200">
        <div
          className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center flex-shrink-0 shadow-md`}
        >
          <Calendar className="h-7 w-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors truncate text-lg">
            {event.name}
          </h3>
          {event.description && (
            <p className="text-sm text-gray-500 truncate mt-0.5">{event.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {event.duration} min
            </span>
            <span className="flex items-center gap-1.5">
              {getLocationIcon(event.location || event.location_type)}
              {getLocationText(event.location, event.location_type)}
            </span>
            {event.price > 0 && (
              <span className="text-green-600 font-medium">
                ${event.price}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
      </div>
    </button>
  );
}
