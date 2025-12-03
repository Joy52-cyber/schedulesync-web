import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  Minus,
  Maximize2,
  Loader2, 
  Calendar,
  Clock,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  Trash2,
  RotateCcw
} from 'lucide-react';
import api, { bookings } from '../utils/api'; 

export default function AISchedulerChat() {
  console.log('🔥 AISchedulerChat component is rendering!');

  const GREETING_MESSAGE = `👋 Hi! I'm your AI scheduling assistant.

I can help you:

📅 Book meetings ("Schedule with john@email.com tomorrow at 2pm")
🕐 Find available times ("When can I meet this week?")  
📋 View your bookings ("Show my upcoming meetings")
📧 Send professional emails ("Send reminder to client@company.com")

What would you like to do?`;

  // Enhanced greeting creation with identification flag
  const createGreeting = () => ({
    role: 'assistant',
    content: GREETING_MESSAGE,
    timestamp: new Date(),
    isGreeting: true
  });

  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('aiChat_isOpen');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');

  // Enhanced chat history initialization
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('aiChat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          const mappedHistory = parsed.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          
          // Check if greeting exists
          const hasGreeting = mappedHistory.some(msg => 
            msg.isGreeting || 
            (msg.role === 'assistant' && msg.content.includes("Hi! I'm your AI scheduling assistant"))
          );
          
          if (hasGreeting) {
            return mappedHistory;
          }
        }
      }
    } catch (e) {
      console.error('Error loading chat history:', e);
    }
    
    // Always return greeting if nothing saved or error
    return [createGreeting()];
  });

  const [loading, setLoading] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(() => {
    const saved = localStorage.getItem('aiChat_pendingBooking');
    return saved ? JSON.parse(saved) : null;
  });
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Force greeting on component mount
  useEffect(() => {
    console.log('🚀 Component mounted, ensuring greeting exists');
    
    setTimeout(() => {
      if (chatHistory.length === 0) {
        const greeting = createGreeting();
        setChatHistory([greeting]);
        localStorage.setItem('aiChat_history', JSON.stringify([greeting]));
      }
    }, 200);
  }, []);

  // Enhanced greeting management
  useEffect(() => {
    console.log('💬 Current chat history length:', chatHistory.length);
    
    // Check if greeting exists
    const hasGreeting = chatHistory.some(msg => 
      msg.isGreeting || 
      (msg.role === 'assistant' && msg.content.includes("Hi! I'm your AI scheduling assistant"))
    );
    
    if (chatHistory.length === 0 || !hasGreeting) {
      console.log('⚠️ No greeting found, adding one');
      const greeting = createGreeting();
      setChatHistory([greeting]);
    }
  }, [chatHistory]);

  // Save chat history to localStorage
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('aiChat_history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Save pending booking to localStorage
  useEffect(() => {
    if (pendingBooking) {
      localStorage.setItem('aiChat_pendingBooking', JSON.stringify(pendingBooking));
    } else {
      localStorage.removeItem('aiChat_pendingBooking');
    }
  }, [pendingBooking]);

  // Save open state to localStorage
  useEffect(() => {
    localStorage.setItem('aiChat_isOpen', JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage('');
    
    setChatHistory(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      timestamp: new Date()
    }]);

    setLoading(true);
    try {
      let contextMessage = userMessage;
      if (pendingBooking) {
        contextMessage = `[Current pending booking: "${pendingBooking.title}" on ${pendingBooking.date} at ${pendingBooking.time} for ${pendingBooking.duration} minutes with ${pendingBooking.attendee_email}]\n\nUser says: ${userMessage}`;
      }

      const response = await api.ai.schedule(contextMessage, chatHistory);
      const responseData = response.data;
      
      if (responseData.type === 'update_pending' && responseData.data?.updatedBooking) {
        setPendingBooking(responseData.data.updatedBooking);
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: responseData.message,
          timestamp: new Date()
        }]);
      } else if (responseData.type === 'confirmation' && responseData.data?.bookingData) {
        const bookingData = responseData.data.bookingData;
        setPendingBooking({
          title: bookingData.title || 'Meeting',
          date: bookingData.date,
          time: bookingData.time,
          attendee_email: bookingData.attendee_email || bookingData.attendees?.[0],
          duration: bookingData.duration || 30,
          notes: bookingData.notes || ''
        });
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: responseData.message,
          timestamp: new Date()
        }]);
      } else {
        const aiMessage = responseData.message || responseData.response || 'I understood your request.';
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: aiMessage,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('AI chat error:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced booking confirmation with detailed error handling
 const handleConfirmBooking = async () => {
  if (!pendingBooking) return;
  setLoading(true);
  try {
    const startDateTime = new Date(`${pendingBooking.date}T${pendingBooking.time}`);
    const endDateTime = new Date(startDateTime.getTime() + pendingBooking.duration * 60000);

    // Get all attendees from the modal
    const allAttendees = pendingBooking.attendees || [pendingBooking.attendee_email];

    const bookingData = {
      title: pendingBooking.title || 'Meeting',
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      attendees: allAttendees,  // ✅ SEND FULL ATTENDEES ARRAY
      attendee_email: allAttendees[0],  // Keep for backward compatibility
      attendee_name: allAttendees[0].split('@')[0],
      notes: pendingBooking.notes || '',
      duration: pendingBooking.duration || 30
    };

    console.log('📤 Sending AI booking request:', bookingData);

    // Create a temporary token for the booking API
const tempToken = `ai-${Date.now()}`;

const response = await bookings.create({
  token: tempToken,
  slot: {
    start: startDateTime.toISOString(),
    end: endDateTime.toISOString()
  },
  attendee_name: allAttendees[0].split('@')[0],
  attendee_email: allAttendees[0], 
  additional_attendees: allAttendees.slice(1), // Rest of attendees
  notes: pendingBooking.notes || '',
  guest_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  event_type_id: null, // AI bookings don't need event type
  event_type_slug: 'ai-booking'
});

    setChatHistory(prev => [...prev, { 
      role: 'assistant', 
      content: `✅ Booking Confirmed!\n\n📅 ${pendingBooking.title || 'Meeting'}\n🕐 ${formatDateTime(startDateTime)}\n👥 ${allAttendees.join(', ')}\n\nConfirmation emails sent!`,
      timestamp: new Date(),
      isConfirmation: true
    }]);

    setPendingBooking(null);
    
  } catch (error) {
    console.error('❌ AI booking error:', error);
    console.error('❌ Error response:', error.response?.data);
    
    setPendingBooking(null);
    
    let errorMessage = '❌ Failed to create booking. ';
    if (error.response?.data?.error) {
      errorMessage += `${error.response.data.error}`;
    } else {
      errorMessage += 'Please try again later.';
    }
    
    setChatHistory(prev => [...prev, { 
      role: 'assistant', 
      content: errorMessage,
      timestamp: new Date()
    }]);
  } finally {
    setLoading(false);
  }
};
  const handleCancelBooking = () => {
    setPendingBooking(null);
    setChatHistory(prev => [...prev, { 
      role: 'assistant', 
      content: 'Booking cancelled. How else can I help you?',
      timestamp: new Date()
    }]);
  };

  // Enhanced clear chat function
  const handleClearChat = () => {
    console.log('🗑️ Clearing all chat history');
    const newGreeting = createGreeting();
    setChatHistory([newGreeting]);
    setPendingBooking(null);
    localStorage.removeItem('aiChat_pendingBooking');
    
    // Force save the new greeting
    setTimeout(() => {
      localStorage.setItem('aiChat_history', JSON.stringify([newGreeting]));
    }, 100);
  };

  // Enhanced reset function
  const handleResetToGreeting = () => {
    console.log('🔄 Resetting to greeting');
    const newGreeting = createGreeting();
    setChatHistory([newGreeting]);
    setPendingBooking(null);
    localStorage.removeItem('aiChat_pendingBooking');
    
    // Force save the new greeting
    setTimeout(() => {
      localStorage.setItem('aiChat_history', JSON.stringify([newGreeting]));
    }, 100);
  };

  // Enhanced delete message function
  const handleDeleteMessage = (indexToDelete) => {
    console.log(`🗑️ Deleting message at index ${indexToDelete}`);
    const newHistory = chatHistory.filter((_, index) => index !== indexToDelete);
    
    // Always ensure greeting exists after deletion
    if (newHistory.length === 0 || !newHistory.some(msg => msg.isGreeting)) {
      const greeting = createGreeting();
      setChatHistory([greeting]);
      setTimeout(() => {
        localStorage.setItem('aiChat_history', JSON.stringify([greeting]));
      }, 100);
    } else {
      setChatHistory(newHistory);
    }
  };

  const formatDateTime = (date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const renderMessage = (content) => {
    const cleaned = content.replace(/\*\*/g, '');
    return cleaned;
  };

  // Mobile-responsive floating button when closed
  if (!isOpen) {
    console.log('🔍 Rendering floating button - should be visible now!');
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-14 w-14 sm:h-16 sm:w-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-2xl hover:shadow-3xl transition-all hover:scale-110 flex items-center justify-center group animate-bounce"
        style={{ animationDuration: '2s', zIndex: 99999 }}
      >
        <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 bg-red-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[99998] w-full sm:w-auto">
      <div className={`
        w-full sm:w-96 
        bg-white 
        rounded-none sm:rounded-3xl 
        shadow-2xl 
        border-0 sm:border-2 sm:border-purple-200 
        overflow-hidden 
        transition-all 
        flex flex-col 
        ${isMinimized ? 'h-16' : 'h-screen sm:h-[550px]'}
        max-h-screen
      `}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">AI Scheduler</h3>
              <p className="text-xs text-purple-200">Natural language booking</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? (
                <Maximize2 className="h-4 w-4 text-white" />
              ) : (
                <Minus className="h-4 w-4 text-white" />
              )}
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50">
              {chatHistory.length <= 1 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-3">
                    Try saying:
                  </p>
                  <div className="space-y-2">
                   {[
  "Book a meeting with john@email.com tomorrow at 2pm",
  "Find available times this week",
  "Show my bookings",
  "Send reminder to client@company.com"
].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setMessage(suggestion)}
                        className="block w-full text-left text-xs sm:text-sm p-2 sm:p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Enhanced Clear Buttons */}
              {chatHistory.length > 1 && (
                <div className="flex justify-center mb-4 gap-2 sm:gap-3 p-2 bg-gray-100 rounded-lg">
                  <button
                    onClick={handleClearChat}
                    className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 flex items-center gap-1 transition-colors px-3 py-2 rounded-lg border border-red-200"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear All Messages
                  </button>
                  <button
                    onClick={handleResetToGreeting}
                    className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-1 transition-colors px-3 py-2 rounded-lg border border-blue-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset Chat
                  </button>
                </div>
              )}

              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 relative ${
                    msg.role === 'user' 
                      ? 'bg-purple-600 text-white rounded-br-md' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
                  }`}>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap">{renderMessage(msg.content)}</p>
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                    
                    {/* Individual delete button - don't show for greeting */}
                    {i > 0 && !msg.isGreeting && (
                      <button
                        onClick={() => handleDeleteMessage(i)}
                        className={`absolute -top-2 -right-2 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs ${
                          msg.role === 'user' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-400 hover:bg-red-500 text-white'
                        }`}
                        title="Delete this message"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 shadow-sm">
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-purple-600" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Enhanced Pending Booking Confirmation with Multiple Attendees */}
{pendingBooking && (
  <div className="p-3 sm:p-4 bg-purple-50 border-t border-purple-200">
    <div className="bg-white rounded-xl p-3 sm:p-4 border-2 border-purple-300 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 text-sm sm:text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-purple-600" />
          Confirm Booking
        </h4>
        <button onClick={() => setPendingBooking(null)} className="text-gray-400 hover:text-red-500 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="space-y-3 text-sm mb-4">
        {/* Title */}
        <div className="flex items-center gap-2 text-gray-600">
          <FileText className="h-4 w-4 flex-shrink-0" />
          <input
            type="text"
            value={pendingBooking.title}
            onChange={(e) => setPendingBooking({...pendingBooking, title: e.target.value})}
            className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm focus:ring-1 focus:ring-purple-500"
            placeholder="Meeting title"
          />
        </div>
        
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <input
            type="date"
            value={pendingBooking.date}
            onChange={(e) => setPendingBooking({...pendingBooking, date: e.target.value})}
            className="bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm focus:ring-1 focus:ring-purple-500"
          />
          <input
            type="time"
            value={pendingBooking.time}
            onChange={(e) => setPendingBooking({...pendingBooking, time: e.target.value})}
            className="bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* Multiple Attendees */}
        <div className="text-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-medium">Attendees:</span>
          </div>
          <div className="space-y-2 pl-6">
            {(pendingBooking.attendees || [pendingBooking.attendee_email]).map((email, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    const newAttendees = [...(pendingBooking.attendees || [pendingBooking.attendee_email])];
                    newAttendees[index] = e.target.value;
                    setPendingBooking({
                      ...pendingBooking, 
                      attendees: newAttendees,
                      attendee_email: newAttendees[0] // Keep first as primary
                    });
                  }}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm focus:ring-1 focus:ring-purple-500"
                  placeholder="attendee@email.com"
                />
                {(pendingBooking.attendees?.length > 1 || index > 0) && (
                  <button
                    onClick={() => {
                      const newAttendees = (pendingBooking.attendees || [pendingBooking.attendee_email]).filter((_, i) => i !== index);
                      setPendingBooking({
                        ...pendingBooking, 
                        attendees: newAttendees,
                        attendee_email: newAttendees[0]
                      });
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const currentAttendees = pendingBooking.attendees || [pendingBooking.attendee_email];
                setPendingBooking({
                  ...pendingBooking, 
                  attendees: [...currentAttendees, '']
                });
              }}
              className="text-purple-600 hover:text-purple-700 text-sm flex items-center gap-1 mt-2"
            >
              + Add another attendee
            </button>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <select
            value={pendingBooking.duration}
            onChange={(e) => setPendingBooking({...pendingBooking, duration: parseInt(e.target.value)})}
            className="bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm focus:ring-1 focus:ring-purple-500"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleConfirmBooking}
          disabled={loading}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 sm:py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm sm:text-base"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" />Confirm</>}
        </button>
        <button
          onClick={handleCancelBooking}
          disabled={loading}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 sm:py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm sm:text-base"
        >
          <XCircle className="h-4 w-4" />Cancel
        </button>
      </div>
    </div>
  </div>
)}

            {/* Input */}
            <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Try: 'Book a call with...' "
                  className="flex-1 px-3 sm:px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !message.trim()}
                  className="p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl transition-colors"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}