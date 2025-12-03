import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  Minus, 
  Loader2, 
  Calendar,
  Clock,
  User,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  Trash2
} from 'lucide-react';
import api from '../utils/api';

export default function AISchedulerChat() {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('aiChat_isOpen');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('aiChat_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert timestamp strings back to Date objects
      return parsed.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
    return [];
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

  // Parse AI response to detect booking confirmation
  const parseBookingFromResponse = (response) => {
    // Check if response contains booking confirmation pattern
    const hasConfirmation = response.includes('Ready to schedule') || 
                           response.includes('ready to book') ||
                           response.includes('Click confirm') ||
                           response.includes('confirm to create');
    
    if (!hasConfirmation) return null;

    // Extract booking details using regex
    const titleMatch = response.match(/[""]([^""]+)[""]\s+for/i) || response.match(/schedule\s+[""]?([^""]+)[""]?\s+for/i);
    const dateMatch = response.match(/for\s+(\d{4}-\d{2}-\d{2})/i) || response.match(/(\d{4}-\d{2}-\d{2})/);
    const timeMatch = response.match(/at\s+(\d{1,2}:\d{2})/i);
    const emailMatch = response.match(/Attendees?:\s*([^\s\n]+@[^\s\n]+)/i) || response.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const durationMatch = response.match(/Duration:\s*(\d+)\s*minutes?/i) || response.match(/(\d+)\s*minutes?/i);
    const notesMatch = response.match(/Notes:\s*(.+?)(?:\n|$)/i);

    if (dateMatch && timeMatch && emailMatch) {
      return {
        title: titleMatch ? titleMatch[1] : 'Meeting',
        date: dateMatch[1],
        time: timeMatch[1],
        attendee_email: emailMatch[1],
        duration: durationMatch ? parseInt(durationMatch[1]) : 30,
        notes: notesMatch && notesMatch[1] !== 'None' ? notesMatch[1] : ''
      };
    }

    return null;
  };

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
      const response = await api.ai.schedule(userMessage, chatHistory);
      const aiMessage = response.data.message || response.data.response || 'I understood your request.';
      
      // Check if AI is asking for confirmation
      const bookingData = parseBookingFromResponse(aiMessage);
      
      if (bookingData) {
        setPendingBooking(bookingData);
      }

      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: aiMessage,
        timestamp: new Date(),
        hasBooking: !!bookingData
      }]);
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
    setChatHistory([]);
    setPendingBooking(null);
    localStorage.removeItem('aiChat_history');
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
            {chatHistory.length > 0 && (
              <button 
                onClick={handleClearChat}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4 text-white" />
              </button>
            )}
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Minus className="h-4 w-4 text-white" />
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {chatHistory.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2">AI Scheduling Assistant</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Try saying:
                  </p>
                  <div className="space-y-2">
                    {[
                      "Book a meeting with john@email.com tomorrow at 2pm",
                      "Schedule a 1-hour call next Monday morning",
                      "Find me a slot this week for a team sync"
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
                      <FileText className="h-4 w-4" />
                      <span>{pendingBooking.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{pendingBooking.date} at {pendingBooking.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span>{pendingBooking.attendee_email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>{pendingBooking.duration} minutes</span>
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