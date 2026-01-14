const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { applySchedulingRules } = require('../utils/schedulingRules');

// Intent detection helpers
const detectIntent = (message) => {
  const lowerMessage = message.toLowerCase();

  // Cancel booking intent - check first before other intents
  if ((lowerMessage.includes('cancel') || lowerMessage.includes('delete') || lowerMessage.includes('remove')) &&
      (lowerMessage.includes('meeting') || lowerMessage.includes('booking') || lowerMessage.includes('appointment'))) {
    return 'cancel_booking';
  }

  // Reschedule booking intent
  if ((lowerMessage.includes('reschedule') || lowerMessage.includes('move') || lowerMessage.includes('change time') ||
       lowerMessage.includes('postpone') || lowerMessage.includes('push back') || lowerMessage.includes('change my')) &&
      (lowerMessage.includes('meeting') || lowerMessage.includes('booking') || lowerMessage.includes('appointment') ||
       lowerMessage.includes('to ') || lowerMessage.match(/to \d/))) {
    return 'reschedule_booking';
  }

  // Availability check intent
  if ((lowerMessage.includes('am i free') || lowerMessage.includes('am i available') ||
       lowerMessage.includes('do i have time') || lowerMessage.includes('check availability') ||
       lowerMessage.includes('what\'s my availability') || lowerMessage.includes('whats my availability') ||
       lowerMessage.includes('show availability') || lowerMessage.includes('free slots') ||
       lowerMessage.includes('open slots') || lowerMessage.includes('available times') ||
       (lowerMessage.includes('availability') && (lowerMessage.includes('my') || lowerMessage.includes('check')))) &&
      !lowerMessage.includes('set ')) {
    return 'check_availability';
  }

  // Meetings with specific person
  if ((lowerMessage.includes('meetings with') || lowerMessage.includes('meeting with') ||
       lowerMessage.includes('appointments with') || lowerMessage.includes('calls with')) &&
      (lowerMessage.includes('@') || lowerMessage.match(/with\s+\w+/))) {
    return 'find_meetings';
  }

  // Analytics/Stats intent
  if (lowerMessage.includes('analytics') ||
      lowerMessage.includes('stats') ||
      lowerMessage.includes('statistics') ||
      lowerMessage.includes('how many bookings') ||
      lowerMessage.includes('how many') ||
      lowerMessage.includes('booking stats') ||
      lowerMessage.includes('my numbers') ||
      lowerMessage.includes('performance') ||
      lowerMessage.includes('report') ||
      lowerMessage.includes('summary') ||
      (lowerMessage.includes('this week') && !lowerMessage.includes('book')) ||
      (lowerMessage.includes('this month') && !lowerMessage.includes('book')) ||
      (lowerMessage.includes('today') && lowerMessage.includes('meeting'))) {
    return 'analytics';
  }

  // Show rules intent
  if ((lowerMessage.includes('show') || lowerMessage.includes('list') || lowerMessage.includes('my') || lowerMessage.includes('active')) &&
      (lowerMessage.includes('rule') || lowerMessage.includes('rules'))) {
    return 'show_rules';
  }

  // Smart rule creation intent - includes natural language patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('set up') || lowerMessage.includes('make')) &&
      (lowerMessage.includes('rule') || lowerMessage.includes('smart rule') || lowerMessage.includes('scheduling rule'))) {
    return 'create_rule';
  }

  // Natural language rule creation
  if (lowerMessage.includes('no meetings on') ||
      lowerMessage.includes('block ') ||
      lowerMessage.includes('add buffer') ||
      lowerMessage.includes('add 15') ||
      lowerMessage.includes('add 30') ||
      lowerMessage.includes('route ') ||
      lowerMessage.includes('auto-approve') ||
      lowerMessage.includes('auto approve')) {
    return 'create_rule';
  }

  // Rule explanation intent
  if (lowerMessage.includes('how do') && (lowerMessage.includes('rule') || lowerMessage.includes('smart rule'))) {
    return 'explain_rules';
  }

  // Get booking link
  if (lowerMessage.includes('booking link') ||
      lowerMessage.includes('my link') ||
      lowerMessage.includes("what's my link") ||
      lowerMessage.includes('share my')) {
    return 'get_link';
  }

  // Upcoming meetings
  if (lowerMessage.includes('upcoming') ||
      lowerMessage.includes('next meeting') ||
      lowerMessage.includes('my schedule') ||
      lowerMessage.includes('my calendar')) {
    return 'upcoming';
  }

  // Quick link creation
  if (lowerMessage.includes('quick link') || lowerMessage.includes('magic link')) {
    return 'create_quick_link';
  }

  // Team links
  if (lowerMessage.includes('team') && (lowerMessage.includes('link') || lowerMessage.includes('booking'))) {
    return 'team_links';
  }

  // Plan comparison
  if (lowerMessage.includes('plan') && (lowerMessage.includes('compare') || lowerMessage.includes('different') || lowerMessage.includes('upgrade'))) {
    return 'plan_info';
  }

  // Book meeting intent
  if ((lowerMessage.includes('book') || lowerMessage.includes('schedule') || lowerMessage.includes('set up')) &&
      (lowerMessage.includes('meeting') || lowerMessage.includes('call') || lowerMessage.includes('appointment'))) {
    return 'book_meeting';
  }

  // Template choice response (A/B/C or numbers)
  if (/^[abc]$/i.test(lowerMessage.trim()) || /^\d+$/.test(lowerMessage.trim()) || lowerMessage.trim() === 'skip') {
    return 'template_choice';
  }

  // Yes/No confirmation response
  if (/^(yes|yeah|yep|confirm|ok|sure|do it)$/i.test(lowerMessage.trim())) {
    return 'confirm_yes';
  }
  if (/^(no|nope|cancel|nevermind|never mind|don't|dont)$/i.test(lowerMessage.trim())) {
    return 'confirm_no';
  }

  return 'general';
};

// Template suggestion for bookings based on intent
async function suggestTemplateForBooking(client, userId, message, eventTypeName) {
  // Get user's templates
  const templates = await client.query(
    'SELECT id, name, type, subject FROM email_templates WHERE user_id = $1',
    [userId]
  );

  if (templates.rows.length === 0) return null;

  const lower = message.toLowerCase();
  const eventLower = (eventTypeName || '').toLowerCase();

  // Intent keywords → template type mapping
  const intentPatterns = [
    { keywords: ['sales', 'demo', 'product demo', 'pitch'], templateTypes: ['sales', 'demo'] },
    { keywords: ['interview', 'candidate', 'hiring', 'recruit'], templateTypes: ['interview', 'hiring'] },
    { keywords: ['consult', 'discovery', 'intro call', 'initial'], templateTypes: ['consultation', 'discovery'] },
    { keywords: ['follow up', 'follow-up', 'check in', 'check-in'], templateTypes: ['followup', 'follow-up'] },
    { keywords: ['onboard', 'kickoff', 'kick-off', 'welcome'], templateTypes: ['onboarding', 'kickoff'] },
    { keywords: ['support', 'help', 'issue', 'problem'], templateTypes: ['support', 'help'] },
    { keywords: ['coaching', 'mentor', 'training'], templateTypes: ['coaching', 'training'] },
    { keywords: ['review', 'feedback', 'assessment'], templateTypes: ['review', 'feedback'] },
  ];

  // Find matching intent
  let matchedIntent = null;
  for (const pattern of intentPatterns) {
    if (pattern.keywords.some(k => lower.includes(k) || eventLower.includes(k))) {
      matchedIntent = pattern;
      break;
    }
  }

  if (!matchedIntent) return null;

  // Find matching template
  const matchingTemplate = templates.rows.find(t => {
    const tName = t.name.toLowerCase();
    const tType = (t.type || '').toLowerCase();
    return matchedIntent.templateTypes.some(mt =>
      tName.includes(mt) || tType.includes(mt)
    );
  });

  if (matchingTemplate) {
    return {
      template: matchingTemplate,
      intent: matchedIntent.keywords[0],
      reason: `This looks like a ${matchedIntent.keywords[0]} meeting`
    };
  }

  return null;
}

// Enhanced date parsing with natural language support
function parseNaturalDate(text) {
  const lowerText = text.toLowerCase();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Today
  if (lowerText.includes('today')) {
    return { date: today, dateStr: 'today' };
  }

  // Tomorrow
  if (lowerText.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { date: tomorrow, dateStr: 'tomorrow' };
  }

  // Day after tomorrow
  if (lowerText.includes('day after tomorrow')) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return { date: dayAfter, dateStr: 'day after tomorrow' };
  }

  // In X days/weeks
  const inXMatch = lowerText.match(/in\s+(\d+)\s+(day|days|week|weeks)/);
  if (inXMatch) {
    const amount = parseInt(inXMatch[1]);
    const unit = inXMatch[2];
    const futureDate = new Date(today);
    if (unit.startsWith('week')) {
      futureDate.setDate(futureDate.getDate() + (amount * 7));
    } else {
      futureDate.setDate(futureDate.getDate() + amount);
    }
    return { date: futureDate, dateStr: `in ${amount} ${unit}` };
  }

  // Next week (meaning next Monday)
  if (lowerText.includes('next week') && !lowerText.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)) {
    const nextMonday = new Date(today);
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    return { date: nextMonday, dateStr: 'next week' };
  }

  // End of week (Friday)
  if (lowerText.includes('end of week') || lowerText.includes('end of the week')) {
    const friday = new Date(today);
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    friday.setDate(friday.getDate() + daysUntilFriday);
    return { date: friday, dateStr: 'end of week' };
  }

  // Day names: "Monday", "next Monday", "this Monday"
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = lowerText.match(/(next\s+|this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (dayMatch) {
    const isNext = dayMatch[1]?.includes('next');
    const dayName = dayMatch[2].toLowerCase();
    const targetDay = dayNames.indexOf(dayName);
    const currentDay = today.getDay();

    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0 || isNext) {
      daysToAdd += 7;
    }
    if (isNext && daysToAdd <= 7) {
      daysToAdd += 7; // "next Monday" means the Monday after this coming one
    }

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    return { date: targetDate, dateStr: `${isNext ? 'next ' : ''}${dayName}` };
  }

  // Specific date formats: "Jan 15", "January 15", "1/15", "15th"
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // "January 15" or "Jan 15"
  const monthDayMatch = lowerText.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (monthDayMatch) {
    const monthStr = monthDayMatch[1].toLowerCase();
    const day = parseInt(monthDayMatch[2]);
    let month = monthNames.indexOf(monthStr);
    if (month === -1) month = monthShort.indexOf(monthStr);

    const targetDate = new Date(now.getFullYear(), month, day);
    if (targetDate < today) {
      targetDate.setFullYear(targetDate.getFullYear() + 1);
    }
    return { date: targetDate, dateStr: `${monthDayMatch[1]} ${day}` };
  }

  // "1/15" or "01/15"
  const slashDateMatch = lowerText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (slashDateMatch) {
    const month = parseInt(slashDateMatch[1]) - 1;
    const day = parseInt(slashDateMatch[2]);
    let year = slashDateMatch[3] ? parseInt(slashDateMatch[3]) : now.getFullYear();
    if (year < 100) year += 2000;

    const targetDate = new Date(year, month, day);
    if (targetDate < today && !slashDateMatch[3]) {
      targetDate.setFullYear(targetDate.getFullYear() + 1);
    }
    return { date: targetDate, dateStr: `${month + 1}/${day}` };
  }

  return null;
}

// Parse time from natural language
function parseNaturalTime(text) {
  const lowerText = text.toLowerCase();

  // "at 2pm", "at 2:30pm", "at 14:00"
  const timeMatch = lowerText.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (!meridiem && hours < 8) hours += 12; // Assume PM for times like "2" or "3"

    return {
      hours,
      minutes,
      timeStr: `${hours > 12 ? hours - 12 : hours}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
    };
  }

  // Named times
  if (lowerText.includes('noon') || lowerText.includes('midday')) {
    return { hours: 12, minutes: 0, timeStr: '12:00 PM' };
  }
  if (lowerText.includes('morning') && !lowerText.includes('tomorrow morning')) {
    return { hours: 9, minutes: 0, timeStr: '9:00 AM' };
  }
  if (lowerText.includes('afternoon')) {
    return { hours: 14, minutes: 0, timeStr: '2:00 PM' };
  }
  if (lowerText.includes('evening')) {
    return { hours: 17, minutes: 0, timeStr: '5:00 PM' };
  }

  return null;
}

// Parse booking details from natural language
function parseBookingDetails(message) {
  const details = {
    attendeeEmail: null,
    attendeeName: null,
    date: null,
    time: null,
    parsedDate: null,
    parsedTime: null,
    duration: 30,
    title: 'Meeting',
    eventType: null
  };

  // Extract email
  const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    details.attendeeEmail = emailMatch[1];
    details.attendeeName = emailMatch[1].split('@')[0];
  }

  // Extract date using enhanced parser
  const dateResult = parseNaturalDate(message);
  if (dateResult) {
    details.parsedDate = dateResult.date;
    details.date = dateResult.dateStr;
  }

  // Extract time using enhanced parser
  const timeResult = parseNaturalTime(message);
  if (timeResult) {
    details.parsedTime = timeResult;
    details.time = timeResult.timeStr;
  }

  // Extract duration
  const durationMatch = message.match(/(\d+)\s*(?:min|minute|hour)/i);
  if (durationMatch) {
    let duration = parseInt(durationMatch[1]);
    if (message.toLowerCase().includes('hour')) {
      duration *= 60;
    }
    details.duration = duration;
  }

  // Extract meeting type/title hints
  const typePatterns = [
    { pattern: /sales\s*(?:call|meeting|demo)/i, type: 'Sales Call' },
    { pattern: /demo/i, type: 'Product Demo' },
    { pattern: /interview/i, type: 'Interview' },
    { pattern: /consult(?:ation)?/i, type: 'Consultation' },
    { pattern: /discovery/i, type: 'Discovery Call' },
    { pattern: /intro(?:duction)?\s*call/i, type: 'Intro Call' },
    { pattern: /onboard(?:ing)?/i, type: 'Onboarding' },
    { pattern: /kickoff|kick-off/i, type: 'Kickoff Meeting' },
    { pattern: /follow[\s-]?up/i, type: 'Follow-up' },
    { pattern: /coaching/i, type: 'Coaching Session' },
    { pattern: /support/i, type: 'Support Call' },
  ];

  for (const { pattern, type } of typePatterns) {
    if (pattern.test(message)) {
      details.eventType = type;
      details.title = type;
      break;
    }
  }

  return details;
}

// Parse meeting reference from message (for cancel/reschedule)
function parseMeetingReference(message) {
  const lowerMessage = message.toLowerCase();
  const reference = {
    email: null,
    name: null,
    date: null,
    time: null,
    meetingId: null
  };

  // Extract email
  const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    reference.email = emailMatch[1];
  }

  // Extract name pattern: "with John", "with Sarah"
  const nameMatch = lowerMessage.match(/with\s+([a-z]+)(?:\s|$|')/i);
  if (nameMatch && !nameMatch[1].includes('@')) {
    reference.name = nameMatch[1];
  }

  // Extract date
  const dateResult = parseNaturalDate(message);
  if (dateResult) {
    reference.date = dateResult.date;
  }

  // Extract time
  const timeResult = parseNaturalTime(message);
  if (timeResult) {
    reference.time = timeResult;
  }

  // Extract meeting ID if mentioned
  const idMatch = message.match(/(?:meeting|booking|#)\s*(\d+)/i);
  if (idMatch) {
    reference.meetingId = parseInt(idMatch[1]);
  }

  return reference;
}

// Parse smart rule from natural language
const parseRuleFromMessage = (message) => {
  const lowerMessage = message.toLowerCase();
  let rule = {
    name: '',
    trigger_type: 'all',
    trigger_value: 'all_bookings',
    action_type: 'set_duration',
    action_value: '30',
    is_active: true
  };

  // Day-based blocking rules: "no meetings on Friday", "block Mondays"
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayBlockMatch = lowerMessage.match(/(?:no meetings on|block|no bookings on)\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?/i);
  if (dayBlockMatch) {
    const day = dayBlockMatch[1].toLowerCase();
    rule.trigger_type = 'day_of_week';
    rule.trigger_value = day;
    rule.action_type = 'block';
    rule.action_value = 'true';
    rule.name = `No meetings on ${day.charAt(0).toUpperCase() + day.slice(1)}`;
    return rule;
  }

  // Buffer rules: "add 15 min buffer", "add buffer after meetings"
  const bufferMatch = lowerMessage.match(/(?:add\s+)?(\d+)?\s*(?:min(?:ute)?s?)?\s*buffer\s*(?:after|before|between)?/i);
  if (bufferMatch || lowerMessage.includes('add buffer')) {
    const bufferMins = bufferMatch?.[1] || '15';
    rule.trigger_type = 'all';
    rule.trigger_value = 'all_bookings';
    rule.action_type = 'add_buffer';
    rule.action_value = bufferMins;
    rule.name = `Add ${bufferMins} min buffer after meetings`;
    return rule;
  }

  // Detect domain-based rules
  const domainMatch = message.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (domainMatch) {
    rule.trigger_type = 'domain';
    rule.trigger_value = domainMatch[1].toLowerCase();
    rule.name = `Rule for ${rule.trigger_value}`;
  }

  // Detect keyword-based rules
  const keywordPatterns = [
    /when.*(email|booking|request).*(contains|has|includes)\s+["']?([^"']+)["']?/i,
    /if.*(email|booking|request).*(contains|has|includes)\s+["']?([^"']+)["']?/i,
    /for.*(booking|meeting|request)s?\s+(with|containing)\s+["']?([^"']+)["']?/i
  ];

  for (const pattern of keywordPatterns) {
    const match = message.match(pattern);
    if (match) {
      rule.trigger_type = 'keyword';
      rule.trigger_value = match[3].trim();
      rule.name = `Rule for "${rule.trigger_value}"`;
      break;
    }
  }

  // Routing rules: "route sales to Sarah", "route demo calls to John"
  const routeMatch = lowerMessage.match(/route\s+(.+?)\s+(?:to|for)\s+(\w+)/i);
  if (routeMatch) {
    rule.trigger_type = 'keyword';
    rule.trigger_value = routeMatch[1].trim();
    rule.action_type = 'route_to';
    rule.action_value = routeMatch[2].trim();
    rule.name = `Route "${routeMatch[1]}" to ${routeMatch[2]}`;
    return rule;
  }

  // Detect duration action
  const durationMatch = message.match(/(\d+)\s*(min|minute|hour)/i);
  if (durationMatch && !lowerMessage.includes('buffer')) {
    let duration = parseInt(durationMatch[1]);
    if (durationMatch[2].toLowerCase().startsWith('hour')) {
      duration *= 60;
    }
    rule.action_type = 'set_duration';
    rule.action_value = duration.toString();
  }

  // Detect auto-approve action
  if (lowerMessage.includes('auto') && (lowerMessage.includes('approve') || lowerMessage.includes('accept') || lowerMessage.includes('confirm'))) {
    rule.action_type = 'auto_approve';
    rule.action_value = 'true';
    if (!rule.name) rule.name = 'Auto-approve rule';
  }

  // Detect block action (general)
  if ((lowerMessage.includes('block') || lowerMessage.includes('reject') || lowerMessage.includes('decline')) && !dayBlockMatch) {
    rule.action_type = 'block';
    rule.action_value = 'true';
  }

  // Detect priority action
  if (lowerMessage.includes('priority') || lowerMessage.includes('vip') || lowerMessage.includes('important')) {
    rule.action_type = 'set_priority';
    rule.action_value = 'high';
    if (!rule.name) rule.name = 'High priority rule';
  }

  return rule;
};

// POST /api/ai/schedule - Main AI chat endpoint
router.post('/schedule', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { message, history } = req.body;

    // Increment AI query usage
    await client.query(
      `UPDATE users SET ai_queries_used = COALESCE(ai_queries_used, 0) + 1 WHERE id = $1`,
      [userId]
    );

    const intent = detectIntent(message);
    console.log(`AI Intent detected: ${intent} for message: "${message.substring(0, 50)}..."`);

    // Handle analytics intent
    if (intent === 'analytics') {
      const stats = await getBookingAnalytics(client, userId);
      return res.json({
        type: 'analytics',
        message: formatAnalyticsResponse(stats),
        data: { stats }
      });
    }

    // Handle cancel booking intent
    if (intent === 'cancel_booking') {
      const reference = parseMeetingReference(message);
      const meetings = await findMatchingMeetings(client, userId, reference);

      if (meetings.length === 0) {
        return res.json({
          type: 'not_found',
          message: `I couldn't find any upcoming meetings matching that description.\n\nTry being more specific:\n- "Cancel my meeting with john@email.com"\n- "Cancel my 2pm meeting tomorrow"\n- "Cancel meeting #123"`
        });
      }

      if (meetings.length === 1) {
        const meeting = meetings[0];
        const dateStr = new Date(meeting.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = new Date(meeting.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        // Store pending cancel action
        await client.query(
          `INSERT INTO ai_pending_actions (user_id, action_type, action_data, expires_at)
           VALUES ($1, 'cancel_booking', $2, NOW() + INTERVAL '5 minutes')
           ON CONFLICT (user_id, action_type) DO UPDATE SET action_data = $2, expires_at = NOW() + INTERVAL '5 minutes'`,
          [userId, JSON.stringify({ bookingId: meeting.id, meeting })]
        );

        return res.json({
          type: 'confirm_cancel',
          message: `Found this meeting:\n\n📅 **${meeting.title || 'Meeting'}**\n🗓️ ${dateStr} at ${timeStr}\n👤 ${meeting.attendee_email}\n\n⚠️ Are you sure you want to cancel?\n\nReply **"yes"** to confirm or **"no"** to keep it.`,
          data: { meeting, action: 'cancel' }
        });
      }

      // Multiple meetings found
      const meetingList = meetings.slice(0, 5).map((m, i) => {
        const dateStr = new Date(m.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = new Date(m.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `${i + 1}. **${m.title || 'Meeting'}** - ${dateStr} at ${timeStr} with ${m.attendee_email}`;
      }).join('\n');

      return res.json({
        type: 'multiple_found',
        message: `I found ${meetings.length} matching meeting${meetings.length > 1 ? 's' : ''}:\n\n${meetingList}\n\nWhich one would you like to cancel? Reply with the number (e.g., "cancel 1").`,
        data: { meetings: meetings.slice(0, 5) }
      });
    }

    // Handle reschedule booking intent
    if (intent === 'reschedule_booking') {
      const reference = parseMeetingReference(message);
      const meetings = await findMatchingMeetings(client, userId, reference);

      // Check if new time is specified
      const newTimeMatch = message.match(/to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      const newDateResult = message.includes(' to ') ? parseNaturalDate(message.split(' to ')[1]) : null;

      if (meetings.length === 0) {
        return res.json({
          type: 'not_found',
          message: `I couldn't find any upcoming meetings to reschedule.\n\nTry:\n- "Reschedule my meeting with john@email.com to 3pm"\n- "Move my 2pm tomorrow to 4pm"\n- "Reschedule meeting #123 to next Monday"`
        });
      }

      if (meetings.length === 1) {
        const meeting = meetings[0];
        const dateStr = new Date(meeting.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = new Date(meeting.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        // Store pending reschedule action
        await client.query(
          `INSERT INTO ai_pending_actions (user_id, action_type, action_data, expires_at)
           VALUES ($1, 'reschedule_booking', $2, NOW() + INTERVAL '5 minutes')
           ON CONFLICT (user_id, action_type) DO UPDATE SET action_data = $2, expires_at = NOW() + INTERVAL '5 minutes'`,
          [userId, JSON.stringify({ bookingId: meeting.id, meeting, newTime: newTimeMatch?.[1], newDate: newDateResult?.dateStr })]
        );

        if (newTimeMatch || newDateResult) {
          return res.json({
            type: 'confirm_reschedule',
            message: `Found this meeting:\n\n📅 **${meeting.title || 'Meeting'}**\n🗓️ Currently: ${dateStr} at ${timeStr}\n👤 ${meeting.attendee_email}\n\n➡️ New time: ${newDateResult?.dateStr || dateStr} at ${newTimeMatch?.[1] || timeStr}\n\nReply **"yes"** to confirm or **"no"** to cancel.`,
            data: { meeting, newTime: newTimeMatch?.[1], newDate: newDateResult?.dateStr, action: 'reschedule' }
          });
        }

        return res.json({
          type: 'need_new_time',
          message: `Found this meeting:\n\n📅 **${meeting.title || 'Meeting'}**\n🗓️ ${dateStr} at ${timeStr}\n👤 ${meeting.attendee_email}\n\nWhen would you like to reschedule it to?\n\nExample: "Move it to 3pm" or "Reschedule to next Monday at 2pm"`,
          data: { meeting, action: 'reschedule' }
        });
      }

      // Multiple meetings found
      const meetingList = meetings.slice(0, 5).map((m, i) => {
        const dateStr = new Date(m.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = new Date(m.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `${i + 1}. **${m.title || 'Meeting'}** - ${dateStr} at ${timeStr} with ${m.attendee_email}`;
      }).join('\n');

      return res.json({
        type: 'multiple_found',
        message: `I found ${meetings.length} matching meeting${meetings.length > 1 ? 's' : ''}:\n\n${meetingList}\n\nWhich one would you like to reschedule? Reply with the number.`,
        data: { meetings: meetings.slice(0, 5) }
      });
    }

    // Handle availability check intent
    if (intent === 'check_availability') {
      const dateResult = parseNaturalDate(message);
      const timeResult = parseNaturalTime(message);

      if (!dateResult) {
        // Show general availability for the week
        const availability = await getWeekAvailability(client, userId);
        return res.json({
          type: 'availability',
          message: formatWeekAvailability(availability),
          data: { availability }
        });
      }

      // Check specific date/time
      const checkDate = dateResult.date;
      const slots = await getAvailableSlotsForDate(client, userId, checkDate);

      if (timeResult) {
        // Check specific time slot
        const requestedTime = new Date(checkDate);
        requestedTime.setHours(timeResult.hours, timeResult.minutes, 0, 0);

        const isAvailable = slots.some(slot => {
          const slotStart = new Date(slot.start);
          const slotEnd = new Date(slot.end);
          return requestedTime >= slotStart && requestedTime < slotEnd;
        });

        const dateStr = checkDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        if (isAvailable) {
          return res.json({
            type: 'available',
            message: `✅ **Yes, you're free!**\n\n${dateStr} at ${timeResult.timeStr} is available.\n\nWould you like me to book a meeting for that time?`,
            data: { date: dateStr, time: timeResult.timeStr, available: true }
          });
        } else {
          const alternativeSlots = slots.slice(0, 3).map(s => {
            const start = new Date(s.start);
            return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          }).join(', ');

          return res.json({
            type: 'unavailable',
            message: `❌ **Sorry, that time is not available.**\n\n${dateStr} at ${timeResult.timeStr} conflicts with another event.\n\n${slots.length > 0 ? `**Available times:** ${alternativeSlots}` : 'No available slots that day.'}`,
            data: { date: dateStr, time: timeResult.timeStr, available: false, alternatives: slots.slice(0, 3) }
          });
        }
      }

      // Show available slots for the day
      const dateStr = checkDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      if (slots.length === 0) {
        return res.json({
          type: 'no_slots',
          message: `📅 **${dateStr}**\n\nNo available slots that day. Your calendar is fully booked or it's outside your working hours.`,
          data: { date: dateStr, slots: [] }
        });
      }

      const slotList = slots.slice(0, 6).map(s => {
        const start = new Date(s.start);
        const end = new Date(s.end);
        return `• ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }).join('\n');

      return res.json({
        type: 'availability',
        message: `📅 **${dateStr}**\n\n**Available slots:**\n${slotList}${slots.length > 6 ? `\n\n...and ${slots.length - 6} more` : ''}`,
        data: { date: dateStr, slots }
      });
    }

    // Handle find meetings with specific person
    if (intent === 'find_meetings') {
      const reference = parseMeetingReference(message);
      const searchTerm = reference.email || reference.name;

      if (!searchTerm) {
        return res.json({
          type: 'clarification',
          message: `Who would you like to find meetings with?\n\nTry:\n- "Show meetings with john@email.com"\n- "Meetings with Sarah"`
        });
      }

      const meetings = await client.query(
        `SELECT * FROM bookings
         WHERE user_id = $1
         AND status != 'cancelled'
         AND (LOWER(attendee_email) LIKE $2 OR LOWER(attendee_name) LIKE $2)
         ORDER BY start_time DESC
         LIMIT 10`,
        [userId, `%${searchTerm.toLowerCase()}%`]
      );

      if (meetings.rows.length === 0) {
        return res.json({
          type: 'not_found',
          message: `I couldn't find any meetings with "${searchTerm}".`
        });
      }

      const upcoming = meetings.rows.filter(m => new Date(m.start_time) > new Date());
      const past = meetings.rows.filter(m => new Date(m.start_time) <= new Date());

      let response = `📋 **Meetings with ${searchTerm}**\n\n`;

      if (upcoming.length > 0) {
        response += `**Upcoming:**\n`;
        upcoming.forEach(m => {
          const dateStr = new Date(m.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const timeStr = new Date(m.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          response += `• ${dateStr} at ${timeStr} - ${m.title || 'Meeting'}\n`;
        });
      }

      if (past.length > 0) {
        response += `\n**Past:**\n`;
        past.slice(0, 3).forEach(m => {
          const dateStr = new Date(m.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          response += `• ${dateStr} - ${m.title || 'Meeting'}\n`;
        });
      }

      return res.json({
        type: 'meetings_list',
        message: response,
        data: { meetings: meetings.rows, searchTerm }
      });
    }

    // Handle smart rule creation
    if (intent === 'create_rule') {
      const parsedRule = parseRuleFromMessage(message);

      if (!parsedRule.trigger_value) {
        return res.json({
          type: 'clarification',
          message: `I'd be happy to help you create a smart rule! Please tell me:\n\n1. **What should trigger it?** (e.g., "emails from @company.com" or "bookings containing 'urgent'")\n\n2. **What should happen?** (e.g., "set duration to 45 minutes" or "auto-approve")\n\nExample: "Create a rule for @acme.com that sets meetings to 45 minutes"`
        });
      }

      // Insert the rule
      const result = await client.query(
        `INSERT INTO scheduling_rules (user_id, name, trigger_type, trigger_value, action_type, action_value, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, parsedRule.name, parsedRule.trigger_type, parsedRule.trigger_value, parsedRule.action_type, parsedRule.action_value, parsedRule.is_active]
      );

      const newRule = result.rows[0];
      return res.json({
        type: 'rule_created',
        message: `Done! I've created a new smart rule:\n\n**${newRule.name}**\n- Trigger: ${newRule.trigger_type} = "${newRule.trigger_value}"\n- Action: ${formatAction(newRule.action_type, newRule.action_value)}\n\nThis rule is now active and will apply to future bookings. You can view and edit it in Smart Rules.`,
        data: { rule: newRule }
      });
    }

    // Handle rule explanation
    if (intent === 'explain_rules') {
      return res.json({
        type: 'info',
        message: `**Smart Rules** automatically apply actions to bookings based on conditions you set.\n\n**How they work:**\n1. **Triggers** - When a booking matches (e.g., email domain, keyword)\n2. **Actions** - What happens (e.g., set duration, auto-approve, block)\n\n**Examples:**\n- Auto-approve bookings from @yourcompany.com\n- Set 15-minute meetings for "quick chat" requests\n- Block bookings from competitor domains\n\nWant me to help you create one? Just describe what you want!`
      });
    }

    // Handle show rules
    if (intent === 'show_rules') {
      const rules = await client.query(
        `SELECT id, name, rule_text, rule_type, trigger_type, trigger_value, action_type, action_value, is_active
         FROM scheduling_rules
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      );

      if (rules.rows.length === 0) {
        return res.json({
          type: 'info',
          message: `You don't have any scheduling rules yet.\n\nWould you like to create one? Try:\n- "No meetings on Friday"\n- "Add 15 min buffer after meetings"\n- "Auto-approve bookings from @company.com"`
        });
      }

      const ruleList = rules.rows.map((r, i) => {
        const status = r.is_active ? '✅' : '❌';
        const ruleName = r.name || r.rule_text || `${r.trigger_type}: ${r.trigger_value}`;
        const ruleType = r.rule_type || r.action_type || 'custom';
        return `${i + 1}. ${status} **${ruleName}** (${ruleType})`;
      }).join('\n');

      return res.json({
        type: 'rules_list',
        message: `📋 **Your Scheduling Rules**\n\n${ruleList}\n\nManage these in the **Smart Rules** page.`,
        data: { rules: rules.rows }
      });
    }

    // Handle get booking link
    if (intent === 'get_link') {
      const linkData = await getBookingLink(client, userId);
      return res.json({
        type: 'link',
        message: `Here's your booking link! Share it with anyone who wants to schedule time with you.`,
        data: linkData
      });
    }

    // Handle upcoming meetings
    if (intent === 'upcoming') {
      const upcoming = await getUpcomingMeetings(client, userId);
      return res.json({
        type: 'upcoming',
        message: upcoming.length > 0
          ? `You have ${upcoming.length} upcoming meeting${upcoming.length > 1 ? 's' : ''}:\n\n${formatUpcomingMeetings(upcoming)}`
          : `You don't have any upcoming meetings. Share your booking link to let people schedule with you!`,
        data: { meetings: upcoming }
      });
    }

    // Handle quick link creation
    if (intent === 'create_quick_link') {
      const quickLink = await createQuickLink(client, userId, message);
      return res.json({
        type: 'quick_link',
        message: `Done! I've created a quick link for you. It expires in 7 days.`,
        data: quickLink
      });
    }

    // Handle team links
    if (intent === 'team_links') {
      const teams = await getTeamLinks(client, userId);
      return res.json({
        type: 'team_links',
        message: teams.length > 0
          ? `Here are your team booking links:`
          : `You don't have any team links yet. Create a team to get shared booking links!`,
        data: { teams }
      });
    }

    // Handle plan info
    if (intent === 'plan_info') {
      return res.json({
        type: 'info',
        message: `**ScheduleSync Plans:**\n\n**Free** - $0/month\n- 50 bookings/month\n- 10 AI queries/month\n- Google & Outlook sync\n- Email reminders\n\n**Starter** - $8/month\n- 200 bookings/month\n- 50 AI queries/month\n- Buffer times & templates\n\n**Pro** - $15/month\n- Unlimited bookings\n- 250 AI queries/month\n- Smart Rules & Email Assistant\n- Priority support\n\n**Team** - $20/user/month\n- Everything in Pro\n- Round-robin booking\n- Collective availability\n- Up to 10 members\n\n[Compare plans](/billing)`
      });
    }

    // Handle yes confirmation for pending actions
    if (intent === 'confirm_yes') {
      // Check for pending cancel action
      const pendingCancel = await client.query(
        `SELECT id, action_data FROM ai_pending_actions
         WHERE user_id = $1 AND action_type = 'cancel_booking'
         AND expires_at > NOW()`,
        [userId]
      );

      if (pendingCancel.rows.length > 0) {
        const pendingData = JSON.parse(pendingCancel.rows[0].action_data);
        const bookingId = pendingData.bookingId;

        // Cancel the booking
        await client.query(
          `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2`,
          [bookingId, userId]
        );

        // Clear pending action
        await client.query('DELETE FROM ai_pending_actions WHERE id = $1', [pendingCancel.rows[0].id]);

        return res.json({
          type: 'cancelled',
          message: `✅ **Meeting cancelled!**\n\nI've cancelled the meeting with ${pendingData.meeting.attendee_email}.\n\nIs there anything else I can help with?`,
          data: { cancelled: true, bookingId }
        });
      }

      // Check for pending reschedule action
      const pendingReschedule = await client.query(
        `SELECT id, action_data FROM ai_pending_actions
         WHERE user_id = $1 AND action_type = 'reschedule_booking'
         AND expires_at > NOW()`,
        [userId]
      );

      if (pendingReschedule.rows.length > 0) {
        const pendingData = JSON.parse(pendingReschedule.rows[0].action_data);
        const bookingId = pendingData.bookingId;
        const meeting = pendingData.meeting;

        // Calculate new start time
        let newStartTime = new Date(meeting.start_time);
        if (pendingData.newDate) {
          const newDate = parseNaturalDate(pendingData.newDate);
          if (newDate) {
            newStartTime = new Date(newDate.date);
            newStartTime.setHours(
              new Date(meeting.start_time).getHours(),
              new Date(meeting.start_time).getMinutes()
            );
          }
        }
        if (pendingData.newTime) {
          const timeResult = parseNaturalTime(pendingData.newTime);
          if (timeResult) {
            newStartTime.setHours(timeResult.hours, timeResult.minutes, 0, 0);
          }
        }

        // Calculate new end time (same duration)
        const duration = new Date(meeting.end_time) - new Date(meeting.start_time);
        const newEndTime = new Date(newStartTime.getTime() + duration);

        // Update the booking
        await client.query(
          `UPDATE bookings SET start_time = $1, end_time = $2 WHERE id = $3 AND user_id = $4`,
          [newStartTime.toISOString(), newEndTime.toISOString(), bookingId, userId]
        );

        // Clear pending action
        await client.query('DELETE FROM ai_pending_actions WHERE id = $1', [pendingReschedule.rows[0].id]);

        const newDateStr = newStartTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const newTimeStr = newStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        return res.json({
          type: 'rescheduled',
          message: `✅ **Meeting rescheduled!**\n\nYour meeting with ${meeting.attendee_email} has been moved to:\n\n📅 ${newDateStr} at ${newTimeStr}\n\nIs there anything else I can help with?`,
          data: { rescheduled: true, bookingId, newStartTime: newStartTime.toISOString() }
        });
      }

      // No pending action
      return res.json({
        type: 'info',
        message: `I'm not sure what you're confirming. What would you like to do?`
      });
    }

    // Handle no confirmation for pending actions
    if (intent === 'confirm_no') {
      // Clear any pending actions
      await client.query(
        `DELETE FROM ai_pending_actions WHERE user_id = $1 AND action_type IN ('cancel_booking', 'reschedule_booking')`,
        [userId]
      );

      return res.json({
        type: 'info',
        message: `No problem, I've cancelled that action. Your meeting remains unchanged.\n\nWhat else can I help with?`
      });
    }

    // Handle template choice (A/B/C or number responses)
    if (intent === 'template_choice') {
      const lower = message.toLowerCase().trim();

      // Check for pending booking action
      const pending = await client.query(
        `SELECT id, action_data FROM ai_pending_actions
         WHERE user_id = $1 AND action_type = 'book_with_template'
         AND expires_at > NOW()`,
        [userId]
      );

      if (pending.rows.length > 0) {
        const pendingData = pending.rows[0].action_data;
        const pendingId = pending.rows[0].id;

        let templateId = null;
        let templateName = 'default confirmation';

        if (lower === 'a') {
          // Use suggested template
          templateId = pendingData.suggestedTemplate?.id;
          templateName = pendingData.suggestedTemplate?.name || 'suggested template';
        } else if (lower === 'b' || lower === 'skip') {
          // Use default (no template)
          templateId = null;
          templateName = 'default confirmation';
        } else if (lower === 'c') {
          // Show all templates
          const allTemplates = await client.query(
            'SELECT id, name, type FROM email_templates WHERE user_id = $1 ORDER BY name',
            [userId]
          );

          if (allTemplates.rows.length === 0) {
            return res.json({
              type: 'info',
              message: "You don't have any custom templates yet. I'll use the default confirmation email.\n\nYou can create templates in **Email Templates** from the sidebar."
            });
          }

          const templateList = allTemplates.rows.map((t, i) =>
            `**${i + 1}.** ${t.name}${t.type ? ` (${t.type})` : ''}`
          ).join('\n');

          return res.json({
            type: 'template_list',
            message: `Here are your templates:\n\n${templateList}\n\nReply with the **number** to use that template, or **"skip"** to use the default.`,
            data: { templates: allTemplates.rows }
          });
        } else if (/^\d+$/.test(lower)) {
          // User selected a template by number
          const templateIndex = parseInt(lower) - 1;
          const allTemplates = await client.query(
            'SELECT id, name, type FROM email_templates WHERE user_id = $1 ORDER BY name',
            [userId]
          );

          if (templateIndex >= 0 && templateIndex < allTemplates.rows.length) {
            templateId = allTemplates.rows[templateIndex].id;
            templateName = allTemplates.rows[templateIndex].name;
          } else {
            return res.json({
              type: 'error',
              message: `Invalid template number. Please choose a number between 1 and ${allTemplates.rows.length}.`
            });
          }
        }

        // Create the booking with selected template
        const bookingDetails = pendingData;

        // Clear pending action first
        await client.query(
          'DELETE FROM ai_pending_actions WHERE id = $1',
          [pendingId]
        );

        // Format date/time for display
        const displayDate = bookingDetails.date || 'the scheduled date';
        const displayTime = bookingDetails.time || 'the scheduled time';

        return res.json({
          type: 'booking_confirmed',
          message: `**Booking Confirmed!**\n\n📅 ${displayDate} at ${displayTime}\n👤 ${bookingDetails.attendeeEmail || 'Guest'}\n📧 Using: ${templateName}\n\n${bookingDetails.attendeeName || 'Your guest'} will receive the confirmation email shortly!`,
          data: {
            booking: bookingDetails,
            templateId,
            templateName
          }
        });
      }

      // No pending action, treat as general message
      return res.json({
        type: 'info',
        message: "I'm not sure what you're responding to. Would you like to book a meeting or do something else?"
      });
    }

    // Handle book meeting intent with template suggestion
    if (intent === 'book_meeting') {
      // Parse booking details from message
      const bookingDetails = parseBookingDetails(message);

      // Check for template suggestion based on meeting type
      const templateSuggestion = await suggestTemplateForBooking(
        client,
        userId,
        message,
        bookingDetails.eventType
      );

      // Also check if event type has a default template
      let eventTypeTemplate = null;
      if (bookingDetails.eventType) {
        const etResult = await client.query(`
          SELECT et.id, et.default_template_id, em.name as template_name
          FROM event_types et
          LEFT JOIN email_templates em ON et.default_template_id = em.id
          WHERE et.user_id = $1 AND LOWER(et.title) LIKE $2 AND et.default_template_id IS NOT NULL
          LIMIT 1
        `, [userId, `%${bookingDetails.eventType.toLowerCase()}%`]);

        if (etResult.rows[0]?.template_name) {
          eventTypeTemplate = {
            id: etResult.rows[0].default_template_id,
            name: etResult.rows[0].template_name
          };
        }
      }

      // Use event type default template if available, otherwise use intent-based suggestion
      const finalSuggestion = eventTypeTemplate
        ? { template: eventTypeTemplate, reason: `This event type uses "${eventTypeTemplate.name}" by default` }
        : templateSuggestion;

      if (finalSuggestion) {
        // Store pending booking with template suggestion
        await client.query(
          `INSERT INTO ai_pending_actions (user_id, action_type, action_data, expires_at)
           VALUES ($1, 'book_with_template', $2, NOW() + INTERVAL '5 minutes')
           ON CONFLICT (user_id, action_type) DO UPDATE SET action_data = $2, expires_at = NOW() + INTERVAL '5 minutes'`,
          [userId, JSON.stringify({ ...bookingDetails, suggestedTemplate: finalSuggestion.template })]
        );

        return res.json({
          type: 'template_suggestion',
          message: `I'll help you book that! 📅\n\n**I found a matching template:** "${finalSuggestion.template.name}"\n${finalSuggestion.reason}\n\nWould you like me to:\n**A)** Use "${finalSuggestion.template.name}" template\n**B)** Use default confirmation email\n**C)** Show me other templates\n\nJust reply with **A**, **B**, or **C**!`,
          data: {
            pendingBooking: bookingDetails,
            suggestedTemplate: finalSuggestion.template
          }
        });
      }

      // No template suggestion, provide booking guidance
      const missingInfo = [];
      if (!bookingDetails.attendeeEmail) missingInfo.push('attendee email');
      if (!bookingDetails.date) missingInfo.push('date');
      if (!bookingDetails.time) missingInfo.push('time');

      if (missingInfo.length > 0) {
        return res.json({
          type: 'clarification',
          message: `I'd be happy to help you book a meeting! I just need a few more details:\n\n${missingInfo.map(i => `- **${i}**`).join('\n')}\n\nFor example: "Book a sales demo with john@example.com on Monday at 2pm"`
        });
      }

      // All details present, proceed with booking
      return res.json({
        type: 'booking_ready',
        message: `Great! I'll book this meeting:\n\n📅 **${bookingDetails.title}**\n🗓️ ${bookingDetails.date} at ${bookingDetails.time}\n👤 ${bookingDetails.attendeeEmail}\n⏱️ ${bookingDetails.duration} minutes\n\nShall I confirm this booking?`,
        data: { booking: bookingDetails }
      });
    }

    // Default general response
    return res.json({
      type: 'general',
      message: `I can help you with:\n\n- 📊 **Analytics** - "Show my booking stats"\n- 🔗 **Links** - "What's my booking link?"\n- 📅 **Schedule** - "Show upcoming meetings"\n- ⚡ **Quick Links** - "Create a quick link"\n- 🎯 **Smart Rules** - "Create a rule for @company.com"\n- 📧 **Book Meeting** - "Book a demo with john@example.com"\n\nWhat would you like to do?`
    });

  } catch (error) {
    console.error('AI schedule error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  } finally {
    client.release();
  }
});

// Helper functions
async function getBookingAnalytics(client, userId) {
  // Combined query for efficiency - get all stats in one query
  const statsResult = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE status != 'cancelled') as total,
      COUNT(*) FILTER (WHERE start_time >= CURRENT_DATE AND start_time < CURRENT_DATE + 1 AND status != 'cancelled') as today,
      COUNT(*) FILTER (WHERE start_time >= CURRENT_DATE AND start_time < CURRENT_DATE + 7 AND status != 'cancelled') as this_week,
      COUNT(*) FILTER (WHERE start_time >= CURRENT_DATE - 7 AND start_time < CURRENT_DATE AND status != 'cancelled') as last_week,
      COUNT(*) FILTER (WHERE start_time >= date_trunc('month', CURRENT_DATE) AND status != 'cancelled') as this_month,
      COUNT(*) FILTER (WHERE start_time >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND start_time < date_trunc('month', CURRENT_DATE) AND status != 'cancelled') as last_month,
      COUNT(*) FILTER (WHERE start_time > NOW() AND status != 'cancelled') as upcoming,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
    FROM bookings
    WHERE user_id = $1
  `, [userId]);

  // Most popular day
  const popularDayResult = await client.query(
    `SELECT EXTRACT(DOW FROM start_time) as day_of_week, COUNT(*) as count
     FROM bookings WHERE user_id = $1 AND status != 'cancelled'
     GROUP BY EXTRACT(DOW FROM start_time)
     ORDER BY count DESC LIMIT 1`,
    [userId]
  );

  // Most popular hour
  const popularHourResult = await client.query(
    `SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
     FROM bookings WHERE user_id = $1 AND status != 'cancelled'
     GROUP BY EXTRACT(HOUR FROM start_time)
     ORDER BY count DESC LIMIT 1`,
    [userId]
  );

  const s = statsResult.rows[0];
  const total = parseInt(s.total) || 0;
  const completed = parseInt(s.completed) || 0;
  const cancelled = parseInt(s.cancelled) || 0;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    total,
    today: parseInt(s.today) || 0,
    thisWeek: parseInt(s.this_week) || 0,
    lastWeek: parseInt(s.last_week) || 0,
    thisMonth: parseInt(s.this_month) || 0,
    lastMonth: parseInt(s.last_month) || 0,
    upcoming: parseInt(s.upcoming) || 0,
    cancelled: cancelled,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    popularDay: popularDayResult.rows[0] ? dayNames[parseInt(popularDayResult.rows[0].day_of_week)] : null,
    popularHour: popularHourResult.rows[0] ? parseInt(popularHourResult.rows[0].hour) : null
  };
}

function formatAnalyticsResponse(stats) {
  let response = `📊 **Your Booking Stats**\n\n`;
  response += `📅 **Today:** ${stats.today} meeting${stats.today !== 1 ? 's' : ''}\n`;
  response += `📆 **This week:** ${stats.thisWeek} meetings\n`;
  response += `⏳ **Upcoming:** ${stats.upcoming} scheduled\n\n`;

  response += `**History:**\n`;
  response += `- Last 7 days: ${stats.lastWeek}\n`;
  response += `- This month: ${stats.thisMonth}\n`;
  response += `- Total: ${stats.total}\n`;
  response += `- Cancelled: ${stats.cancelled}\n`;

  if (stats.popularDay || stats.popularHour !== null) {
    response += `\n**Peak Times:**\n`;
    if (stats.popularDay) response += `- Busiest day: ${stats.popularDay}\n`;
    if (stats.popularHour !== null) {
      const hour = stats.popularHour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      response += `- Popular hour: ${displayHour}:00 ${ampm}\n`;
    }
  }

  response += `\nAnything else you'd like to know?`;

  return response;
}

function formatAction(actionType, actionValue) {
  switch (actionType) {
    case 'set_duration':
      return `Set duration to ${actionValue} minutes`;
    case 'auto_approve':
      return 'Auto-approve booking';
    case 'block':
      return 'Block booking';
    case 'set_priority':
      return `Set priority to ${actionValue}`;
    case 'add_buffer':
      return `Add ${actionValue} min buffer after meetings`;
    case 'route_to':
      return `Route to ${actionValue}`;
    default:
      return `${actionType}: ${actionValue}`;
  }
}

async function getBookingLink(client, userId) {
  const userResult = await client.query(
    'SELECT email, username FROM users WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];
  const username = user.username || user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

  const frontendUrl = process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app';
  const url = `${frontendUrl}/${username}`;

  return { url, username, type: 'booking', short_url: `/${username}` };
}

async function getUpcomingMeetings(client, userId) {
  const result = await client.query(
    `SELECT * FROM bookings
     WHERE user_id = $1 AND start_time > NOW() AND status != 'cancelled'
     ORDER BY start_time ASC LIMIT 5`,
    [userId]
  );
  return result.rows;
}

function formatUpcomingMeetings(meetings) {
  return meetings.map((m, i) => {
    const date = new Date(m.start_time);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${i + 1}. **${m.title || 'Meeting'}** - ${dateStr} at ${timeStr}\n   with ${m.attendee_email}`;
  }).join('\n\n');
}

async function createQuickLink(client, userId, message) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(8).toString('hex');

  // Parse duration from message if mentioned
  let duration = 30;
  const durationMatch = message.match(/(\d+)\s*(min|minute)/i);
  if (durationMatch) {
    duration = parseInt(durationMatch[1]);
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const result = await client.query(
    `INSERT INTO magic_links (user_id, token, duration_minutes, expires_at, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [userId, token, duration, expiresAt]
  );

  const frontendUrl = process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app';
  const url = `${frontendUrl}/m/${token}`;

  return {
    url,
    token,
    type: 'magic',
    short_url: `/m/${token.substring(0, 8)}...`,
    duration,
    expiresAt
  };
}

async function getTeamLinks(client, userId) {
  const result = await client.query(
    `SELECT t.id, t.name, t.slug, t.team_booking_token
     FROM teams t
     JOIN team_members tm ON t.id = tm.team_id
     WHERE tm.user_id = $1 AND tm.is_active = true
     AND t.name NOT LIKE '%Personal%'`,
    [userId]
  );

  const frontendUrl = process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app';

  return result.rows.map(team => ({
    id: team.id,
    name: team.name,
    url: `${frontendUrl}/team/${team.slug || team.team_booking_token}`,
    short_url: `/team/${team.slug || team.team_booking_token}`
  }));
}

// Find matching meetings based on reference criteria
async function findMatchingMeetings(client, userId, reference) {
  let query = `
    SELECT * FROM bookings
    WHERE user_id = $1
    AND status != 'cancelled'
    AND start_time > NOW()
  `;
  const params = [userId];
  let paramIndex = 2;

  // Filter by meeting ID
  if (reference.meetingId) {
    query += ` AND id = $${paramIndex++}`;
    params.push(reference.meetingId);
  }

  // Filter by email
  if (reference.email) {
    query += ` AND LOWER(attendee_email) = $${paramIndex++}`;
    params.push(reference.email.toLowerCase());
  }

  // Filter by name
  if (reference.name && !reference.email) {
    query += ` AND LOWER(attendee_name) LIKE $${paramIndex++}`;
    params.push(`%${reference.name.toLowerCase()}%`);
  }

  // Filter by date
  if (reference.date) {
    const startOfDay = new Date(reference.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reference.date);
    endOfDay.setHours(23, 59, 59, 999);

    query += ` AND start_time >= $${paramIndex++} AND start_time <= $${paramIndex++}`;
    params.push(startOfDay.toISOString(), endOfDay.toISOString());
  }

  // Filter by time (approximate match within 30 minutes)
  if (reference.time && reference.date) {
    const targetTime = new Date(reference.date);
    targetTime.setHours(reference.time.hours, reference.time.minutes, 0, 0);
    const timeBefore = new Date(targetTime.getTime() - 30 * 60000);
    const timeAfter = new Date(targetTime.getTime() + 30 * 60000);

    query += ` AND start_time >= $${paramIndex++} AND start_time <= $${paramIndex++}`;
    params.push(timeBefore.toISOString(), timeAfter.toISOString());
  }

  query += ` ORDER BY start_time ASC LIMIT 10`;

  const result = await client.query(query, params);
  return result.rows;
}

// Get week availability summary
async function getWeekAvailability(client, userId) {
  const today = new Date();
  const weekDays = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // Get bookings for this day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await client.query(
      `SELECT COUNT(*) as count FROM bookings
       WHERE user_id = $1 AND status != 'cancelled'
       AND start_time >= $2 AND start_time <= $3`,
      [userId, startOfDay.toISOString(), endOfDay.toISOString()]
    );

    weekDays.push({
      date,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      bookingCount: parseInt(bookings.rows[0].count),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }

  return weekDays;
}

// Format week availability for display
function formatWeekAvailability(weekDays) {
  let response = `📅 **Your Week at a Glance**\n\n`;

  weekDays.forEach(day => {
    const status = day.isWeekend ? '🔒' : (day.bookingCount === 0 ? '✅' : (day.bookingCount >= 5 ? '🔴' : '🟡'));
    const bookingText = day.bookingCount === 0 ? 'Free' : `${day.bookingCount} meeting${day.bookingCount > 1 ? 's' : ''}`;
    response += `${status} **${day.dayName}** ${day.dateStr}: ${bookingText}\n`;
  });

  response += `\n💡 Ask "Am I free tomorrow at 2pm?" to check specific times.`;
  return response;
}

// Get available slots for a specific date
async function getAvailableSlotsForDate(client, userId, date) {
  // Get user's working hours
  const userResult = await client.query(
    'SELECT working_hours, timezone FROM users WHERE id = $1',
    [userId]
  );

  const user = userResult.rows[0];
  const workingHours = user?.working_hours || {
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false },
    sunday: { enabled: false }
  };

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];
  const dayHours = workingHours[dayName];

  if (!dayHours?.enabled) {
    return []; // Not a working day
  }

  // Parse working hours
  const [startHour, startMin] = (dayHours.start || '09:00').split(':').map(Number);
  const [endHour, endMin] = (dayHours.end || '17:00').split(':').map(Number);

  const dayStart = new Date(date);
  dayStart.setHours(startHour, startMin, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(endHour, endMin, 0, 0);

  // Get existing bookings for the day
  const bookings = await client.query(
    `SELECT start_time, end_time FROM bookings
     WHERE user_id = $1 AND status != 'cancelled'
     AND start_time >= $2 AND start_time < $3
     ORDER BY start_time ASC`,
    [userId, dayStart.toISOString(), dayEnd.toISOString()]
  );

  // Calculate available slots (30-minute increments)
  const slots = [];
  let currentTime = new Date(dayStart);

  // Don't show past slots
  const now = new Date();
  if (currentTime < now) {
    currentTime = new Date(now);
    currentTime.setMinutes(Math.ceil(currentTime.getMinutes() / 30) * 30, 0, 0);
  }

  while (currentTime < dayEnd) {
    const slotEnd = new Date(currentTime.getTime() + 30 * 60000);

    // Check if slot conflicts with any booking
    const hasConflict = bookings.rows.some(booking => {
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);
      return currentTime < bookingEnd && slotEnd > bookingStart;
    });

    if (!hasConflict) {
      slots.push({
        start: currentTime.toISOString(),
        end: slotEnd.toISOString()
      });
    }

    currentTime = slotEnd;
  }

  return slots;
}

// POST /api/ai/schedule/confirm - Confirm booking with scheduling rules
router.post('/schedule/confirm', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const {
      title,
      start_time,
      end_time,
      attendee_email,
      attendee_name,
      notes,
      duration,
      team_id
    } = req.body;

    // Apply scheduling rules
    const bookingData = {
      attendee_name: attendee_name || (attendee_email ? attendee_email.split('@')[0] : 'Guest'),
      attendee_email: attendee_email || '',
      start_time,
      end_time,
      user_id: userId,
      team_id: team_id || null,
      title: title || 'Meeting',
      notes: notes || '',
      duration: duration || 30,
      status: 'confirmed'
    };

    console.log('📅 AI Schedule Confirm:', bookingData.title, 'for', bookingData.attendee_email);

    const ruleResults = await applySchedulingRules(client, userId, bookingData);

    // Check if booking is blocked by rules
    if (ruleResults.blocked) {
      console.log('🚫 AI booking blocked by rule:', ruleResults.blockReason);
      return res.status(403).json({
        success: false,
        error: 'Booking blocked',
        reason: ruleResults.blockReason,
        appliedRules: ruleResults.appliedRules
      });
    }

    // Use modified data from rules
    const finalData = ruleResults.modifiedData;

    // Recalculate end_time if duration was modified
    let finalEndTime = end_time;
    if (ruleResults.appliedRules.some(r => r.action.includes('set_duration'))) {
      const startDate = new Date(start_time);
      finalEndTime = new Date(startDate.getTime() + finalData.duration * 60000).toISOString();
    }

    const result = await client.query(
      `INSERT INTO bookings (attendee_name, attendee_email, start_time, end_time, user_id, team_id, status, title, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        finalData.attendee_name,
        finalData.attendee_email,
        finalData.start_time,
        finalEndTime,
        finalData.user_id,
        finalData.team_id,
        finalData.status,
        finalData.title,
        finalData.notes
      ]
    );

    const booking = result.rows[0];

    // Log applied rules
    if (ruleResults.appliedRules.length > 0) {
      console.log('✨ Applied rules to AI schedule confirm:', ruleResults.appliedRules.map(r => r.name).join(', '));
    }

    res.json({
      success: true,
      message: 'Booking confirmed',
      booking,
      appliedRules: ruleResults.appliedRules.length > 0 ? ruleResults.appliedRules : undefined,
      autoApproved: ruleResults.autoApproved || undefined
    });

  } catch (error) {
    console.error('Error confirming AI booking:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm booking' });
  } finally {
    client.release();
  }
});

// POST /api/ai/suggest - Get AI suggestions
router.post('/suggest', authenticateToken, async (req, res) => {
  res.json({ suggestions: [] });
});

// Cleanup expired pending actions (runs periodically)
async function cleanupExpiredPendingActions() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM ai_pending_actions WHERE expires_at < NOW()'
    );
    if (result.rowCount > 0) {
      console.log(`🧹 Cleaned up ${result.rowCount} expired AI pending actions`);
    }
  } catch (error) {
    // Table might not exist yet, ignore error
    if (!error.message.includes('does not exist')) {
      console.error('Error cleaning up pending actions:', error);
    }
  } finally {
    client.release();
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredPendingActions, 5 * 60 * 1000);

// Run initial cleanup after 10 seconds (give server time to start)
setTimeout(cleanupExpiredPendingActions, 10000);

module.exports = router;
