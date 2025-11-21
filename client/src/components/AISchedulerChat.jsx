import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Minimize2 } from 'lucide-react';
import { aiScheduler } from '../utils/api';

export default function AISchedulerChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your AI Scheduling Assistant. I can help you find the best times for meetings, manage your bookings, and answer questions about your schedule.",
      timestamp: new Date()
    }
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async () => {
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
      const response = await aiScheduler.sendMessage(userMessage, chatHistory);
      const data = response.data;

      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: data.message,
        type: data.type,
        data: data,
        timestamp: new Date() 
      }]);
    } catch (error) {
      console.error('AI error:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.',
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
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.message,
        timestamp: new Date() 
      }]);
    } catch (error) {
      console.error('Confirmation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-16 w-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-2xl hover:shadow-3xl transition-all hover:scale-110 flex items-center justify-center group z-50 animate-bounce"
        style={{ animationDuration: '2s' }}
      >
        <Sparkles className="h-8 w-8 text-white group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`w-96 bg-white rounded-3xl shadow-2xl border-2 border-purple-200 overflow-hidden transition-all ${
        isMinimized ? 'h-16' : 'h-[600px]'
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold">AI Assistant</h3>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                <p className="text-white/90 text-xs">Online • Ready to help</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="h-[440px] overflow-y-auto p-4 bg-gradient-to-br from-gray-50 to-purple-50/30 space-y-4">
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-1 max-w-[75%]">
                    <div className={`p-3 rounded-2xl shadow-md ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-900 rounded-bl-sm border-2 border-purple-100'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      
                      {msg.type === 'confirmation' && msg.data?.bookingData && (
                        <button
                          onClick={() => handleConfirm(msg.data.bookingData)}
                          className="mt-3 w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl hover:shadow-xl transition-all text-sm font-bold flex items-center justify-center gap-2"
                        >
                          ✅ Confirm Booking
                        </button>
                      )}
                    </div>
                    <p className={`text-xs text-gray-500 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                  
                  {msg.role === 'user' && (
                    <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-md">
                      YOU
                    </div>
                  )}
                </div>
              ))}
              
              {loading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-md">
                    <Sparkles className="h-4 w-4 text-white animate-pulse" />
                  </div>
                  <div className="bg-white p-3 rounded-2xl rounded-bl-sm shadow-md border-2 border-purple-100">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm text-gray-600 font-medium">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-3 bg-white border-t-2 border-purple-100">
              <p className="text-xs font-bold text-gray-700 mb-2">Quick Actions:</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  'Show my bookings this week',
                  'Find time for a meeting',
                  'Check tomorrow\'s availability'
                ].map((action) => (
                  <button
                    key={action}
                    onClick={() => setMessage(action)}
                    className="px-3 py-1.5 text-xs font-semibold text-purple-600 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-purple-200 rounded-lg whitespace-nowrap transition-all hover:shadow-md"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t-2 border-purple-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1 px-4 py-3 border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-sm bg-gradient-to-r from-purple-50/50 to-pink-50/50"
                  disabled={loading}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={loading || !message.trim()}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl group"
                >
                  <Send className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                💡 Try: "Schedule a meeting with john@example.com tomorrow at 2pm"
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}