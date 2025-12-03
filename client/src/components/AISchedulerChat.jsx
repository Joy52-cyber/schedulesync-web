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
  Trash2
} from 'lucide-react';
import api from '../utils/api';

export default function AISchedulerChat() {
  const GREETING_MESSAGE = `Hi! I'm your AI scheduling assistant. I can help you:\n\n• Book meetings\n• Find available times\n• View your bookings\n\nWhat would you like to do?`;

  const createGreeting = () => ({
    role: 'assistant',
    content: GREETING_MESSAGE,
    timestamp: new Date()
  });

  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('aiChat_isOpen');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');

  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('aiChat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed || parsed.length === 0) {
          return [createGreeting()];
        }
        return parsed.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      } catch (e) {
        return [createGreeting()];
      }
    }
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

  // Ensure greeting exists (for users who had old localStorage)
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([createGreeting()]);
    }
  }, []);

  // Save chat history to localStorage
  useEffect(() => {
    localStorage.setItem('aiChat_history', JSON.stringify(chatHistory));
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
    
    // Add user message to chat
    setChatHistory(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      timestamp: new Date()
    }]);

    setLoading(true);
    try {
      // Include pending booking context if exists
      let contextMessage = userMessage;
      if (pendingBooking) {
        contextMessage = `[Current pending booking: "${pendingBooking.title}" on ${pendingBooking.date} at ${pendingBooking.time} for ${pendingBooking.duration} minutes with ${pendingBooking.attendee_email}]\n\nUser says: ${userMessage}`;
      }

      const response = await api.ai.schedule(contextMessage, chatHistory);
      const responseData = response.data;
      
      // Handle different response types
      if (responseData.type === 'update_pending' && responseData.data?.updatedBooking) {
        // Update the pending booking with new values
        setPendingBooking(responseData.data.updatedBooking);
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: responseData.message,
          timestamp: new Date()
        }]);
      } else if (responseData.type === 'confirmation' && responseData.data?.bookingData) {
        // New booking confirmation
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
        // Regular message (slots, list, clarify, etc.)
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

  const handleConfirmBooking = async () => {
    if (!pendingBooking) return;

    setLoading(true);
    try {
      // Create the booking
      const startDateTime = new Date(`${pendingBooking.date}T${pendingBooking.time}`);
      const endDateTime = new Date(startDateTime.getTime() + pendingBooking.duration * 60000);

      const response = await api.post('/chatgpt/book-meeting', {
        title: pendingBooking.title,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        attendee_email: pendingBooking.attendee_email,
        attendee_name: pendingBooking.attendee_email.split('@')[0],
        notes: pendingBooking.notes
      });

      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `✅ **Booking Confirmed!**\n\n📅 ${pendingBooking.title}\n🕐 ${formatDateTime(startDateTime)}\n👤 ${pendingBooking.attendee_email}\n\nConfirmation email sent!`,
        timestamp: new Date(),
        isConfirmation: true
      }]);

      setPendingBooking(null);
    } catch (error) {
      console.error('Booking confirmation error:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: '❌ Failed to create booking. Please try again or check availability.',
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

  const handleClearChat = () => {
    setChatHistory([createGreeting()]);
    setPendingBooking(null);
    localStorage.removeItem('aiChat_pendingBooking');
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

  // Clean up AI response - remove markdown symbols
  const renderMessage = (content) => {
    // Remove ** markers entirely
    const cleaned = content.replace(/\*\*/g, '');
    return cleaned;
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-16 w-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-2xl hover:shadow-3xl transition-all hover:scale-110 flex items-center justify-center group animate-bounce"
        style={{ animationDuration: '2s', zIndex: 99999 }}
      >
        <Sparkles className="h-8 w-8 text-white group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6" style={{ zIndex: 99998 }}>
      <div className={`w-96 bg-white rounded-3xl shadow-2xl border-2 border-purple-200 overflow-hidden transition-all flex flex-col ${
        isMinimized ? 'h-16' : 'h-[550px]'
      }`}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">AI Scheduler</h3>
              <p className="text-xs text-purple-200">Natural language booking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {chatHistory.length <= 1 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-3">
                    Try saying:
                  </p>
                  <div className="space-y-2">
                    {[
                      "Book a meeting with john@email.com tomorrow at 2pm",
                      "Find available times this week",
                      "Show my bookings"
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setMessage(suggestion)}
                        className="block w-full text-left text-sm p-2 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatHistory.length > 1 && (
                <div className="flex justify-center mb-2">
                  <button
                    onClick={handleClearChat}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear conversation
                  </button>
                </div>
              )}

              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user' 
                      ? 'bg-purple-600 text-white rounded-br-md' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{renderMessage(msg.content)}</p>
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Pending Booking Confirmation */}
            {pendingBooking && (
              <div className="p-4 bg-purple-50 border-t border-purple-200">
                <div className="bg-white rounded-xl p-4 border-2 border-purple-300 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    Confirm Booking
                  </h4>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <input
                        type="text"
                        value={pendingBooking.title}
                        onChange={(e) => setPendingBooking({...pendingBooking, title: e.target.value})}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <input
                        type="date"
                        value={pendingBooking.date}
                        onChange={(e) => setPendingBooking({...pendingBooking, date: e.target.value})}
                        className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-purple-500"
                      />
                      <input
                        type="time"
                        value={pendingBooking.time}
                        onChange={(e) => setPendingBooking({...pendingBooking, time: e.target.value})}
                        className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <input
                        type="email"
                        value={pendingBooking.attendee_email}
                        onChange={(e) => setPendingBooking({...pendingBooking, attendee_email: e.target.value})}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <select
                        value={pendingBooking.duration}
                        onChange={(e) => setPendingBooking({...pendingBooking, duration: parseInt(e.target.value)})}
                        className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-purple-500"
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
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Confirm
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelBooking}
                      disabled={loading}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Try: 'Book a call with...' "
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
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