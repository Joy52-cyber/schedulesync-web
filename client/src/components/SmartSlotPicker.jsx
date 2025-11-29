import { useState, useEffect } from 'react';
import { Calendar, Clock, Check, Loader2, Eye, EyeOff, AlertCircle, Sparkles, Star, Zap, ArrowRight } from 'lucide-react';
import { bookings } from '../utils/api';
import CalendarModal from './CalendarModal';

export default function SmartSlotPicker({ 
  bookingToken, 
  guestCalendar = null,
  duration = 30,
  onSlotSelected
}) {
  const [slots, setSlots] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const hasGuestCalendar = guestCalendar?.signedIn === true;

  useEffect(() => {
    loadSlots();
  }, [bookingToken, guestCalendar, duration]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('🌍 User timezone detected:', userTimezone);
      
      const response = await bookings.getSlots(bookingToken, {
        guestAccessToken: guestCalendar?.accessToken,
        guestRefreshToken: guestCalendar?.refreshToken,
        duration: duration,
        timezone: userTimezone
      });

      const slotsData = response.data;

      console.log('📊 Loaded slots:', {
        totalDates: Object.keys(slotsData.slots).length,
        availableSlots: slotsData.summary.availableSlots,
        hasGuestCalendar: hasGuestCalendar
      });
      
      setSlots(slotsData.slots);
      setSummary(slotsData.summary);

      // Auto-select first available date if none selected
      if (!selectedDate) {
        const firstAvailableDate = Object.keys(slotsData.slots).find(date => 
          slotsData.slots[date].some(slot => slot.status === 'available')
        );
        if (firstAvailableDate) {
          setSelectedDate(firstAvailableDate);
        }
      } else if (!slotsData.slots[selectedDate]) {
         const firstAvailableDate = Object.keys(slotsData.slots).find(date => 
            slotsData.slots[date].some(slot => slot.status === 'available')
          );
          if (firstAvailableDate) setSelectedDate(firstAvailableDate);
      }

    } catch (error) {
      console.error('❌ Error loading slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMatchClasses = (matchColor, isSelected) => {
    if (isSelected) {
      return {
        button: 'border-blue-600 bg-blue-600',
        text: 'text-white',
        badge: 'bg-white/20 text-white',
        icon: 'text-white'
      };
    }

    if (!hasGuestCalendar) {
      return {
        button: 'border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 hover:shadow-md',
        text: 'text-gray-900',
        badge: 'bg-gray-500 text-white',
        icon: 'text-gray-600'
      };
    }

    const colorMap = {
      green: {
        button: 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 hover:shadow-md',
        text: 'text-green-900',
        badge: 'bg-green-500 text-white',
        icon: 'text-green-600'
      },
      blue: {
        button: 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 hover:shadow-md',
        text: 'text-blue-900',
        badge: 'bg-blue-500 text-white',
        icon: 'text-blue-600'
      },
      purple: {
        button: 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 hover:shadow-md',
        text: 'text-purple-900',
        badge: 'bg-purple-500 text-white',
        icon: 'text-purple-600'
      },
      yellow: {
        button: 'border-yellow-500 bg-gradient-to-br from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100 hover:shadow-md',
        text: 'text-yellow-900',
        badge: 'bg-yellow-500 text-white',
        icon: 'text-yellow-600'
      },
      gray: {
        button: 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:shadow-md',
        text: 'text-gray-900',
        badge: 'bg-gray-500 text-white',
        icon: 'text-gray-600'
      }
    };

    return colorMap[matchColor] || colorMap.gray;
  };

  const getMatchIcon = (matchScore) => {
    if (matchScore >= 90) return <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />;
    if (matchScore >= 80) return <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />;
    if (matchScore >= 70) return <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />;
    return <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />;
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 sm:py-12">
        <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-blue-600 mb-3" />
        <span className="text-sm sm:text-base text-gray-600">
          {hasGuestCalendar ? 'Finding best times for both of you...' : 'Loading availability...'}
        </span>
      </div>
    );
  }

  const dates = Object.keys(slots);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-3 text-sm">
        <div className={`flex items-center gap-2 ${selectedDate ? 'text-green-600' : 'text-blue-600 font-semibold'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            selectedDate ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            {selectedDate ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">1</span>}
          </div>
          <span>Pick a date</span>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300" />
        <div className={`flex items-center gap-2 ${selectedDate ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            selectedDate ? 'bg-blue-100' : 'bg-slate-100'
          }`}>
            <span className="text-xs font-bold">2</span>
          </div>
          <span>Choose a time</span>
        </div>
      </div>

      {/* Summary */}
      {summary && summary.availableSlots > 0 && (
        <div className={`border-2 rounded-xl p-4 ${
          hasGuestCalendar 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
            : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              hasGuestCalendar ? 'bg-green-500' : 'bg-blue-500'
            }`}>
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className={`text-base font-bold ${
                hasGuestCalendar ? 'text-green-900' : 'text-blue-900'
              }`}>
                {summary.availableSlots} available slot{summary.availableSlots !== 1 ? 's' : ''} found
              </p>
              {hasGuestCalendar ? (
                <p className="text-sm text-green-700 mt-0.5">
                  ✨ Showing mutual availability with AI-ranked suggestions
                </p>
              ) : (
                <p className="text-sm text-blue-700 mt-0.5">
                  Showing all available times. Connect your calendar next time for personalized suggestions!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {summary && summary.availableSlots === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-900">
                No available slots in the next {summary.settings?.horizonDays || 30} days
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Try connecting your calendar or contact the organizer directly
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Button - Primary Action */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600">1</span>
            </div>
            Select a date
          </h3>
          {selectedDate && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <Check className="h-4 w-4" />
              {new Date(slots[selectedDate][0]?.start).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
          )}
        </div>

        {/* Big Calendar Button */}
        <button
          onClick={() => setShowCalendarModal(true)}
          className="w-full p-6 border-2 border-dashed border-blue-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 group-hover:text-blue-700">
                {selectedDate ? 'Change Date' : 'Open Calendar'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Browse available dates in calendar view
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Time Slots Section - Only show when date is selected */}
      {selectedDate && slots[selectedDate] && (
        <div className="pt-6 border-t-2 border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">2</span>
              </div>
              Choose your time
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{duration} min slots</span>
              <button
                onClick={() => setShowUnavailable(!showUnavailable)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              >
                {showUnavailable ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Hide unavailable</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Show all</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Show selected date info */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">
                {new Date(slots[selectedDate][0]?.start).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
              <span className="text-blue-600 ml-2">
                • {slots[selectedDate].filter(s => s.status === 'available').length} times available
              </span>
            </p>
          </div>

          {/* Time slots grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
            {slots[selectedDate]
              .filter(slot => {
                if (slot.status === 'available') return true;
                return showUnavailable;
              })
              .map((slot, index) => {
                const isSelected = selectedSlot?.start === slot.start;
                const isAvailable = slot.status === 'available';

                if (isAvailable) {
                  const matchClasses = getMatchClasses(slot.matchColor, isSelected);
                  const MatchIcon = () => getMatchIcon(slot.matchScore);

                  return (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedSlot(slot);
                        onSlotSelected(slot);
                        console.log('✅ Slot selected:', slot.time, 'Match score:', slot.matchScore);
                      }}
                      className={`relative p-4 rounded-lg border-2 text-left transition-all min-h-[100px] active:scale-95 ${matchClasses.button}`}
                    >
                      {hasGuestCalendar && slot.matchScore && slot.matchScore >= 70 && !isSelected && (
                        <div className="absolute top-2 right-2">
                          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${matchClasses.badge} shadow-sm`}>
                            <MatchIcon />
                            <span className="text-[10px] font-bold">{slot.matchScore}%</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-1 mb-2">
                        <span className={`text-lg font-bold ${matchClasses.text}`}>
                          {slot.time}
                        </span>
                        {isSelected && (
                          <Check className="h-5 w-5 text-white flex-shrink-0" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className={`text-xs font-bold ${isSelected ? 'text-white' : matchClasses.text}`}>
                          {isSelected 
                            ? 'Selected' 
                            : hasGuestCalendar && slot.matchLabel 
                              ? slot.matchLabel 
                              : 'Available'}
                        </p>
                        
                        {!isSelected && hasGuestCalendar && slot.matchScore && (
                          <div className={`flex items-center gap-1 ${matchClasses.icon}`}>
                            {slot.matchScore >= 90 && (
                              <span className="text-[10px] font-medium">Excellent time!</span>
                            )}
                            {slot.matchScore >= 80 && slot.matchScore < 90 && (
                              <span className="text-[10px] font-medium">Great choice</span>
                            )}
                            {slot.matchScore >= 70 && slot.matchScore < 80 && (
                              <span className="text-[10px] font-medium">Good option</span>
                            )}
                            {slot.matchScore < 70 && slot.matchScore >= 60 && (
                              <span className="text-[10px] font-medium">Fair match</span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                } else {
                  return (
                    <button
                      key={index}
                      disabled
                      className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-left opacity-60 cursor-not-allowed min-h-[100px]"
                      title={slot.details}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium text-gray-600">
                          {slot.time}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {slot.reason === 'organizer_busy' && '🔴 Busy'}
                        {slot.reason === 'guest_busy' && '🟡 You\'re busy'}
                        {slot.reason === 'outside_hours' && '⚪ Off hours'}
                        {slot.reason === 'lead_time' && '⏰ Too soon'}
                        {slot.reason === 'buffer' && '⏸️ Buffer'}
                        {slot.reason === 'daily_cap' && '📊 Daily limit'}
                        {slot.reason === 'blocked' && '🚫 Blocked'}
                      </p>
                    </button>
                  );
                }
              })}
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendarModal && (
        <CalendarModal 
          slots={slots}
          onSelectDate={handleDateSelect}
          onClose={() => setShowCalendarModal(false)}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}