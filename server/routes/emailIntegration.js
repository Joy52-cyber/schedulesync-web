const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Gmail OAuth config
const gmailOAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/email/gmail/callback`
);

// Gmail scopes for reading emails
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email'
];

// ============ GMAIL ROUTES ============

// GET /api/email/gmail/auth - Start Gmail OAuth
router.get('/gmail/auth', authenticateToken, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');

  const authUrl = gmailOAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    state,
    prompt: 'consent'
  });

  res.json({ authUrl });
});

// GET /api/email/gmail/callback - Gmail OAuth callback
router.get('/gmail/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    const { tokens } = await gmailOAuth2Client.getToken(code);
    gmailOAuth2Client.setCredentials(tokens);

    // Get user's email address
    const gmail = google.gmail({ version: 'v1', auth: gmailOAuth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const emailAddress = profile.data.emailAddress;

    // Save connection
    await pool.query(`
      INSERT INTO email_connections (user_id, provider, email_address, access_token, refresh_token, token_expires_at, last_sync_at)
      VALUES ($1, 'gmail', $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, provider)
      DO UPDATE SET
        access_token = $3,
        refresh_token = COALESCE($4, email_connections.refresh_token),
        token_expires_at = $5,
        is_active = true,
        updated_at = NOW()
    `, [userId, emailAddress, tokens.access_token, tokens.refresh_token, new Date(tokens.expiry_date)]);

    console.log(`Gmail connected for user ${userId}: ${emailAddress}`);

    // Trigger initial sync
    syncGmailForUser(userId).catch(console.error);

    // Redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?tab=email&connected=gmail`);
  } catch (error) {
    console.error('Gmail OAuth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=email&error=gmail_failed`);
  }
});


// ============ OUTLOOK ROUTES ============

const OUTLOOK_SCOPES = [
  'openid',
  'profile',
  'email',
  'Mail.Read',
  'Mail.Send',
  'offline_access'
];

// GET /api/email/outlook/auth - Start Outlook OAuth
router.get('/outlook/auth', authenticateToken, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${process.env.MICROSOFT_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent((process.env.BACKEND_URL || 'http://localhost:3001') + '/api/email/outlook/callback')}` +
    `&scope=${encodeURIComponent(OUTLOOK_SCOPES.join(' '))}` +
    `&state=${state}` +
    `&prompt=consent`;

  res.json({ authUrl });
});

// GET /api/email/outlook/callback - Outlook OAuth callback
router.get('/outlook/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/email/outlook/callback`,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      throw new Error(tokens.error_description);
    }

    // Get user's email
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const profile = await profileResponse.json();

    // Save connection
    await pool.query(`
      INSERT INTO email_connections (user_id, provider, email_address, access_token, refresh_token, token_expires_at, last_sync_at)
      VALUES ($1, 'outlook', $2, $3, $4, NOW() + INTERVAL '1 hour', NOW())
      ON CONFLICT (user_id, provider)
      DO UPDATE SET
        access_token = $3,
        refresh_token = COALESCE($4, email_connections.refresh_token),
        token_expires_at = NOW() + INTERVAL '1 hour',
        is_active = true,
        updated_at = NOW()
    `, [userId, profile.mail || profile.userPrincipalName, tokens.access_token, tokens.refresh_token]);

    console.log(`Outlook connected for user ${userId}: ${profile.mail || profile.userPrincipalName}`);

    // Trigger initial sync
    syncOutlookForUser(userId).catch(console.error);

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?tab=email&connected=outlook`);
  } catch (error) {
    console.error('Outlook OAuth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=email&error=outlook_failed`);
  }
});


// ============ EMAIL SYNC FUNCTIONS ============

async function refreshGmailToken(connection) {
  gmailOAuth2Client.setCredentials({
    refresh_token: connection.refresh_token
  });

  const { credentials } = await gmailOAuth2Client.refreshAccessToken();

  await pool.query(`
    UPDATE email_connections
    SET access_token = $1, token_expires_at = $2, updated_at = NOW()
    WHERE id = $3
  `, [credentials.access_token, new Date(credentials.expiry_date), connection.id]);

  return credentials.access_token;
}

async function syncGmailForUser(userId) {
  console.log(`📧 Syncing Gmail for user ${userId}`);

  const connection = await pool.query(`
    SELECT * FROM email_connections
    WHERE user_id = $1 AND provider = 'gmail' AND is_active = true AND monitoring_enabled = true
  `, [userId]);

  if (connection.rows.length === 0) return;

  const conn = connection.rows[0];

  // Refresh token if needed
  let accessToken = conn.access_token;
  if (new Date(conn.token_expires_at) < new Date()) {
    accessToken = await refreshGmailToken(conn);
  }

  gmailOAuth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: gmailOAuth2Client });

  // Get emails from last 24 hours (or since last sync)
  const query = `is:inbox newer_than:1d`;

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50
  });

  const messages = response.data.messages || [];
  console.log(`   Found ${messages.length} emails to check`);

  for (const msg of messages) {
    try {
      // Check if already processed
      const existing = await pool.query(
        'SELECT id FROM detected_emails WHERE user_id = $1 AND provider_email_id = $2',
        [userId, msg.id]
      );

      if (existing.rows.length > 0) continue;

      // Get full message
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });

      const headers = fullMessage.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value;

      // Extract body
      let body = '';
      if (fullMessage.data.payload.body?.data) {
        body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString();
      } else if (fullMessage.data.payload.parts) {
        const textPart = fullMessage.data.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString();
        }
      }

      // Analyze for scheduling intent
      const intent = analyzeEmailForSchedulingIntent(subject, body);

      if (intent.detected && intent.confidence > 0.6) {
        // Generate suggested reply
        const user = await pool.query('SELECT name, username FROM users WHERE id = $1', [userId]);
        const bookingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/${user.rows[0]?.username}`;

        const suggestedReply = generateEmailReply(from, subject, body, bookingUrl, user.rows[0]?.name);

        // Parse from name and email
        const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/) || [null, from, from];
        const fromName = fromMatch[1]?.trim().replace(/"/g, '') || '';
        const fromEmail = fromMatch[2]?.trim() || from;

        // Save detected email
        await pool.query(`
          INSERT INTO detected_emails (
            user_id, email_connection_id, provider_email_id, from_email, from_name,
            subject, body_snippet, body_full, received_at, scheduling_intent, suggested_reply
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          userId,
          conn.id,
          msg.id,
          fromEmail,
          fromName,
          subject,
          body.substring(0, 500),
          body,
          date ? new Date(date) : new Date(),
          JSON.stringify(intent),
          suggestedReply
        ]);

        console.log(`   ✅ Detected scheduling email: "${subject}" from ${fromEmail}`);
      }
    } catch (error) {
      console.error(`   Error processing message ${msg.id}:`, error.message);
    }
  }

  // Update last sync time
  await pool.query(
    'UPDATE email_connections SET last_sync_at = NOW() WHERE id = $1',
    [conn.id]
  );
}

async function syncOutlookForUser(userId) {
  console.log(`📧 Syncing Outlook for user ${userId}`);

  const connection = await pool.query(`
    SELECT * FROM email_connections
    WHERE user_id = $1 AND provider = 'outlook' AND is_active = true AND monitoring_enabled = true
  `, [userId]);

  if (connection.rows.length === 0) return;

  const conn = connection.rows[0];

  // Refresh token if needed
  let accessToken = conn.access_token;
  if (new Date(conn.token_expires_at) < new Date()) {
    accessToken = await refreshOutlookToken(conn);
  }

  // Get emails from last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${since}&$top=50&$select=id,subject,from,bodyPreview,body,receivedDateTime`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const data = await response.json();
  const messages = data.value || [];

  console.log(`   Found ${messages.length} emails to check`);

  for (const msg of messages) {
    try {
      // Check if already processed
      const existing = await pool.query(
        'SELECT id FROM detected_emails WHERE user_id = $1 AND provider_email_id = $2',
        [userId, msg.id]
      );

      if (existing.rows.length > 0) continue;

      const body = msg.body?.content || msg.bodyPreview || '';
      const subject = msg.subject || '';
      const from = msg.from?.emailAddress?.address || '';
      const fromName = msg.from?.emailAddress?.name || '';

      // Analyze for scheduling intent
      const intent = analyzeEmailForSchedulingIntent(subject, body);

      if (intent.detected && intent.confidence > 0.6) {
        const user = await pool.query('SELECT name, username FROM users WHERE id = $1', [userId]);
        const bookingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/${user.rows[0]?.username}`;

        const suggestedReply = generateEmailReply(from, subject, body, bookingUrl, user.rows[0]?.name);

        await pool.query(`
          INSERT INTO detected_emails (
            user_id, email_connection_id, provider_email_id, from_email, from_name,
            subject, body_snippet, body_full, received_at, scheduling_intent, suggested_reply
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          userId,
          conn.id,
          msg.id,
          from,
          fromName,
          subject,
          body.substring(0, 500),
          body,
          new Date(msg.receivedDateTime),
          JSON.stringify(intent),
          suggestedReply
        ]);

        console.log(`   ✅ Detected scheduling email: "${subject}" from ${from}`);
      }
    } catch (error) {
      console.error(`   Error processing message ${msg.id}:`, error.message);
    }
  }

  await pool.query(
    'UPDATE email_connections SET last_sync_at = NOW() WHERE id = $1',
    [conn.id]
  );
}

async function refreshOutlookToken(connection) {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const tokens = await response.json();

  await pool.query(`
    UPDATE email_connections
    SET access_token = $1, refresh_token = COALESCE($2, refresh_token), token_expires_at = NOW() + INTERVAL '1 hour', updated_at = NOW()
    WHERE id = $3
  `, [tokens.access_token, tokens.refresh_token, connection.id]);

  return tokens.access_token;
}


// ============ AI ANALYSIS FUNCTIONS ============

function analyzeEmailForSchedulingIntent(subject, body) {
  // Pattern-based scheduling intent detection
  const text = `${subject} ${body}`.toLowerCase();

  const schedulingKeywords = [
    'meeting', 'schedule', 'call', 'chat', 'discuss', 'talk',
    'available', 'availability', 'calendar', 'slot', 'time',
    'connect', 'catch up', 'sync', 'book', 'appointment',
    'demo', 'consultation', 'interview', 'coffee',
    'next week', 'this week', 'tomorrow', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'minutes', 'hour'
  ];

  const negativeKeywords = [
    'unsubscribe', 'newsletter', 'promotion', 'sale', 'discount',
    'order', 'shipped', 'tracking', 'invoice', 'receipt',
    'password', 'verify', 'confirm your', 'automated', 'noreply',
    'do not reply', 'notification', 'alert'
  ];

  // Count matches
  let positiveScore = 0;
  let negativeScore = 0;

  for (const keyword of schedulingKeywords) {
    if (text.includes(keyword)) positiveScore++;
  }

  for (const keyword of negativeKeywords) {
    if (text.includes(keyword)) negativeScore++;
  }

  // Detect specific patterns
  const hasQuestion = text.includes('?');
  const hasTimeRef = /\b(am|pm|morning|afternoon|evening|week|day)\b/.test(text);
  const hasAvailability = /\b(free|available|open|work for you)\b/.test(text);

  if (hasQuestion) positiveScore += 2;
  if (hasTimeRef) positiveScore += 2;
  if (hasAvailability) positiveScore += 3;

  // Calculate confidence
  const confidence = Math.min(1, Math.max(0, (positiveScore - negativeScore * 2) / 10));

  // Detect meeting type
  let meetingType = 'general';
  if (text.includes('demo')) meetingType = 'demo';
  else if (text.includes('interview')) meetingType = 'interview';
  else if (text.includes('consultation')) meetingType = 'consultation';
  else if (text.includes('coffee') || text.includes('catch up')) meetingType = 'casual';
  else if (text.includes('call')) meetingType = 'call';

  return {
    detected: confidence > 0.4,
    confidence,
    type: meetingType,
    suggestedDuration: meetingType === 'demo' ? 30 : meetingType === 'consultation' ? 60 : 30,
    keywords: schedulingKeywords.filter(k => text.includes(k))
  };
}

function generateEmailReply(fromEmail, subject, body, bookingUrl, userName) {
  // Simple template-based reply generation
  const firstName = fromEmail.split('@')[0].split('.')[0];
  const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const reSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

  const reply = `Hi ${capitalizedName},

Thanks for reaching out! I'd be happy to find a time to connect.

You can book a time that works best for you using my scheduling link:
${bookingUrl}

Just pick a slot that fits your schedule and I'll see you then!

Best,
${userName || 'Me'}`;

  return JSON.stringify({
    to: fromEmail,
    subject: reSubject,
    body: reply
  });
}


// ============ API ENDPOINTS ============

// GET /api/email/connections - Get user's email connections
router.get('/connections', authenticateToken, async (req, res) => {
  try {
    const connections = await pool.query(`
      SELECT id, provider, email_address, is_active, monitoring_enabled, last_sync_at, created_at
      FROM email_connections
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.id]);

    res.json({ connections: connections.rows });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// DELETE /api/email/connections/:id - Disconnect email
router.delete('/connections/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM email_connections WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// PATCH /api/email/connections/:id/toggle - Toggle monitoring
router.patch('/connections/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE email_connections
      SET monitoring_enabled = NOT monitoring_enabled, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING monitoring_enabled
    `, [req.params.id, req.user.id]);

    res.json({ monitoring_enabled: result.rows[0]?.monitoring_enabled });
  } catch (error) {
    console.error('Toggle monitoring error:', error);
    res.status(500).json({ error: 'Failed to toggle monitoring' });
  }
});

// POST /api/email/sync - Manually trigger sync
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const connections = await pool.query(
      'SELECT provider FROM email_connections WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );

    for (const conn of connections.rows) {
      if (conn.provider === 'gmail') {
        await syncGmailForUser(req.user.id);
      } else if (conn.provider === 'outlook') {
        await syncOutlookForUser(req.user.id);
      }
    }

    res.json({ success: true, message: 'Sync completed' });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// GET /api/email/detected - Get detected scheduling emails
router.get('/detected', authenticateToken, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const emails = await pool.query(`
      SELECT
        de.*,
        ec.provider
      FROM detected_emails de
      LEFT JOIN email_connections ec ON de.email_connection_id = ec.id
      WHERE de.user_id = $1
        AND ($2 = 'all' OR de.status = $2)
      ORDER BY de.received_at DESC
      LIMIT 50
    `, [req.user.id, status]);

    res.json({ emails: emails.rows });
  } catch (error) {
    console.error('Get detected emails error:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// POST /api/email/detected/:id/reply - Send reply
router.post('/detected/:id/reply', authenticateToken, async (req, res) => {
  try {
    const { customReply } = req.body;

    const email = await pool.query(`
      SELECT de.*, ec.provider, ec.access_token, ec.refresh_token, ec.token_expires_at, ec.id as connection_id
      FROM detected_emails de
      JOIN email_connections ec ON de.email_connection_id = ec.id
      WHERE de.id = $1 AND de.user_id = $2
    `, [req.params.id, req.user.id]);

    if (email.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const e = email.rows[0];
    const replyData = customReply ? JSON.parse(customReply) : JSON.parse(e.suggested_reply);

    // Send via Gmail or Outlook
    if (e.provider === 'gmail') {
      await sendGmailReply(e, replyData);
    } else if (e.provider === 'outlook') {
      await sendOutlookReply(e, replyData);
    }

    // Update status
    await pool.query(`
      UPDATE detected_emails SET status = 'replied', replied_at = NOW() WHERE id = $1
    `, [req.params.id]);

    console.log(`Reply sent for email ${req.params.id} to ${replyData.to}`);
    res.json({ success: true, message: 'Reply sent!' });
  } catch (error) {
    console.error('Send reply error:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// POST /api/email/detected/:id/dismiss - Dismiss email
router.post('/detected/:id/dismiss', authenticateToken, async (req, res) => {
  try {
    await pool.query(`
      UPDATE detected_emails SET status = 'dismissed' WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Dismiss error:', error);
    res.status(500).json({ error: 'Failed to dismiss' });
  }
});

async function sendGmailReply(email, replyData) {
  // Refresh token if needed
  let accessToken = email.access_token;
  if (new Date(email.token_expires_at) < new Date()) {
    accessToken = await refreshGmailToken({
      id: email.connection_id,
      refresh_token: email.refresh_token
    });
  }

  gmailOAuth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: gmailOAuth2Client });

  const message = [
    `To: ${replyData.to}`,
    `Subject: ${replyData.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    replyData.body
  ].join('\n');

  const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });
}

async function sendOutlookReply(email, replyData) {
  // Refresh token if needed
  let accessToken = email.access_token;
  if (new Date(email.token_expires_at) < new Date()) {
    accessToken = await refreshOutlookToken({
      id: email.connection_id,
      refresh_token: email.refresh_token
    });
  }

  await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        subject: replyData.subject,
        body: { contentType: 'Text', content: replyData.body },
        toRecipients: [{ emailAddress: { address: replyData.to } }]
      }
    })
  });
}

// Export for use in cron
module.exports = router;
module.exports.syncGmailForUser = syncGmailForUser;
module.exports.syncOutlookForUser = syncOutlookForUser;
