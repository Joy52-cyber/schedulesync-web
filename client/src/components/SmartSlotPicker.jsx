import { useState, useEffect } from 'react';
import { Calendar, Clock, Check, Info, Loader2, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`);

export default function SmartSlotPicker({ 
  bookingToken, 
  guestCalendar = null,
  onSlotSelected 
}) {
  const [slots, setSlots] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);

  useEffect(() => {
    loadSlots();
  }, [bookingToken]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      
      // Auto-detect user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('🌍 User timezone detected:', userTimezone);
      
      const response = await axios.post(
        `${API_URL}/book/${bookingToken}/slots-with-status`,
        {
          guestAccessToken: guestCalendar?.accessToken,
          guestRefreshToken: guestCalendar?.refreshToken,
          duration: 60,
          daysAhead: 14,
          timezone: userTimezone
        }
      );

      console.log('📊 Loaded slots:', {
        totalDates: Object.keys(response.data.slots).length,
        availableSlots: response.data.summary.availableSlots
      });
      
      setSlots(response.data.slots);
      setSummary(response.data.summary);

      // Only auto-select first date if nothing is currently selected
      if (!selectedDate) {
        const firstAvailableDate = Object.keys(response.data.slots).find(date => 
          response.data.slots[date].some(slot => slot.status === 'available')
        );
        if (firstAvailableDate) {
          setSelectedDate(firstAvailableDate);
        }
      }

    } catch (error) {
      console.error('❌ Error loading slots:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading availability...</span>
      </div>
    );
  }

  const dates = Object.keys(slots);
  const visibleDates = showAllDates ? dates : dates.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && summary.availableSlots > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900">
                {summary.availableSlots} available time{summary.availableSlots !== 1 ? 's' : ''} found
              </p>
              {!summary.hasGuestCalendar && (
                <p className="text-xs text-green-700 mt-1">
                  💡 Connect your calendar to see mutual availability
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
                No available slots in the next 2 weeks
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Please connect your calendar or contact the organizer directly
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Date Selector */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Select a date
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {visibleDates.map(date => {
            const daySlots = slots[date];
            const availableCount = daySlots.filter(s => s.status === 'available').length;
            const unavailableCount = daySlots.length - availableCount;
            const isSelected = selectedDate === date;

            return (
              <button
                key={date}
                onClick={() => {
                  setSelectedDate(date);
                  setSelectedSlot(null);
                }}
                disabled={availableCount === 0}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  isSelected 
                    ? 'border-green-500 bg-green-50' 
                    : availableCount > 0
                    ? 'border-gray-300 hover:border-green-300'
                    : 'border-red-200 bg-red-50 opacity-75 cursor-not-allowed'
                }`}
              >
                <p className="text-xs font-semibold text-gray-600">
                  {daySlots[0]?.dayOfWeek}
                </p>
                <p className={`text-sm font-bold mt-1 ${availableCount > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                  {new Date(daySlots[0]?.start).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
                {availableCount > 0 ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Check className="h-3 w-3 text-green-600" />
                    <p className="text-xs font-medium text-green-600">
                      {availableCount} slot{availableCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                ) : (
                  <div className="mt-1">
                    <p className="text-xs text-red-600 font-medium">
                      No slots
                    </p>
                    {showUnavailable && unavailableCount > 0 && (
                      <p className="text-xs text-gray-500">
                        ({unavailableCount} busy)
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Show More/Less Button */}
        {dates.length > 4 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAllDates(!showAllDates)}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              {showAllDates ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show less dates
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show more dates ({dates.length - 4} more)
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Time Slots for Selected Date */}
      {selectedDate && slots[selectedDate] && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Available times
            </h3>
            <button
              onClick={() => setShowUnavailable(!showUnavailable)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              {showUnavailable ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  Hide unavailable
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  Show all times
                </>
              )}
            </button>
          </div>

          {/* Slots Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
            {slots[selectedDate]
              .filter(slot => {
                if (slot.status === 'available') return true;
                return showUnavailable;
              })
              .map((slot, index) => {
                const isSelected = selectedSlot?.start === slot.start;
                const isAvailable = slot.status === 'available';

                if (isAvailable) {
                  return (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedSlot(slot);
                        onSlotSelected(slot);
                        console.log('✅ Slot selected:', slot.time, slot.start);
                      }}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'border-green-600 bg-green-600 text-white shadow-lg'
                          : 'border-green-500 bg-green-50 hover:bg-green-100 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-lg font-bold ${
                          isSelected ? 'text-white' : 'text-green-900'
                        }`}>
                          {slot.time}
                        </span>
                        <Check className={`h-5 w-5 ${
                          isSelected ? 'text-white' : 'text-green-600'
                        }`} />
                      </div>
                      <p className={`text-xs font-medium ${
                        isSelected ? 'text-green-100' : 'text-green-700'
                      }`}>
                        {isSelected ? 'Selected' : 'Available'}
                      </p>
                    </button>
                  );
                } else {
                  return (
                    <button
                      key={index}
                      disabled
                      className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-left opacity-60 cursor-not-allowed"
                      title={slot.details}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-600">
                          {slot.time}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {slot.reason === 'organizer_busy' && '🔴 Busy'}
                        {slot.reason === 'guest_busy' && '🟡 You\'re busy'}
                        {slot.reason === 'outside_hours' && '⚪ Off hours'}
                        {slot.reason === 'past' && '⏰ Past'}
                        {slot.reason === 'weekend' && '📅 Weekend'}
                      </p>
                    </button>
                  );
                }
              })}
          </div>

          {/* Available count */}
          {slots[selectedDate] && (
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-600">
                {slots[selectedDate].filter(s => s.status === 'available').length} available time
                {slots[selectedDate].filter(s => s.status === 'available').length !== 1 ? 's' : ''} on this day
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}