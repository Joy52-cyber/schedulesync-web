const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { applySchedulingRules } = require('../utils/schedulingRules');

// Intent detection helpers
const detectIntent = (message) => {
  const lowerMessage = message.toLowerCase();

  // Analytics intent
  if (lowerMessage.includes('analytics') ||
      lowerMessage.includes('stats') ||
      lowerMessage.includes('statistics') ||
      lowerMessage.includes('how many bookings') ||
      lowerMessage.includes('booking stats') ||
      lowerMessage.includes('my numbers') ||
      lowerMessage.includes('performance')) {
    return 'analytics';
  }

  // Smart rule creation intent
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('set up') || lowerMessage.includes('make')) &&
      (lowerMessage.includes('rule') || lowerMessage.includes('smart rule') || lowerMessage.includes('scheduling rule'))) {
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

// Parse booking details from natural language
function parseBookingDetails(message) {
  const details = {
    attendeeEmail: null,
    attendeeName: null,
    date: null,
    time: null,
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

  // Extract date patterns
  const datePatterns = [
    /(?:on\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(?:on\s+)?(tomorrow|today|next\s+week)/i,
    /(?:on\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)/i
  ];

  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      details.date = match[1];
      break;
    }
  }

  // Extract time
  const timeMatch = message.match(/(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (timeMatch) {
    details.time = timeMatch[1];
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

// Parse smart rule from natural language
const parseRuleFromMessage = (message) => {
  const lowerMessage = message.toLowerCase();
  let rule = {
    name: '',
    trigger_type: 'domain',
    trigger_value: '',
    action_type: 'set_duration',
    action_value: '30',
    is_active: true
  };

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

  // Detect duration action
  const durationMatch = message.match(/(\d+)\s*(min|minute|hour)/i);
  if (durationMatch) {
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
  }

  // Detect block action
  if (lowerMessage.includes('block') || lowerMessage.includes('reject') || lowerMessage.includes('decline')) {
    rule.action_type = 'block';
    rule.action_value = 'true';
  }

  // Detect priority action
  if (lowerMessage.includes('priority') || lowerMessage.includes('vip') || lowerMessage.includes('important')) {
    rule.action_type = 'set_priority';
    rule.action_value = 'high';
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
        message: `**TruCal Plans:**\n\n**Free** - $0/month\n- 10 AI queries/month\n- Basic booking page\n- Google Calendar sync\n\n**Pro** - $15/month\n- Unlimited AI queries\n- Quick links & email assistant\n- Custom booking rules\n- Priority support\n\n**Team** - $25/month\n- Everything in Pro\n- Team booking pages\n- Round-robin scheduling\n- Team analytics\n\n[Upgrade now](/billing)`
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
  // Total bookings
  const totalResult = await client.query(
    'SELECT COUNT(*) as count FROM bookings WHERE user_id = $1',
    [userId]
  );

  // This month's bookings
  const thisMonthResult = await client.query(
    `SELECT COUNT(*) as count FROM bookings
     WHERE user_id = $1 AND start_time >= date_trunc('month', CURRENT_DATE)`,
    [userId]
  );

  // Last month's bookings
  const lastMonthResult = await client.query(
    `SELECT COUNT(*) as count FROM bookings
     WHERE user_id = $1
     AND start_time >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
     AND start_time < date_trunc('month', CURRENT_DATE)`,
    [userId]
  );

  // Upcoming bookings
  const upcomingResult = await client.query(
    `SELECT COUNT(*) as count FROM bookings
     WHERE user_id = $1 AND start_time > NOW() AND status != 'cancelled'`,
    [userId]
  );

  // Completion rate
  const completedResult = await client.query(
    `SELECT COUNT(*) as count FROM bookings
     WHERE user_id = $1 AND status = 'completed'`,
    [userId]
  );

  // Cancellation rate
  const cancelledResult = await client.query(
    `SELECT COUNT(*) as count FROM bookings
     WHERE user_id = $1 AND status = 'cancelled'`,
    [userId]
  );

  // Most popular day
  const popularDayResult = await client.query(
    `SELECT EXTRACT(DOW FROM start_time) as day_of_week, COUNT(*) as count
     FROM bookings WHERE user_id = $1
     GROUP BY EXTRACT(DOW FROM start_time)
     ORDER BY count DESC LIMIT 1`,
    [userId]
  );

  // Most popular hour
  const popularHourResult = await client.query(
    `SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
     FROM bookings WHERE user_id = $1
     GROUP BY EXTRACT(HOUR FROM start_time)
     ORDER BY count DESC LIMIT 1`,
    [userId]
  );

  const total = parseInt(totalResult.rows[0].count);
  const completed = parseInt(completedResult.rows[0].count);
  const cancelled = parseInt(cancelledResult.rows[0].count);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    total,
    thisMonth: parseInt(thisMonthResult.rows[0].count),
    lastMonth: parseInt(lastMonthResult.rows[0].count),
    upcoming: parseInt(upcomingResult.rows[0].count),
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    popularDay: popularDayResult.rows[0] ? dayNames[parseInt(popularDayResult.rows[0].day_of_week)] : null,
    popularHour: popularHourResult.rows[0] ? parseInt(popularHourResult.rows[0].hour) : null
  };
}

function formatAnalyticsResponse(stats) {
  const monthChange = stats.lastMonth > 0
    ? Math.round(((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100)
    : stats.thisMonth > 0 ? 100 : 0;

  const changeText = monthChange > 0 ? `+${monthChange}%` : `${monthChange}%`;
  const changeEmoji = monthChange > 0 ? '📈' : monthChange < 0 ? '📉' : '➡️';

  let response = `**Your Booking Analytics** 📊\n\n`;
  response += `**All Time:** ${stats.total} bookings\n`;
  response += `**This Month:** ${stats.thisMonth} bookings ${changeEmoji} ${changeText} vs last month\n`;
  response += `**Upcoming:** ${stats.upcoming} scheduled\n\n`;

  if (stats.completionRate > 0 || stats.cancellationRate > 0) {
    response += `**Rates:**\n`;
    response += `- Completion: ${stats.completionRate}%\n`;
    response += `- Cancellation: ${stats.cancellationRate}%\n\n`;
  }

  if (stats.popularDay || stats.popularHour !== null) {
    response += `**Peak Times:**\n`;
    if (stats.popularDay) response += `- Busiest day: ${stats.popularDay}\n`;
    if (stats.popularHour !== null) {
      const hour = stats.popularHour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      response += `- Popular hour: ${displayHour}:00 ${ampm}\n`;
    }
  }

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
