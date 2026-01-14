const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================================================
// INBOX ASSISTANT ROUTES
// ============================================================================

// GET /api/inbox/emails - Get all inbox emails for the user
router.get('/emails', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, intent, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT ie.*,
             ed.id as draft_id,
             ed.status as draft_status,
             ed.body_text as draft_body
      FROM inbox_emails ie
      LEFT JOIN email_drafts ed ON ie.id = ed.inbox_email_id AND ed.status = 'pending'
      WHERE ie.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND ie.status = $${paramIndex++}`;
      params.push(status);
    }

    if (intent) {
      query += ` AND ie.detected_intent = $${paramIndex++}`;
      params.push(intent);
    }

    query += ` ORDER BY ie.received_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get counts by status
    const countsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'draft_created') as drafts_ready,
        COUNT(*) FILTER (WHERE status = 'responded') as responded,
        COUNT(*) FILTER (WHERE detected_intent = 'schedule_meeting') as scheduling_requests
      FROM inbox_emails
      WHERE user_id = $1
    `, [userId]);

    res.json({
      emails: result.rows,
      counts: countsResult.rows[0],
      pagination: { limit: parseInt(limit), offset: parseInt(offset) }
    });
  } catch (error) {
    console.error('Get inbox emails error:', error);
    res.status(500).json({ error: 'Failed to fetch inbox emails' });
  }
});

// GET /api/inbox/emails/:id - Get single email with draft
router.get('/emails/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const emailId = parseInt(req.params.id);

    const emailResult = await pool.query(`
      SELECT * FROM inbox_emails
      WHERE id = $1 AND user_id = $2
    `, [emailId, userId]);

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const draftResult = await pool.query(`
      SELECT * FROM email_drafts
      WHERE inbox_email_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [emailId]);

    res.json({
      email: emailResult.rows[0],
      draft: draftResult.rows[0] || null
    });
  } catch (error) {
    console.error('Get email detail error:', error);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

// POST /api/inbox/emails - Manually add an email (or webhook receives one)
router.post('/emails', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const {
      message_id,
      thread_id,
      from_email,
      from_name,
      to_email,
      subject,
      body_text,
      body_html,
      source = 'manual'
    } = req.body;

    await client.query('BEGIN');

    // Insert the email
    const emailResult = await client.query(`
      INSERT INTO inbox_emails
        (user_id, message_id, thread_id, from_email, from_name, to_email, subject, body_text, body_html, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (message_id) DO NOTHING
      RETURNING *
    `, [userId, message_id, thread_id, from_email, from_name, to_email, subject, body_text, body_html, source]);

    if (emailResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ message: 'Email already processed', duplicate: true });
    }

    const email = emailResult.rows[0];

    // Analyze the email with AI
    const analysis = await analyzeEmailIntent(body_text || subject, from_email);

    // Update with analysis
    await client.query(`
      UPDATE inbox_emails
      SET detected_intent = $1, intent_confidence = $2, extracted_data = $3, priority = $4
      WHERE id = $5
    `, [analysis.intent, analysis.confidence, JSON.stringify(analysis.data), analysis.priority, email.id]);

    // If scheduling intent detected, generate a draft response
    if (analysis.intent === 'schedule_meeting' && analysis.confidence >= 0.7) {
      const draft = await generateDraftResponse(client, userId, email, analysis);

      await client.query(`
        UPDATE inbox_emails SET status = 'draft_created' WHERE id = $1
      `, [email.id]);

      await client.query('COMMIT');
      return res.json({
        email: { ...email, detected_intent: analysis.intent },
        draft,
        message: 'Email processed and draft created'
      });
    }

    await client.query('COMMIT');
    res.json({
      email: { ...email, detected_intent: analysis.intent },
      message: 'Email processed'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add inbox email error:', error);
    res.status(500).json({ error: 'Failed to process email' });
  } finally {
    client.release();
  }
});

// POST /api/inbox/emails/:id/analyze - Re-analyze an email
router.post('/emails/:id/analyze', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const emailId = parseInt(req.params.id);

    const emailResult = await client.query(`
      SELECT * FROM inbox_emails WHERE id = $1 AND user_id = $2
    `, [emailId, userId]);

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = emailResult.rows[0];
    const analysis = await analyzeEmailIntent(email.body_text || email.subject, email.from_email);

    await client.query(`
      UPDATE inbox_emails
      SET detected_intent = $1, intent_confidence = $2, extracted_data = $3, priority = $4, updated_at = NOW()
      WHERE id = $5
    `, [analysis.intent, analysis.confidence, JSON.stringify(analysis.data), analysis.priority, emailId]);

    // Generate draft if scheduling intent
    let draft = null;
    if (analysis.intent === 'schedule_meeting' && analysis.confidence >= 0.7) {
      draft = await generateDraftResponse(client, userId, email, analysis);
      await client.query(`UPDATE inbox_emails SET status = 'draft_created' WHERE id = $1`, [emailId]);
    }

    res.json({
      intent: analysis.intent,
      confidence: analysis.confidence,
      data: analysis.data,
      draft
    });
  } catch (error) {
    console.error('Analyze email error:', error);
    res.status(500).json({ error: 'Failed to analyze email' });
  } finally {
    client.release();
  }
});

// PUT /api/inbox/emails/:id/status - Update email status
router.put('/emails/:id/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const emailId = parseInt(req.params.id);
    const { status } = req.body;

    const validStatuses = ['pending', 'draft_created', 'responded', 'ignored', 'manual'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(`
      UPDATE inbox_emails
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `, [status, emailId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({ email: result.rows[0] });
  } catch (error) {
    console.error('Update email status error:', error);
    res.status(500).json({ error: 'Failed to update email status' });
  }
});

// ============================================================================
// DRAFT MANAGEMENT ROUTES
// ============================================================================

// GET /api/inbox/drafts - Get all pending drafts
router.get('/drafts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'pending' } = req.query;

    const result = await pool.query(`
      SELECT ed.*, ie.from_email, ie.from_name, ie.subject as original_subject, ie.body_text as original_body
      FROM email_drafts ed
      JOIN inbox_emails ie ON ed.inbox_email_id = ie.id
      WHERE ed.user_id = $1 AND ed.status = $2
      ORDER BY ed.created_at DESC
    `, [userId, status]);

    res.json({ drafts: result.rows });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// GET /api/inbox/drafts/:id - Get single draft
router.get('/drafts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT ed.*, ie.from_email, ie.from_name, ie.subject as original_subject,
             ie.body_text as original_body, ie.detected_intent, ie.extracted_data
      FROM email_drafts ed
      JOIN inbox_emails ie ON ed.inbox_email_id = ie.id
      WHERE ed.id = $1 AND ed.user_id = $2
    `, [draftId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    res.json({ draft: result.rows[0] });
  } catch (error) {
    console.error('Get draft error:', error);
    res.status(500).json({ error: 'Failed to fetch draft' });
  }
});

// PUT /api/inbox/drafts/:id - Edit a draft
router.put('/drafts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = parseInt(req.params.id);
    const { body_text, subject, proposed_times } = req.body;

    const result = await pool.query(`
      UPDATE email_drafts
      SET edited_body = $1, subject = COALESCE($2, subject),
          proposed_times = COALESCE($3, proposed_times),
          status = 'edited'
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `, [body_text, subject, proposed_times ? JSON.stringify(proposed_times) : null, draftId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    res.json({ draft: result.rows[0] });
  } catch (error) {
    console.error('Update draft error:', error);
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

// POST /api/inbox/drafts/:id/approve - Approve and send a draft
router.post('/drafts/:id/approve', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const draftId = parseInt(req.params.id);

    const draftResult = await client.query(`
      SELECT ed.*, ie.from_email, u.email as user_email, u.name as user_name
      FROM email_drafts ed
      JOIN inbox_emails ie ON ed.inbox_email_id = ie.id
      JOIN users u ON ed.user_id = u.id
      WHERE ed.id = $1 AND ed.user_id = $2
    `, [draftId, userId]);

    if (draftResult.rows.length === 0) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const draft = draftResult.rows[0];
    const bodyToSend = draft.edited_body || draft.body_text;

    // Here you would integrate with your email sending service
    // For now, we'll just mark it as approved/sent
    console.log('Sending email to:', draft.to_email);
    console.log('Subject:', draft.subject);
    console.log('Body:', bodyToSend);

    // Update draft status
    await client.query(`
      UPDATE email_drafts
      SET status = 'sent', sent_at = NOW(), reviewed_at = NOW()
      WHERE id = $1
    `, [draftId]);

    // Update inbox email status
    await client.query(`
      UPDATE inbox_emails
      SET status = 'responded', updated_at = NOW()
      WHERE id = $1
    `, [draft.inbox_email_id]);

    res.json({
      success: true,
      message: 'Draft approved and marked as sent',
      // In production, you'd return the sent message details
    });
  } catch (error) {
    console.error('Approve draft error:', error);
    res.status(500).json({ error: 'Failed to approve draft' });
  } finally {
    client.release();
  }
});

// POST /api/inbox/drafts/:id/reject - Reject a draft
router.post('/drafts/:id/reject', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = parseInt(req.params.id);
    const { reason } = req.body;

    const result = await pool.query(`
      UPDATE email_drafts
      SET status = 'rejected', reviewed_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING inbox_email_id
    `, [draftId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // Reset inbox email to pending for manual handling
    await pool.query(`
      UPDATE inbox_emails
      SET status = 'manual', updated_at = NOW()
      WHERE id = $1
    `, [result.rows[0].inbox_email_id]);

    res.json({ success: true, message: 'Draft rejected' });
  } catch (error) {
    console.error('Reject draft error:', error);
    res.status(500).json({ error: 'Failed to reject draft' });
  }
});

// POST /api/inbox/drafts/:id/regenerate - Regenerate a draft with different parameters
router.post('/drafts/:id/regenerate', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const draftId = parseInt(req.params.id);
    const { tone, include_times, custom_message } = req.body;

    const draftResult = await client.query(`
      SELECT ed.*, ie.*
      FROM email_drafts ed
      JOIN inbox_emails ie ON ed.inbox_email_id = ie.id
      WHERE ed.id = $1 AND ed.user_id = $2
    `, [draftId, userId]);

    if (draftResult.rows.length === 0) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const oldDraft = draftResult.rows[0];

    // Generate new draft with custom parameters
    const analysis = {
      intent: oldDraft.detected_intent,
      confidence: parseFloat(oldDraft.intent_confidence),
      data: oldDraft.extracted_data || {}
    };

    const newDraft = await generateDraftResponse(client, userId, oldDraft, analysis, {
      tone: tone || 'professional',
      include_times: include_times !== false,
      custom_message
    });

    // Mark old draft as replaced
    await client.query(`
      UPDATE email_drafts SET status = 'rejected' WHERE id = $1
    `, [draftId]);

    res.json({ draft: newDraft });
  } catch (error) {
    console.error('Regenerate draft error:', error);
    res.status(500).json({ error: 'Failed to regenerate draft' });
  } finally {
    client.release();
  }
});

// ============================================================================
// INBOX STATS & SETTINGS
// ============================================================================

// GET /api/inbox/stats - Get inbox statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'draft_created') as drafts_ready,
        COUNT(*) FILTER (WHERE status = 'responded') as responded,
        COUNT(*) FILTER (WHERE status = 'ignored') as ignored,
        COUNT(*) FILTER (WHERE detected_intent = 'schedule_meeting') as scheduling_requests,
        COUNT(*) FILTER (WHERE detected_intent = 'reschedule') as reschedule_requests,
        COUNT(*) FILTER (WHERE detected_intent = 'cancel') as cancel_requests,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
        AVG(intent_confidence) FILTER (WHERE intent_confidence IS NOT NULL) as avg_confidence
      FROM inbox_emails
      WHERE user_id = $1 AND received_at > NOW() - INTERVAL '30 days'
    `, [userId]);

    const draftStats = await pool.query(`
      SELECT
        COUNT(*) as total_drafts,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_review,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/60) FILTER (WHERE reviewed_at IS NOT NULL) as avg_review_time_minutes
      FROM email_drafts
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
    `, [userId]);

    res.json({
      emails: stats.rows[0],
      drafts: draftStats.rows[0]
    });
  } catch (error) {
    console.error('Get inbox stats error:', error);
    res.status(500).json({ error: 'Failed to fetch inbox stats' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Analyze email intent using AI
async function analyzeEmailIntent(emailContent, fromEmail) {
  // Keywords and patterns for intent detection
  const lowerContent = (emailContent || '').toLowerCase();

  let intent = 'none';
  let confidence = 0.5;
  let priority = 'normal';
  const data = {};

  // Schedule meeting patterns
  const schedulePatterns = [
    /schedule\s+(?:a\s+)?(?:call|meeting|time|chat)/i,
    /book\s+(?:a\s+)?(?:call|meeting|time|slot)/i,
    /set\s+up\s+(?:a\s+)?(?:call|meeting|time)/i,
    /(?:can|could)\s+we\s+(?:meet|talk|chat|connect)/i,
    /(?:let'?s|want\s+to)\s+(?:schedule|meet|connect|chat)/i,
    /(?:available|free)\s+(?:for\s+)?(?:a\s+)?(?:call|meeting|chat)/i,
    /(?:find|pick)\s+(?:a\s+)?time/i,
    /(?:15|30|45|60)\s*(?:min|minute)/i,
    /(?:coffee|lunch|demo|intro|discovery)\s+(?:call|meeting|chat)/i
  ];

  const reschedulePatterns = [
    /reschedule/i,
    /(?:move|change|push)\s+(?:the\s+)?(?:meeting|call|time)/i,
    /(?:can'?t|cannot)\s+make\s+(?:it|the\s+meeting)/i,
    /need\s+to\s+(?:move|change)/i
  ];

  const cancelPatterns = [
    /cancel/i,
    /(?:won'?t|will\s+not)\s+be\s+able/i,
    /(?:have\s+to|need\s+to)\s+cancel/i
  ];

  // Check patterns
  for (const pattern of schedulePatterns) {
    if (pattern.test(lowerContent)) {
      intent = 'schedule_meeting';
      confidence = 0.85;
      priority = 'high';
      break;
    }
  }

  if (intent === 'none') {
    for (const pattern of reschedulePatterns) {
      if (pattern.test(lowerContent)) {
        intent = 'reschedule';
        confidence = 0.80;
        priority = 'high';
        break;
      }
    }
  }

  if (intent === 'none') {
    for (const pattern of cancelPatterns) {
      if (pattern.test(lowerContent)) {
        intent = 'cancel';
        confidence = 0.80;
        priority = 'normal';
        break;
      }
    }
  }

  // Extract time mentions
  const timePatterns = [
    /(?:next|this)\s+(?:monday|tuesday|wednesday|thursday|friday|week)/gi,
    /(?:tomorrow|today)/gi,
    /(?:\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi,
    /(?:morning|afternoon|evening)/gi
  ];

  const proposedTimes = [];
  for (const pattern of timePatterns) {
    const matches = lowerContent.match(pattern);
    if (matches) {
      proposedTimes.push(...matches);
    }
  }
  if (proposedTimes.length > 0) {
    data.mentioned_times = proposedTimes;
  }

  // Extract duration mentions
  const durationMatch = lowerContent.match(/(\d+)\s*(?:min|minute|hour)/i);
  if (durationMatch) {
    data.duration = parseInt(durationMatch[1]);
    if (lowerContent.includes('hour')) {
      data.duration *= 60;
    }
  }

  // VIP detection (could be expanded with a VIP list)
  if (fromEmail && (fromEmail.includes('ceo') || fromEmail.includes('founder') || fromEmail.includes('president'))) {
    priority = 'high';
  }

  return { intent, confidence, priority, data };
}

// Generate a draft response
async function generateDraftResponse(client, userId, email, analysis, options = {}) {
  const { tone = 'professional', include_times = true, custom_message } = options;

  // Get user info and booking link
  const userResult = await client.query(`
    SELECT name, email, username, timezone FROM users WHERE id = $1
  `, [userId]);
  const user = userResult.rows[0];

  // Get default event type
  const eventTypeResult = await client.query(`
    SELECT id, title, duration, slug FROM event_types
    WHERE user_id = $1 AND is_active = true
    ORDER BY created_at ASC LIMIT 1
  `, [userId]);
  const eventType = eventTypeResult.rows[0];

  const bookingLink = eventType
    ? `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/${user.username}/${eventType.slug}`
    : `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/${user.username}`;

  // Build the draft response
  const fromName = email.from_name || email.from_email.split('@')[0];

  let subject = `Re: ${email.subject || 'Meeting Request'}`;

  let bodyText = '';

  if (tone === 'casual') {
    bodyText = `Hi ${fromName},\n\n`;
    bodyText += custom_message || `Thanks for reaching out! I'd love to chat.\n\n`;
  } else {
    bodyText = `Hi ${fromName},\n\n`;
    bodyText += custom_message || `Thank you for your email. I'd be happy to schedule a time to connect.\n\n`;
  }

  if (include_times && eventType) {
    bodyText += `You can book a ${eventType.duration}-minute ${eventType.title} directly on my calendar:\n`;
    bodyText += `${bookingLink}\n\n`;
    bodyText += `Just pick a time that works best for you!\n\n`;
  } else {
    bodyText += `Please let me know what times work best for you, and I'll do my best to accommodate.\n\n`;
  }

  bodyText += `Best regards,\n${user.name || 'Your Name'}`;

  // Create the draft
  const draftResult = await client.query(`
    INSERT INTO email_drafts
      (user_id, inbox_email_id, to_email, to_name, subject, body_text, booking_link, event_type_id, ai_model, confidence_score)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    userId,
    email.id,
    email.from_email,
    email.from_name,
    subject,
    bodyText,
    bookingLink,
    eventType?.id,
    'rule-based-v1',
    analysis.confidence
  ]);

  return draftResult.rows[0];
}

module.exports = router;
