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
  RotateCcw,
  Zap,
  Copy, 
  Check, 
  Link
} from 'lucide-react';
import api from '../utils/api';

export default function AISchedulerChat() {
  console.log('🔥 AISchedulerChat component is rendering!');

  const GREETING_MESSAGE = `👋 Hi! I'm your AI scheduling assistant.

I can help you with:

📅 Bookings
- "Book meeting with john@email.com tomorrow 2pm"
- "Show my confirmed/cancelled/rescheduled bookings"
- "How many bookings this month?" (stats)

🔗 Links
- "Get my booking link"
- "Create magic link for John"
- "Show team links"
- "Get Sarah's booking link"

📋 Event Types
- "What are my event types?"
- "Show my consultation event"

🏢 Teams
- "Schedule with Marketing team"
- "Find available times this week"

📧 Emails
- "Send reminder to client@company.com"

What would you like to do?`;

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
  const [copiedUrl, setCopiedUrl] = useState(null); // ✅ NEW: Track copied URL

  const [usage, setUsage] = useState({
    ai_queries_used: 0,
    ai_queries_limit: 10,
    loading: true
  });

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

  const fetchUsage = async () => {
    try {
      console.log('📊 Fetching AI usage...');
      const response = await api.get('/user/usage');
      console.log('📊 Usage response:', response.data);
      
      setUsage({
        ai_queries_used: response.data.ai_queries_used || 0,
        ai_queries_limit: response.data.ai_queries_limit || 10,
        loading: false
      });
    } catch (error) {
      console.error('❌ Failed to fetch usage:', error);
      setUsage({
        ai_queries_used: 0,
        ai_queries_limit: 10,
        loading: false
      });
    }
  };

  // ✅ NEW: Copy link handler
  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  useEffect(() => {
    setTimeout(() => {
      if (chatHistory.length === 0) {
        const greeting = createGreeting();
        setChatHistory([greeting]);
        localStorage.setItem('aiChat_history', JSON.stringify([greeting]));
      }
    }, 200);
  }, []);

  useEffect(() => {
    const hasGreeting = chatHistory.some(msg => 
      msg.isGreeting || 
      (msg.role === 'assistant' && msg.content.includes("Hi! I'm your AI scheduling assistant"))
    );
    
    if (chatHistory.length === 0 || !hasGreeting) {
      const greeting = createGreeting();
      setChatHistory([greeting]);
    }
  }, [chatHistory]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('aiChat_history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  useEffect(() => {
    if (pendingBooking) {
      localStorage.setItem('aiChat_pendingBooking', JSON.stringify(pendingBooking));
    } else {
      localStorage.removeItem('aiChat_pendingBooking');
    }
  }, [pendingBooking]);

  useEffect(() => {
    localStorage.setItem('aiChat_isOpen', JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    if (isOpen) {
      fetchUsage();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    if (usage.ai_queries_used >= usage.ai_queries_limit) {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ You've reached your AI query limit (${usage.ai_queries_limit}). Please upgrade your plan to continue using AI features.`,
        timestamp: new Date()
      }]);
      return;
    }

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

      console.log('📤 Sending AI request:', contextMessage);

      const response = await api.ai.schedule(contextMessage, chatHistory);
      const responseData = response.data;
      
      console.log('📥 AI response received:', responseData);

      if (responseData.usage) {
        console.log('✅ Updating usage state:', responseData.usage);
        setUsage(prev => ({
          ...prev,
          ai_queries_used: responseData.usage.ai_queries_used,
          ai_queries_limit: responseData.usage.ai_queries_limit
        }));
      }

      if (responseData.type === 'update_pending' && responseData.data?.updatedBooking) {
        setPendingBooking(responseData.data.updatedBooking);
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: responseData.message,
          timestamp: new Date(),
          data: responseData.data // ✅ Store data for link rendering
        }]);
      } else if (responseData.type === 'confirmation' && responseData.data?.bookingData) {
        const bookingData = responseData.data.bookingData;
        setPendingBooking({
          title: bookingData.title || 'Meeting',
          date: bookingData.date,
          time: bookingData.time,
          attendees: bookingData.attendees || [bookingData.attendee_email],
          attendee_email: bookingData.attendee_email || bookingData.attendees?.[0],
          duration: bookingData.duration || 30,
          notes: bookingData.notes || '',
          team_id: bookingData.team_id || null,
          team_name: bookingData.team_name || null
        });
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: responseData.message,
          timestamp: new Date(),
          data: responseData.data // ✅ Store data for link rendering
        }]);
      } else {
        const aiMessage = responseData.message || responseData.response || 'I understood your request.';
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: aiMessage,
          timestamp: new Date(),
          data: responseData.data, // ✅ Store data for link rendering
          responseType: responseData.type // ✅ Store type for conditional rendering
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
      const startDateTime = new Date(`${pendingBooking.date}T${pendingBooking.time}`);
      const endDateTime = new Date(startDateTime.getTime() + pendingBooking.duration * 60000);
      const allAttendees = pendingBooking.attendees || [pendingBooking.attendee_email];

      const bookingData = {
        title: pendingBooking.title || 'Meeting',
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        attendees: allAttendees,
        attendee_email: allAttendees[0],
        attendee_name: allAttendees[0].split('@')[0],
        notes: pendingBooking.notes || '',
        team_id: pendingBooking.team_id || null
      };

      console.log('📤 Sending AI booking request:', bookingData);

      const response = await api.post('/chatgpt/book-meeting', bookingData);

      console.log('✅ AI booking response:', response.data);

      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `✅ Booking Confirmed!\n\n📅 ${pendingBooking.title || 'Meeting'}\n🕐 ${formatDateTime(startDateTime)}\n👤 ${allAttendees.join(', ')}${pendingBooking.team_name ? `\n🏢 Team: ${pendingBooking.team_name}` : ''}\n\nConfirmation emails sent!`,
        timestamp: new Date(),
        isConfirmation: true
      }]);

      setPendingBooking(null);
      
    } catch (error) {
      console.error('❌ AI booking error:', error);
      console.error('❌ Error response:', error.response?.data);
      
      let errorMessage = '❌ Failed to create booking. ';
      if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
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

  const handleClearChat = () => {
    const newGreeting = createGreeting();
    setChatHistory([newGreeting]);
    setPendingBooking(null);
    localStorage.removeItem('aiChat_pendingBooking');
    setTimeout(() => {
      localStorage.setItem('aiChat_history', JSON.stringify([newGreeting]));
    }, 100);
  };

  const handleResetToGreeting = () => {
    const newGreeting = createGreeting();
    setChatHistory([newGreeting]);
    setPendingBooking(null);
    localStorage.removeItem('aiChat_pendingBooking');
    setTimeout(() => {
      localStorage.setItem('aiChat_history', JSON.stringify([newGreeting]));
    }, 100);
  };

  const handleDeleteMessage = (indexToDelete) => {
    const newHistory = chatHistory.filter((_, index) => index !== indexToDelete);
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
    return content.replace(/\*\*/g, '');
  };

  // ✅ NEW: Link with copy button component
  const LinkWithCopy = ({ url, label }) => (
    <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2 mt-2">
      <Link className="h-4 w-4 text-purple-600 flex-shrink-0" />
      <span className="text-xs text-purple-700 truncate flex-1 font-mono">{label || url}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleCopyLink(url);
        }}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-all flex-shrink-0 ${
          copiedUrl === url 
            ? 'bg-green-500 text-white' 
            : 'bg-purple-600 text-white hover:bg-purple-700'
        }`}
      >
        {copiedUrl === url ? (
          <>
            <Check className="h-3 w-3" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );

  // ✅ NEW: Multiple links grid component
  const LinksGrid = ({ links, labelKey = 'name' }) => (
    <div className="space-y-2 mt-3">
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{link[labelKey] || link.title || link.name}</p>
            <p className="text-xs text-gray-500 font-mono truncate">{link.short_url || `/book/...`}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLink(link.url);
            }}
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded transition-all flex-shrink-0 ${
              copiedUrl === link.url 
                ? 'bg-green-500 text-white' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {copiedUrl === link.url ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  );

  // ✅ NEW: Render message content with links
  const renderMessageContent = (msg) => {
    const content = renderMessage(msg.content);
    const data = msg.data;
    
    // Single link responses (personal, magic, member)
    if (data?.url && data?.type) {
      const shortLabel = data.short_url || 
        (data.type === 'magic' ? `/m/${data.token?.substring(0, 8)}...` : 
         `/book/${data.token?.substring(0, 8) || '...'}...`);
      
      return (
        <>
          <p className="text-xs sm:text-sm whitespace-pre-wrap">{content}</p>
          <LinkWithCopy url={data.url} label={shortLabel} />
        </>
      );
    }
    
    // Team links (multiple)
    if (data?.teams && Array.isArray(data.teams) && data.teams.length > 0 && data.teams[0]?.url) {
      return (
        <>
          <p className="text-xs sm:text-sm whitespace-pre-wrap">{content}</p>
          <LinksGrid links={data.teams} labelKey="name" />
        </>
      );
    }
    
    // Member links (multiple)
    if (data?.members && Array.isArray(data.members) && data.members.length > 0 && data.members[0]?.url) {
      return (
        <>
          <p className="text-xs sm:text-sm whitespace-pre-wrap">{content}</p>
          <LinksGrid links={data.members} labelKey="name" />
        </>
      );
    }
    
    // Event types with links
    if (data?.event_types && Array.isArray(data.event_types) && data.event_types.length > 0 && data.event_types[0]?.booking_url) {
      const linksWithUrl = data.event_types.map(et => ({
        ...et,
        url: et.booking_url,
        short_url: `/${data.username}/${et.slug}`
      }));
      return (
        <>
          <p className="text-xs sm:text-sm whitespace-pre-wrap">{content}</p>
          <LinksGrid links={linksWithUrl} labelKey="title" />
        </>
      );
    }
    
    // Default text
    return <p className="text-xs sm:text-sm whitespace-pre-wrap">{content}</p>;
  };

  const suggestions = [
    "Get my booking link",
    "What are my event types?",
    "Show confirmed bookings",
    "Create magic link for VIP",
    "How many bookings this month?",
    "Show team links"
  ];

  if (!isOpen) {
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
        ${isMinimized ? 'h-16' : 'h-screen sm:h-[600px]'}
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

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
              <Zap className="h-3 w-3 text-yellow-300" />
              {usage.loading ? (
                <span className="text-xs text-white">...</span>
              ) : (
                <span className="text-xs text-white font-medium">
                  {usage.ai_queries_used}/{usage.ai_queries_limit}
                </span>
              )}
            </div>
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
              {/* Usage warning when near limit */}
              {!usage.loading && usage.ai_queries_used >= usage.ai_queries_limit - 1 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-700 font-medium">
                      {usage.ai_queries_used >= usage.ai_queries_limit 
                        ? `You've reached your AI query limit (${usage.ai_queries_limit})`
                        : `Only ${usage.ai_queries_limit - usage.ai_queries_used} AI query remaining`
                      }
                    </span>
                  </div>
                  {usage.ai_queries_used >= usage.ai_queries_limit && (
                    <p className="text-xs text-yellow-600 mt-1">
                      Upgrade your plan to continue using AI features.
                    </p>
                  )}
                </div>
              )}

              {/* Suggestions grid */}
              {chatHistory.length <= 1 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-3">Try saying:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setMessage(suggestion)}
                        className="text-left text-xs p-2 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatHistory.length > 1 && (
                <div className="flex justify-center mb-4 gap-2 sm:gap-3 p-2 bg-gray-100 rounded-lg">
                  <button
                    onClick={handleClearChat}
                    className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 flex items-center gap-1 transition-colors px-3 py-2 rounded-lg border border-red-200"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear All
                  </button>
                  <button
                    onClick={handleResetToGreeting}
                    className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-1 transition-colors px-3 py-2 rounded-lg border border-blue-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
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
                    {/* ✅ UPDATED: Use renderMessageContent for assistant messages */}
                    {msg.role === 'user' ? (
                      <p className="text-xs sm:text-sm whitespace-pre-wrap">{renderMessage(msg.content)}</p>
                    ) : (
                      renderMessageContent(msg)
                    )}
                    
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                    
                    {i > 0 && !msg.isGreeting && (
                      <button
                        onClick={() => handleDeleteMessage(i)}
                        className={`absolute -top-2 -right-2 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs ${
                          msg.role === 'user' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-400 hover:bg-red-500 text-white'
                        }`}
                        title="Delete"
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

            {/* Pending Booking */}
            {pendingBooking && (
              <div className="p-3 sm:p-4 bg-purple-50 border-t border-purple-200">
                <div className="bg-white rounded-xl p-3 sm:p-4 border-2 border-purple-300 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800 text-sm sm:text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      Confirm Booking
                      {pendingBooking.team_name && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {pendingBooking.team_name}
                        </span>
                      )}
                    </h4>
                    <button onClick={() => setPendingBooking(null)} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-sm mb-4">
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
                                  attendee_email: newAttendees[0]
                                });
                              }}
                              className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm focus:ring-1 focus:ring-purple-500"
                              placeholder="attendee@email.com"
                            />
                            {(pendingBooking.attendees?.length > 1) && (
                              <button
                                onClick={() => {
                                  const newAttendees = (pendingBooking.attendees || []).filter((_, i) => i !== index);
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
                  placeholder="Try: 'Get my booking link' "
                  className="flex-1 px-3 sm:px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  disabled={loading || (usage.ai_queries_used >= usage.ai_queries_limit)}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !message.trim() || (usage.ai_queries_used >= usage.ai_queries_limit)}
                  className="p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl transition-colors"
                  title={usage.ai_queries_used >= usage.ai_queries_limit ? 'AI query limit reached' : 'Send message'}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}