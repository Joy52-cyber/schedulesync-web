import { useState, useEffect } from 'react';
import { Calendar, Clock, X, Check, Info, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    loadSlots();
  }, [guestCalendar]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      
      const response = await axios.post(
        `${API_URL}/book/${bookingToken}/slots-with-status`,
        {
          guestAccessToken: guestCalendar?.accessToken,
          guestRefreshToken: guestCalendar?.refreshToken,
          duration: 60,
          daysAhead: 14
        }
      );

      setSlots(response.data.slots);
      setSummary(response.data.summary);

      // Auto-select first date with available slots
      const firstAvailableDate = Object.keys(response.data.slots).find(date => 
        response.data.slots[date].some(slot => slot.status === 'available')
      );
      if (firstAvailableDate) {
        setSelectedDate(firstAvailableDate);
      }

    } catch (error) {
      console.error('Error loading slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status, reason) => {
    if (status === 'available') return 'bg-green-50 border-green-500 hover:bg-green-100 cursor-pointer';
    if (reason === 'past') return 'bg-gray-100 border-gray-300 text-gray-400';
    if (reason === 'organizer_busy') return 'bg-red-50 border-red-300 text-red-600';
    if (reason === 'guest_busy') return 'bg-yellow-50 border-yellow-300 text-yellow-700';
    if (reason === 'both_busy') return 'bg-orange-50 border-orange-300 text-orange-700';
    return 'bg-gray-50 border-gray-300 text-gray-500';
  };

  const getStatusIcon = (status, reason) => {
    if (status === 'available') return <Check className="h-4 w-4 text-green-600" />;
    if (reason === 'past') return <Clock className="h-4 w-4" />;
    if (reason === 'organizer_busy') return <X className="h-4 w-4" />;
    if (reason === 'guest_busy') return <X className="h-4 w-4" />;
    return <Info className="h-4 w-4" />;
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

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">
                Found {summary.availableSlots} available slots in the next 2 weeks
              </p>
              {!summary.hasGuestCalendar && (
                <p className="text-xs text-blue-700 mt-1">
                  💡 Connect your calendar to see mutual availability
                </p>
              )}
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
          {dates.map(date => {
            const daySlots = slots[date];
            const availableCount = daySlots.filter(s => s.status === 'available').length;
            const isSelected = selectedDate === date;

            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                disabled={availableCount === 0}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : availableCount > 0
                    ? 'border-gray-300 hover:border-blue-300'
                    : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                }`}
              >
                <p className="text-xs font-semibold text-gray-600">
                  {daySlots[0]?.dayOfWeek}
                </p>
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {new Date(daySlots[0]?.start).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {availableCount > 0 ? `${availableCount} slots` : 'None available'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots for Selected Date */}
      {selectedDate && slots[selectedDate] && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Available times on {selectedDate}
          </h3>

          {/* Filter: Show only work hours by default */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
            {slots[selectedDate]
              .filter(slot => {
                // Only show work hours + immediately surrounding times
                const hour = new Date(slot.start).getHours();
                return hour >= 8 && hour < 18;
              })
              .map((slot, index) => {
                const isSelected = selectedSlot?.start === slot.start;
                const isAvailable = slot.status === 'available';

                return (
                  <button
                    key={index}
                    onClick={() => isAvailable && (onSlotSelected(slot), setSelectedSlot(slot))}
                    disabled={!isAvailable}
                    className={`group relative p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : getStatusColor(slot.status, slot.reason)
                    }`}
                    title={slot.details}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${
                        isSelected ? 'text-white' : ''
                      }`}>
                        {slot.time}
                      </span>
                      {getStatusIcon(slot.status, slot.reason)}
                    </div>
                    {!isAvailable && slot.details && (
                      <p className="text-xs mt-1 opacity-75">
                        {slot.details.replace('Organizer', '').replace('has another meeting', 'Busy')}
                      </p>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-gray-600">Organizer busy</span>
            </div>
            {summary?.hasGuestCalendar && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-500"></div>
                <span className="text-gray-600">You're busy</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-400"></div>
              <span className="text-gray-600">Outside hours</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}