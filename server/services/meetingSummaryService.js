const pool = require('../config/database');
const Anthropic = require('@anthropic-ai/sdk');
const { sendEmail } = require('./email');
const { DateTime } = require('luxon');
const mjml2html = require('mjml');
const fs = require('fs').promises;
const path = require('path');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate meeting summary from email thread context
 * @param {number} bookingId - The booking ID
 * @returns {Promise<string|null>} - The generated summary or null if no thread exists
 */
async function generateMeetingSummary(bookingId) {
  try {
    // Get booking details
    const bookingResult = await pool.query(
      `SELECT b.*, u.email as user_email, u.name as user_name, u.timezone
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

    // Build email context
    const emailContext = messagesResult.rows
      .map(m => {
        const timestamp = DateTime.fromJSDate(m.created_at).toFormat('MMM d, yyyy h:mm a');
        return `From: ${m.from_email} (${timestamp})\n${m.body_text}`;
      })
      .join('\n\n---\n\n');

    // Generate summary with Claude
    console.log(`Generating summary for booking ${bookingId} using Claude API...`);
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are analyzing an email thread that led to a scheduled meeting. Generate a concise meeting summary with the following sections:

**Meeting Purpose**: What is this meeting about? (1-2 sentences)

**Key Discussion Points**: What topics were discussed in the email exchange? (3-5 bullet points)

**Next Steps**: What actions or outcomes were mentioned? (2-4 bullet points, or "None mentioned" if not applicable)

Email thread:
${emailContext}

Keep it professional, concise, and actionable. Focus on what was discussed in the emails that led to this meeting.`
      }]
    });

    const summary = response.content[0].text;

    // Store summary in database
    await pool.query(
      `UPDATE bookings
       SET meeting_summary = $1, summary_sent_at = NOW()
       WHERE id = $2`,
      [summary, bookingId]
    );

    console.log(`✅ Summary generated and stored for booking ${bookingId}`);
    return summary;

  } catch (error) {
    console.error(`Error generating summary for booking ${bookingId}:`, error);
    return null;
  }
}

/**
 * Extract action items from meeting summary using Claude
 * @param {number} bookingId - The booking ID
 * @param {string} summary - The meeting summary
 * @returns {Promise<Array>} - Extracted action items
 */
async function extractActionItems(bookingId, summary) {
  try {
    const bookingResult = await pool.query(
      `SELECT attendee_email, user_email FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) return [];

    const booking = bookingResult.rows[0];

    // Ask Claude to extract action items
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract action items from this meeting summary. Return ONLY a valid JSON array of objects with this structure:
[
  {
    "description": "Brief description of the action item",
    "assigned_to_email": "${booking.attendee_email}" or "${booking.user_email}" or null,
    "due_date": "YYYY-MM-DD" or null
  }
]

Rules:
- Only extract clear, actionable items
- Assign to the most appropriate person based on context
- Set due_date only if explicitly mentioned
- If no action items, return an empty array: []
- Return ONLY the JSON array, no other text

Meeting summary:
${summary}`
      }]
    });

    const jsonText = response.content[0].text.trim();

    // Parse JSON response
    let actionItems = [];
    try {
      actionItems = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse action items JSON:', jsonText);
      return [];
    }

    // Validate and save action items
    const savedItems = [];
    for (const item of actionItems) {
      if (!item.description) continue;

      const result = await pool.query(
        `INSERT INTO booking_action_items
         (booking_id, description, assigned_to, due_date, created_by)
         VALUES ($1, $2, $3, $4, 'ai')
         RETURNING *`,
        [
          bookingId,
          item.description,
          item.assigned_to_email || null,
          item.due_date || null
        ]
      );

      savedItems.push(result.rows[0]);
    }

    console.log(`✅ Extracted ${savedItems.length} action items for booking ${bookingId}`);
    return savedItems;

  } catch (error) {
    console.error(`Error extracting action items for booking ${bookingId}:`, error);
    return [];
  }
}

/**
 * Send post-meeting summary email
 * @param {number} bookingId - The booking ID
 * @returns {Promise<boolean>} - Success status
 */
async function sendMeetingSummaryEmail(bookingId) {
  try {
    const bookingResult = await pool.query(
      `SELECT b.*, u.email as user_email, u.name as user_name, u.timezone,
              u.logo_url, u.accent_color
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      console.log(`Booking ${bookingId} not found`);
      return false;
    }

    const booking = bookingResult.rows[0];

    // Check if summary exists
    if (!booking.meeting_summary) {
      console.log(`No summary available for booking ${bookingId}`);
      return false;
    }

    // Get action items
    const actionItemsResult = await pool.query(
      `SELECT * FROM booking_action_items
       WHERE booking_id = $1
       ORDER BY created_at`,
      [bookingId]
    );

    const actionItems = actionItemsResult.rows;

    // Format meeting time
    const startTime = DateTime.fromJSDate(booking.start_time)
      .setZone(booking.timezone || 'America/New_York');
    const meetingDate = startTime.toFormat('EEEE, MMMM d, yyyy');
    const meetingTime = startTime.toFormat('h:mm a ZZZZ');

    // Build action items HTML
    let actionItemsHtml = '';
    if (actionItems.length > 0) {
      const itemsList = actionItems.map(item => {
        const assignedText = item.assigned_to ? ` (${item.assigned_to})` : '';
        const dueText = item.due_date ? ` - Due: ${DateTime.fromJSDate(item.due_date).toFormat('MMM d')}` : '';
        return `<li style="margin-bottom: 8px;">${item.description}${assignedText}${dueText}</li>`;
      }).join('\n');

      actionItemsHtml = `
        <mj-section background-color="#f8f9fa" padding="20px">
          <mj-column>
            <mj-text font-size="18px" font-weight="600" color="#1a1a1a">
              📋 Action Items
            </mj-text>
            <mj-text font-size="14px" line-height="1.6" color="#4a4a4a">
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${itemsList}
              </ul>
            </mj-text>
          </mj-column>
        </mj-section>
      `;
    }

    // Build MJML template
    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="system-ui, -apple-system, sans-serif" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#ffffff">
          <!-- Header -->
          <mj-section background-color="${booking.accent_color || '#6366f1'}" padding="30px">
            <mj-column>
              <mj-text font-size="24px" font-weight="700" color="#ffffff" align="center">
                📝 Meeting Summary
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Meeting Details -->
          <mj-section padding="20px">
            <mj-column>
              <mj-text font-size="16px" font-weight="600" color="#1a1a1a">
                ${booking.title}
              </mj-text>
              <mj-text font-size="14px" color="#6b7280">
                ${meetingDate} at ${meetingTime}
              </mj-text>
              <mj-text font-size="14px" color="#6b7280">
                With: ${booking.attendee_name} (${booking.attendee_email})
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Summary Content -->
          <mj-section background-color="#f8f9fa" padding="20px">
            <mj-column>
              <mj-text font-size="14px" line-height="1.6" color="#1a1a1a">
                ${booking.meeting_summary.replace(/\n/g, '<br>')}
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Action Items (if any) -->
          ${actionItemsHtml}

          <!-- Footer -->
          <mj-section padding="20px">
            <mj-column>
              <mj-text font-size="12px" color="#9ca3af" align="center">
                This summary was automatically generated by TruCal Assistant
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    const { html } = mjml2html(mjmlTemplate);

    // Send email to both parties
    const recipients = [booking.user_email, booking.attendee_email];

    for (const recipient of recipients) {
      await sendEmail({
        to: recipient,
        subject: `Meeting Summary: ${booking.title}`,
        html: html
      });
    }

    console.log(`✅ Meeting summary email sent for booking ${bookingId}`);
    return true;

  } catch (error) {
    console.error(`Error sending summary email for booking ${bookingId}:`, error);
    return false;
  }
}

/**
 * Process post-meeting summaries for completed meetings
 * Called by cron job every 15 minutes
 */
async function sendPostMeetingSummaries() {
  try {
    console.log('🔍 Checking for meetings needing summaries...');

    // Find meetings that:
    // - Ended 15+ minutes ago (but within last 48 hours)
    // - Are confirmed
    // - Don't have a summary yet
    // - Have an associated email thread
    const result = await pool.query(
      `SELECT DISTINCT b.id
       FROM bookings b
       INNER JOIN email_bot_threads ebt ON ebt.booking_id = b.id
       WHERE b.status = 'confirmed'
         AND b.end_time < NOW() - INTERVAL '15 minutes'
         AND b.end_time > NOW() - INTERVAL '48 hours'
         AND b.meeting_summary IS NULL`,
      []
    );

    console.log(`Found ${result.rows.length} meetings to summarize`);

    for (const row of result.rows) {
      const bookingId = row.id;

      // Generate summary
      const summary = await generateMeetingSummary(bookingId);

      if (summary) {
        // Extract action items
        await extractActionItems(bookingId, summary);

        // Send summary email
        await sendMeetingSummaryEmail(bookingId);
      }
    }

  } catch (error) {
    console.error('Error in sendPostMeetingSummaries:', error);
  }
}

module.exports = {
  generateMeetingSummary,
  extractActionItems,
  sendMeetingSummaryEmail,
  sendPostMeetingSummaries
};
