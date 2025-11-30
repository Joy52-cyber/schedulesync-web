import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar, User, Clock, MapPin,
  Sparkles, ArrowRight, ExternalLink, Loader2,
  Ban, ChevronRight, RefreshCw, CheckCircle,
  AlertTriangle, Plus, X
} from 'lucide-react';
import { bookings, oauth, eventTypes as eventTypesAPI } from '../utils/api';
import SmartSlotPicker from '../components/SmartSlotPicker';

const FadeIn = ({ children, className = "" }) => (
  <div className={`animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards ${className}`}>
    {children}
  </div>
);

export default function BookingPage() {
  const { token } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  
  const [isLinkUsed, setIsLinkUsed] = useState(false); 
  const [isDirectMemberLink, setIsDirectMemberLink] = useState(false);
  const [isReschedule, setIsReschedule] = useState(false);
  const [rescheduleToken, setRescheduleToken] = useState(null);

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
  
  const [additionalAttendees, setAdditionalAttendees] = useState([]);
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('');
  const [guestTimezone, setGuestTimezone] = useState('');
    
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setGuestTimezone(timezone);
      console.log('🌍 Guest timezone detected:', timezone);
    } catch (error) {
      console.error('Failed to detect timezone:', error);
      setGuestTimezone('UTC');
    }
  }, []);

  useEffect(() => {
    const rescheduleParam = searchParams.get('reschedule');
    if (rescheduleParam) {
      setIsReschedule(true);
      setRescheduleToken(rescheduleParam);
    }
    loadBookingInfo();
  }, [token]);

  useEffect(() => {
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
        const rescheduleParam = searchParams.get('reschedule');
        let newUrl = `/book/${token}`;
        const params = new URLSearchParams();
        if (typeParam) params.set('type', typeParam);
        if (rescheduleParam) params.set('reschedule', rescheduleParam);
        if (params.toString()) newUrl += `?${params.toString()}`;
        
        navigate(newUrl, { replace: true });
        setStep('form');
      } catch (err) {
        console.error('Guest OAuth failed:', err);
        setHasProcessedOAuth(false);
      }
    })();
  }, [searchParams, token, navigate, hasProcessedOAuth]);

  const loadBookingInfo = async () => {
    try {
      setLoading(true);
      const response = await bookings.getByToken(token);
      const payload = response.data?.data || response.data || {};

      if (!payload.team || !payload.member) throw new Error('Missing info');

      if (payload.member.external_booking_link && !isReschedule) {
        setRedirecting(true);
        setMemberInfo(payload.member);
        setTimeout(() => { window.location.href = payload.member.external_booking_link; }, 1500);
        return;
      }

      setTeamInfo(payload.team);
      setMemberInfo(payload.member);
      
      const directMemberLink = payload.isDirectLink === true || 
                               payload.skipEventTypes === true ||
                               payload.linkType === 'member' ||
                               isReschedule;
      
      setIsDirectMemberLink(directMemberLink);
      
      if (directMemberLink) {
        setEventTypes([]);
        setSelectedEventType(null);
        setStep('calendar-choice');
        return;
      }
      
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
      setError(err.response?.data?.error || 'Invalid booking link');
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

  const handleCalendarConnect = (provider) => {
    const currentUrl = window.location.origin + window.location.pathname;
    const redirectUri = currentUrl;
    const state = `guest-booking:${token}:${provider}`;
    
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
        state: state,
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
        state: state,
      });
      window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
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
      const response = await bookings.create({
        token, 
        slot: selectedSlot, 
        ...formData,
        additional_attendees: additionalAttendees,
        guest_timezone: guestTimezone,
        event_type_id: selectedEventType?.id,
        event_type_slug: selectedEventType?.slug,
        reschedule_token: rescheduleToken, 
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
      };
      navigate(`/booking-confirmation?data=${encodeURIComponent(JSON.stringify(bookingData))}`);
    } catch (err) {
      if (err.response?.status === 410) setIsLinkUsed(true);
      else alert(err.response?.data?.error || 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const duration = selectedEventType?.duration || memberInfo?.default_duration || 30;
  const avatarLetter = memberInfo?.name?.[0]?.toUpperCase() || memberInfo?.user_name?.[0]?.toUpperCase() || 'U';

  if (loading || redirecting) return <LoadingScreen redirecting={redirecting} memberName={memberInfo?.name} />;
  if (isLinkUsed) return <ExpiredLinkScreen />;
  if (error && !teamInfo) return <ErrorScreen error={error} />;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-6 font-sans">
      <div className="bg-white w-full max-w-6xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-slate-100">
        
        <div className="md:w-1/3 bg-slate-50 border-r border-slate-200 p-8 flex flex-col relative">

          {isReschedule && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3 items-start">
              <RefreshCw className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Rescheduling</p>
                <p className="text-sm text-amber-700 leading-tight">Your original booking will be cancelled once you confirm a new time.</p>
              </div>
            </div>
          )}

          <div className="flex-1 mt-8">
            <div className="mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-200 mb-4">
                {avatarLetter}
              </div>
              <p className="text-slate-500 font-medium text-sm">Book a meeting with</p>
              <h2 className="text-2xl font-bold text-slate-900">{memberInfo?.name || memberInfo?.user_name}</h2>
              <p className="text-slate-400 text-sm mt-1">{teamInfo?.name}</p>
            </div>

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
              </div>
            ) : (
              <div className="mt-8 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-700">Please select a meeting type from the list to continue.</p>
              </div>
            )}
          </div>
          
          <div className="mt-auto pt-6 text-xs text-slate-300 font-medium">
            Powered by ScheduleSync
          </div>
        </div>

        <div className="md:w-2/3 bg-white p-6 md:p-10 overflow-y-auto relative">
          
          {step === 'event-select' && (
            <FadeIn className="max-w-xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Select a Meeting Type</h2>
              <p className="text-slate-500 mb-8">Choose the type of meeting you'd like to schedule.</p>
              
              <div className="grid gap-4">
                {eventTypes.map((et) => (
                  <button
                    key={et.id}
                    onClick={() => handleSelectEventType(et)}
                    className="group relative flex items-center gap-4 p-5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-50 transition-all text-left bg-white"
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                      <Clock className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors">{et.title}</h3>
                      <p className="text-slate-500 text-sm mt-1">{et.duration} minutes</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </FadeIn>
          )}

          {step === 'calendar-choice' && (
            <FadeIn className="max-w-lg mx-auto py-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Check for conflicts?</h2>
                <p className="text-slate-500 mt-2">Sign in to overlay your calendar availability on top of {memberInfo?.name?.split(' ')[0]}'s schedule.</p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => handleCalendarConnect('google')}
                  className="w-full flex items-center p-4 rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50/30 transition-all group"
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
                  className="w-full flex items-center p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
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
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-2 text-xs text-slate-400 uppercase tracking-wide">Or</span>
                  </div>
                </div>

                <button 
                  onClick={() => setStep('form')} 
                  className="w-full py-4 text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Skip and select time manually
                </button>
              </div>
            </FadeIn>
          )}

          {step === 'form' && (
            <FadeIn className="h-full flex flex-col">
              {guestCalendar?.signedIn && (
                <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium self-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Using your calendar: {guestCalendar.email}
                </div>
              )}

              {guestTimezone && (
                <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium self-start">
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
                    bookingToken={token} 
                    guestCalendar={guestCalendar} 
                    onSlotSelected={setSelectedSlot}
                    duration={duration}
                    timezone={guestTimezone} 
                  />
                </div>
              )}

              {selectedSlot && (
                <div className="max-w-lg mx-auto w-full animate-in slide-in-from-right-8 duration-300">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Selected Time</p>
                      <p className="text-blue-900 font-semibold mt-1">
                        {new Date(selectedSlot.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                      <p className="text-blue-800 text-sm">
                        {new Date(selectedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })} - {new Date(selectedSlot.end).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => setSelectedSlot(null)} className="text-sm text-blue-600 hover:text-blue-800 font-medium underline">
                      Change
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
                      <input 
                        type="text"
                        required
                        value={formData.attendee_name} 
                        onChange={(e) => setFormData({ ...formData, attendee_name: e.target.value })} 
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                      <input 
                        type="email"
                        required
                        value={formData.attendee_email} 
                        onChange={(e) => setFormData({ ...formData, attendee_email: e.target.value })} 
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="john@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                      <textarea 
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                        rows="3"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                        placeholder="Anything specific you want to discuss?"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Invite Others to This Meeting
                      </label>
                      
                      {additionalAttendees.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {additionalAttendees.map((email, index) => (
                            <div key={index} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg group">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                <span className="text-sm text-slate-700">{email}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttendee(email)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Remove attendee"
                              >
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
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddAttendee();
                            }
                          }}
                          className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                          placeholder="colleague@example.com"
                        />
                        <button
                          type="button"
                          onClick={handleAddAttendee}
                          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm flex items-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Additional attendees will receive calendar invites and meeting details
                      </p>
                    </div>

                    <button 
                      type="submit"
                      disabled={submitting} 
                      className="w-full mt-4 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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

function LoadingScreen({ redirecting, memberName }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center animate-pulse">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          {redirecting ? <ExternalLink className="h-8 w-8 text-blue-600" /> : <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />}
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
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Ban className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Already Used</h2>
        <p className="text-gray-600 mb-6">
          This single-use booking link has already been used or has expired.
        </p>
        <p className="text-sm text-gray-500">
          Please request a new link from the organizer if you need to book another time.
        </p>
      </div>
    </div>
  );
}

function ErrorScreen({ error }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h2>
        <p className="text-gray-600 mb-6">
          {error || 'This booking link is invalid or has expired. Please check your email for the correct link or contact the organizer.'}
        </p>
        <p className="text-sm text-gray-500">
          You can safely close this page.
        </p>
      </div>
    </div>
  );
}