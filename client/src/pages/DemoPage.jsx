import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  Calendar,
  ArrowRight,
  Clock,
  CheckCircle,
  Zap,
  Lock
} from 'lucide-react';

const DEMO_LIMIT = 5;

const examplePrompts = [
  "Book a meeting with john@example.com tomorrow at 2pm",
  "Schedule a 30-minute call with sarah@company.com next Monday",
  "Find me a free slot this Friday afternoon",
  "What's my availability this week?",
];

// Simulated AI responses for demo
const generateDemoResponse = (message) => {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('book') || lowerMsg.includes('schedule') || lowerMsg.includes('meeting') || lowerMsg.includes('call')) {
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/i);
    const email = emailMatch ? emailMatch[0] : 'contact@example.com';
    
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
  
  if (lowerMsg.includes('reschedule') || lowerMsg.includes('move') || lowerMsg.includes('change time')) {
    return {
      type: 'rescheduled',
      message: `🔄 **Meeting Rescheduled!**

I've moved your meeting to **Thursday at 3:00 PM**.

📧 Updated invites sent to all attendees
📅 Calendar updated

Is there anything else you need?`,
    };
  }
  
  if (lowerMsg.includes('cancel')) {
    return {
      type: 'cancelled',
      message: `❌ **Meeting Cancelled**

I've cancelled the meeting and notified all attendees.

Would you like to reschedule for another time?`,
    };
  }
  
  if (lowerMsg.includes('link') || lowerMsg.includes('booking page') || lowerMsg.includes('share')) {
    return {
      type: 'link',
      message: `🔗 **Your Booking Links:**

**Main booking page:**
schedulesync.com/yourname

**30-min Quick Call:**
schedulesync.com/yourname/quick-call

**1-hour Consultation:**
schedulesync.com/yourname/consultation

Share these links and let people book directly on your calendar!`,
    };
  }
  
  return {
    type: 'general',
    message: `I can help you with:

📅 **Scheduling** - "Book a meeting with john@email.com tomorrow at 2pm"
🔍 **Availability** - "What's my availability this week?"
🔗 **Links** - "What's my booking link?"
🔄 **Changes** - "Reschedule my meeting to Friday"

Just tell me what you need in plain English!`,
  };
};

export default function DemoPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `👋 **Welcome to the ScheduleSync AI Demo!**

I'm your AI scheduling assistant. Try sending me a message!

**Try these:**
• "Book a meeting with john@example.com tomorrow at 2pm"
• "What's my availability this week?"
• "Create a booking link for Sarah"

This is a demo with simulated responses. Sign up to connect your real calendar!`,
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [demoCount, setDemoCount] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    if (demoCount >= DEMO_LIMIT) {
      setShowLimitModal(true);
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    setIsTyping(true);
    setDemoCount(prev => prev + 1);

    // Simulate typing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const response = generateDemoResponse(messageText);
    setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
    setIsTyping(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-40 right-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>
      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-sm bg-black/20 relative z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">ScheduleSync</span>
          </button>
          
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-sm hidden sm:block">
              {DEMO_LIMIT - demoCount} demo messages left
            </span>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-purple-500/25 transition-all"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 relative z-10">
        {/* Chat Container */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold">AI Scheduling Assistant</h2>
              <p className="text-white/50 text-xs flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Demo Mode • {DEMO_LIMIT - demoCount} messages remaining
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="h-[400px] sm:h-[450px] overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-white/10 text-white border border-white/10'
                }`}>
                  <div className="text-sm whitespace-pre-wrap">
                    {msg.content.split('**').map((part, i) => 
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/10">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-black/20">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                disabled={isTyping}
              />
              
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isTyping}
                className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Example Prompts */}
        <div className="mt-6">
          <p className="text-white/50 text-sm mb-3 text-center">Try these examples:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {examplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => setInput(prompt)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70 text-xs hover:bg-white/10 hover:text-white transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <Zap className="w-8 h-8 text-yellow-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Natural Language</h3>
            <p className="text-white/50 text-sm">Just type what you need - "Book a meeting with John tomorrow"</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <Calendar className="w-8 h-8 text-blue-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Smart Scheduling</h3>
            <p className="text-white/50 text-sm">AI finds the best times based on your calendar</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Instant Booking</h3>
            <p className="text-white/50 text-sm">Meetings created & invites sent automatically</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold text-lg hover:shadow-xl hover:shadow-purple-500/25 transition-all inline-flex items-center gap-2"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-white/40 text-sm mt-3">No credit card required • Connect your real calendar</p>
        </div>
      </div>

      {/* Limit Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Demo Limit Reached</h3>
              <p className="text-white/60 mb-6">
                You've used all {DEMO_LIMIT} demo messages. Sign up for free to get unlimited AI scheduling with your real calendar!
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/register')}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  Sign Up Free
                </button>
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="w-full px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
                >
                  Continue Browsing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}