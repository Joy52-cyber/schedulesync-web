import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar, User, Clock, MapPin,
  Sparkles, ArrowRight, ExternalLink, Loader2,
  Ban, ChevronRight, RefreshCw, CheckCircle,
  AlertTriangle, Plus, X
} from 'lucide-react';
import { bookings, oauth, eventTypes as eventTypesAPI, STATIC_BASE_URL } from '../utils/api';
import SmartSlotPicker from '../components/SmartSlotPicker';

const FadeIn = ({ children, className = "" }) => (
  <div className={`animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards ${className}`}>
    {children}
  </div>
);

export default function BookingPage() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const isPublicEventType = params.username && params.eventSlug;
  const token = params.token;
  const username = params.username;
  const eventSlug = params.eventSlug;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  
  const [isLinkUsed, setIsLinkUsed] = useState(false); 
  const [isDirectMemberLink, setIsDirectMemberLink] = useState(false);
  const [isReschedule, setIsReschedule] = useState(false);
  const [rescheduleToken, setRescheduleToken] = useState(null);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [magicLinkData, setMagicLinkData] = useState(null);
  const [participants, setParticipants] = useState([]);

  const [hostInfo, setHostInfo] = useState(null);
  const [teamInfo, setTeamInfo] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedEventType, setSelectedEventType] = useState(null);
  const [error, setError] = useState('');
  
  // Booking token for slot picker (may differ from URL token for magic links)
  const [bookingTokenForSlots, setBookingTokenForSlots] = useState(null);
  
  const [branding, setBranding] = useState({
    logo_url: null,
    primary_color: '#3B82F6',
    accent_color: '#6366F1',
    hide_powered_by: false,
  });
  const [logoError, setLogoError] = useState(false);

  const [step, setStep] = useState('loading');
  const [guestCalendar, setGuestCalendar] = useState(null);
  const [hasProcessedOAuth, setHasProcessedOAuth] = useState(false);
    
  const [formData, setFormData] = useState({
    attendee_name: '',
    attendee_email: '',
    notes: '',
    custom_answers: {},
  });
  
  const [additionalAttendees, setAdditionalAttendees] = useState([]);
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('');
  const [guestTimezone, setGuestTimezone] = useState('');
    
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setGuestTimezone(timezone);
    } catch (error) {
      setGuestTimezone('UTC');
    }
  }, []);

  useEffect(() => {
    if (isPublicEventType) return;
    const rescheduleParam = searchParams.get('reschedule');
    if (rescheduleParam) {
      setIsReschedule(true);
      setRescheduleToken(rescheduleParam);
    }
  }, [token, isPublicEventType]);

  useEffect(() => {
    loadBookingInfo();
  }, []);

  useEffect(() => {
    if (isPublicEventType) return;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state?.startsWith('guest-booking:') || !token || hasProcessedOAuth) return;

    setHasProcessedOAuth(true);

    (async () => {
      try {
        setError('');
        const provider = state.split(':')[2] || 'google';
        
        let response;
        if (provider === 'microsoft') {
          response = await oauth.guestMicrosoftAuth(code, token);
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

        // Only update form if not already prefilled (magic links)
        setFormData((prev) => ({
          ...prev,
          attendee_name: prev.attendee_name || data.name || '',
          attendee_email: prev.attendee_email || data.email || '',
        }));

        const typeParam = searchParams.get('type');
        const rescheduleParam = searchParams.get('reschedule');
        let newUrl = `/book/${token}`;
        const params = new URLSearchParams();
        if (typeParam) params.set('type', typeParam);
        if (rescheduleParam) params.set('reschedule', rescheduleParam);
        if (params.toString()) newUrl += `?${params.toString()}`;
        
        navigate(newUrl, { replace: true });
        
      } catch (err) {
        setError('Failed to connect calendar. Please try again.');
        setStep('calendar-choice');
        
        const params = new URLSearchParams(searchParams);
        params.delete('code');
        params.delete('state');
        navigate(`/book/${token}?${params.toString()}`, { replace: true });
      }
    })();
  }, [searchParams, token, navigate, hasProcessedOAuth, isPublicEventType]);

  useEffect(() => {
    if (isPublicEventType) return;
    if (!guestCalendar?.signedIn || eventTypes.length === 0) return;
    
    const savedState = localStorage.getItem('schedulesync_oauth_return');
    if (!savedState) return;
    
    try {
      const state = JSON.parse(savedState);
      
      if (Date.now() - state.timestamp > 5 * 60 * 1000) {
        localStorage.removeItem('schedulesync_oauth_return');
        return;
      }
      
      if (state.eventTypeId) {
        const eventType = eventTypes.find(et => et.id === state.eventTypeId);
        if (eventType) {
          setSelectedEventType(eventType);
          const params = new URLSearchParams(searchParams);
          params.set('type', state.eventTypeSlug);
          setSearchParams(params, { replace: true });
        }
      }
      
      if (state.step) {
        setStep(state.step);
      }
      
      localStorage.removeItem('schedulesync_oauth_return');
      
    } catch (err) {
      localStorage.removeItem('schedulesync_oauth_return');
    }
  }, [guestCalendar?.signedIn, eventTypes, searchParams, setSearchParams, isPublicEventType]);

  const loadBookingInfo = async () => {
    try {
      setLoading(true);
      
      // ========== PUBLIC EVENT TYPE BOOKING ==========
      if (isPublicEventType) {
        const response = await fetch(`/api/public/booking/${username}/${eventSlug}`);
        if (!response.ok) throw new Error('Event type not found');
        
        const data = await response.json();
        
        setHostInfo(data.host);
        
        if (data.branding) {
          setBranding({
            logo_url: data.branding.logo_url || null,
            primary_color: data.branding.primary_color || '#3B82F6',
            accent_color: data.branding.accent_color || '#6366F1',
            hide_powered_by: data.branding.hide_powered_by || false,
          });
        }
        
        setMemberInfo({
          name: data.host.name,
          user_name: data.host.username,
          id: data.host.username,
        });
        
        setTeamInfo({
          name: `${data.host.name}'s Events`,
          id: 'public',
        });
        
        setSelectedEventType(data.eventType);
        setEventTypes([data.eventType]);
        setStep('form');
        setLoading(false);
        return;
      }
      
      // ========== TOKEN-BASED BOOKING (Regular, Single-Use, Magic Link) ==========
      const response = await bookings.getByToken(token);
      const payload = response.data?.data || response.data || {};

      if (!payload.team || !payload.member) throw new Error('Missing info');

      // Check for external booking link redirect
      if (payload.member.external_booking_link && !isReschedule) {
        setRedirecting(true);
        setMemberInfo(payload.member);
        setTimeout(() => { window.location.href = payload.member.external_booking_link; }, 1500);
        return;
      }

      setTeamInfo(payload.team);
      setMemberInfo(payload.member);
      
      // Track if this is a magic link
      if (payload.isMagicLink) {
        setIsMagicLink(true);
        if (payload.magicLinkData) {
          setMagicLinkData(payload.magicLinkData);
        }
        if (payload.participants && payload.participants.length > 0) {
          setParticipants(payload.participants);
        }
      }
      
      // Load branding
      if (payload.member?.user_id) {
        try {
          const brandingRes = await fetch(`/api/user/${payload.member.user_id}/branding`);
          if (brandingRes.ok) {
            const brandingData = await brandingRes.json();
            setBranding({
              logo_url: brandingData.brand_logo_url || null,
              primary_color: brandingData.brand_primary_color || '#3B82F6',
              accent_color: brandingData.brand_accent_color || '#6366F1',
              hide_powered_by: brandingData.hide_powered_by || false,
            });
          }
        } catch (e) {}
      }
      
      const directMemberLink = payload.isDirectLink === true || 
                               payload.skipEventTypes === true ||
                               payload.linkType === 'member' ||
                               isReschedule;
      
      setIsDirectMemberLink(directMemberLink);
      
      // ========== MAGIC LINK HANDLING ==========
      // Pre-fill attendee info from magic link
      if (payload.prefill) {
        setFormData(prev => ({
          ...prev,
          attendee_name: payload.prefill.attendee_name || prev.attendee_name,
          attendee_email: payload.prefill.attendee_email || prev.attendee_email,
        }));
      }
      
      // Use member's booking token for slots (magic links provide this)
      if (payload.bookingToken) {
        setBookingTokenForSlots(payload.bookingToken);
      }
      
      // For magic links with event type, use it
      if (payload.selectedEventType) {
        setSelectedEventType(payload.selectedEventType);
        setEventTypes(payload.eventTypes || [payload.selectedEventType]);
      }
      
      if (directMemberLink) {
        // If magic link has event type, go straight to calendar choice
        if (payload.selectedEventType) {
          setStep('calendar-choice');
        } else {
          setEventTypes([]);
          setSelectedEventType(null);
          setStep('calendar-choice');
        }
        return;
      }
      
      // ========== REGULAR BOOKING FLOW ==========
      let allEventTypes = payload.eventTypes || [];
      if (allEventTypes.length === 0 && !directMemberLink) {
        const eventTypesRes = await eventTypesAPI.getAll();
        allEventTypes = eventTypesRes.data.eventTypes || [];
      }
      
      const activeEventTypes = allEventTypes.filter(et => et.is_active !== false);
      setEventTypes(activeEventTypes);
      
      const eventTypeSlug = searchParams.get('type');
      if (eventTypeSlug) {
        const selectedEvent = activeEventTypes.find(e => e.slug === eventTypeSlug);
        if (selectedEvent) {
          setSelectedEventType(selectedEvent);
          setStep('calendar-choice');
        } else {
          setStep(activeEventTypes.length > 0 ? 'event-select' : 'calendar-choice');
        }
      } else {
        if (activeEventTypes.length === 1) {
          setSelectedEventType(activeEventTypes[0]);
          setStep('calendar-choice');
        } else if (activeEventTypes.length > 1) {
          setStep('event-select');
        } else {
          setStep('calendar-choice');
        }
      }

    } catch (err) {
      if (err.response?.status === 410 || err.response?.data?.code === 'LINK_USED') {
        setIsLinkUsed(true);
        setLoading(false);
        return;
      }
      setError(err.message || err.response?.data?.error || 'Invalid booking link');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEventType = (eventType) => {
    setSelectedEventType(eventType);
    const params = new URLSearchParams(searchParams);
    params.set('type', eventType.slug);
    setSearchParams(params);
    setStep('calendar-choice');
  };

  const handleCalendarConnect = async (provider) => {
    try {
      if (selectedEventType) {
        const stateToSave = {
          token: token,
          eventTypeId: selectedEventType.id,
          eventTypeSlug: selectedEventType.slug,
          step: 'form',
          timestamp: Date.now()
        };
        localStorage.setItem('schedulesync_oauth_return', JSON.stringify(stateToSave));
      }
      
      let response;
      if (provider === 'google') {
        response = await oauth.getGoogleGuestUrl(token);
      } else if (provider === 'microsoft') {
        response = await oauth.getMicrosoftGuestUrl(token);
      }
      
      const authUrl = response.data.url;
      window.location.href = authUrl;
      
    } catch (error) {
      setError('Failed to connect calendar. Please try again.');
    }
  };

  const handleAddAttendee = () => {
    if (!newAttendeeEmail.trim()) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAttendeeEmail)) {
      alert('Please enter a valid email address');
      return;
    }
    
    if (additionalAttendees.includes(newAttendeeEmail) || newAttendeeEmail === formData.attendee_email) {
      alert('This email is already added');
      return;
    }
    
    setAdditionalAttendees([...additionalAttendees, newAttendeeEmail]);
    setNewAttendeeEmail('');
  };

  const handleRemoveAttendee = (emailToRemove) => {
    setAdditionalAttendees(additionalAttendees.filter(email => email !== emailToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;
    
    try {
      setSubmitting(true);
      
      if (isPublicEventType) {
        const response = await fetch('/api/public/booking/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username,
            event_slug: eventSlug,
            start_time: selectedSlot.start,
            end_time: selectedSlot.end,
            attendee_name: formData.attendee_name,
            attendee_email: formData.attendee_email,
            notes: formData.notes,
            additional_attendees: additionalAttendees,
            guest_timezone: guestTimezone,
            custom_answers: formData.custom_answers,
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create booking');
        }
        
        const data = await response.json();
        const booking = data.booking;
        
        const bookingData = {
          id: booking.id,
          start_time: selectedSlot.start,
          end_time: selectedSlot.end,
          attendee_name: formData.attendee_name,
          attendee_email: formData.attendee_email,
          additional_attendees: additionalAttendees,
          guest_timezone: guestTimezone,
          organizer_name: hostInfo.name,
          team_name: teamInfo.name,
          event_type: selectedEventType.title,
          duration: selectedEventType.duration,
          notes: formData.notes,
          meet_link: booking.meet_link,
          manage_token: booking.manage_token,
          is_reschedule: false,
          confirmation_message: selectedEventType.confirmation_message,
        };
        
        navigate(`/booking-confirmation?data=${encodeURIComponent(JSON.stringify(bookingData))}`);
        return;
      }
      
      // Token-based booking (includes magic links)
      const response = await bookings.create({
        token,
        slot: selectedSlot,
        ...formData,
        additional_attendees: additionalAttendees,
        guest_timezone: guestTimezone,
        custom_answers: formData.custom_answers,
        event_type_id: selectedEventType?.id,
        event_type_slug: selectedEventType?.slug,
        reschedule_token: rescheduleToken,
        is_magic_link: isMagicLink,
        magic_link_token: isMagicLink ? token : null,
        magic_link_id: magicLinkData?.id || null,
      });
      
      const booking = response.data.booking;
      const bookingData = {
        id: booking?.id,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        attendee_name: formData.attendee_name,
        attendee_email: formData.attendee_email,
        additional_attendees: additionalAttendees,
        guest_timezone: guestTimezone,
        organizer_name: memberInfo?.name || memberInfo?.user_name,
        team_name: teamInfo?.name,
        event_type: selectedEventType?.title || selectedEventType?.name,
        duration: selectedEventType?.duration || 30,
        notes: formData.notes,
        meet_link: booking?.meet_link,
        booking_token: booking?.booking_token || token,
        manage_token: booking?.manage_token,
        is_reschedule: isReschedule,
        confirmation_message: selectedEventType?.confirmation_message,
      };
      navigate(`/booking-confirmation?data=${encodeURIComponent(JSON.stringify(bookingData))}`);
      
    } catch (err) {
      if (err.response?.status === 410) setIsLinkUsed(true);
      else alert(err.message || err.response?.data?.error || 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const duration = selectedEventType?.duration || memberInfo?.default_duration || 30;
  const displayName = hostInfo?.name || memberInfo?.name || memberInfo?.user_name;
  const avatarLetter = displayName?.[0]?.toUpperCase() || 'U';

  // Get full URL for logo (handles relative paths)
  const getLogoUrl = (logoUrl) => {
    if (!logoUrl) return null;
    if (logoUrl.startsWith('http')) return logoUrl;
    return `${STATIC_BASE_URL}${logoUrl}`;
  };
  
  // Use member's booking token for slots if available (magic links), otherwise URL token
  const bookingTokenForPicker = isPublicEventType 
    ? `public:${username}:${eventSlug}` 
    : (bookingTokenForSlots || token);

  if (loading || redirecting) return <LoadingScreen redirecting={redirecting} memberName={displayName} branding={branding} />;
  if (isLinkUsed) return <ExpiredLinkScreen />;
  if (error && !teamInfo) return <ErrorScreen error={error} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4 md:p-6 font-sans relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl w-full max-w-6xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-white/20 relative z-10">
        
        {/* Left Sidebar */}
        <div className="md:w-1/3 bg-gradient-to-br from-slate-50 to-purple-50/30 border-r border-purple-100/50 p-8 flex flex-col relative backdrop-blur-sm">
          {/* Decorative circles */}
          <div className="absolute top-5 right-5 w-24 h-24 border-2 border-purple-200/30 rounded-full"></div>
          <div className="absolute bottom-5 left-5 w-16 h-16 border-2 border-pink-200/30 rounded-full"></div>

          {isReschedule && (
            <div className="mb-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-4 flex gap-3 items-start shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md">
                <RefreshCw className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Rescheduling</p>
                <p className="text-sm text-amber-700 leading-tight">Your original booking will be cancelled once you confirm a new time.</p>
              </div>
            </div>
          )}
          
          {isMagicLink && (
            <div className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200/50 rounded-2xl p-4 flex gap-3 items-start shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-purple-800 uppercase tracking-wide mb-1">
                  {magicLinkData?.name || 'Quick Link'}
                </p>
                <p className="text-sm text-purple-700 leading-tight">
                  {magicLinkData?.scheduling_mode === 'collective'
                    ? 'Group meeting - all participants required'
                    : 'Single-use booking link'}
                </p>
              </div>
            </div>
          )}
          
          {/* Show all participants for multi-member magic links */}
          {participants.length > 1 && (
            <div className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/50 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <User className="h-3 w-3 text-white" />
                </div>
                Meeting Participants
              </p>
              <div className="space-y-2">
                {participants.map((participant, index) => (
                  <div key={participant.id} className="flex items-center gap-3 bg-white/60 backdrop-blur-sm px-3 py-2 rounded-xl">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md"
                      style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.accent_color})` }}
                    >
                      {participant.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-indigo-900 truncate">
                        {participant.name}
                        {participant.is_host && (
                          <span className="ml-2 text-xs bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-2 py-1 rounded-lg font-bold">Host</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {magicLinkData?.scheduling_mode === 'collective' && (
                <p className="text-xs text-indigo-600 mt-3 font-medium">
                  All participants' calendars will be checked
                </p>
              )}
            </div>
          )}

          <div className="flex-1 mt-8">
            <div className="mb-6">
              {branding.logo_url && !logoError ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg mb-4 bg-white border border-slate-200">
                  <img
                    src={getLogoUrl(branding.logo_url)}
                    alt="Logo"
                    className="w-full h-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4"
                  style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.accent_color})` }}
                >
                  {avatarLetter}
                </div>
              )}
              <p className="text-slate-500 font-medium text-sm">Book a meeting with</p>
              <h2 className="text-2xl font-bold text-slate-900">{displayName}</h2>
              <p className="text-slate-400 text-sm mt-1">{teamInfo?.name}</p>
            </div>

            {/* Host Bio */}
            {hostInfo?.bio && (
              <div className="mb-6">
                <p className="text-sm text-slate-600 leading-relaxed">{hostInfo.bio}</p>
              </div>
            )}

            {selectedEventType ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="h-px bg-slate-200 w-full" />
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{selectedEventType.title}</h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">{duration} min</span>
                    </div>
                    {selectedEventType.location && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="h-4 w-4" />
                        <span>{selectedEventType.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                {selectedEventType.description && (
                  <p className="text-sm text-slate-500 leading-relaxed">{selectedEventType.description}</p>
                )}
                {selectedEventType.pre_meeting_instructions && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Before the Meeting</p>
                    <p className="text-sm text-amber-700 leading-relaxed">{selectedEventType.pre_meeting_instructions}</p>
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="mt-8 p-4 rounded-xl border"
                style={{ 
                  backgroundColor: branding.primary_color + '10',
                  borderColor: branding.primary_color + '30'
                }}
              >
                <p className="text-sm" style={{ color: branding.primary_color }}>
                  Please select an event type from the list to continue.
                </p>
              </div>
            )}
          </div>
          
          {!branding.hide_powered_by && (
            <div className="mt-auto pt-6 text-xs text-slate-300 font-medium">
              Powered by TruCal
            </div>
          )}
        </div>

        {/* Right Content Area */}
        <div className="md:w-2/3 bg-white p-6 md:p-10 overflow-y-auto relative">
          
          {step === 'event-select' && !isPublicEventType && (
            <FadeIn className="max-w-xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Select an Event Type</h2>
              <p className="text-slate-500 mb-8">Choose the type of meeting you'd like to schedule.</p>
              
              <div className="grid gap-4">
                {eventTypes.map((et) => (
                  <button
                    key={et.id}
                    onClick={() => handleSelectEventType(et)}
                    className="group relative flex items-center gap-4 p-6 rounded-2xl border-2 border-slate-200 hover:shadow-xl hover:shadow-purple-100/50 transition-all text-left bg-white hover:-translate-y-0.5"
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = branding.primary_color; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  >
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md"
                      style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.accent_color})` }}
                    >
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-lg">{et.title}</h3>
                      <p className="text-slate-500 text-sm mt-1">{et.duration} minutes</p>
                    </div>
                    <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-all" style={{ color: branding.primary_color }} />
                  </button>
                ))}
              </div>
            </FadeIn>
          )}

          {step === 'calendar-choice' && !isPublicEventType && (
            <FadeIn className="max-w-lg mx-auto py-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: branding.primary_color + '15' }}>
                  <Sparkles className="h-8 w-8" style={{ color: branding.primary_color }} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Check for conflicts?</h2>
                <p className="text-slate-500 mt-2">Sign in to overlay your calendar availability on top of {displayName?.split(' ')[0]}'s schedule.</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => handleCalendarConnect('google')}
                  className="w-full flex items-center p-5 rounded-xl border-2 border-slate-200 hover:border-red-300 hover:bg-gradient-to-br hover:from-red-50 hover:to-orange-50 transition-all group hover:shadow-lg hover:-translate-y-0.5"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-6 w-6 mr-4" />
                  <div className="text-left flex-1">
                    <span className="block font-semibold text-slate-900">Connect Google Calendar</span>
                    <span className="block text-xs text-slate-500">We'll only read your busy times</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-red-500 transition-colors" />
                </button>

                <button
                  onClick={() => handleCalendarConnect('microsoft')}
                  className="w-full flex items-center p-5 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all group hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="h-6 w-6 mr-4 grid grid-cols-2 gap-0.5">
                    <div className="bg-[#f35325]"></div>
                    <div className="bg-[#81bc06]"></div>
                    <div className="bg-[#05a6f0]"></div>
                    <div className="bg-[#ffba08]"></div>
                  </div>
                  <div className="text-left flex-1">
                    <span className="block font-semibold text-slate-900">Connect Outlook / Office 365</span>
                    <span className="block text-xs text-slate-500">We'll only read your busy times</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-slate-400 uppercase tracking-wide">Or</span></div>
                </div>

                <button
                  onClick={() => setStep('form')}
                  className="w-full py-4 text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all hover:shadow-md"
                >
                  Skip and select time manually
                </button>
              </div>
            </FadeIn>
          )}

          {step === 'form' && (
            <FadeIn className="h-full flex flex-col">
              {guestCalendar?.signedIn && (
                <div className="mb-4 inline-flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 text-green-700 rounded-xl text-sm font-semibold self-start shadow-sm">
                  <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse shadow-md" />
                  Using your calendar: {guestCalendar.email}
                </div>
              )}

              {guestTimezone && (
                <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold self-start shadow-sm border" style={{ background: `linear-gradient(135deg, ${branding.primary_color}15, ${branding.accent_color}15)`, color: branding.primary_color, borderColor: branding.primary_color + '30' }}>
                  <Clock className="h-4 w-4" />
                  Your timezone: {guestTimezone}
                </div>
              )}

              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                {selectedSlot ? 'Finalize Booking' : 'Select a Time'}
              </h2>

              {!selectedSlot && (
                <div className="flex-1">
                  <SmartSlotPicker 
                    bookingToken={bookingTokenForPicker}
                    guestCalendar={guestCalendar} 
                    onSlotSelected={setSelectedSlot}
                    duration={duration}
                    timezone={guestTimezone}
                  />
                </div>
              )}

              {selectedSlot && (
                <div className="max-w-lg mx-auto w-full animate-in slide-in-from-right-8 duration-300">
                  <div className="rounded-2xl p-5 mb-6 flex justify-between items-center border-2 shadow-lg shadow-purple-100/50" style={{ background: `linear-gradient(135deg, ${branding.primary_color}15, ${branding.accent_color}15)`, borderColor: branding.primary_color + '30' }}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md" style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.accent_color})` }}>
                        <CheckCircle className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: branding.primary_color }}>Selected Time</p>
                        <p className="font-semibold" style={{ color: branding.primary_color }}>
                          {new Date(selectedSlot.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                        <p className="text-sm" style={{ color: branding.primary_color + 'cc' }}>
                          {new Date(selectedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })} - {new Date(selectedSlot.end).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedSlot(null)} className="text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/50 transition-all" style={{ color: branding.primary_color }}>Change</button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
                      <input
                        type="text"
                        required
                        value={formData.attendee_name}
                        onChange={(e) => setFormData({ ...formData, attendee_name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-2 focus:border-transparent outline-none transition-all hover:border-slate-300 focus:shadow-lg focus:shadow-purple-100/50"
                        placeholder="John Doe"
                        style={{ '--tw-ring-color': branding.primary_color }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={formData.attendee_email}
                        onChange={(e) => setFormData({ ...formData, attendee_email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-2 focus:border-transparent outline-none transition-all hover:border-slate-300 focus:shadow-lg focus:shadow-purple-100/50"
                        placeholder="john@example.com"
                        style={{ '--tw-ring-color': branding.primary_color }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows="3"
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-2 focus:border-transparent outline-none transition-all resize-none hover:border-slate-300 focus:shadow-lg focus:shadow-purple-100/50"
                        placeholder="Anything specific you want to discuss?"
                        style={{ '--tw-ring-color': branding.primary_color }}
                      />
                    </div>

                    {/* Custom Questions */}
                    {selectedEventType?.custom_questions?.length > 0 && (
                      <div className="pt-4 border-t border-slate-200 space-y-4">
                        <p className="text-sm font-medium text-slate-700">Additional Questions</p>
                        {selectedEventType.custom_questions.map((q) => (
                          <div key={q.id}>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              {q.label}
                              {q.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {q.type === 'textarea' ? (
                              <textarea
                                value={formData.custom_answers[q.id] || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  custom_answers: { ...formData.custom_answers, [q.id]: e.target.value }
                                })}
                                required={q.required}
                                rows="3"
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-2 focus:border-transparent outline-none transition-all resize-none hover:border-slate-300 focus:shadow-lg focus:shadow-purple-100/50"
                                placeholder={q.placeholder || ''}
                                style={{ '--tw-ring-color': branding.primary_color }}
                              />
                            ) : q.type === 'select' ? (
                              <select
                                value={formData.custom_answers[q.id] || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  custom_answers: { ...formData.custom_answers, [q.id]: e.target.value }
                                })}
                                required={q.required}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-2 focus:border-transparent outline-none transition-all bg-white hover:border-slate-300 focus:shadow-lg focus:shadow-purple-100/50"
                                style={{ '--tw-ring-color': branding.primary_color }}
                              >
                                <option value="">Select an option</option>
                                {q.options?.map((opt, i) => (
                                  <option key={i} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : 'text'}
                                value={formData.custom_answers[q.id] || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  custom_answers: { ...formData.custom_answers, [q.id]: e.target.value }
                                })}
                                required={q.required}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-2 focus:border-transparent outline-none transition-all hover:border-slate-300 focus:shadow-lg focus:shadow-purple-100/50"
                                placeholder={q.placeholder || ''}
                                style={{ '--tw-ring-color': branding.primary_color }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-200">
                      <label className="block text-sm font-medium text-slate-700 mb-3">Invite Others to This Meeting</label>
                      
                      {additionalAttendees.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {additionalAttendees.map((email, index) => (
                            <div key={index} className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-purple-50/30 px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: branding.primary_color + '20' }}>
                                  <User className="h-4 w-4" style={{ color: branding.primary_color }} />
                                </div>
                                <span className="text-sm text-slate-700 font-medium">{email}</span>
                              </div>
                              <button type="button" onClick={() => handleRemoveAttendee(email)} className="text-slate-400 hover:text-red-600 transition-colors p-1 hover:bg-red-50 rounded-lg">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newAttendeeEmail}
                          onChange={(e) => setNewAttendeeEmail(e.target.value)}
                          onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAttendee(); } }}
                          className="flex-1 px-4 py-2 rounded-lg border-2 border-slate-200 focus:ring-2 focus:border-transparent outline-none transition-all text-sm hover:border-slate-300 focus:shadow-md focus:shadow-purple-100/50"
                          placeholder="colleague@example.com"
                          style={{ '--tw-ring-color': branding.primary_color }}
                        />
                        <button
                          type="button"
                          onClick={handleAddAttendee}
                          className="px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1 text-white shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                          style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.accent_color})` }}
                        >
                          <Plus className="h-4 w-4" />Add
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Additional attendees will receive calendar invites and meeting details</p>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full mt-6 text-white py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-purple-200/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
                      style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.accent_color})` }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {isReschedule ? 'Confirming...' : 'Booking...'}
                        </>
                      ) : (
                        <>{isReschedule ? 'Confirm Reschedule' : 'Confirm Booking'}</>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </FadeIn>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ redirecting, memberName, branding }) {
  const primaryColor = branding?.primary_color || '#3B82F6';
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center animate-pulse">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: primaryColor + '20' }}>
          {redirecting ? <ExternalLink className="h-8 w-8" style={{ color: primaryColor }} /> : <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />}
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{redirecting ? `Redirecting to ${memberName}...` : 'Loading availability...'}</h2>
      </div>
    </div>
  );
}

function ExpiredLinkScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><Ban className="h-10 w-10 text-red-500" /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Already Used</h2>
        <p className="text-gray-600 mb-6">This single-use booking link has already been used or has expired.</p>
        <p className="text-sm text-gray-500">Please request a new link from the organizer if you need to book another time.</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="h-10 w-10 text-red-500" /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h2>
        <p className="text-gray-600 mb-6">{error || 'This booking link is invalid or has expired.'}</p>
        <p className="text-sm text-gray-500">You can safely close this page.</p>
      </div>
    </div>
  );
}