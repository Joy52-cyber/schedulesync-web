import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar, User, Clock,
  Sparkles, ArrowRight, ExternalLink, Loader2,
  Ban, ShieldAlert, ChevronRight
} from 'lucide-react';
import { bookings, oauth, eventTypes as eventTypesAPI } from '../utils/api';
import SmartSlotPicker from '../components/SmartSlotPicker';

export default function BookingPage() {
  const { token } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  
  const [isLinkUsed, setIsLinkUsed] = useState(false); 
  const [isDirectMemberLink, setIsDirectMemberLink] = useState(false); // NEW: Track if this is a direct member link

  const [teamInfo, setTeamInfo] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedEventType, setSelectedEventType] = useState(null);
  const [error, setError] = useState('');
   
  const [step, setStep] = useState('loading');
  const [guestCalendar, setGuestCalendar] = useState(null);
  const [hasProcessedOAuth, setHasProcessedOAuth] = useState(false);
   
  const [formData, setFormData] = useState({
    attendee_name: '',
    attendee_email: '',
    notes: '',
  });
   
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    loadBookingInfo();
  }, [token]);

  // --- OAUTH HANDLING ---
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code || !state?.startsWith('guest-booking:') || !token || hasProcessedOAuth) {
      return;
    }

    console.log('✅ Starting guest OAuth processing...');
    setHasProcessedOAuth(true);

    (async () => {
      try {
        setError('');
        const provider = state.split(':')[2] || 'google';
        console.log(`🔐 Processing guest ${provider} OAuth callback...`);
        
        let response;
        if (provider === 'microsoft') {
          response = await oauth.handleMicrosoftCallback(code);
        } else {
          response = await oauth.guestGoogleAuth(code, token);
        }
        
        const data = response.data;
        
        setGuestCalendar({
          signedIn: true,
          hasCalendarAccess: data.hasCalendarAccess || false,
          provider: provider,
          email: data.email || '',
          name: data.name || '',
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        setFormData((prev) => ({
          ...prev,
          attendee_name: data.name || prev.attendee_name,
          attendee_email: data.email || prev.attendee_email,
        }));

        const typeParam = searchParams.get('type');
        navigate(`/book/${token}${typeParam ? `?type=${typeParam}` : ''}`, { replace: true });
        setStep('form');
      } catch (err) {
        console.error('❌ Guest OAuth failed:', err);
        setHasProcessedOAuth(false);
      }
    })();
  }, [searchParams, token, navigate, hasProcessedOAuth]);

  const loadBookingInfo = async () => {
    try {
      setLoading(true);
      const response = await bookings.getByToken(token);
      console.log('📥 Booking info loaded:', response.data);

      const payload = response.data?.data || response.data || {};

      if (!payload.team || !payload.member) {
        throw new Error('Missing team or member information');
      }

      // Handle External Links
      if (payload.member.external_booking_link) {
        console.log('🔀 External link detected. Redirecting to:', payload.member.external_booking_link);
        setRedirecting(true);
        setMemberInfo(payload.member);
        
        setTimeout(() => {
          window.location.href = payload.member.external_booking_link;
        }, 1500);
        return;
      }

      setTeamInfo(payload.team);
      setMemberInfo(payload.member);
      
      // ✅ FIX: Check if this is a direct member booking link
      // A direct member link should NOT show event type selection
      // Backend should return isDirectLink: true OR eventTypes should be explicitly empty/null
      const directMemberLink = payload.isDirectLink === true || 
                               payload.skipEventTypes === true ||
                               payload.linkType === 'member';
      
      setIsDirectMemberLink(directMemberLink);
      
      if (directMemberLink) {
        // ✅ Direct member link - skip event type selection entirely
        console.log('👤 Direct member booking link detected - skipping event type selection');
        setEventTypes([]);
        setSelectedEventType(null);
        setStep('calendar-choice');
        return;
      }
      
      // ✅ Event type booking link - load and show event types
      console.log('📅 Event type booking link - loading event types');
      
      let allEventTypes = payload.eventTypes || [];
      
      // Only fetch event types if backend didn't return them AND it's not a direct link
      if (allEventTypes.length === 0 && !directMemberLink) {
        try {
          console.log('📡 Fetching event types from API...');
          const eventTypesRes = await eventTypesAPI.getAll();
          allEventTypes = eventTypesRes.data.eventTypes || eventTypesRes.data || [];
          console.log('📦 All event types:', allEventTypes);
        } catch (err) {
          console.error('Failed to fetch event types:', err);
        }
      }
      
      // Filter only active event types
      const activeEventTypes = allEventTypes.filter(et => et.is_active !== false);
      setEventTypes(activeEventTypes);
      
      // Check if event type is specified in URL
      const eventTypeSlug = searchParams.get('type');
      console.log('🔍 Event type slug from URL:', eventTypeSlug);

      if (eventTypeSlug) {
        const selectedEvent = activeEventTypes.find(e => e.slug === eventTypeSlug);
        if (selectedEvent) {
          console.log('🎯 Found event type:', selectedEvent);
          setSelectedEventType(selectedEvent);
          setStep('calendar-choice');
        } else {
          setStep(activeEventTypes.length > 0 ? 'event-select' : 'calendar-choice');
        }
      } else {
        if (activeEventTypes.length > 1) {
          setStep('event-select');
        } else if (activeEventTypes.length === 1) {
          setSelectedEventType(activeEventTypes[0]);
          setStep('calendar-choice');
        } else {
          setStep('calendar-choice');
        }
      }

    } catch (err) {
      console.error('❌ Error loading booking info:', err);
      
      if (err.response?.status === 410 || err.response?.data?.code === 'LINK_USED') {
        setIsLinkUsed(true);
        setLoading(false);
        return;
      }

      setError(err.response?.data?.error || 'Invalid booking link');
      setTeamInfo(null);
      setMemberInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEventType = (eventType) => {
    setSelectedEventType(eventType);
    setSearchParams({ type: eventType.slug });
    setStep('calendar-choice');
  };

  const handleCalendarConnect = (provider) => {
    const redirectUri = `${window.location.origin}/oauth/callback`;
    
    if (provider === 'google') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const scope = 'openid email profile https://www.googleapis.com/auth/calendar.readonly';

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        access_type: 'offline',
        prompt: 'select_account',
        state: `guest-booking:${token}:google`,
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (provider === 'microsoft') {
      const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
      const scope = 'openid email profile Calendars.Read';

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        response_mode: 'query',
        state: `guest-booking:${token}:microsoft`,
      });
      window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    }
  };

  const handleSkipCalendar = () => setStep('form');
  const handleSlotSelected = (slot) => setSelectedSlot(slot);

  const handleBackToEventSelect = () => {
    setSelectedEventType(null);
    setSearchParams({});
    setStep('event-select');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return alert('Please select a time slot');
    
    try {
      setSubmitting(true);
      const response = await bookings.create({
        token, 
        slot: selectedSlot, 
        ...formData,
        event_type_id: selectedEventType?.id,
        event_type_slug: selectedEventType?.slug,
      });
      navigateBookingSuccess(response.data.booking);
    } catch (err) {
      if (err.response?.status === 410 || err.response?.data?.code === 'LINK_USED') {
        setIsLinkUsed(true);
        return;
      }
      alert(err.response?.data?.error || 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const navigateBookingSuccess = (booking) => {
    const bookingData = {
      id: booking?.id,
      start_time: selectedSlot.start,
      end_time: selectedSlot.end,
      attendee_name: formData.attendee_name,
      attendee_email: formData.attendee_email,
      organizer_name: memberInfo?.name || memberInfo?.user_name,
      team_name: teamInfo?.name,
      event_type: selectedEventType?.title || selectedEventType?.name,
      duration: selectedEventType?.duration || 30,
      notes: formData.notes,
      meet_link: booking?.meet_link || null,
      booking_token: booking?.booking_token || token,
    };
    const dataParam = encodeURIComponent(JSON.stringify(bookingData));
    navigate(`/booking-confirmation?data=${dataParam}`);
  };

  // Get duration from selected event type or member default or 30
  const duration = selectedEventType?.duration || memberInfo?.default_duration || 30;

  // --- VIEW 1: LOADING / REDIRECTING ---
  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            {redirecting ? <ExternalLink className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-600" /> : <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-600" />}
          </div>
          <p className="text-gray-900 font-bold text-lg">
            {redirecting ? `Redirecting to ${memberInfo?.name}'s calendar...` : 'Loading...'}
          </p>
          {redirecting && <p className="text-gray-500 text-sm mt-2">Please wait while we take you to the booking page.</p>}
        </div>
      </div>
    );
  }

  // --- VIEW 2: SINGLE USE LINK EXPIRED ---
  if (isLinkUsed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Ban className="h-10 w-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Invitation No Longer Valid</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            This single-use link has already been used to book a meeting or has expired. Please contact the host to request a new invitation.
          </p>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <ShieldAlert className="h-4 w-4" />
              <span>One-time secure link</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 3: GENERIC ERROR ---
  if (error && !teamInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">😕</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Booking Link</h1>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  // --- HEADER COMPONENT ---
  const Header = () => (
    <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5"></div>
      <div className="relative p-6 md:p-8">
        <div className="flex items-start gap-4 md:gap-6">
          <div className="relative flex-shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-30"></div>
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl md:text-3xl">
                {memberInfo?.name?.[0]?.toUpperCase() || memberInfo?.user_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {/* Show Event Type if selected (only for event type bookings) */}
            {selectedEventType && !isDirectMemberLink ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: selectedEventType.color === 'blue' ? '#3B82F6' : 
                                       selectedEventType.color === 'purple' ? '#8B5CF6' : 
                                       selectedEventType.color === 'green' ? '#10B981' :
                                       selectedEventType.color === 'red' ? '#EF4444' :
                                       selectedEventType.color || '#3B82F6'
                    }}
                  />
                  <span className="text-sm text-gray-500">Event Type</span>
                </div>
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">
                  {selectedEventType.title || selectedEventType.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                  <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                    <User className="h-4 w-4" />
                    <span>{memberInfo?.name || memberInfo?.user_name}</span>
                  </div>
                  <div className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold flex items-center gap-1">
                    <Clock className="h-3 w-3 md:h-4 md:w-4" />
                    {duration} min
                  </div>
                </div>
                {selectedEventType.description && (
                  <p className="text-gray-600 text-sm md:text-base leading-relaxed">{selectedEventType.description}</p>
                )}
                {eventTypes.length > 1 && step !== 'event-select' && (
                  <button
                    onClick={handleBackToEventSelect}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    ← Change event type
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Direct member booking OR no event type selected */}
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">
                  Book with {memberInfo?.name || memberInfo?.user_name}
                </h1>
                <p className="text-gray-600 text-sm md:text-base mb-2">{teamInfo?.name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {duration} min meeting
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // --- VIEW 4: EVENT TYPE SELECTION (Only for event type bookings) ---
  if (step === 'event-select' && !isDirectMemberLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Header />
          
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Meeting Type</h2>
            <p className="text-gray-600 mb-6">Choose the type of meeting you'd like to schedule</p>
            
            <div className="space-y-3 md:space-y-4">
              {eventTypes.map((eventType) => (
                <button
                  key={eventType.id}
                  onClick={() => handleSelectEventType(eventType)}
                  className="w-full group relative"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity"></div>
                  <div className="relative bg-white border-2 border-gray-200 rounded-2xl p-4 md:p-5 group-hover:border-blue-400 transition-all flex items-center gap-3 md:gap-4">
                    <div 
                      className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                      style={{ 
                        backgroundColor: eventType.color === 'blue' ? '#EFF6FF' : 
                                         eventType.color === 'purple' ? '#F5F3FF' : 
                                         eventType.color === 'green' ? '#F0FDF4' :
                                         eventType.color === 'red' ? '#FEF2F2' :
                                         '#F3F4F6'
                      }}
                    >
                      <Clock 
                        className="h-5 w-5 md:h-6 md:w-6"
                        style={{ 
                          color: eventType.color === 'blue' ? '#3B82F6' : 
                                 eventType.color === 'purple' ? '#8B5CF6' : 
                                 eventType.color === 'green' ? '#10B981' :
                                 eventType.color === 'red' ? '#EF4444' :
                                 '#6B7280'
                        }}
                      />
                    </div>
                    
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-bold text-gray-900 text-base md:text-lg">
                        {eventType.title || eventType.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs md:text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3 md:h-4 md:w-4" />
                          {eventType.duration} min
                        </span>
                        {eventType.description && (
                          <span className="text-xs md:text-sm text-gray-400 truncate max-w-[150px] md:max-w-[250px]">
                            • {eventType.description}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 5: MAIN BOOKING INTERFACE ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Header />

        {/* Calendar Choice Step */}
        {step === 'calendar-choice' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Your Calendar</h3>
              <p className="text-gray-600 mb-6">
                Sync your calendar to automatically check for conflicts (optional)
              </p>
              
              <div className="space-y-3 md:space-y-4">
                {/* Google Calendar */}
                <button onClick={() => handleCalendarConnect('google')} className="w-full group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-yellow-500 rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity"></div>
                  <div className="relative bg-white border-2 border-gray-200 rounded-2xl p-4 md:p-5 group-hover:border-red-300 transition-all flex items-center gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-xl flex items-center justify-center shadow-md border border-gray-100 flex-shrink-0">
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-6 w-6 md:h-8 md:w-8" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-gray-900 text-base md:text-lg">Google Calendar</p>
                      <p className="text-xs md:text-sm text-gray-600">Connect to check for conflicts</p>
                    </div>
                    <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-gray-400 group-hover:text-red-500 transition-colors flex-shrink-0" />
                  </div>
                </button>

                {/* Microsoft Calendar */}
                <button onClick={() => handleCalendarConnect('microsoft')} className="w-full group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity"></div>
                  <div className="relative bg-white border-2 border-gray-200 rounded-2xl p-4 md:p-5 group-hover:border-blue-400 transition-all flex items-center gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-xl flex items-center justify-center shadow-md border border-gray-100 flex-shrink-0">
                      <svg className="h-6 w-6 md:h-8 md:w-8" viewBox="0 0 23 23">
                        <path fill="#f35325" d="M1 1h10v10H1z"/>
                        <path fill="#81bc06" d="M12 1h10v10H12z"/>
                        <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                        <path fill="#ffba08" d="M12 12h10v10H12z"/>
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-gray-900 text-base md:text-lg">Microsoft Outlook</p>
                      <p className="text-xs md:text-sm text-gray-600">Connect to check for conflicts</p>
                    </div>
                    <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  </div>
                </button>

                {/* Skip option */}
                <button onClick={handleSkipCalendar} className="w-full group">
                  <div className="flex items-center justify-center gap-3 p-4 md:p-5 border-2 border-dashed border-gray-300 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                    <span className="font-semibold text-gray-600 group-hover:text-gray-900 text-sm md:text-base">
                      Continue without calendar sync
                    </span>
                  </div>
                </button>
              </div>

              {/* Connected Calendar Indicator */}
              {guestCalendar?.signedIn && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-green-900">Calendar Connected</p>
                      <p className="text-sm text-green-700 truncate">{guestCalendar.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Booking Form Step */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-600" /> Select a Time
              </h2>
              <SmartSlotPicker 
                bookingToken={token} 
                guestCalendar={guestCalendar} 
                onSlotSelected={handleSlotSelected}
                duration={duration}
              />
            </div>

            {selectedSlot && (
              <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 animate-slideUp">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <User className="h-6 w-6 text-purple-600" /> Your Information
                </h2>
                <div className="space-y-4 md:space-y-5">
                  <input 
                    type="text" 
                    required 
                    value={formData.attendee_name} 
                    onChange={(e) => setFormData({ ...formData, attendee_name: e.target.value })} 
                    placeholder="Full Name" 
                    className="w-full p-3 md:p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors text-base" 
                  />
                  <input 
                    type="email" 
                    required 
                    value={formData.attendee_email} 
                    onChange={(e) => setFormData({ ...formData, attendee_email: e.target.value })} 
                    placeholder="Email Address" 
                    className="w-full p-3 md:p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors text-base" 
                  />
                  <textarea 
                    value={formData.notes} 
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                    rows="4" 
                    placeholder="Notes (Optional)" 
                    className="w-full p-3 md:p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors text-base" 
                  />
                </div>
              </div>
            )}

            {selectedSlot && (
              <div className="relative animate-slideUp">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl opacity-30 blur-xl"></div>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="relative w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white px-6 md:px-8 py-4 md:py-5 rounded-2xl text-base md:text-lg font-bold hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {submitting ? <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" /> : 'Confirm Booking'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}