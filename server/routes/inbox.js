const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================================================
// ACTIVITY LOGGING HELPER
// ============================================================================

async function logActivity(client, userId, actionType, metadata = {}) {
  try {
    await client.query(
      `INSERT INTO inbox_activity (user_id, action_type, inbox_email_id, email_draft_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, actionType, metadata.inboxEmailId || null, metadata.emailDraftId || null, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Activity logging error:', error);
    // Don't throw - logging should not break main flow
  }
}

// ============================================================================
// OPERATING MODE HELPER
// ============================================================================

async function getUserSettings(client, userId) {
  const result = await client.query(
    `SELECT * FROM inbox_settings WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    // Create default settings
    const insertResult = await client.query(
      `INSERT INTO inbox_settings (user_id) VALUES ($1) RETURNING *`,
      [userId]
    );
    return insertResult.rows[0];
  }

  return result.rows[0];
}

async function handleDraftBasedOnMode(client, userId, draft, email, confidence) {
  const settings = await getUserSettings(client, userId);
  const mode = settings.operating_mode || 'semi_autonomous';

  // Check for contact-specific overrides
  const overrides = settings.contact_overrides || {};
  const contactOverride = overrides[email.from_email];
  const effectiveMode = contactOverride?.mode || mode;

  if (effectiveMode === 'fully_autonomous' && confidence >= 0.85) {
    // Schedule auto-send with undo window
    const delaySeconds = settings.auto_send_delay_seconds || 120;
    await client.query(
      `UPDATE email_drafts SET auto_send_at = NOW() + INTERVAL '${delaySeconds} seconds' WHERE id = $1`,
      [draft.id]
    );

    await logActivity(client, userId, 'auto_send_scheduled', {
      emailDraftId: draft.id,
      inboxEmailId: email.id,
      delaySeconds,
      scheduledFor: new Date(Date.now() + delaySeconds * 1000).toISOString()
    });

    return { mode: 'auto_send_scheduled', delaySeconds, draft };
  }

  // Semi-autonomous or manual - just notify
  await logActivity(client, userId, 'draft_ready_for_review', {
    emailDraftId: draft.id,
    inboxEmailId: email.id,
    mode: effectiveMode
  });

  return { mode: effectiveMode, draft };
}

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
// QUICK PASTE ENDPOINTS (for manual email analysis)
// ============================================================================

// POST /api/inbox/analyze-email - Analyze pasted email text (Quick Paste feature)
router.post('/analyze-email', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email_text } = req.body;

    if (!email_text || !email_text.trim()) {
      return res.status(400).json({ error: 'Email text is required' });
    }

    // Analyze the email
    const analysis = await analyzeEmailIntent(email_text, null);

    // Get user's booking link
    const userResult = await pool.query(
      `SELECT u.username, et.slug, et.title, et.duration
       FROM users u
       LEFT JOIN event_types et ON et.user_id = u.id AND et.is_active = true
       WHERE u.id = $1
       ORDER BY et.created_at ASC
       LIMIT 1`,
      [userId]
    );

    const user = userResult.rows[0];
    const bookingLink = user?.slug
      ? `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/${user.username}/${user.slug}`
      : user?.username
        ? `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/${user.username}`
        : null;

    // Build suggested actions
    const suggestedActions = [];
    if (analysis.intent === 'schedule_meeting' || analysis.intent === 'request_meeting') {
      suggestedActions.push(
        { action: 'send_booking_link', label: 'Send Booking Link' },
        { action: 'propose_times', label: 'Propose Specific Times' },
        { action: 'ask_for_details', label: 'Ask for More Details' }
      );
    } else if (analysis.intent === 'reschedule') {
      suggestedActions.push(
        { action: 'confirm_reschedule', label: 'Confirm & Send New Link' },
        { action: 'suggest_alternatives', label: 'Suggest Alternative Times' }
      );
    } else if (analysis.intent === 'cancel') {
      suggestedActions.push(
        { action: 'confirm_cancel', label: 'Confirm Cancellation' },
        { action: 'offer_reschedule', label: 'Offer to Reschedule' }
      );
    } else {
      suggestedActions.push(
        { action: 'general_reply', label: 'Generate General Reply' }
      );
    }

    // Extract sender info from email text if possible
    const fromMatch = email_text.match(/(?:From|from):\s*([^\n<]+)/i);
    const senderName = fromMatch ? fromMatch[1].trim() : null;

    res.json({
      intent_type: analysis.intent,
      confidence: analysis.confidence,
      has_scheduling_intent: ['schedule_meeting', 'request_meeting', 'reschedule'].includes(analysis.intent),
      extracted_data: {
        ...analysis.data,
        sender_name: senderName,
        mentioned_dates: analysis.data.mentioned_times || []
      },
      suggested_actions: suggestedActions,
      booking_link: bookingLink,
      event_info: user?.title ? { title: user.title, duration: user.duration } : null
    });
  } catch (error) {
    console.error('Analyze email error:', error);
    res.status(500).json({ error: 'Failed to analyze email' });
  }
});

// POST /api/inbox/generate-reply - Generate a reply for Quick Paste
router.post('/generate-reply', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { intent_type, sender_name, booking_link, selected_action } = req.body;

    // Get user info
    const userResult = await pool.query(
      `SELECT name, email FROM users WHERE id = $1`,
      [userId]
    );
    const user = userResult.rows[0];
    const userName = user?.name || 'there';
    const recipientName = sender_name || 'there';

    let reply = '';

    switch (selected_action) {
      case 'send_booking_link':
        reply = `Hi ${recipientName},\n\nThank you for reaching out! I'd be happy to schedule a time to connect.\n\nPlease use my booking link to find a time that works best for you:\n${booking_link || '[Your booking link]'}\n\nLooking forward to speaking with you!\n\nBest regards,\n${userName}`;
        break;

      case 'propose_times':
        reply = `Hi ${recipientName},\n\nThank you for reaching out! I'd love to find a time to connect.\n\nHere are a few times that work for me:\n- [Option 1]\n- [Option 2]\n- [Option 3]\n\nAlternatively, you can book directly on my calendar: ${booking_link || '[Your booking link]'}\n\nLet me know what works best for you!\n\nBest regards,\n${userName}`;
        break;

      case 'ask_for_details':
        reply = `Hi ${recipientName},\n\nThank you for reaching out! I'd be happy to schedule a call.\n\nTo help me prepare, could you share a bit more about what you'd like to discuss? That way I can make sure we make the most of our time together.\n\nOnce I have a better understanding, I'll send over my availability.\n\nBest regards,\n${userName}`;
        break;

      case 'confirm_reschedule':
        reply = `Hi ${recipientName},\n\nNo problem at all! I understand schedules can change.\n\nPlease feel free to book a new time using my calendar link:\n${booking_link || '[Your booking link]'}\n\nLooking forward to connecting!\n\nBest regards,\n${userName}`;
        break;

      case 'suggest_alternatives':
        reply = `Hi ${recipientName},\n\nI understand the original time doesn't work. Here are some alternative times:\n\n- [Alternative 1]\n- [Alternative 2]\n- [Alternative 3]\n\nOr you can pick any available slot here: ${booking_link || '[Your booking link]'}\n\nLet me know what works!\n\nBest regards,\n${userName}`;
        break;

      case 'confirm_cancel':
        reply = `Hi ${recipientName},\n\nNo worries, I've noted the cancellation.\n\nIf you'd like to reschedule in the future, feel free to use my booking link anytime:\n${booking_link || '[Your booking link]'}\n\nTake care!\n\nBest regards,\n${userName}`;
        break;

      case 'offer_reschedule':
        reply = `Hi ${recipientName},\n\nI'm sorry to hear you need to cancel. If your schedule opens up, I'd still love to connect.\n\nFeel free to book a new time whenever works for you:\n${booking_link || '[Your booking link]'}\n\nNo rush - the link will always be available.\n\nBest regards,\n${userName}`;
        break;

      default:
        reply = `Hi ${recipientName},\n\nThank you for your email.\n\n[Your response here]\n\nBest regards,\n${userName}`;
    }

    res.json({ reply });
  } catch (error) {
    console.error('Generate reply error:', error);
    res.status(500).json({ error: 'Failed to generate reply' });
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

// ============================================================================
// WEBHOOK HANDLERS (Gmail & Outlook)
// ============================================================================

// POST /api/inbox/webhook/gmail - Gmail push notification webhook
router.post('/webhook/gmail', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message?.data) {
      return res.status(200).json({ success: true, message: 'No data' });
    }

    // Decode the base64 message from Gmail
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    console.log('Gmail webhook received:', data);

    // data contains: { emailAddress, historyId }
    // In production, you would:
    // 1. Look up user by emailAddress
    // 2. Fetch new messages since historyId
    // 3. Process each message through the inbox system

    // For now, acknowledge receipt
    res.status(200).json({ success: true, received: true });
  } catch (error) {
    console.error('Gmail webhook error:', error);
    res.status(200).json({ success: true, error: error.message }); // Always 200 for webhooks
  }
});

// POST /api/inbox/webhook/outlook - Microsoft Graph push notification webhook
router.post('/webhook/outlook', async (req, res) => {
  try {
    // Handle validation request from Microsoft
    if (req.query.validationToken) {
      return res.status(200).send(req.query.validationToken);
    }

    const { value: notifications } = req.body;

    if (!notifications || !Array.isArray(notifications)) {
      return res.status(200).json({ success: true });
    }

    for (const notification of notifications) {
      console.log('Outlook webhook received:', notification);
      // notification contains: { subscriptionId, changeType, resource, resourceData }
      // Process similar to Gmail
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Outlook webhook error:', error);
    res.status(200).json({ success: true, error: error.message });
  }
});

// ============================================================================
// SETTINGS ROUTES
// ============================================================================

// GET /api/inbox/settings - Get user's inbox settings
router.get('/settings', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const settings = await getUserSettings(client, userId);
    res.json({ settings });
  } catch (error) {
    console.error('Get inbox settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  } finally {
    client.release();
  }
});

// PUT /api/inbox/settings - Update user's inbox settings
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      operating_mode,
      auto_send_delay_seconds,
      email_style,
      contact_overrides,
      enabled,
      notify_on_draft
    } = req.body;

    // Validate operating_mode
    const validModes = ['manual', 'semi_autonomous', 'fully_autonomous'];
    if (operating_mode && !validModes.includes(operating_mode)) {
      return res.status(400).json({ error: 'Invalid operating mode' });
    }

    const result = await pool.query(`
      INSERT INTO inbox_settings (user_id, operating_mode, auto_send_delay_seconds, email_style, contact_overrides, enabled, notify_on_draft)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE SET
        operating_mode = COALESCE($2, inbox_settings.operating_mode),
        auto_send_delay_seconds = COALESCE($3, inbox_settings.auto_send_delay_seconds),
        email_style = COALESCE($4, inbox_settings.email_style),
        contact_overrides = COALESCE($5, inbox_settings.contact_overrides),
        enabled = COALESCE($6, inbox_settings.enabled),
        notify_on_draft = COALESCE($7, inbox_settings.notify_on_draft),
        updated_at = NOW()
      RETURNING *
    `, [
      userId,
      operating_mode,
      auto_send_delay_seconds,
      email_style ? JSON.stringify(email_style) : null,
      contact_overrides ? JSON.stringify(contact_overrides) : null,
      enabled,
      notify_on_draft
    ]);

    res.json({ settings: result.rows[0], message: 'Settings updated' });
  } catch (error) {
    console.error('Update inbox settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================================================
// AUTO-SEND & UNDO ROUTES
// ============================================================================

// POST /api/inbox/drafts/:id/undo - Cancel scheduled auto-send
router.post('/drafts/:id/undo', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const draftId = parseInt(req.params.id);

    const result = await client.query(`
      UPDATE email_drafts
      SET auto_send_at = NULL, status = 'pending'
      WHERE id = $1 AND user_id = $2 AND auto_send_at IS NOT NULL AND status = 'pending'
      RETURNING *
    `, [draftId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draft not found or already sent' });
    }

    await logActivity(client, userId, 'auto_send_cancelled', {
      emailDraftId: draftId
    });

    res.json({ success: true, message: 'Auto-send cancelled', draft: result.rows[0] });
  } catch (error) {
    console.error('Undo auto-send error:', error);
    res.status(500).json({ error: 'Failed to cancel auto-send' });
  } finally {
    client.release();
  }
});

// GET /api/inbox/drafts/scheduled - Get drafts scheduled for auto-send
router.get('/drafts/scheduled', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT ed.*, ie.from_email, ie.from_name, ie.subject as original_subject
      FROM email_drafts ed
      JOIN inbox_emails ie ON ed.inbox_email_id = ie.id
      WHERE ed.user_id = $1 AND ed.auto_send_at IS NOT NULL AND ed.status = 'pending'
      ORDER BY ed.auto_send_at ASC
    `, [userId]);

    res.json({ drafts: result.rows });
  } catch (error) {
    console.error('Get scheduled drafts error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled drafts' });
  }
});

// ============================================================================
// ACTIVITY LOG ROUTES
// ============================================================================

// GET /api/inbox/activity - Get activity log
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, action_type } = req.query;

    let query = `
      SELECT ia.*, ie.from_email, ie.subject, ed.to_email
      FROM inbox_activity ia
      LEFT JOIN inbox_emails ie ON ia.inbox_email_id = ie.id
      LEFT JOIN email_drafts ed ON ia.email_draft_id = ed.id
      WHERE ia.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (action_type) {
      query += ` AND ia.action_type = $${paramIndex++}`;
      params.push(action_type);
    }

    query += ` ORDER BY ia.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json({ activity: result.rows });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ============================================================================
// BACKGROUND JOB: Process scheduled auto-sends
// ============================================================================

async function processScheduledSends() {
  const client = await pool.connect();
  try {
    // Find drafts ready to send
    const readyDrafts = await client.query(`
      SELECT ed.*, u.email as user_email, u.name as user_name
      FROM email_drafts ed
      JOIN users u ON ed.user_id = u.id
      WHERE ed.auto_send_at <= NOW() AND ed.status = 'pending'
    `);

    for (const draft of readyDrafts.rows) {
      try {
        console.log(`Auto-sending draft ${draft.id} to ${draft.to_email}`);

        // Here you would integrate with email sending (nodemailer, etc.)
        // For now, just mark as sent

        await client.query(`
          UPDATE email_drafts SET status = 'sent', sent_at = NOW(), auto_send_at = NULL WHERE id = $1
        `, [draft.id]);

        await client.query(`
          UPDATE inbox_emails SET status = 'responded', updated_at = NOW() WHERE id = $1
        `, [draft.inbox_email_id]);

        await logActivity(client, draft.user_id, 'email_auto_sent', {
          emailDraftId: draft.id,
          inboxEmailId: draft.inbox_email_id,
          toEmail: draft.to_email
        });

        console.log(`Draft ${draft.id} auto-sent successfully`);
      } catch (sendError) {
        console.error(`Failed to auto-send draft ${draft.id}:`, sendError);
      }
    }
  } catch (error) {
    console.error('Process scheduled sends error:', error);
  } finally {
    client.release();
  }
}

// Run auto-send processor every 30 seconds
setInterval(processScheduledSends, 30000);

module.exports = router;
