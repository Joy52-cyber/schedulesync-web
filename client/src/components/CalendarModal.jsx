import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Calendar, Info } from 'lucide-react';

function CalendarModalContent({ slots, onSelectDate, onClose, selectedDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [normalizedSlots, setNormalizedSlots] = useState({});

  // ============ TIMEZONE-SAFE DATE NORMALIZATION ============
  useEffect(() => {
    console.log('🔄 Normalizing slots for calendar modal...');
    console.log('📦 Original slot keys (first 5):', Object.keys(slots).slice(0, 5));
    
    const normalized = {};
    let successCount = 0;
    let failCount = 0;

    for (const [dateKey, daySlots] of Object.entries(slots)) {
      try {
        // Parse the formatted date string back to a Date object
        const parsedDate = new Date(dateKey);
        
        if (isNaN(parsedDate.getTime())) {
          console.warn('⚠️ Invalid date:', dateKey);
          failCount++;
          continue;
        }

        // ✅ Use local timezone components instead of UTC
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        const isoKey = `${year}-${month}-${day}`;

        normalized[isoKey] = daySlots;
        
        if (successCount < 5) {
          console.log(`✅ Converted: "${dateKey}" → "${isoKey}" (${daySlots.length} slots)`);
        }
        successCount++;
      } catch (error) {
        console.error('❌ Error normalizing date:', dateKey, error);
        failCount++;
      }
    }

    console.log(`✅ Normalization complete: Success: ${successCount} dates, Failed: ${failCount} dates`);
    setNormalizedSlots(normalized);
  }, [slots]);

  // ============ AUTO-NAVIGATE TO FIRST AVAILABLE MONTH ============
  useEffect(() => {
    if (Object.keys(normalizedSlots).length === 0) return;
    
    const sortedDates = Object.keys(normalizedSlots)
      .filter(dateKey => {
        const daySlots = normalizedSlots[dateKey];
        return daySlots && daySlots.some(s => s.status === 'available');
      })
      .sort();
    
    if (sortedDates.length === 0) return;
    
    const firstAvailableDate = sortedDates[0];
    const [year, month] = firstAvailableDate.split('-').map(Number);
    const targetMonth = new Date(year, month - 1, 1);
    
    setCurrentMonth(targetMonth);
  }, [normalizedSlots]);

  // ============ HELPER FUNCTIONS ============
  const getDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getAvailableCount = (dateKey) => {
    const daySlots = normalizedSlots[dateKey];
    if (!daySlots) return 0;
    return daySlots.filter(s => s.status === 'available').length;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };

  // ============ DATE SELECTION - SIMPLE VERSION ============
  const handleDateSelect = (dateKey) => {
    console.log('🎯 Date clicked in modal:', dateKey);
    onSelectDate(dateKey);
    onClose();
  };

  // ============ CALENDAR GRID BUILDER ============
  const buildCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const grid = [];

    // Empty cells before the first day
    for (let i = 0; i < startingDayOfWeek; i++) {
      grid.push(<div key={`empty-${i}`} className="h-16 sm:h-20" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = getDateKey(date);
      const availableCount = getAvailableCount(dateKey);
      const hasSlots = availableCount > 0;
      const todayDate = isToday(date);
      const isPast = isPastDate(date);
      const isSelectedDate = selectedDate === dateKey;

      grid.push(
        <div
          key={day}
          onClick={() => {
            if (!isPast && hasSlots) {
              handleDateSelect(dateKey);
            }
          }}
          className={`h-16 sm:h-20 rounded-lg border-2 transition-all relative group ${
            isSelectedDate
              ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
              : hasSlots && !isPast
              ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md cursor-pointer active:scale-95'
              : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
          }`}
        >
          <div className="flex flex-col items-center justify-center h-full p-1 pointer-events-none">
            <span className={`text-base sm:text-lg font-semibold ${
              todayDate ? 'text-blue-600' : hasSlots && !isPast ? 'text-gray-900' : 'text-gray-400'
            }`}>
              {day}
            </span>
            
            {hasSlots && !isPast && (
              <div className="flex items-center gap-0.5 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isSelectedDate ? 'bg-blue-500' : 'bg-green-500'}`} />
                <span className={`text-[10px] font-medium ${isSelectedDate ? 'text-blue-600' : 'text-green-600'}`}>
                  {availableCount}
                </span>
              </div>
            )}
            
            {todayDate && (
              <span className="text-[9px] text-blue-600 font-bold uppercase mt-0.5">Today</span>
            )}

            {isSelectedDate && (
              <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>

          {hasSlots && !isPast && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
              {availableCount} slot{availableCount !== 1 ? 's' : ''} available
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return grid;
  };

  const totalAvailableSlots = Object.values(normalizedSlots).reduce((sum, daySlots) => {
    return sum + daySlots.filter(s => s.status === 'available').length;
  }, 0);

  const availableDatesInMonth = Object.keys(normalizedSlots)
    .filter(dateKey => {
      const [year, month] = dateKey.split('-').map(Number);
      return year === currentMonth.getFullYear() && 
             month === currentMonth.getMonth() + 1 &&
             getAvailableCount(dateKey) > 0;
    })
    .length;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[9999]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Select a Date</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  {totalAvailableSlots} total slots available
                </p>
              </div>
            </div>
            <div onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer">
              <X className="h-5 w-5 text-gray-500" />
            </div>
          </div>

          {availableDatesInMonth > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-green-800">
                <span className="font-semibold">{availableDatesInMonth} day{availableDatesInMonth !== 1 ? 's' : ''}</span> with available slots in {currentMonth.toLocaleDateString('en-US', { month: 'long' })}
              </p>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="p-4 sm:p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </div>
            
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            
            <div
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </div>
          </div>

          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {buildCalendarGrid()}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2">Legend:</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">Available slots</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">Selected date</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                <span className="text-gray-600">No slots</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarModal(props) {
  // ✅ Render modal using React Portal - OUTSIDE the form DOM tree!
  return createPortal(
    <CalendarModalContent {...props} />,
    document.body
  );
}