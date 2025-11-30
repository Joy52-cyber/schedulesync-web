import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react';

export default function CalendarModal({ slots, onSelectDate, onClose, selectedDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [normalizedSlots, setNormalizedSlots] = useState({});
  const [debugMode, setDebugMode] = useState(false); // Set to false for production

  // ============ DATE NORMALIZATION WITH TIMEZONE FIX ============
  useEffect(() => {
    console.log('🔧 CalendarModal: Normalizing slot keys...');
    console.log('📦 Received slots object:', slots);
    console.log('📦 Original slot keys (first 5):', Object.keys(slots || {}).slice(0, 5));
    
    if (!slots || Object.keys(slots).length === 0) {
      console.warn('⚠️ No slots provided to CalendarModal');
      setNormalizedSlots({});
      return;
    }
    
    const normalized = {};
    let successCount = 0;
    let failCount = 0;
    
    Object.keys(slots).forEach(key => {
      try {
        // Handle multiple date formats
        let date;
        
        // Check if already in ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
          date = new Date(key + 'T12:00:00'); // Add noon to avoid timezone issues
        } else {
          // Parse formatted dates like "Monday, December 2, 2024"
          date = new Date(key);
        }
        
        if (isNaN(date.getTime())) {
          console.warn(`⚠️ Could not parse date: "${key}"`);
          failCount++;
          return;
        }
        
        // ✅ CRITICAL FIX: Build ISO key from LOCAL date components (not UTC)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const isoKey = `${year}-${month}-${day}`;
        
        // Store the slots array for this date
        normalized[isoKey] = slots[key];
        successCount++;
        
        if (successCount <= 3) {
          console.log(`✅ Converted: "${key}" → "${isoKey}" (${slots[key].length} slots)`);
        }
      } catch (error) {
        console.error(`❌ Error parsing date "${key}":`, error);
        failCount++;
      }
    });
    
    console.log('✅ Normalization complete:');
    console.log(`   - Success: ${successCount} dates`);
    console.log(`   - Failed: ${failCount} dates`);
    console.log(`   - Normalized keys (first 5):`, Object.keys(normalized).slice(0, 5));
    console.log(`   - Total dates available:`, Object.keys(normalized).length);
    
    setNormalizedSlots(normalized);
  }, [slots]);

  // ============ CALENDAR CONFIGURATION ============
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  // ============ NAVIGATION ============
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // ============ DATE HELPERS ============
  const getDateKey = (day) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, day);
    
    // Build ISO key (YYYY-MM-DD) from local components
    const isoYear = date.getFullYear();
    const isoMonth = String(date.getMonth() + 1).padStart(2, '0');
    const isoDay = String(date.getDate()).padStart(2, '0');
    
    return `${isoYear}-${isoMonth}-${isoDay}`;
  };

  const getAvailableCount = (dateKey) => {
    const daySlots = normalizedSlots[dateKey];
    if (!daySlots || !Array.isArray(daySlots)) {
      return 0;
    }
    return daySlots.filter(s => s.status === 'available').length;
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && 
           month === today.getMonth() && 
           year === today.getFullYear();
  };

  const isPastDate = (day) => {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };

  // ============ BUILD CALENDAR GRID ============
  const days = [];
  
  // Empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(
      <div key={`empty-${i}`} className="h-16 sm:h-20" />
    );
  }

  // Actual days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = getDateKey(day);
    const availableCount = getAvailableCount(dateKey);
    const isSelectedDate = selectedDate === dateKey;
    const isPast = isPastDate(day);
    const todayDate = isToday(day);
    const hasSlots = availableCount > 0;

    days.push(
      <button
        key={day}
        onClick={() => {
          if (!isPast && hasSlots) {
            console.log('🎯 Date selected:', dateKey, `(${availableCount} slots available)`);
            onSelectDate(dateKey);
            onClose();
          } else {
            console.log('⚠️ Cannot select:', dateKey, {
              isPast,
              hasSlots,
              availableCount
            });
          }
        }}
        disabled={isPast || !hasSlots}
        className={`h-16 sm:h-20 rounded-lg border-2 transition-all relative group ${
          isSelectedDate
            ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
            : hasSlots && !isPast
            ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md cursor-pointer'
            : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
        }`}
        title={
          isPast 
            ? 'Past date' 
            : hasSlots 
            ? `${availableCount} slot${availableCount !== 1 ? 's' : ''} available`
            : 'No slots available'
        }
      >
        <div className="flex flex-col items-center justify-center h-full p-1">
          {/* Day Number */}
          <span className={`text-base sm:text-lg font-semibold ${
            todayDate
              ? 'text-blue-600'
              : hasSlots && !isPast
              ? 'text-gray-900'
              : 'text-gray-400'
          }`}>
            {day}
          </span>
          
          {/* Available Slots Indicator */}
          {hasSlots && !isPast && (
            <div className="flex items-center gap-0.5 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${
                isSelectedDate ? 'bg-blue-500' : 'bg-green-500'
              }`} />
              <span className={`text-[10px] font-medium ${
                isSelectedDate ? 'text-blue-600' : 'text-green-600'
              }`}>
                {availableCount}
              </span>
            </div>
          )}
          
          {/* Today Badge */}
          {todayDate && (
            <span className="text-[9px] text-blue-600 font-bold uppercase mt-0.5">
              Today
            </span>
          )}

          {/* Selected Badge */}
          {isSelectedDate && (
            <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </div>

        {/* Hover Tooltip */}
        {hasSlots && !isPast && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
            {availableCount} slot{availableCount !== 1 ? 's' : ''} available
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </button>
    );
  }

  // ============ STATS ============
  const totalDatesWithSlots = Object.keys(normalizedSlots).filter(key => {
    const slots = normalizedSlots[key];
    return slots && slots.some(s => s.status === 'available');
  }).length;

  const totalAvailableSlots = Object.values(normalizedSlots).reduce((sum, daySlots) => {
    return sum + (daySlots?.filter(s => s.status === 'available').length || 0);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
        
        {/* ============ HEADER ============ */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Select a Date</h2>
              <p className="text-sm text-white/80">
                {totalDatesWithSlots} dates with {totalAvailableSlots} available slots
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Close calendar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ============ CALENDAR BODY ============ */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          
          {/* Debug Panel (Remove in production) */}
          {debugMode && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs space-y-1">
              <p className="font-bold text-yellow-900">🐛 Debug Info:</p>
              <p><strong>Original keys (first 3):</strong> {Object.keys(slots || {}).slice(0, 3).join(', ')}</p>
              <p><strong>Normalized keys (first 3):</strong> {Object.keys(normalizedSlots || {}).slice(0, 3).join(', ')}</p>
              <p><strong>Total normalized dates:</strong> {Object.keys(normalizedSlots || {}).length}</p>
              <p><strong>Selected date key:</strong> {selectedDate || 'none'}</p>
              <button
                onClick={() => console.log('Full normalized slots:', normalizedSlots)}
                className="mt-2 px-2 py-1 bg-yellow-200 rounded text-yellow-900 hover:bg-yellow-300"
              >
                Log to Console
              </button>
            </div>
          )}

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={previousMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors group"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600 group-hover:text-gray-900" />
            </button>
            
            <h3 className="text-lg font-bold text-gray-900">
              {monthNames[month]} {year}
            </h3>
            
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors group"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-gray-900" />
            </button>
          </div>

          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {days}
          </div>

          {/* Empty State */}
          {Object.keys(normalizedSlots).length === 0 && (
            <div className="mt-8 text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <Info className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">No available dates found</p>
              <p className="text-xs text-gray-500 mt-1">Try connecting your calendar or contact the organizer</p>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Legend</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-200 rounded bg-white flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-xs text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 rounded bg-blue-50"></div>
                <span className="text-xs text-gray-600">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 rounded bg-white flex items-center justify-center">
                  <span className="text-[8px] font-bold text-blue-600">T</span>
                </div>
                <span className="text-xs text-gray-600">Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-100 rounded bg-gray-50 opacity-50"></div>
                <span className="text-xs text-gray-600">Unavailable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}