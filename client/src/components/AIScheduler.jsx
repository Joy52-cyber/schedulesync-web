import { useState } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { aiScheduler } from '../utils/api';

export default function AIScheduler() {
  const [messages, setMessages] = useState([
    { 
      from: 'ai', 
      text: '👋 Hi! I can help you schedule meetings. Try saying:\n\n"Schedule a meeting with john@example.com tomorrow at 2pm"\n\nor\n\n"When am I free this week?"'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(m => [...m, { from: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const response = await aiScheduler.sendMessage(userMessage, messages);
      const data = response.data;

      setMessages(m => [...m, { 
        from: 'ai', 
        text: data.message,
        type: data.type,
        data: data
      }]);

    } catch (error) {
      console.error('AI error:', error);
      setMessages(m => [...m, { 
        from: 'ai', 
        text: 'Sorry, I encountered an error. Please try again.'
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
        text: response.data.message 
      }]);
    } catch (error) {
      console.error('Confirmation error:', error);
      setMessages(m => [...m, { 
        from: 'ai', 
        text: 'Failed to create booking. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-2xl shadow-xl border-2 border-gray-100">
      {/* Header */}
      <div className="p-4 border-b-2 border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">AI Scheduling Assistant</h3>
            <p className="text-xs text-gray-600">Natural language scheduling</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.from === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-900'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              
              {/* Confirmation button */}
              {msg.type === 'confirmation' && msg.data?.bookingData && (
                <button
                  onClick={() => handleConfirm(msg.data.bookingData)}
                  className="mt-3 w-full bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors text-sm font-semibold"
                >
                  ✅ Confirm Booking
                </button>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t-2 border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Schedule a meeting with..."
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}