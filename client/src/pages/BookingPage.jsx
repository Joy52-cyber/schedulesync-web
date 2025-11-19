import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Calendar, Clock, User, Mail, MessageSquare, CheckCircle, 
  Loader2, ArrowRight, ChevronLeft, ChevronRight, Info,
  Sparkles, Globe, Video, MapPin
} from 'lucide-react';
import api from '../utils/api';

export default function BookingPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  const [teamData, setTeamData] = useState(null);
  const [slots, setSlots] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep] = useState(1); // 1: date, 2: time, 3: details
  
  const [formData, setFormData] = useState({
    attendee_name: '',
    attendee_email: '',
    notes: '',
  });

  useEffect(() => {
    loadBookingData();
  }, [token]);

  const loadBookingData = async () => {
    try {
      setLoading(true);
      
      // Load team/member info
      const infoResponse = await api.get(`/book/${token}`);
      setTeamData(infoResponse.data.data);
      
      // Load available slots
      const slotsResponse = await api.post(`/book/${token}/slots-with-status`, {
        duration: 30,
        daysAhead: 14,
      });
      
      setSlots(slotsResponse.data.slots || {});
      
      // Auto-select first available date
      const dates = Object.keys(slotsResponse.data.slots || {});
      if (dates.length > 0) {
        setSelectedDate(dates[0]);
      }
    } catch (error) {
      console.error('Error loading booking data:', error);
      setError('Failed to load booking page. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep(2);
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedSlot) {
      setError('Please select a time slot');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      await api.post('/bookings', {
        token,
        slot: {
          start: selectedSlot.start,
          end: selectedSlot.end,
        },
        attendee_name: formData.attendee_name,
        attendee_email: formData.attendee_email,
        notes: formData.notes,
      });
      
      setSuccess(true);
    } catch (error) {
      console.error('Booking error:', error);
      setError(error.response?.data?.error || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const getAvailableSlots = (date) => {
    return (slots[date] || []).filter(slot => slot.status === 'available');
  };

  const groupSlotsByTimeOfDay = (dateSlots) => {
    const morning = [];
    const afternoon = [];
    const evening = [];
    
    dateSlots.forEach(slot => {
      const hour = new Date(slot.start).getHours();
      if (hour < 12) morning.push(slot);
      else if (hour < 17) afternoon.push(slot);
      else evening.push(slot);
    });
    
    return { morning, afternoon, evening };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (error && !teamData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Unavailable</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center animate-scale-in">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Booking Confirmed! 🎉</h2>
          <p className="text-gray-600 mb-6">
            Your meeting with <span className="font-semibold">{teamData.member.name}</span> is confirmed for:
          </p>
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <p className="font-semibold text-gray-900">{formatDate(selectedSlot.start)}</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Clock className="h-5 w-5 text-purple-600" />
              <p className="font-semibold text-gray-900">
                {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
              </p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              📧 A confirmation email with calendar invite has been sent to <span className="font-semibold">{formData.attendee_email}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const availableDates = Object.keys(slots).filter(date => getAvailableSlots(date).length > 0);
  const selectedDateSlots = selectedDate ? getAvailableSlots(selectedDate) : [];
  const timeGroups = selectedDate ? groupSlotsByTimeOfDay(selectedDateSlots) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-2xl">
                {teamData.member.name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{teamData.member.name}</h1>
              <p className="text-sm text-gray-600">{teamData.team.name}</p>
            </div>
            
            {/* Duration Badge */}
            <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              30 min
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left Sidebar - Steps */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6 sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Book a Meeting
              </h3>
              
              {/* Step Indicators */}
              <div className="space-y-4">
                {/* Step 1 */}
                <div className={`flex items-start gap-3 ${step >= 1 ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step > 1 ? 'bg-green-500' : step === 1 ? 'bg-blue-600' : 'bg-gray-200'
                  }`}>
                    {step > 1 ? (
                      <CheckCircle className="h-5 w-5 text-white" />
                    ) : (
                      <span className="text-white font-bold text-sm">1</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Select Date</p>
                    <p className="text-sm text-gray-600">
                      {selectedDate ? formatDate(selectedDate) : 'Choose a day'}
                    </p>
                  </div>
                </div>
                
                {/* Step 2 */}
                <div className={`flex items-start gap-3 ${step >= 2 ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step > 2 ? 'bg-green-500' : step === 2 ? 'bg-blue-600' : 'bg-gray-200'
                  }`}>
                    {step > 2 ? (
                      <CheckCircle className="h-5 w-5 text-white" />
                    ) : (
                      <span className="text-white font-bold text-sm">2</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Pick Time</p>
                    <p className="text-sm text-gray-600">
                      {selectedSlot ? formatTime(selectedSlot.start) : 'Choose a time slot'}
                    </p>
                  </div>
                </div>
                
                {/* Step 3 */}
                <div className={`flex items-start gap-3 ${step >= 3 ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step === 3 ? 'bg-blue-600' : 'bg-gray-200'
                  }`}>
                    <span className="text-white font-bold text-sm">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Your Details</p>
                    <p className="text-sm text-gray-600">Enter your information</p>
                  </div>
                </div>
              </div>
              
              {/* Meeting Info */}
              {teamData.team.description && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm text-gray-600">{teamData.team.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Content */}
          <div className="lg:col-span-3">
            {/* Date Selection */}
            {step >= 1 && (
              <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Select a Date
                </h3>
                
                {availableDates.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">No available dates at the moment</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableDates.slice(0, 6).map((date) => (
                      <button
                        key={date}
                        onClick={() => handleDateSelect(date)}
                        className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                          selectedDate === date
                            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                            {getAvailableSlots(date).length} slots
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Time Selection */}
            {step >= 2 && selectedDate && (
              <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-600" />
                    Select a Time
                  </h3>
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Change Date
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">{formatDate(selectedDate)}</p>
                
                {selectedDateSlots.length === 0 ? (
                  <p className="text-center py-4 text-gray-600">No available times for this date</p>
                ) : (
                  <div className="space-y-4">
                    {timeGroups.morning.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                          ☀️ Morning
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {timeGroups.morning.map((slot, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSlotSelect(slot)}
                              className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all hover:scale-105 ${
                                selectedSlot === slot
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                              }`}
                            >
                              {formatTime(slot.start)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {timeGroups.afternoon.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                          🌤️ Afternoon
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {timeGroups.afternoon.map((slot, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSlotSelect(slot)}
                              className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all hover:scale-105 ${
                                selectedSlot === slot
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                              }`}
                            >
                              {formatTime(slot.start)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {timeGroups.evening.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                          🌙 Evening
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {timeGroups.evening.map((slot, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSlotSelect(slot)}
                              className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all hover:scale-105 ${
                                selectedSlot === slot
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                              }`}
                            >
                              {formatTime(slot.start)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Details Form */}
            {step >= 3 && selectedSlot && (
              <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-green-600" />
                  Your Details
                </h3>
                
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <Info className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Your Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.attendee_name}
                        onChange={(e) => setFormData({ ...formData, attendee_name: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Your Email *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={formData.attendee_email}
                        onChange={(e) => setFormData({ ...formData, attendee_email: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
                        placeholder="john@example.com"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all resize-none"
                        placeholder="Anything you'd like to share about the meeting?"
                        rows="3"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      <>
                        Confirm Booking
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}