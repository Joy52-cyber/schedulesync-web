const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Get AI response using Claude for natural conversation
 * Enhances rule-based responses with natural language understanding
 * @param {string} userMessage - User's message
 * @param {Array} conversationHistory - Previous messages
 * @param {Object} context - User context (timezone, tier, page, etc.)
 * @param {Object} userData - User's booking data, event types, stats, etc.
 * @returns {Promise<Object>} - AI response with message and suggested actions
 */
async function getAIResponse(userMessage, conversationHistory = [], context = {}, userData = {}) {
  try {
    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(context, userData);

    // Build conversation messages
    const messages = buildConversationMessages(userMessage, conversationHistory);

    console.log(`🤖 Calling Claude AI for: "${userMessage.substring(0, 50)}..."`);

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages
    });

    const assistantMessage = response.content[0].text;

    // Extract structured data from response if present
    const structuredData = extractStructuredData(assistantMessage);

    return {
      message: assistantMessage,
      ...structuredData,
      modelUsed: 'claude-3-5-haiku-20241022'
    };

  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

/**
 * Build system prompt with user context
 */
function buildSystemPrompt(context, userData) {
  const { personality = 'friendly', timezone, tier, currentPage, userName } = context;
  const { stats = {}, upcomingMeetings = [], eventTypes = [], templates = [], topAttendees = [], activeRules = [], attendeeContext = null } = userData;

  // Build insights section
  let insights = [];

  if (stats.popular_day) {
    insights.push(`Your busiest day is ${stats.popular_day}`);
  }

  if (stats.popular_hour !== null && stats.popular_hour !== undefined) {
    const hour = stats.popular_hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    insights.push(`You typically meet at ${displayHour}:00 ${ampm}`);
  }

  if (topAttendees.length > 0) {
    const topPerson = topAttendees[0];
    insights.push(`You meet most often with ${topPerson.attendee_email} (${topPerson.meeting_count} meetings)`);
  }

  if (stats.this_week > 10) {
    insights.push(`Heavy week ahead with ${stats.this_week} meetings`);
  }

  const upcomingDetails = upcomingMeetings.map(m => {
    const date = new Date(m.start_time);
    return `- ${m.title || 'Meeting'} with ${m.attendee_email || m.attendee_name} on ${date.toLocaleDateString()}`;
  }).join('\n');

  let prompt = `You are TruCal Assistant, a helpful AI scheduling assistant integrated into the TruCal scheduling platform.

**Your Personality:** ${getPersonalityInstructions(personality)}

**User Context:**
- Name: ${userName || 'User'}
- Timezone: ${timezone || 'Not set'}
- Plan: ${tier || 'free'} tier
- Current Page: ${currentPage || 'Dashboard'}

**User's Scheduling Data:**
- Total Bookings (all-time): ${stats.total_bookings || 0}
- This Month: ${stats.this_month || 0}
- This Week: ${stats.this_week || 0}
- Upcoming: ${stats.upcoming || 0}
- Active Event Types: ${eventTypes.length || 0}
- Meeting Templates Available: ${templates.length || 0}
- Active Smart Rules: ${activeRules.length || 0}

${insights.length > 0 ? `**Behavioral Insights:**\n${insights.map(i => `- ${i}`).join('\n')}\n` : ''}
${upcomingMeetings.length > 0 ? `**Upcoming Meetings:**\n${upcomingDetails}\n` : ''}
${templates.length > 0 ? `**Available Templates:** ${templates.map(t => t.name).join(', ')}\n` : ''}
${topAttendees.length > 0 ? `**Frequent Collaborators:** ${topAttendees.map(a => `${a.attendee_email} (${a.meeting_count})`).join(', ')}\n` : ''}
${attendeeContext ? `**Attendee Intelligence for ${attendeeContext.email}:**
- Meeting History: You've met ${attendeeContext.profile.meeting_count} time(s)
- Last Meeting: ${attendeeContext.profile.last_meeting_date ? new Date(attendeeContext.profile.last_meeting_date).toLocaleDateString() : 'Never'}
${attendeeContext.preferences.hasPattern ? `- Preferred Days: ${attendeeContext.preferences.preferredDays.join(', ')}
- Preferred Times: ${attendeeContext.preferences.preferredTimes.join(', ')}
- Typical Duration: ${attendeeContext.preferences.averageDuration} minutes` : ''}
${attendeeContext.profile.notes ? `- Notes: ${attendeeContext.profile.notes}` : ''}
${attendeeContext.recentMeetings.length > 0 ? `- Recent Meetings: ${attendeeContext.recentMeetings.slice(0, 2).map(m => m.title || 'Meeting').join(', ')}` : ''}

IMPORTANT: Mention this relationship context when booking! Say something like "You've met with ${attendeeContext.email} ${attendeeContext.profile.meeting_count} times before" and suggest times that match their pattern if available.
` : ''}

**Your Capabilities:**
1. **Scheduling**: Help book meetings, find available times, create quick links
2. **Management**: Cancel, reschedule, or modify existing bookings
3. **Analytics**: Provide booking stats, trends, and insights
4. **Smart Rules**: Create scheduling rules (buffer time, day blocking, routing)
5. **Links & Sharing**: Get booking links, create single-use links, share team links
6. **Availability**: Check free time, show calendar, suggest optimal slots
7. **Templates**: Suggest meeting templates with pre-filled agendas (Sales Discovery, 1-on-1s, Product Demo, Team Standup, Project Kickoff, Customer Support)
8. **Smart Suggestions**: AI-powered time slot recommendations based on user patterns
9. **Relationship Insights**: Track meeting history with attendees
10. **Navigation**: Help users navigate the platform

**Response Guidelines:**
1. Be concise but friendly - users are busy
2. Offer specific, actionable suggestions
3. Use formatting: **bold** for emphasis, bullet points for lists
4. Include relevant links when applicable: [Link Text](/path)
5. For complex requests, break them into steps
6. Proactively suggest next actions
7. Use emojis sparingly and appropriately 📅 🚀 ✅
8. When booking, ALWAYS confirm details before creating
9. If you need more info, ask specific questions
10. Detect and highlight conflicts or issues

**Proactive Intelligence:**
- If user asks about availability, check their upcoming meetings and suggest optimal times
- If user books with a frequent collaborator, mention the relationship ("You've met with them ${X} times")
- If it's a sales/demo meeting type, suggest the appropriate template
- If user's week is heavy, suggest they might want to block time or add buffer rules
- When showing stats, highlight interesting patterns (busiest day, favorite times)
- If user mentions a specific day, check if they have any rules blocking that day
- Suggest templates that match the meeting type being discussed
- If user has no upcoming meetings, proactively suggest sharing their booking link

**Special Instructions:**
- For booking requests: Extract email, date, time, duration → Check if attendee is a frequent collaborator → Mention relationship if exists → Ask for confirmation
- For analytics: Provide actual numbers from user data → Highlight patterns and insights
- For links: Return the full URL format
- For cancellations/reschedules: Require explicit confirmation
- For template suggestions: Match meeting type to appropriate template:
  * "sales", "demo", "pitch" → Sales Discovery Call template
  * "1-on-1", "check-in", "sync" → Weekly 1-on-1 template
  * "demo", "walkthrough", "presentation" → Product Demo template
  * "standup", "daily", "quick sync" → Team Standup template
  * "kickoff", "planning", "project start" → Project Kickoff template
  * "support", "help", "issue" → Customer Support Call template

**Relationship Intelligence:**
When user mentions an email address, check topAttendees list:
- If found: "You've met with [email] [count] times before!"
- Suggest: "Would you like to use the same meeting format as last time?"
- If it's their #1 collaborator: "That's your most frequent meeting partner!"

**Time Intelligence:**
- If user asks about "tomorrow" and it's their popular day: "Tomorrow is [Day], typically your busiest day!"
- If they try to book at an unusual hour (not their popular_hour): "You usually meet at [X]:00, but [requested time] works too!"
- If this week is particularly busy: "You have [X] meetings this week, more than usual. Want me to help reorganize?"

**Template Auto-Matching Examples:**
- User: "Book a sales call with john@acme.com" → Suggest: "I'll use the **Sales Discovery Call** template (30 min) with a pre-filled agenda. Sound good?"
- User: "Schedule my weekly sync with Sarah" → Suggest: "Using your **Weekly 1-on-1** template for this!"
- User: "Demo for prospects tomorrow" → Suggest: "I'll set this up with the **Product Demo** template (45 min with Q&A section)"

**Format for Actions:**
When you want to trigger an action or return structured data, use this format at the end of your response:

[ACTION:type:data]

Types:
- BOOKING_CONFIRM: Ready to book meeting
- LINK: Share a booking link
- ANALYTICS: Show statistics
- TEMPLATE_SUGGEST: Suggest meeting template
- AVAILABILITY: Show available slots

Example:
Great! I'll book a meeting with john@example.com for tomorrow at 2pm.

[ACTION:BOOKING_CONFIRM:{"email":"john@example.com","date":"tomorrow","time":"2pm","duration":30}]`;

  return prompt;
}

/**
 * Get personality-specific instructions
 */
function getPersonalityInstructions(personality) {
  const instructions = {
    friendly: 'Warm, conversational, and encouraging. Use casual language while staying professional. Add enthusiasm!',
    professional: 'Formal, concise, and business-focused. Use precise language and avoid casual expressions.',
    concise: 'Extremely brief. Get straight to the point. No extra words. Short sentences.'
  };
  return instructions[personality] || instructions.friendly;
}

/**
 * Build conversation messages for Claude
 */
function buildConversationMessages(userMessage, conversationHistory) {
  const messages = [];

  // Add conversation history (limit to last 10 messages for context)
  const recentHistory = conversationHistory.slice(-10);

  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage
  });

  return messages;
}

/**
 * Extract structured data from Claude's response
 * Looks for [ACTION:type:data] markers
 */
function extractStructuredData(message) {
  const actionPattern = /\[ACTION:(\w+):({[^}]+})\]/;
  const match = message.match(actionPattern);

  if (match) {
    try {
      const actionType = match[1];
      const actionData = JSON.parse(match[2]);

      // Remove the action marker from the message
      const cleanMessage = message.replace(actionPattern, '').trim();

      return {
        message: cleanMessage,
        actionType,
        actionData,
        hasAction: true
      };
    } catch (e) {
      console.error('Failed to parse action data:', e);
    }
  }

  return {
    message,
    hasAction: false
  };
}

/**
 * Get quick response without AI for simple queries
 * Used as fallback or for very common questions
 */
function getQuickResponse(intent, context) {
  const responses = {
    greeting: `Hi there! I'm your TruCal scheduling assistant. I can help you book meetings, share links, check your calendar, and more!\n\nWhat would you like to do?`,

    help: `Here's what I can help you with:\n\n📅 **Scheduling**\n- "Book a meeting with john@email.com tomorrow at 2pm"\n- "What's my availability this week?"\n- "Create a quick link for a 30-min call"\n\n🔗 **Links**\n- "What's my booking link?"\n- "Show my team links"\n\n📊 **Analytics**\n- "Show my booking stats"\n- "How many meetings this month?"\n\n⚙️ **Smart Rules**\n- "Block Fridays"\n- "Add 15 min buffer after meetings"\n\nJust ask me in plain English!`,

    capabilities: `I can help you with:\n\n✅ Book, cancel, and reschedule meetings\n✅ Share booking links and create quick links\n✅ Check your availability and calendar\n✅ Show booking statistics and trends\n✅ Create smart scheduling rules\n✅ Suggest meeting templates\n✅ Find meetings with specific people\n\nTry asking me something!`
  };

  return responses[intent] || null;
}

/**
 * Generate proactive suggestions based on user context
 * @param {Object} userData - User's scheduling data
 * @returns {Array} - List of proactive suggestions
 */
function generateProactiveSuggestions(userData) {
  const suggestions = [];
  const { stats, upcomingMeetings, templates, topAttendees, activeRules } = userData;

  // No upcoming meetings - suggest sharing link
  if (stats.upcoming === 0 && stats.total_bookings > 0) {
    suggestions.push({
      type: 'share_link',
      priority: 'high',
      message: 'No upcoming meetings. Share your booking link to get booked!',
      action: 'What\'s my booking link?'
    });
  }

  // Heavy week - suggest buffer time
  if (stats.this_week > 10 && activeRules.length === 0) {
    suggestions.push({
      type: 'add_buffer',
      priority: 'medium',
      message: `You have ${stats.this_week} meetings this week! Consider adding buffer time between meetings.`,
      action: 'Add 15 min buffer after meetings'
    });
  }

  // No templates but have meetings - suggest creating one
  if (stats.total_bookings > 5 && templates.length === 0) {
    suggestions.push({
      type: 'create_template',
      priority: 'low',
      message: 'Save time by creating meeting templates for recurring meeting types!',
      action: 'Show me available templates'
    });
  }

  // Frequent collaborator - suggest optimizing
  if (topAttendees.length > 0 && topAttendees[0].meeting_count > 5) {
    const topPerson = topAttendees[0];
    suggestions.push({
      type: 'optimize_recurring',
      priority: 'low',
      message: `You meet often with ${topPerson.attendee_email}. Want to set up a recurring meeting?`,
      action: `Book recurring with ${topPerson.attendee_email}`
    });
  }

  return suggestions.sort((a, b) => {
    const priority = { high: 3, medium: 2, low: 1 };
    return priority[b.priority] - priority[a.priority];
  }).slice(0, 2); // Return top 2 suggestions
}

module.exports = {
  getAIResponse,
  getQuickResponse,
  generateProactiveSuggestions
};
