import { useState } from 'react';
import { X, Users, Clock, Globe, Search, Calendar, Loader2, Plus, Check } from 'lucide-react';
import api from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

export default function GroupScheduler({ onClose, onBookingCreated }) {
  const notify = useNotification();

  const [participants, setParticipants] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [duration, setDuration] = useState(30);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [maxSlots, setMaxSlots] = useState(10);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];

  const handleAddParticipant = () => {
    const email = emailInput.trim().toLowerCase();

    // Basic email validation
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      notify.error('Please enter a valid email address');
      return;
    }

    if (participants.includes(email)) {
      notify.error('This participant is already added');
      return;
    }

    setParticipants([...participants, email]);
    setEmailInput('');
  };

  const handleRemoveParticipant = (email) => {
    setParticipants(participants.filter((p) => p !== email));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddParticipant();
    }
  };

  const handleFindAvailability = async () => {
    if (participants.length === 0) {
      notify.error('Please add at least one participant');
      return;
    }

    try {
      setLoading(true);
      setAvailableSlots([]);
      setSelectedSlot(null);

      const response = await api.groupAvailability.find({
        participants,
        duration,
        timezone,
        maxSlots,
      });

      if (response.data.availableSlots && response.data.availableSlots.length > 0) {
        setAvailableSlots(response.data.availableSlots);
        notify.success(`Found ${response.data.availableSlots.length} available time slots`);
      } else {
        notify.warning('No mutual availability found for these participants');
      }
    } catch (error) {
      console.error('Failed to find availability:', error);
      notify.error(error.response?.data?.error || 'Failed to find group availability');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot);
  };

  const handleCreateBooking = async () => {
    if (!selectedSlot) {
      notify.error('Please select a time slot');
      return;
    }

    if (!meetingTitle) {
      notify.error('Please enter a meeting title');
      return;
    }

    try {
      setCreating(true);

      // Create booking with all participants
      const bookingData = {
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        title: meetingTitle,
        notes: meetingNotes,
        attendees: participants,
        timezone,
      };

      const response = await api.bookings.create(bookingData);

      notify.success('Group meeting scheduled successfully!');

      if (onBookingCreated) {
        onBookingCreated(response.data);
      }

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to create booking:', error);
      notify.error(error.response?.data?.error || 'Failed to schedule group meeting');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeRange = (start, end) => {
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex items-center justify-between shadow-lg z-10 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Schedule Group Meeting</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-all"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Participants Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Participants ({participants.length})
            </label>

            {/* Participant chips */}
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                {participants.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-md"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => handleRemoveParticipant(email)}
                      className="hover:bg-white/20 rounded-full p-0.5 transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add participant input */}
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter participant email..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all"
              />
              <button
                onClick={handleAddParticipant}
                className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Press Enter to add participant</p>
          </div>

          {/* Meeting Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Duration */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-600" />
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Max Slots */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                Max Slots
              </label>
              <select
                value={maxSlots}
                onChange={(e) => setMaxSlots(Number(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all"
              >
                <option value={5}>5 options</option>
                <option value={10}>10 options</option>
                <option value={15}>15 options</option>
                <option value={20}>20 options</option>
              </select>
            </div>
          </div>

          {/* Find Availability Button */}
          <button
            onClick={handleFindAvailability}
            disabled={loading || participants.length === 0}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-purple-200/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Finding Available Times...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Find Available Times
              </>
            )}
          </button>

          {/* Available Slots */}
          {availableSlots.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                Available Times ({availableSlots.length})
              </h3>

              {/* Meeting Details (if slot selected) */}
              {selectedSlot && (
                <div className="mb-4 space-y-3 p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Meeting Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Team Planning Meeting"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Meeting Notes (optional)
                    </label>
                    <textarea
                      placeholder="Add agenda, topics, or any notes..."
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all min-h-[80px]"
                    />
                  </div>

                  <button
                    onClick={handleCreateBooking}
                    disabled={creating || !meetingTitle}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Creating Meeting...
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        Confirm & Schedule Meeting
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Slots Grid */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectSlot(slot)}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      selectedSlot === slot
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-2 border-purple-700 shadow-xl'
                        : 'bg-white border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className={`font-semibold text-lg ${
                            selectedSlot === slot ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {formatDate(slot.start)}
                        </p>
                        <p
                          className={`text-sm mt-1 ${
                            selectedSlot === slot ? 'text-purple-100' : 'text-gray-600'
                          }`}
                        >
                          {formatTimeRange(slot.start, slot.end)}
                        </p>
                      </div>
                      {selectedSlot === slot && (
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No slots found message */}
          {!loading && availableSlots.length === 0 && participants.length > 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                Click "Find Available Times" to search for mutual availability
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
