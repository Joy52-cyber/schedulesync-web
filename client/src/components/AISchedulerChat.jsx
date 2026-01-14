import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  Globe,
  Users
} from 'lucide-react';
import api from '../utils/api';

export default function AISchedulerChat() {
  console.log('🔥 AISchedulerChat component is rendering!');

  // Get current page location for context-aware suggestions
  const location = useLocation();

  // Use global UpgradeContext - this syncs with Dashboard
  const {
    currentTier,
    hasProFeature,
    hasTeamFeature,
    loading: tierLoading,
    refreshUsage,
    usage: globalUsage
  } = useUpgrade();

  // User name for personalized greeting
  const [userName, setUserName] = useState('');

  // Derive usage from global context (syncs with Dashboard automatically)
  const usage = {
    ai_queries_used: globalUsage?.ai_queries_used ?? 0,
    ai_queries_limit: globalUsage?.ai_queries_limit ?? 10,
    loading: tierLoading
  };

  const isUnlimited = (usage.ai_queries_limit ?? 0) >= 1000;

  // Timezone state
  const [currentTimezone, setCurrentTimezone] = useState('');

  const commonTimezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Manila', label: 'Manila (PHT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZDT)' },
  ];

  const getTimezoneLabel = (tz) => {
    const found = commonTimezones.find(t => t.value === tz);
    return found ? found.label : tz;
  };

  // Page context-aware suggestions
  const getPageContextSuggestions = () => {
    const path = location.pathname;

    if (path === '/dashboard' || path === '/') {
      return [
        { action: 'today', label: "Today's meetings", icon: Calendar, color: 'blue' },
        { action: 'analytics', label: 'Quick stats', icon: FileText, color: 'green' },
        { action: 'link', label: 'Booking Link', icon: Link, color: 'purple' },
        ...(hasProFeature() ? [{ action: 'quick', label: 'Quick Link', icon: Sparkles, color: 'pink' }] : []),
        ...(hasTeamFeature() ? [{ action: 'teams', label: 'Team Links', icon: Users, color: 'orange' }] : [])
      ];
    }

    if (path === '/bookings') {
      return [
        { action: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'blue' },
        { action: 'reschedule', label: 'Reschedule', icon: Clock, color: 'green' },
        { action: 'analytics', label: 'Stats', icon: FileText, color: 'purple' },
        { action: 'link', label: 'My link', icon: Link, color: 'pink' }
      ];
    }

    if (path === '/links' || path === '/my-links') {
      return [
        { action: 'link', label: 'Copy my link', icon: Link, color: 'purple' },
        ...(hasProFeature() ? [{ action: 'quick', label: 'Create Quick Link', icon: Sparkles, color: 'pink' }] : []),
        { action: 'share', label: 'Share tips', icon: Send, color: 'blue' },
        { action: 'event_types', label: 'Event types', icon: Calendar, color: 'green' }
      ];
    }

    if (path === '/event-types') {
      return [
        { action: 'event_types', label: 'List events', icon: Calendar, color: 'blue' },
        { action: 'create_event', label: 'Create new', icon: Sparkles, color: 'purple' },
        { action: 'link', label: 'My link', icon: Link, color: 'green' }
      ];
    }

    if (path === '/schedule' || path === '/calendar') {
      return [
        { action: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'blue' },
        { action: 'book', label: 'Book meeting', icon: Calendar, color: 'green' },
        { action: 'availability', label: 'My availability', icon: Clock, color: 'purple' }
      ];
    }

    if (path === '/settings') {
      return [
        { action: 'timezone', label: 'Timezone', icon: Globe, color: 'green' },
        { action: 'availability', label: 'Availability', icon: Clock, color: 'blue' },
        { action: 'link', label: 'Booking Link', icon: Link, color: 'purple' }
      ];
    }

    if (path === '/rules' || path === '/smart-rules') {
      return [
        { action: 'list_rules', label: 'My rules', icon: FileText, color: 'blue' },
        { action: 'create_rule', label: 'Create rule', icon: Sparkles, color: 'purple' },
        { action: 'block_friday', label: 'Block Friday', icon: Calendar, color: 'pink' },
        { action: 'add_buffer', label: 'Add buffer', icon: Clock, color: 'green' }
      ];
    }

    if (path === '/templates') {
      return [
        { action: 'list_templates', label: 'My templates', icon: Mail, color: 'blue' },
        { action: 'create_template', label: 'Create template', icon: Sparkles, color: 'purple' },
        { action: 'link', label: 'My link', icon: Link, color: 'green' }
      ];
    }

    if (path === '/email-analyzer') {
      return [
        { action: 'email_help', label: 'How it works', icon: Mail, color: 'blue' },
        { action: 'link', label: 'My booking link', icon: Link, color: 'purple' }
      ];
    }

    if (path === '/teams' || path.startsWith('/team')) {
      return [
        { action: 'teams', label: 'Team Links', icon: Users, color: 'orange' },
        { action: 'team_stats', label: 'Team stats', icon: FileText, color: 'blue' },
        { action: 'team_help', label: 'Team features', icon: Sparkles, color: 'purple' }
      ];
    }

    if (path === '/billing') {
      return [
        { action: 'plan_info', label: 'Compare plans', icon: FileText, color: 'purple' },
        { action: 'link', label: 'Booking Link', icon: Link, color: 'blue' }
      ];
    }

    // Default suggestions
    return [
      { action: 'book', label: 'Book meeting', icon: Calendar, color: 'blue' },
      { action: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'green' },
      { action: 'analytics', label: 'Stats', icon: FileText, color: 'purple' },
      { action: 'link', label: 'My link', icon: Link, color: 'pink' }
    ];
  };

  const getPageName = (path) => {
    if (path.includes('/dashboard') || path === '/') return 'Dashboard';
    if (path.includes('/bookings')) return 'Bookings';
    if (path.includes('/event-types')) return 'Event Types';
    if (path.includes('/teams')) return 'Teams';
    if (path.includes('/rules') || path.includes('/smart-rules')) return 'Smart Rules';
    if (path.includes('/my-links') || path.includes('/links')) return 'Booking Links';
    if (path.includes('/templates')) return 'Templates';
    if (path.includes('/settings')) return 'Settings';
    if (path.includes('/billing')) return 'Billing';
    if (path.includes('/email-analyzer')) return 'Email Analyzer';
    return null;
  };

  const getGreetingMessage = (name = '') => {
    const hour = new Date().getHours();
    let timeGreeting = "Hi";
    if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
    else if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    else if (hour >= 17 && hour < 22) timeGreeting = "Good evening";

    const firstName = name ? name.split(' ')[0] : '';
    const greeting = firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;

    const pageName = getPageName(location.pathname);
    let contextHint = '';
    if (pageName) {
      contextHint = `\n\nI see you're on the ${pageName} page. `;
    }

    return `${greeting}! 👋 I'm your scheduling assistant.${contextHint}

I can help you book meetings, share your links, check your schedule, and more.

What would you like to do?`;
  };

  const createGreeting = (name = '') => ({
    role: 'assistant',
    content: getGreetingMessage(name || userName),
    timestamp: new Date(),
    isGreeting: true
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [showTimezoneSelector, setShowTimezoneSelector] = useState(false);

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
  const [isTyping, setIsTyping] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(() => {
    const saved = localStorage.getItem('aiChat_pendingBooking');
    return saved ? JSON.parse(saved) : null;
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchTimezone = async () => {
    try {
      const response = await api.timezone.get();
      let tz = '';
      if (typeof response.data === 'string') {
        try {
          const parsed = JSON.parse(response.data);
          tz = parsed.timezone || response.data;
        } catch {
          tz = response.data;
        }
      } else if (response.data && typeof response.data === 'object') {
        tz = response.data.timezone || '';
      }
      setCurrentTimezone(tz);
    } catch (error) {
      console.error('Failed to fetch timezone:', error);
    }
  };

  const fetchUserName = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data?.name) {
        setUserName(response.data.name);
        // Update greeting if chat just started
        if (chatHistory.length <= 1 && chatHistory[0]?.isGreeting) {
          const newGreeting = createGreeting(response.data.name);
          setChatHistory([newGreeting]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user name:', error);
    }
  };

  const handleTimezoneChange = async (newTimezone) => {
    setLoading(true);
    try {
      await api.timezone.update(newTimezone);
      setCurrentTimezone(newTimezone);
      setShowTimezoneSelector(false);
      
      const tzLabel = getTimezoneLabel(newTimezone);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `✅ Done! Your timezone has been updated to **${tzLabel}** (${newTimezone}).\n\nAll your bookings and availability will now use this timezone. 🌍`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Failed to update timezone:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Oops, I couldn't update your timezone. Please try again or go to Settings to change it manually.`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleQuickAction = (action) => {
    const actions = {
      'link': "What's my booking link?",
      'quick': 'Create a quick link',
      'upcoming': 'Show my upcoming meetings',
      'today': "What meetings do I have today?",
      'timezone': 'Change my timezone',
      'teams': 'Show my team links',
      'share': 'How should I share my booking link?',
      'book': 'Help me book a meeting',
      'availability': 'What is my current availability?',
      'create_rule': 'Help me create a smart rule',
      'list_rules': 'Show my active rules',
      'block_friday': 'Create a rule: no meetings on Friday',
      'add_buffer': 'Create a rule: add 15 min buffer after meetings',
      'rules_help': 'How do smart rules work?',
      'email_help': 'How does the email analyzer work?',
      'team_help': 'What can I do with teams?',
      'team_stats': 'Show team booking distribution',
      'plan_info': 'Compare the different plans',
      'analytics': 'Show my booking stats',
      'reschedule': 'Help me reschedule a meeting',
      'event_types': 'What event types do I have?',
      'create_event': 'Help me create a new event type',
      'list_templates': 'Show my email templates',
      'create_template': 'Help me create a new email template'
    };
    setMessage(actions[action] || '');
  };

  useEffect(() => {
    if (!tierLoading && chatHistory.length === 0) {
      const greeting = createGreeting();
      setChatHistory([greeting]);
      localStorage.setItem('aiChat_history', JSON.stringify([greeting]));
    }
  }, [tierLoading]);

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
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    if (isOpen) {
      // Refresh global usage when chat opens
      if (refreshUsage) refreshUsage();
      fetchTimezone();
      fetchUserName();
    }
  }, [isOpen]);

  const parseTimezoneFromMessage = (msg) => {
    const lowerMsg = msg.toLowerCase();
    const timezonePatterns = [
      { pattern: /eastern|new york|est|edt/i, value: 'America/New_York' },
      { pattern: /central|chicago|cst|cdt/i, value: 'America/Chicago' },
      { pattern: /mountain|denver|mst|mdt/i, value: 'America/Denver' },
      { pattern: /pacific|los angeles|pst|pdt/i, value: 'America/Los_Angeles' },
      { pattern: /london|uk|gmt|bst/i, value: 'Europe/London' },
      { pattern: /paris|cet|cest|france/i, value: 'Europe/Paris' },
      { pattern: /singapore|sgt/i, value: 'Asia/Singapore' },
      { pattern: /tokyo|japan|jst/i, value: 'Asia/Tokyo' },
      { pattern: /shanghai|china|cst(?!.*central)/i, value: 'Asia/Shanghai' },
      { pattern: /manila|philippines|pht/i, value: 'Asia/Manila' },
      { pattern: /dubai|gst|uae/i, value: 'Asia/Dubai' },
      { pattern: /sydney|australia|aedt|aest/i, value: 'Australia/Sydney' },
      { pattern: /auckland|new zealand|nzdt|nzst/i, value: 'Pacific/Auckland' },
    ];

    for (const { pattern, value } of timezonePatterns) {
      if (pattern.test(lowerMsg)) return value;
    }
    return null;
  };

  const handleSend = async () => {
    if (!message || !message.trim() || loading) return;

    if (!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit) {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `Looks like you've used all ${usage.ai_queries_limit} AI queries this month! 😅\n\nUpgrade to Pro for unlimited queries – I'll be here whenever you need me!\n\n[Upgrade to Pro](/billing)`,
        timestamp: new Date()
      }]);
      return;
    }

    const userMessage = message.trim();
    const lowerMessage = userMessage.toLowerCase();

    const isTimezoneRequest = 
      lowerMessage.includes('timezone') || 
      lowerMessage.includes('time zone') ||
      lowerMessage.includes('change my time') ||
      lowerMessage.includes('set my time') ||
      lowerMessage.includes('update my time') ||
      lowerMessage === 'tz' ||
      lowerMessage.match(/^(my )?(current )?time\s*zone?$/i);

    if (isTimezoneRequest) {
      setMessage('');
      setChatHistory(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
      const parsedTimezone = parseTimezoneFromMessage(userMessage);
      
      if (parsedTimezone) {
        await handleTimezoneChange(parsedTimezone);
      } else {
        const currentTzLabel = getTimezoneLabel(currentTimezone);
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: `🌍 Your current timezone is **${currentTzLabel}** (${currentTimezone || 'Not set'}).\n\nSelect your new timezone below:`,
          timestamp: new Date(),
          showTimezoneSelector: true
        }]);
        setShowTimezoneSelector(true);
      }
      return;
    }

    if (lowerMessage.includes('what') && (lowerMessage.includes('timezone') || lowerMessage.includes('time zone'))) {
      setMessage('');
      setChatHistory(prev => [...prev, 
        { role: 'user', content: userMessage, timestamp: new Date() },
        { role: 'assistant', content: `🌍 Your current timezone is **${getTimezoneLabel(currentTimezone)}** (${currentTimezone || 'Not set'}).\n\nWant to change it? Just say "Change my timezone".`, timestamp: new Date() }
      ]);
      return;
    }
    
   if (!hasTeamFeature() && (
  lowerMessage.includes('create a team') ||
  lowerMessage.includes('team scheduling') ||
  lowerMessage.includes('book with team') ||
  lowerMessage.includes('team booking link') ||
  lowerMessage.includes('round robin') ||
  lowerMessage.includes('collective booking')
)) {
  setChatHistory(prev => [...prev, 
    { role: 'user', content: userMessage, timestamp: new Date() },
    { role: 'assistant', content: `I'd love to help with team scheduling! 🏢\n\nThis is a Team plan feature ($25/month).\n\n[Check out the Team plan](/billing)`, timestamp: new Date() }
  ]);
  setMessage('');
  return;
}

    if (!hasProFeature() && (lowerMessage.includes('send reminder') || lowerMessage.includes('send email') || lowerMessage.includes('email template'))) {
      setChatHistory(prev => [...prev, 
        { role: 'user', content: userMessage, timestamp: new Date() },
        { role: 'assistant', content: `Great idea to send emails! 📧\n\nEmail features are part of Pro ($15/month).\n\n[Upgrade to Pro](/billing)`, timestamp: new Date() }
      ]);
      setMessage('');
      return;
    }

    setMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);

    setLoading(true);
    setIsTyping(true);
    try {
      let contextMessage = userMessage;
      if (pendingBooking) {
        contextMessage = `[Current pending booking: "${pendingBooking.title}" on ${pendingBooking.date} at ${pendingBooking.time} for ${pendingBooking.duration} minutes with ${pendingBooking.attendee_email}]\n\nUser says: ${userMessage}`;
      }

      const response = await api.ai.schedule(contextMessage, chatHistory);
      const responseData = response.data;

      // Refresh global usage after AI query - updates both Dashboard and AI Chat
      if (refreshUsage) refreshUsage();

      if (responseData.type === 'update_pending' && responseData.data?.updatedBooking) {
        setPendingBooking(responseData.data.updatedBooking);
        setChatHistory(prev => [...prev, { role: 'assistant', content: responseData.message, timestamp: new Date(), data: responseData.data }]);
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
        setChatHistory(prev => [...prev, { role: 'assistant', content: responseData.message, timestamp: new Date(), data: responseData.data }]);
      } else {
        const aiMessage = responseData.message || responseData.response || 'Got it! Let me know if you need anything else.';
        setChatHistory(prev => [...prev, { role: 'assistant', content: aiMessage, timestamp: new Date(), data: responseData.data, responseType: responseData.type }]);
      }

    } catch (error) {
      console.error('AI chat error:', error);
      if (refreshUsage) refreshUsage();
      
      let fallbackResponse = "Hmm, something went wrong on my end. Mind trying that again? 🙏";
      if (error?.response?.status === 429) {
        fallbackResponse = "I'm getting a lot of requests right now! 🔥 Please wait 10-15 seconds and try again.";
      }
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: fallbackResponse, timestamp: new Date() }]);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!pendingBooking) return;
    setLoading(true);
    try {
      const startDateTime = new Date(`${pendingBooking.date}T${pendingBooking.time}`);
      const endDateTime = new Date(startDateTime.getTime() + pendingBooking.duration * 60000);
      const allAttendees = pendingBooking.attendees || [pendingBooking.attendee_email];

      await api.post('/chatgpt/book-meeting', {
        title: pendingBooking.title || 'Meeting',
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        attendees: allAttendees,
        attendee_email: allAttendees[0],
        attendee_name: allAttendees[0].split('@')[0],
        notes: pendingBooking.notes || '',
        team_id: pendingBooking.team_id || null
      });

      const formattedDate = startDateTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const formattedTime = startDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `You're all set! ✅\n\n📅 **${pendingBooking.title || 'Meeting'}**\n🗓️ ${formattedDate} at ${formattedTime}\n👥 ${allAttendees.join(', ')}${pendingBooking.team_name ? `\n🏢 ${pendingBooking.team_name}` : ''}\n\nI've sent calendar invites to everyone. Anything else?`,
        timestamp: new Date(),
        isConfirmation: true
      }]);
      setPendingBooking(null);
      if (refreshUsage) refreshUsage();
    } catch (error) {
      console.error('Booking error:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Oops, I couldn't create that booking. ${error.response?.data?.error || 'Want to try again?'}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = () => {
    setPendingBooking(null);
    setChatHistory(prev => [...prev, { role: 'assistant', content: "No problem, I've cancelled that. What else can I help with?", timestamp: new Date() }]);
  };

  const handleClearChat = () => {
    const newGreeting = createGreeting();
    setChatHistory([newGreeting]);
    setPendingBooking(null);
    setShowTimezoneSelector(false);
    localStorage.removeItem('aiChat_pendingBooking');
    setTimeout(() => localStorage.setItem('aiChat_history', JSON.stringify([newGreeting])), 100);
  };

  const handleDeleteMessage = (indexToDelete) => {
    const newHistory = chatHistory.filter((_, index) => index !== indexToDelete);
    if (newHistory.length === 0 || !newHistory.some(msg => msg.isGreeting)) {
      setChatHistory([createGreeting()]);
    } else {
      setChatHistory(newHistory);
    }
  };

  const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const renderMessage = (content) => content.replace(/\*\*/g, '');

  const LinkWithCopy = ({ url, label }) => (
    <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2 mt-2">
      <Link className="h-4 w-4 text-purple-600 flex-shrink-0" />
      <span className="text-xs text-purple-700 truncate flex-1 font-mono">{label || url}</span>
      <button onClick={(e) => { e.stopPropagation(); handleCopyLink(url); }} className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-all flex-shrink-0 ${copiedUrl === url ? 'bg-green-500 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
        {copiedUrl === url ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
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
          <button onClick={(e) => { e.stopPropagation(); handleCopyLink(link.url); }} className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded transition-all flex-shrink-0 ${copiedUrl === link.url ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {copiedUrl === link.url ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
          </button>
        </div>
      ))}
    </div>
  );

  const TimezoneSelector = () => (
    <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
        {commonTimezones.map((tz) => (
          <button key={tz.value} onClick={() => handleTimezoneChange(tz.value)} disabled={loading} className={`text-left text-xs p-2 rounded-lg border transition-colors ${currentTimezone === tz.value ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-white border-gray-200 hover:border-purple-300 hover:bg-purple-50'}`}>
            <div className="flex items-center gap-2">
              <Globe className="h-3 w-3 text-gray-500" />
              <span className="font-medium">{tz.label}</span>
            </div>
            <span className="text-gray-500 ml-5">{tz.value}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderMessageContent = (msg) => {
    const content = renderMessage(msg.content);
    const data = msg.data;
    
    if (data?.url && data?.type) {
      const shortLabel = data.short_url || (data.type === 'magic' ? `/m/${data.token?.substring(0, 8)}...` : `/book/${data.token?.substring(0, 8) || '...'}...`);
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><LinkWithCopy url={data.url} label={shortLabel} /></>;
    }
    if (data?.teams?.length > 0 && data.teams[0]?.url) {
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><LinksGrid links={data.teams} labelKey="name" /></>;
    }
    if (data?.members?.length > 0 && data.members[0]?.url) {
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><LinksGrid links={data.members} labelKey="name" /></>;
    }
    if (data?.event_types?.length > 0 && data.event_types[0]?.booking_url) {
      const linksWithUrl = data.event_types.map(et => ({ ...et, url: et.booking_url, short_url: `/${data.username}/${et.slug}` }));
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><LinksGrid links={linksWithUrl} labelKey="title" /></>;
    }
    if (msg.showTimezoneSelector) {
      return <><p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p><TimezoneSelector /></>;
    }
    return <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{content}</p>;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[99999] group"
      >
        {/* Mobile: Icon only */}
        <div className="sm:hidden h-14 w-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all">
          <Sparkles className="h-7 w-7 text-white" />
        </div>

        {/* Desktop: Icon + Text */}
        <div className="hidden sm:flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-3 rounded-full shadow-2xl hover:shadow-purple-500/30 hover:scale-105 transition-all">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-left pr-2">
            <p className="font-bold text-sm">AI Assistant</p>
            <p className="text-xs text-purple-200">Ask me anything</p>
          </div>
        </div>

        {/* Notification dot */}
        <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[99998] w-full sm:w-auto">
      <div className={`w-full sm:w-96 bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border-2 sm:border-purple-200 overflow-hidden transition-all flex flex-col ${isMinimized ? 'h-16' : 'h-[80vh] sm:h-[600px]'} max-h-screen`}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">AI Assistant</h3>
              <p className="text-xs text-purple-200">{currentTier === 'free' ? 'Free' : currentTier === 'pro' ? 'Pro ⚡' : 'Team 🏢'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
              <Zap className="h-3 w-3 text-yellow-300" />
              <span className="text-xs text-white font-medium">{isUnlimited ? '∞' : `${usage.ai_queries_used}/${usage.ai_queries_limit}`}</span>
            </div>
            <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              {isMinimized ? <Maximize2 className="h-4 w-4 text-white" /> : <Minus className="h-4 w-4 text-white" />}
            </button>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50">
              {!isUnlimited && (
                <div className={`rounded-lg p-4 mb-4 ${usage.ai_queries_used >= usage.ai_queries_limit ? 'bg-red-50 border-2 border-red-300' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${usage.ai_queries_used >= usage.ai_queries_limit ? 'bg-red-100' : 'bg-yellow-100'}`}>
                      <Zap className={`h-5 w-5 ${usage.ai_queries_used >= usage.ai_queries_limit ? 'text-red-600' : 'text-yellow-600'}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold mb-2 ${usage.ai_queries_used >= usage.ai_queries_limit ? 'text-red-800 text-base' : 'text-yellow-800 text-sm'}`}>
                        {usage.ai_queries_used >= usage.ai_queries_limit ? `You've used all ${usage.ai_queries_limit} queries` : `${usage.ai_queries_limit - usage.ai_queries_used} queries left`}
                      </p>
                      {usage.ai_queries_used >= usage.ai_queries_limit ? (
                        <button onClick={() => window.location.href = '/billing'} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4 rounded-lg font-semibold text-sm">Get Pro – $15/mo</button>
                      ) : (
                        <p className="text-xs text-yellow-700">Go Pro for unlimited!</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {chatHistory.length <= 1 && (isUnlimited || usage.ai_queries_used < usage.ai_queries_limit) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {getPageContextSuggestions().slice(0, 4).map((suggestion, index) => {
                    const IconComponent = suggestion.icon;
                    const colorClasses = {
                      purple: 'text-purple-600',
                      blue: 'text-blue-600',
                      green: 'text-green-600',
                      pink: 'text-pink-600',
                      orange: 'text-orange-600'
                    };
                    return (
                      <button
                        key={index}
                        onClick={() => handleQuickAction(suggestion.action)}
                        className="flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                      >
                        <IconComponent className={`h-4 w-4 ${colorClasses[suggestion.color] || 'text-purple-600'}`} />
                        <span className="text-sm font-medium">{suggestion.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {chatHistory.length > 2 && (
                <div className="flex justify-center mb-4 gap-2 p-2 bg-gray-100 rounded-lg">
                  <button onClick={handleClearChat} className="text-xs text-red-600 bg-red-50 hover:bg-red-100 flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200"><Trash2 className="h-3 w-3" /> Clear</button>
                  <button onClick={handleClearChat} className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center gap-1 px-3 py-2 rounded-lg border border-blue-200"><RotateCcw className="h-3 w-3" /> Start Over</button>
                </div>
              )}

              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 relative ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-md' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'}`}>
                    {msg.role === 'user' ? <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{renderMessage(msg.content)}</p> : renderMessageContent(msg)}
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>{formatTime(msg.timestamp)}</p>
                    {i > 0 && !msg.isGreeting && (
                      <button onClick={() => handleDeleteMessage(i)} className={`absolute -top-2 -right-2 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs ${msg.role === 'user' ? 'bg-red-500 text-white' : 'bg-gray-400 hover:bg-red-500 text-white'}`}>×</button>
                    )}
                  </div>
                </div>
              ))}

              {(loading || isTyping) && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-gray-500 ml-1">Typing...</span>
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
                    <h4 className="font-semibold text-gray-800 text-sm sm:text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-purple-600" />Ready to book?</h4>
                    <button onClick={() => setPendingBooking(null)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-3 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <input type="text" value={pendingBooking.title} onChange={(e) => setPendingBooking({...pendingBooking, title: e.target.value})} className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm" placeholder="Meeting title" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <input type="date" value={pendingBooking.date} onChange={(e) => setPendingBooking({...pendingBooking, date: e.target.value})} className="bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm" />
                      <input type="time" value={pendingBooking.time} onChange={(e) => setPendingBooking({...pendingBooking, time: e.target.value})} className="bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2"><Mail className="h-4 w-4 text-gray-400" /><span className="text-sm font-medium">Attendees</span></div>
                      <div className="space-y-2 pl-6">
                        {(pendingBooking.attendees || [pendingBooking.attendee_email]).map((email, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input type="email" value={email} onChange={(e) => { const newAttendees = [...(pendingBooking.attendees || [pendingBooking.attendee_email])]; newAttendees[index] = e.target.value; setPendingBooking({...pendingBooking, attendees: newAttendees, attendee_email: newAttendees[0]}); }} className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm" placeholder="email@example.com" />
                            {pendingBooking.attendees?.length > 1 && <button onClick={() => { const newAttendees = (pendingBooking.attendees || []).filter((_, i) => i !== index); setPendingBooking({...pendingBooking, attendees: newAttendees, attendee_email: newAttendees[0]}); }} className="text-red-500 p-1"><X className="h-4 w-4" /></button>}
                          </div>
                        ))}
                        <button onClick={() => setPendingBooking({...pendingBooking, attendees: [...(pendingBooking.attendees || [pendingBooking.attendee_email]), '']})} className="text-purple-600 text-sm">+ Add someone</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <select value={pendingBooking.duration} onChange={(e) => setPendingBooking({...pendingBooking, duration: parseInt(e.target.value)})} className="bg-gray-50 border border-gray-200 rounded px-2 py-2 text-sm">
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleConfirmBooking} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" /> Book it!</>}</button>
                    <button onClick={handleCancelBooking} disabled={loading} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"><XCircle className="h-4 w-4" /> Never mind</button>
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input ref={inputRef} type="text" value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Type a message..." className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" disabled={loading || (!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit)} />
                <button onClick={handleSend} disabled={loading || !message.trim() || (!isUnlimited && usage.ai_queries_used >= usage.ai_queries_limit)} className="p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl transition-colors">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}