const pool = require('../config/database');
const Anthropic = require('@anthropic-ai/sdk');
const { DateTime } = require('luxon');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate meeting agenda from email thread context
 * @param {number} bookingId - The booking ID
 * @returns {Promise<string|null>} - The generated agenda or null if no thread exists
 */
async function generateAgendaFromEmail(bookingId) {
  try {
    console.log(`Generating agenda for booking ${bookingId}...`);

    // Get booking details
    const bookingResult = await pool.query(
      `SELECT b.*, u.email as user_email, u.name as user_name
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      console.log(`Booking ${bookingId} not found`);
      return null;
    }

    const booking = bookingResult.rows[0];

    // Get email thread if it exists
    const threadResult = await pool.query(
      `SELECT id, subject FROM email_bot_threads WHERE booking_id = $1`,
      [bookingId]
    );

    if (threadResult.rows.length === 0) {
      console.log(`No email thread found for booking ${bookingId}`);
      return null;
    }

    const thread = threadResult.rows[0];

    // Get all messages in the thread
    const messagesResult = await pool.query(
      `SELECT body_text, from_email, created_at
       FROM email_bot_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC`,
      [thread.id]
    );

    if (messagesResult.rows.length === 0) {
      console.log(`No messages found for thread ${thread.id}`);
      return null;
    }

    // Build email context (only use actual email content, skip bot responses)
    const emailContext = messagesResult.rows
      .filter(m => !m.from_email.includes('@mg.trucal.xyz')) // Filter out bot messages
      .map(m => {
        const timestamp = DateTime.fromJSDate(m.created_at).toFormat('MMM d, h:mm a');
        return `From: ${m.from_email} (${timestamp})\n${m.body_text}`;
      })
      .join('\n\n---\n\n');

    if (!emailContext.trim()) {
      console.log(`No human email content found for thread ${thread.id}`);
      return null;
    }

    // Generate agenda with Claude
    console.log(`Calling Claude API to generate agenda...`);
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are analyzing an email thread that led to a scheduled meeting. Generate a concise meeting agenda.

Format as bullet points under these sections (only include sections if relevant):

**Purpose**
- Main reason for the meeting

**Discussion Topics**
- Topics to cover during the meeting

**Questions to Address**
- Specific questions mentioned in the emails

Keep it brief (3-6 bullet points total). Focus on actionable items. If the email thread doesn't provide enough context for a meaningful agenda, just say "General discussion" for Purpose.

Email thread:
${emailContext}`
      }]
    });

    const agenda = response.content[0].text.trim();

    // Store agenda in meeting_context
    await pool.query(
      `INSERT INTO meeting_context (booking_id, email_thread_id, generated_agenda, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (booking_id) DO UPDATE SET
         generated_agenda = $3,
         email_thread_id = $2,
         updated_at = NOW()`,
      [bookingId, thread.id, agenda]
    );

    console.log(`✅ Agenda generated and stored for booking ${bookingId}`);
    return agenda;

  } catch (error) {
    console.error(`Error generating agenda for booking ${bookingId}:`, error);
    return null;
  }
}

/**
 * Get or generate agenda for a booking
 * @param {number} bookingId - The booking ID
 * @returns {Promise<string|null>} - The agenda (cached or newly generated)
 */
async function getAgenda(bookingId) {
  try {
    // Check if agenda already exists
    const result = await pool.query(
      `SELECT generated_agenda FROM meeting_context WHERE booking_id = $1`,
      [bookingId]
    );

    if (result.rows.length > 0 && result.rows[0].generated_agenda) {
      console.log(`Using cached agenda for booking ${bookingId}`);
      return result.rows[0].generated_agenda;
    }

    // Generate new agenda
    return await generateAgendaFromEmail(bookingId);

  } catch (error) {
    console.error(`Error getting agenda for booking ${bookingId}:`, error);
    return null;
  }
}

/**
 * Generate context summary for a meeting (less detailed than agenda)
 * @param {number} bookingId - The booking ID
 * @returns {Promise<string|null>} - Context summary or null
 */
async function generateContextSummary(bookingId) {
  try {
    // Get email thread
    const threadResult = await pool.query(
      `SELECT ebt.id FROM email_bot_threads ebt
       WHERE ebt.booking_id = $1`,
      [bookingId]
    );

    if (threadResult.rows.length === 0) return null;

    const threadId = threadResult.rows[0].id;

    // Get messages
    const messagesResult = await pool.query(
      `SELECT body_text FROM email_bot_messages
       WHERE thread_id = $1 AND direction = 'inbound'
       ORDER BY created_at ASC`,
      [threadId]
    );

    if (messagesResult.rows.length === 0) return null;

    const emailContent = messagesResult.rows
      .map(m => m.body_text)
      .join('\n\n');

    // Generate summary
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Summarize the context of this meeting request in 1-2 sentences. Focus on WHY they want to meet.

Emails:
${emailContent}`
      }]
    });

    const summary = response.content[0].text.trim();

    // Store in meeting_context
    await pool.query(
      `INSERT INTO meeting_context (booking_id, context_summary, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (booking_id) DO UPDATE SET
         context_summary = $2,
         updated_at = NOW()`,
      [bookingId, summary]
    );

    return summary;

  } catch (error) {
    console.error(`Error generating context summary for booking ${bookingId}:`, error);
    return null;
  }
}

module.exports = {
  generateAgendaFromEmail,
  getAgenda,
  generateContextSummary
};
