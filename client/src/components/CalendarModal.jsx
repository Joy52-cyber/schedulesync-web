import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export default function CalendarModal({ slots, onSelectDate, onClose, selectedDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Debug: Log slots on mount
  useEffect(() => {
    console.log('📅 CalendarModal - Slots received:', slots);
    console.log('📅 Available dates:', Object.keys(slots || {}).filter(date => {
      const daySlots = slots[date] || [];
      return daySlots.some(s => s.status === 'available');
    }));
  }, [slots]);

  const monthNames = ["January", "February", "March", "April", "May", "June",
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

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const getDateKey = (day) => {
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0];
  };

  const getAvailableCount = (dateKey) => {
    const daySlots = slots[dateKey];
    if (!daySlots) {
      console.log('⚪ No slots for', dateKey);
      return 0;
    }
    const count = daySlots.filter(s => s.status === 'available').length;
    console.log('✅ Date:', dateKey, 'Available:', count, 'Total:', daySlots.length);
    return count;
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
    return date < today;
  };

  const days = [];
  
  // Empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="h-16 sm:h-20" />);
  }

  // Actual days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = getDateKey(day);
    const availableCount = getAvailableCount(dateKey);
    const isSelectedDate = selectedDate === dateKey;
    const isPast = isPastDate(day);
    const todayDate = isToday(day);

    days.push(
      <button
        key={day}
        onClick={() => {
          if (!isPast && availableCount > 0) {
            console.log('📅 Selected date:', dateKey);
            onSelectDate(dateKey);
            onClose();
          }
        }}
        disabled={isPast || availableCount === 0}
        className={`h-16 sm:h-20 rounded-lg border-2 transition-all relative group ${
          isSelectedDate
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : availableCount > 0 && !isPast
            ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
            : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
        }`}
      >
        <div className="flex flex-col items-center justify-center h-full p-1">
          <span className={`text-base sm:text-lg font-semibold ${
            todayDate
              ? 'text-blue-600'
              : availableCount > 0 && !isPast
              ? 'text-gray-900'
              : 'text-gray-400'
          }`}>
            {day}
          </span>
          
          {availableCount > 0 && !isPast && (
            <div className="flex items-center gap-0.5 mt-1">
              <div className="w-1 h-1 bg-green-500 rounded-full" />
              <span className="text-[10px] text-green-600 font-medium">
                {availableCount}
              </span>
            </div>
          )}
          
          {todayDate && (
            <span className="text-[9px] text-blue-600 font-bold uppercase">Today</span>
          )}
        </div>

        {/* Tooltip on hover */}
        {availableCount > 0 && !isPast && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            {availableCount} slot{availableCount !== 1 ? 's' : ''} available
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Select a Date</h2>
              <p className="text-sm text-white/80">Choose from available dates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Calendar */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={previousMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h3 className="text-lg font-bold text-gray-900">
              {monthNames[month]} {year}
            </h3>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
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

          {/* Legend */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Legend</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-200 rounded bg-white"></div>
                <span className="text-xs text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 rounded bg-blue-50"></div>
                <span className="text-xs text-gray-600">Selected</span>
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