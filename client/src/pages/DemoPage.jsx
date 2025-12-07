import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  Calendar,
  ArrowRight,
  Mic,
  X,
  Clock,
  CheckCircle,
  Zap,
  MessageSquare,
  Lock
} from 'lucide-react';

const DEMO_LIMIT = 3;

const examplePrompts = [
  "Book a meeting with john@example.com tomorrow at 2pm",
  "Schedule a 30-minute call with sarah@company.com next Monday",
  "Find me a free slot this Friday afternoon",
  "What's my availability this week?",
];

// Simulated AI responses for demo
const generateDemoResponse = (message) => {
  const lowerMsg = message.toLowerCase();
  
  // Booking intent
  if (lowerMsg.includes('book') || lowerMsg.includes('schedule') || lowerMsg.includes('meeting') || lowerMsg.includes('call')) {
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/i);
    const email = emailMatch ? emailMatch[0] : 'contact@example.com';
    
    // Extract time hints
    let timeStr = 'tomorrow at 2:00 PM';
    if (lowerMsg.includes('monday')) timeStr = 'Monday at 10:00 AM';
    else if (lowerMsg.includes('friday')) timeStr = 'Friday at 3:00 PM';
    else if (lowerMsg.includes('next week')) timeStr = 'next Tuesday at 11:00 AM';
    else if (lowerMsg.includes('3pm') || lowerMsg.includes('3 pm')) timeStr = 'tomorrow at 3:00 PM';
    else if (lowerMsg.includes('10am') || lowerMsg.includes('10 am')) timeStr = 'tomorrow at 10:00 AM';
    
    return {
      type: 'booking_confirmed',
      message: `✅ **Meeting Scheduled!**

I've booked a 30-minute meeting with **${email}** for **${timeStr}**.

📧 Confirmation emails sent to both parties
📅 Added to your calendar
🔗 Google Meet link: meet.google.com/abc-defg-hij

*In the full version, this would actually create the booking and send real invites!*`,
    };
  }
  
  // Availability check
  if (lowerMsg.includes('available') || lowerMsg.includes('availability') || lowerMsg.includes('free slot') || lowerMsg.includes('free time')) {
    return {
      type: 'availability',
      message: `📅 **Your Availability This Week:**

**Tomorrow:**
• 9:00 AM - 10:30 AM
• 2:00 PM - 5:00 PM

**Wednesday:**
• 10:00 AM - 12:00 PM
• 3:30 PM - 6:00 PM

**Thursday:**
• All day available

**Friday:**
• 9:00 AM - 11:00 AM
• 1:00 PM - 4:00 PM

Would you like me to book a specific slot?`,
    };
  }
  
  // Add attendee
  if (lowerMsg.includes('add') && (lowerMsg.includes('attendee') || lowerMsg.includes('@'))) {
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/i);
    const email = emailMatch ? emailMatch[0] : 'newperson@example.com';
    
    return {
      type: 'attendee_added',
      message: `✅ Done! I've added **${email}** to your meeting.

📧 Calendar invite sent to the new attendee.

Anyone else you'd like to add?`,
    };
  }
  
  // Reschedule
  if (lowerMsg.includes('reschedule') || lowerMsg.includes('move') || lowerMsg.includes('change time')) {
    return {
      type: 'reschedule',
      message: `🔄 **No problem!** 

I can reschedule your meeting. When would you like to move it to?

Just say something like "Move it to Thursday at 3pm" and I'll handle the rest.`,
    };
  }
  
  // Cancel
  if (lowerMsg.includes('cancel')) {
    return {
      type: 'cancel',
      message: `⚠️ **Cancel Meeting?**

I can cancel your upcoming meeting. Just confirm and I'll:
• Remove it from your calendar
• Notify all attendees
• Send cancellation emails

Would you like me to proceed?`,
    };
  }
  
  // Default helpful response
  return {
    type: 'help',
    message: `👋 Hey! I'm your AI scheduling assistant. Here's what I can do:

📅 **Book meetings** - "Book a call with john@email.com tomorrow at 2pm"
🔍 **Check availability** - "What's my schedule this week?"
👥 **Add attendees** - "Add sarah@company.com to my next meeting"
🔄 **Reschedule** - "Move my 2pm meeting to Thursday"
❌ **Cancel** - "Cancel my meeting with John"

Try one of these, or ask me anything!`,
  };
};

export default function DemoPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: `👋 **Welcome to the ScheduleSync Demo!**

I'm your AI scheduling assistant. Try asking me to:

• Book a meeting with someone
• Check your availability  
• Add an attendee to a meeting

You have **${DEMO_LIMIT} free queries** to try. Go ahead, ask me anything!`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    if (queriesUsed >= DEMO_LIMIT) {
      setShowUpgradePrompt(true);
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setQueriesUsed(prev => prev + 1);

    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const response = generateDemoResponse(userMessage.content);
    
    const assistantMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);

    // Show upgrade prompt after last query
    if (queriesUsed + 1 >= DEMO_LIMIT) {
      setTimeout(() => setShowUpgradePrompt(true), 2000);
    }
  };

  const handleExampleClick = (prompt) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const remainingQueries = DEMO_LIMIT - queriesUsed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold">ScheduleSync</span>
          </button>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-white/80">
                <span className="font-bold text-white">{remainingQueries}</span> queries left
              </span>
            </div>
            
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-bold hover:shadow-lg transition-all"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4">
        
        {/* Demo Badge */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Interactive Demo - No sign up required</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-thin scrollbar-thumb-white/10">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-sm'
                    : 'bg-white/10 backdrop-blur-sm text-white border border-white/10 rounded-bl-sm'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-white/60">AI Assistant</span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content.split('**').map((part, i) => 
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-bl-sm px-4 py-3 border border-white/10">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-xs text-white/50">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Example Prompts */}
        {messages.length <= 2 && !showUpgradePrompt && (
          <div className="mb-4">
            <p className="text-xs text-white/40 mb-2 text-center">Try one of these:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {examplePrompts.slice(0, 3).map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(prompt)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-white/70 hover:text-white transition-all"
                >
                  {prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upgrade Prompt Overlay */}
        {showUpgradePrompt && (
          <div className="mb-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">You've used all demo queries!</h3>
            <p className="text-white/60 mb-6 text-sm">
              Sign up free to get 10 AI queries/month, or upgrade for unlimited.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Sign Up Free
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full sm:w-auto px-6 py-3 bg-white/10 text-white rounded-full font-medium hover:bg-white/20 transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={showUpgradePrompt ? "Sign up to continue..." : "Try: 'Book a meeting with john@email.com tomorrow'"}
              disabled={showUpgradePrompt}
              className="flex-1 bg-transparent text-white placeholder:text-white/40 px-3 py-2 outline-none text-sm disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || showUpgradePrompt}
              className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          {/* Mobile queries counter */}
          <div className="sm:hidden flex justify-center mt-2">
            <span className="text-xs text-white/50">
              {remainingQueries} {remainingQueries === 1 ? 'query' : 'queries'} remaining
            </span>
          </div>
        </div>
      </div>

      {/* Features Footer */}
      <div className="border-t border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Real AI scheduling</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Google & Outlook sync</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Free forever plan</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}