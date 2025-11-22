import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Minimize2 } from 'lucide-react';
import { aiScheduler } from '../utils/api';
import api from '../utils/api';

export default function AISchedulerChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      content:
        "Hi! I'm your AI Scheduling Assistant. I can help you find the best times for meetings, manage your bookings, and answer questions about your schedule.",
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage('');
    setChatHistory((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      },
    ]);
    setLoading(true);

    try {
      const response = await aiScheduler.sendMessage(userMessage, chatHistory);
      const data = response.data;

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          type: data.type,
          data,
          timestamp: new Date(),
        },
      ]);

      if (data.needsSlots) {
        await fetchAndShowSlots(data.searchParams);
      }
    } catch (error) {
      console.error('AI error:', error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAndShowSlots = async (searchParams) => {
    try {
      const linkResponse = await api.get('/my-booking-link');
      const bookingToken = linkResponse.data.bookingToken;

      const slotsResponse = await api.post(`/book/${bookingToken}/slots-with-status`, {
        duration: (searchParams && searchParams.duration_minutes) || 30,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      const allSlots = Object.values(slotsResponse.data.slots).flat();
      const availableSlots = allSlots
        .filter((slot) => slot.status === 'available')
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5);

      if (availableSlots.length === 0) {
        setChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              "I couldn't find any available slots in the next 7 days. Would you like to check a different time range?",
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const slotsList = availableSlots
        .map((slot, i) => {
          const start = new Date(slot.start);
          return `${i + 1}. **${start.toLocaleDateString()}** at **${start.toLocaleTimeString(
            'en-US',
            {
              hour: 'numeric',
              minute: '2-digit',
            }
          )}** (${slot.matchLabel})`;
        })
        .join('\n');

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Here are the best available times:\n\n${slotsList}\n\nWould you like to book one of these slots?`,
          type: 'slot_list',
          data: { slots: availableSlots },
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I had trouble checking your availability. Please try again.',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleConfirm = async (bookingData) => {
    setLoading(true);
    try {
      const response = await aiScheduler.confirmBooking(bookingData);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.data.message,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Confirmation error:', error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Failed to create booking. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // ───────── Floating button (closed) ─────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 h-16 w-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-2xl hover:shadow-3xl transition-all hover:scale-110 flex items-center justify-center group"
        style={{ zIndex: 99999 }}
      >
        <Sparkles className="h-8 w-8 text-white group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      </button>
    );
  }

  // ───────── Chat window (open) ─────────
  return (
    <div
      className="fixed inset-x-2 bottom-4 md:bottom-6 md:right-6 md:left-auto"
      style={{ zIndex: 99998 }}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl border-2 border-purple-200 overflow-hidden transition-all flex flex-col
          w-full md:w-96
          ${isMinimized ? 'h-14' : 'max-h-[55vh] md:max-h-[70vh]'}
        `}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 md:p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            {!isMinimized && (
              <div>
                <h3 className="text-white font-bold text-sm md:text-base">AI Assistant</h3>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                  <p className="text-white/90 text-[11px] md:text-xs">Online • Ready to help</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 md:p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <Minimize2 className="h-3 w-3 md:h-4 md:w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 md:p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-3 w-3 md:h-4 md:w-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gradient-to-br from-gray-50 to-purple-50/30 space-y-3 md:space-y-4">
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-2 md:gap-3 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-7 w-7 md:h-8 md:w-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                      <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-white" />
                    </div>
                  )}

                  <div className="flex flex-col gap-1 max-w-[78%]">
                    <div
                      className={`p-2.5 md:p-3 rounded-2xl shadow-md text-xs md:text-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 rounded-bl-sm border-2 border-purple-100'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>

                      {msg.type === 'confirmation' && msg.data && msg.data.bookingData && (
                        <button
                          onClick={() => handleConfirm(msg.data.bookingData)}
                          disabled={loading}
                          className="mt-2 w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-2 rounded-xl hover:shadow-xl transition-all text-xs md:text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          ✅ Confirm Booking
                        </button>
                      )}
                    </div>
                    <p
                      className={`text-[10px] md:text-xs text-gray-500 px-1 ${
                        msg.role === 'user' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>

                  {msg.role === 'user' && (
                    <div className="h-7 w-7 md:h-8 md:w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-[10px] md:text-xs flex-shrink-0 shadow-md">
                      YOU
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2 md:gap-3">
                  <div className="h-7 w-7 md:h-8 md:w-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-md">
                    <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-white animate-pulse" />
                  </div>
                  <div className="bg-white p-2.5 md:p-3 rounded-2xl rounded-bl-sm shadow-md border-2 border-purple-100">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 bg-purple-500 rounded-full animate-bounce" />
                        <div
                          className="h-1.5 w-1.5 bg-purple-500 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <div
                          className="h-1.5 w-1.5 bg-purple-500 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                      <span className="text-xs md:text-sm text-gray-600 font-medium">
                        Thinking...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick actions */}
            <div className="px-3 md:px-4 py-2.5 md:py-3 bg-white border-t-2 border-purple-100 flex-shrink-0">
              <p className="text-[10px] md:text-xs font-bold text-gray-700 mb-1.5">
                Quick Actions:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {['Show bookings', 'Find meeting time', 'Tomorrow availability'].map((action) => (
                  <button
                    key={action}
                    onClick={() => setMessage(action)}
                    className="px-3 py-1.5 text-[11px] md:text-xs font-semibold text-purple-600 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-purple-200 rounded-lg whitespace-nowrap transition-all hover:shadow-md flex-shrink-0"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="p-3 md:p-4 bg-white border-t-2 border-purple-200 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1 px-3 md:px-4 py-2.5 md:py-3 border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-xs md:text-sm bg-gradient-to-r from-purple-50/50 to-pink-50/50"
                  disabled={loading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !message.trim()}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl group flex-shrink-0"
                >
                  <Send className="h-4 w-4 md:h-5 md:w-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              <p className="text-[10px] md:text-xs text-gray-500 mt-1.5 md:mt-2 text-center">
                💡 Try: "Schedule meeting with john@example.com tomorrow"
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
