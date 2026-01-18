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
  const { stats = {}, upcomingMeetings = [], eventTypes = [] } = userData;

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
- Active Event Types: ${eventTypes.length || 0}
- Upcoming Meetings: ${upcomingMeetings.length || 0}
- Meeting Templates Available: ${userData.templates?.length || 0}

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

**Special Instructions:**
- For booking requests: Extract email, date, time, duration → Ask for confirmation
- For analytics: Provide actual numbers from user data
- For links: Return the full URL format
- For cancellations/reschedules: Require explicit confirmation
- For template suggestions: Match meeting type to appropriate template

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

module.exports = {
  getAIResponse,
  getQuickResponse
};
