/**
 * Email Webhook Routes
 * Receives inbound emails from email providers (SendGrid, Mailgun, etc.)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { processInboundEmail } = require('../services/emailBot');

// Multer for parsing multipart form data (SendGrid/Mailgun format)
const upload = multer();

/**
 * Verify Mailgun webhook signature
 * Mailgun signs webhooks using HMAC-SHA256
 */
function verifyMailgunSignature(timestamp, token, signature) {
  // Skip verification in development if no signing key is set
  if (!process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.warn('⚠️  MAILGUN_WEBHOOK_SIGNING_KEY not set, skipping signature verification');
    return true;
  }

  const encodedToken = crypto
    .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');

  return encodedToken === signature;
}

/**
 * POST /api/email/inbound
 * Webhook endpoint for receiving inbound emails
 *
 * Supports:
 * - SendGrid Inbound Parse
 * - Mailgun
 * - Custom SMTP relay
 */
router.post('/inbound', upload.any(), async (req, res) => {
  console.log('📨 Received inbound email webhook');

  try {
    // Verify Mailgun signature if present
    if (req.body.signature && req.body.timestamp && req.body.token) {
      const isValid = verifyMailgunSignature(
        req.body.timestamp,
        req.body.token,
        req.body.signature
      );

      if (!isValid) {
        console.error('❌ Invalid Mailgun signature');
        return res.status(403).json({ error: 'Invalid signature' });
      }

      console.log('✅ Mailgun signature verified');
    }

    // Parse based on provider
    let emailData;

    if (req.body.envelope) {
      // SendGrid format
      emailData = parseSendGridEmail(req.body);
    } else if (req.body['body-plain']) {
      // Mailgun format
      emailData = parseMailgunEmail(req.body);
    } else {
      // Generic JSON format
      emailData = parseGenericEmail(req.body);
    }

    console.log('📧 Parsed email:', {
      from: emailData.from?.email,
      to: emailData.to?.map(t => t.email),
      subject: emailData.subject
    });

    // Process the email
    const result = await processInboundEmail(emailData);

    if (result.success) {
      console.log('✅ Email processed successfully');
      res.status(200).json({ success: true, threadId: result.threadId });
    } else {
      console.log('⚠️ Email processing issue:', result.reason);
      res.status(200).json({ success: false, reason: result.reason });
    }

  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Return 200 to prevent retries
    res.status(200).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/email/inbound/test
 * Test endpoint for simulating inbound emails
 */
router.post('/inbound/test', async (req, res) => {
  console.log('🧪 Test inbound email received');

  try {
    const emailData = parseGenericEmail(req.body);

    console.log('📧 Test email data:', {
      from: emailData.from?.email,
      to: emailData.to?.map(t => t.email),
      subject: emailData.subject
    });

    const result = await processInboundEmail(emailData);
    res.json(result);

  } catch (error) {
    console.error('❌ Test webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Parse SendGrid Inbound Parse format
 */
function parseSendGridEmail(body) {
  const envelope = JSON.parse(body.envelope || '{}');
  const headers = parseHeaders(body.headers);

  // Parse from
  const fromHeader = body.from || '';
  const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/) || [null, fromHeader, fromHeader];

  // Parse to/cc
  const parseAddressList = (str) => {
    if (!str) return [];
    return str.split(',').map(addr => {
      const match = addr.trim().match(/^(.+?)\s*<(.+?)>$/) || [null, '', addr.trim()];
      return { name: match[1]?.trim().replace(/"/g, ''), email: match[2]?.trim() };
    });
  };

  return {
    from: {
      name: fromMatch[1]?.trim().replace(/"/g, ''),
      email: fromMatch[2]?.trim() || envelope.from
    },
    to: parseAddressList(body.to),
    cc: parseAddressList(body.cc),
    subject: body.subject,
    text: body.text,
    html: body.html,
    messageId: headers['message-id'],
    inReplyTo: headers['in-reply-to'],
    references: headers['references']?.split(/\s+/)
  };
}

/**
 * Parse Mailgun format
 */
function parseMailgunEmail(body) {
  // Parse all To recipients (Mailgun sends the full To header)
  const parseAddressList = (str) => {
    if (!str) return [];
    return str.split(',').map(addr => {
      const trimmed = addr.trim();
      const match = trimmed.match(/^(.+?)\s*<(.+?)>$/);
      if (match) {
        return { name: match[1].trim().replace(/"/g, ''), email: match[2].trim() };
      }
      return { name: '', email: trimmed };
    }).filter(a => a.email);
  };

  // Mailgun sends To/Cc headers as well as recipient
  const toRecipients = parseAddressList(body.To || body.to);
  const ccRecipients = parseAddressList(body.Cc || body.cc);

  // If no To header, fall back to recipient
  if (toRecipients.length === 0 && body.recipient) {
    toRecipients.push({ email: body.recipient, name: '' });
  }

  return {
    from: { email: body.sender, name: body.from?.split('<')[0]?.trim() },
    to: toRecipients,
    cc: ccRecipients,
    subject: body.subject,
    text: body['body-plain'],
    html: body['body-html'],
    messageId: body['Message-Id'],
    inReplyTo: body['In-Reply-To'],
    references: body['References']?.split(/\s+/)
  };
}

/**
 * Parse generic JSON format
 */
function parseGenericEmail(body) {
  // Helper to normalize email addresses to {email, name} objects
  const normalizeAddress = (addr) => {
    if (!addr) return null;
    if (typeof addr === 'string') {
      // Could be "Name <email>" or just "email"
      const match = addr.match(/^(.+?)\s*<(.+?)>$/);
      if (match) {
        return { name: match[1].trim().replace(/"/g, ''), email: match[2].trim() };
      }
      return { email: addr.trim(), name: '' };
    }
    if (typeof addr === 'object' && addr.email) {
      return addr;
    }
    return null;
  };

  // Helper to normalize array of addresses
  const normalizeAddressList = (list) => {
    if (!list) return [];
    if (typeof list === 'string') {
      // Handle comma-separated string of emails
      return list.split(',').map(addr => normalizeAddress(addr.trim())).filter(Boolean);
    }
    if (Array.isArray(list)) {
      return list.map(normalizeAddress).filter(Boolean);
    }
    return [];
  };

  return {
    from: normalizeAddress(body.from) || normalizeAddress(body.fromEmail) || { email: 'unknown', name: '' },
    to: normalizeAddressList(body.to) || [normalizeAddress(body.toEmail)].filter(Boolean),
    cc: normalizeAddressList(body.cc),
    subject: body.subject || '(no subject)',
    text: body.text || body.textBody || '',
    html: body.html || body.htmlBody || '',
    messageId: body.messageId || body.headers?.['Message-ID'] || `msg-${Date.now()}`,
    inReplyTo: body.inReplyTo,
    references: body.references
  };
}

/**
 * Parse email headers string
 */
function parseHeaders(headersStr) {
  const headers = {};
  if (!headersStr) return headers;

  const lines = headersStr.split('\n');
  let currentKey = '';

  lines.forEach(line => {
    if (line.match(/^\s/)) {
      // Continuation of previous header
      headers[currentKey] += ' ' + line.trim();
    } else {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        currentKey = match[1].toLowerCase();
        headers[currentKey] = match[2].trim();
      }
    }
  });

  return headers;
}

module.exports = router;
