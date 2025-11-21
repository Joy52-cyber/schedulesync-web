import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, User, Bot, Calendar, Clock } from 'lucide-react';
import { aiScheduler } from '../utils/api';

export default function AIScheduler() {
  const [messages, setMessages] = useState([
    { 
      from: 'ai', 
      text: "Hi! I'm your AI scheduling assistant. I can help you:\n\n• Schedule meetings with natural language\n• Check your availability\n• Reschedule or cancel bookings\n\nJust tell me what you need!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(m => [...m, { from: 'user', text: userMessage, timestamp: new Date() }]);
    setLoading(true);

    try {
      const response = await aiScheduler.sendMessage(userMessage, messages);
      const data = response.data;

      setMessages(m => [...m, { 
        from: 'ai', 
        text: data.message,
        type: data.type,
        data: data,
        timestamp: new Date()
      }]);

    } catch (error) {
      console.error('AI error:', error);
      setMessages(m => [...m, { 
        from: 'ai', 
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (bookingData) => {
    setLoading(true);
    try {
      const response = await aiScheduler.confirmBooking(bookingData);
      setMessages(m => [...m, { 
        from: 'ai', 
        text: response.data.message,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Confirmation error:', error);
      setMessages(m => [...m, { 
        from: 'ai', 
        text: 'Failed to create booking. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { text: 'Schedule meeting tomorrow at 2pm', icon: Calendar },
    { text: 'When am I free this week?', icon: Clock },
    { text: 'Show my upcoming bookings', icon: Calendar }
  ];

  return (
    <div className="flex flex-col h-[650px] bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-3xl shadow-2xl overflow-hidden border-4 border-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="h-7 w-7 text-purple-600" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-xl">AI Assistant</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <p className="text-white/90 text-sm">Online • Ready to help</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white/50 backdrop-blur-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.from === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
              msg.from === 'user' 
                ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                : 'bg-gradient-to-br from-purple-500 to-pink-600'
            }`}>
              {msg.from === 'user' ? (
                <User className="h-5 w-5 text-white" />
              ) : (
                <Bot className="h-5 w-5 text-white" />
              )}
            </div>

            {/* Message Bubble */}
            <div className={`flex flex-col max-w-[75%] ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-5 py-3 shadow-md ${
                msg.from === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-tr-sm' 
                  : 'bg-white border-2 border-purple-100 text-gray-900 rounded-tl-sm'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                
                {/* Confirmation button */}
                {msg.type === 'confirmation' && msg.data?.bookingData && (
                  <button
                    onClick={() => handleConfirm(msg.data.bookingData)}
                    className="mt-4 w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-3 rounded-xl hover:shadow-xl transition-all text-sm font-bold flex items-center justify-center gap-2 group"
                  >
                    <Calendar className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    Confirm Booking
                  </button>
                )}
              </div>
              <p className={`text-xs text-gray-500 mt-1 px-1 ${msg.from === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="bg-white border-2 border-purple-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-md">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <span className="text-sm text-gray-600 font-medium">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="px-6 py-3 bg-white/80 backdrop-blur-sm border-t-2 border-purple-100">
          <p className="text-xs font-bold text-gray-700 mb-2">Quick Actions:</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(action.text);
                  document.querySelector('input[type="text"]')?.focus();
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-2 border-purple-200 rounded-xl text-xs font-semibold text-gray-700 transition-all hover:shadow-md"
              >
                <action.icon className="h-3 w-3" />
                {action.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-6 bg-white border-t-2 border-purple-100">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type your scheduling request..."
            className="flex-1 px-5 py-4 border-2 border-purple-200 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-sm bg-gradient-to-r from-blue-50/50 to-purple-50/50"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white px-8 py-4 rounded-2xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center gap-2 group disabled:hover:shadow-lg"
          >
            <Send className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          💡 Try: "Schedule a 30-min meeting with john@example.com tomorrow at 2pm"
        </p>
      </div>
    </div>
  );
}