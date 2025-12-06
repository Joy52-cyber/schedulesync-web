import { useState, useRef, useEffect } from 'react';
import { useUpgrade } from '../context/UpgradeContext';
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
  Link,
  Lock,
  Mic,
  MicOff
} from 'lucide-react';
import api from '../utils/api';

export default function AISchedulerChat() {
  console.log('🔥 AISchedulerChat component is rendering!');

  const { currentTier, hasProFeature, hasTeamFeature, loading: tierLoading } = useUpgrade();

  // Generate friendly, conversational greeting based on user's tier
  const getGreetingMessage = () => {
    const hour = new Date().getHours();
    let timeGreeting = "Hi there";
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 17) timeGreeting = "Good afternoon";
    else timeGreeting = "Good evening";

    let greeting = `${timeGreeting}! 👋

I'm your scheduling assistant, and I'm here to help make booking meetings a breeze.

Here's what I can do for you:

📅 **Bookings**
• Book meetings – just tell me who and when!
• Show your upcoming, confirmed, or past bookings
• Give you booking stats

🔗 **Links**
• Share your booking link
• Create one-time magic links (Pro)`;

    if (hasTeamFeature()) {
      greeting += `

🏢 **Teams**
• Schedule with your teams
• Get team booking links
• Find team member availability`;
    }

    if (hasProFeature()) {
      greeting += `

📧 **Emails**
• Send meeting reminders
• Draft follow-up emails`;
    }

    greeting += `

🎤 **Voice** – Tap the mic and just talk to me!

What can I help you with today?`;

    return greeting;
  };

  const createGreeting = () => ({
    role: 'assistant',
    content: getGreetingMessage(),
    timestamp: new Date(),
    isGreeting: true
  });

  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('aiChat_isOpen');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);

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
            (msg.role === 'assistant' && msg.content.includes("scheduling assistant"))
          );
          
          if (hasGreeting) {
            return mappedHistory;
          }
        }
      }
    } catch (e) {
      console.error('Error loading chat history:', e);
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(() => {
    const saved = localStorage.getItem('aiChat_pendingBooking');
    return saved ? JSON.parse(saved) : null;
  });

  // Voice input states
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
        setMessage(transcript);
        
        if (event.results[event.results.length - 1].isFinal) {
          setIsListening(false);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: "Oops! Looks like I don't have microphone access. Could you enable it in your browser settings? I'd love to hear from you! 🎤",
            timestamp: new Date()
          }]);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: "Unfortunately, voice input isn't supported in your browser. Try Chrome, Edge, or Safari for the best experience! In the meantime, feel free to type your request. 😊",
        timestamp: new Date()
      }]);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setMessage('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setIsListening(false);
      }
    }
  };

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

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const isUnlimited = usage.ai_queries_limit >= 1000;

  // Initialize greeting when tier loads
  useEffect(() => {
    if (!tierLoading && chatHistory.length === 0) {
      const greeting = createGreeting();
      setChatHistory([greeting]);
      localStorage.setItem('aiChat_history', JSON.stringify([greeting]));
    }
  }, [tierLoading]);

  // Update greeting if tier changes
  useEffect(() => {
    if (!tierLoading && chatHistory.length > 0) {
      const hasGreeting = chatHistory.some(msg => msg.isGreeting);
      if (!hasGreeting) {
        const greeting = createGreeting();
        setChatHistory(prev => [greeting, ...prev]);
      }
    }
  }, [currentTier, tierLoading]);

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

    // Stop listening if active
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    // Only block if NOT unlimited and at limit
    if (!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit) {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `Ah, looks like you've used all ${usage.ai_queries_limit} AI queries for this month! 😅\n\nNo worries though – upgrade to Pro and you'll get unlimited queries. I'll be here whenever you need me!\n\n[Upgrade to Pro](/billing)`,
        timestamp: new Date()
      }]);
      return;
    }

    const userMessage = message.trim();
    const lowerMessage = userMessage.toLowerCase();
    
    // Block team features for non-team users (friendly message)
    if (!hasTeamFeature() && (
      lowerMessage.includes('team') || 
      lowerMessage.includes('marketing team') ||
      lowerMessage.includes('sales team')
    )) {
      setChatHistory(prev => [...prev, 
        { role: 'user', content: userMessage, timestamp: new Date() },
        { 
          role: 'assistant', 
          content: `I'd love to help with team scheduling! 🏢\n\nThis is a Team plan feature ($25/month) that includes:\n• Unlimited teams\n• Round-robin & collective booking\n• Team booking links\n• Up to 10 team members\n\nWant to unlock it? [Check out the Team plan](/billing) – it's pretty awesome!`,
          timestamp: new Date()
        }
      ]);
      setMessage('');
      return;
    }

    // Block email features for free users (friendly message)
    if (!hasProFeature() && (
      lowerMessage.includes('send reminder') ||
      lowerMessage.includes('send email') ||
      lowerMessage.includes('email template')
    )) {
      setChatHistory(prev => [...prev, 
        { role: 'user', content: userMessage, timestamp: new Date() },
        { 
          role: 'assistant', 
          content: `Great idea to send emails! 📧\n\nEmail features are part of the Pro plan ($12/month). You'll get:\n• Custom email templates\n• AI-powered drafts\n• Automated reminders\n\n[Upgrade to Pro](/billing) and I'll help you send those emails!`,
          timestamp: new Date()
        }
      ]);
      setMessage('');
      return;
    }

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
          data: responseData.data
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
          data: responseData.data
        }]);
      } else {
        const aiMessage = responseData.message || responseData.response || 'Got it! Let me know if you need anything else.';
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: aiMessage,
          timestamp: new Date(),
          data: responseData.data,
          responseType: responseData.type
        }]);
      }

    } catch (error) {
      console.error('AI chat error:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: "Hmm, something went wrong on my end. Mind trying that again? 🙏",
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

      // Format date nicely
      const formattedDate = startDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = startDateTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const confirmMsg = `You're all set! ✅

I've booked your meeting:

📅 **${pendingBooking.title || 'Meeting'}**
🗓️ ${formattedDate} at ${formattedTime}
👥 ${allAttendees.join(', ')}${pendingBooking.team_name ? `\n🏢 ${pendingBooking.team_name}` : ''}

I've sent calendar invites to everyone. Is there anything else I can help you with?`;

      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: confirmMsg,
        timestamp: new Date(),
        isConfirmation: true
      }]);

      setPendingBooking(null);
      
    } catch (error) {
      console.error('❌ AI booking error:', error);
      console.error('❌ Error response:', error.response?.data);
      
      let errorMessage = "Oops, I couldn't create that booking. ";
      if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
      } else {
        errorMessage += "Want to try again?";
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
      content: "No problem, I've cancelled that. What else can I help you with?",
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

  const renderMessageContent = (msg) => {
    const content = renderMessage(msg.content);
    const data = msg.data;
    
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
    
    if (data?.teams && Array.isArray(data.teams) && data.teams.length > 0 && data.teams[0]?.url) {
      return (
        <>
          <p className="text-xs sm:text-sm whitespace-pre-wrap">{content}</p>
          <LinksGrid links={data.teams} labelKey="name" />
        </>
      );
    }
    
    if (data?.members && Array.isArray(data.members) && data.members.length > 0 && data.members[0]?.url) {
      return (
        <>
          <p className="text-xs sm:text-sm whitespace-pre-wrap">{content}</p>
          <LinksGrid links={data.members} labelKey="name" />
        </>
      );
    }
    
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
    
    return <p className="text-xs sm:text-sm whitespace-pre-wrap">{content}</p>;
  };

  // Conversational suggestions
  const getSuggestions = () => {
    const baseSuggestions = [
      "What's my booking link?",
      "Show my upcoming meetings",
      "How many bookings do I have?",
    ];

    if (hasProFeature()) {
      baseSuggestions.push("Create a magic link");
    }

    if (hasTeamFeature()) {
      baseSuggestions.push("Show my team links");
    }

    return baseSuggestions;
  };

  const suggestions = getSuggestions();

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
        ${isMinimized ? 'h-16' : 'h-[80vh] sm:h-[600px]'}
        max-h-screen
      `}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">AI Assistant</h3>
              <p className="text-xs text-purple-200">
                {speechSupported && <span className="mr-1">🎤</span>}
                {currentTier === 'free' ? 'Free' : currentTier === 'pro' ? 'Pro ⚡' : 'Team 🏢'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Usage display */}
            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
              <Zap className="h-3 w-3 text-yellow-300" />
              {usage.loading ? (
                <span className="text-xs text-white">...</span>
              ) : (
                <span className="text-xs text-white font-medium">
                  {isUnlimited ? '∞' : `${usage.ai_queries_used}/${usage.ai_queries_limit}`}
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
              
              {/* Usage warning - ONLY show for free users */}
              {!isUnlimited && (
                <div className={`rounded-lg p-4 mb-4 ${
                  usage.ai_queries_used >= usage.ai_queries_limit
                    ? 'bg-red-50 border-2 border-red-300'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      usage.ai_queries_used >= usage.ai_queries_limit
                        ? 'bg-red-100'
                        : 'bg-yellow-100'
                    }`}>
                      <Zap className={`h-5 w-5 ${
                        usage.ai_queries_used >= usage.ai_queries_limit
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }`} />
                    </div>
                    
                    <div className="flex-1">
                      <p className={`font-bold mb-2 ${
                        usage.ai_queries_used >= usage.ai_queries_limit
                          ? 'text-red-800 text-base'
                          : 'text-yellow-800 text-sm'
                      }`}>
                        {usage.ai_queries_used >= usage.ai_queries_limit
                          ? `You've used all ${usage.ai_queries_limit} queries`
                          : `${usage.ai_queries_limit - usage.ai_queries_used} queries left this month`
                        }
                      </p>
                      {usage.ai_queries_used >= usage.ai_queries_limit ? (
                        <div className="space-y-2">
                          <p className="text-sm text-red-700">
                            Upgrade to keep chatting!
                          </p>
                          <button
                            onClick={() => window.location.href = '/billing'}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-2 px-4 rounded-lg font-semibold text-sm transition-all"
                          >
                            Get Pro – $12/mo
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-yellow-700">
                          Go Pro for unlimited conversations!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions grid - ONLY show if NOT at limit */}
              {chatHistory.length <= 1 && (isUnlimited || usage.ai_queries_used < usage.ai_queries_limit) && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-3">Try asking:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setMessage(suggestion)}
                        className="text-left text-sm p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
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
                    Clear
                  </button>
                  <button
                    onClick={handleResetToGreeting}
                    className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-1 transition-colors px-3 py-2 rounded-lg border border-blue-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Start Over
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
                  <div className="bg-white rounded-2xl px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 shadow-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-purple-600" />
                    <span className="text-sm text-gray-500">Thinking...</span>
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
                      Ready to book?
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
                        <span className="text-sm font-medium">Who's joining?</span>
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
                          + Add someone else
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
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" />Book it!</>}
                    </button>
                    <button
                      onClick={handleCancelBooking}
                      disabled={loading}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 sm:py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm sm:text-base"
                    >
                      <XCircle className="h-4 w-4" />Never mind
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
              {/* Voice listening indicator */}
              {isListening && (
                <div className="mb-3 flex items-center gap-2 text-sm text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                  <span>I'm listening... speak now!</span>
                  <button 
                    onClick={toggleListening}
                    className="ml-auto text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    Stop
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isListening ? "Listening..." : "Type or tap 🎤 to speak..."}
                  className={`flex-1 px-3 sm:px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm ${
                    isListening ? 'border-purple-400 bg-purple-50' : 'border-gray-200'
                  }`}
                  disabled={loading || (!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit)}
                />
                
                {/* Microphone button */}
                <button
                  onClick={toggleListening}
                  disabled={loading || (!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit)}
                  className={`p-3 rounded-xl transition-all ${
                    isListening 
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' 
                      : speechSupported
                        ? 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
                
                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={loading || !message.trim() || (!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit)}
                  className="p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl transition-colors"
                  title={!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit ? 'Query limit reached' : 'Send'}
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