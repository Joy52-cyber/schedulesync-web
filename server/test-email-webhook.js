/**
 * Test Email Bot Webhook
 * Simulates an inbound email to the webhook endpoint
 * Usage: node server/test-email-webhook.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Sample email data - simulating Mailgun webhook payload
const sampleMailgunPayload = {
  // Mailgun signature fields (for verification)
  timestamp: Math.floor(Date.now() / 1000).toString(),
  token: 'test-token-' + Date.now(),
  signature: 'test-signature', // Will be skipped if MAILGUN_WEBHOOK_SIGNING_KEY not set

  // Email metadata
  sender: 'john@company.com',
  from: 'John Smith <john@company.com>',
  subject: 'Partnership Discussion - Let\'s find a time to meet',

  // Recipients (includes the bot email)
  recipient: 'schedule@mg.trucal.xyz',
  To: 'schedule@mg.trucal.xyz, jaybersales95@gmail.com', // TruCal user email
  Cc: '',

  // Email body
  'body-plain': `Hi there,

I'd love to schedule a meeting to discuss our partnership opportunity.

Are you available sometime next week? I prefer mornings if possible.

Looking forward to hearing from you!

Best,
John`,

  'body-html': `<p>Hi there,</p>
<p>I'd love to schedule a meeting to discuss our partnership opportunity.</p>
<p>Are you available sometime next week? I prefer mornings if possible.</p>
<p>Looking forward to hearing from you!</p>
<p>Best,<br>John</p>`,

  // Email headers
  'Message-Id': '<test-message-' + Date.now() + '@company.com>',
  'In-Reply-To': '',
  'References': ''
};

// Alternative: Generic JSON format (easier to customize)
const sampleGenericPayload = {
  from: {
    email: 'sarah@startup.com',
    name: 'Sarah Johnson'
  },
  to: [
    { email: 'schedule@mg.trucal.xyz', name: 'TruCal Bot' },
    { email: 'jaybersales95@gmail.com', name: 'Jay Bersales' } // TruCal user
  ],
  cc: [],
  subject: 'Quick meeting to discuss project',
  text: `Hey!

Can we schedule a quick 30-minute call?

I'm flexible this week, afternoon would be great.

Thanks!
Sarah`,
  html: '<p>Hey!</p><p>Can we schedule a quick 30-minute call?</p><p>I\'m flexible this week, afternoon would be great.</p><p>Thanks!<br>Sarah</p>',
  messageId: 'test-msg-' + Date.now() + '@startup.com'
};

async function testWebhook(useMailgunFormat = true) {
  const payload = useMailgunFormat ? sampleMailgunPayload : sampleGenericPayload;
  const format = useMailgunFormat ? 'Mailgun' : 'Generic JSON';

  console.log(`\n🧪 Testing Email Bot Webhook (${format} format)\n`);
  console.log('Target URL:', `${BASE_URL}/api/email/inbound`);
  console.log('From:', payload.from || payload.sender);
  console.log('To:', payload.to || payload.To);
  console.log('Subject:', payload.subject);
  console.log('\n📤 Sending webhook request...\n');

  try {
    const response = await axios.post(
      `${BASE_URL}/api/email/inbound`,
      payload,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded' // Mailgun sends as form data
        }
      }
    );

    console.log('✅ Webhook Response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log('\n✅ Email processed successfully!');
      console.log(`Thread ID: ${response.data.threadId}`);
      console.log('\n📧 Check the database for:');
      console.log(`  - New thread in email_bot_threads (ID: ${response.data.threadId})`);
      console.log('  - Inbound message in email_bot_messages');
      console.log('  - Outbound bot response in email_bot_messages');
      console.log('\n📬 Guest should receive email with time slot options');
    } else {
      console.log('\n⚠️  Email processing issue:', response.data.reason);

      if (response.data.reason === 'no_user_found') {
        console.log('\n💡 Fix: Update the email payload to include a valid TruCal user email');
        console.log('   Replace "user@example.com" with an actual user from your database');
        console.log('   Run: psql $DATABASE_URL -c "SELECT id, email FROM users;"');
      } else if (response.data.reason === 'bot_disabled') {
        console.log('\n💡 Fix: Enable the bot for this user');
        console.log('   Run: node server/migrations/init-bot-settings.js <user_id>');
      }
    }

  } catch (error) {
    console.error('❌ Webhook request failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }

    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure the server is running: npm run dev');
    console.log(`2. Check server is accessible at ${BASE_URL}`);
    console.log('3. Verify database schema is migrated: node server/migrations/verify-email-bot-schema.js');
    console.log('4. Check user exists and bot is enabled for them');
  }
}

// Get format from command line argument
const format = process.argv[2];

if (format === 'generic' || format === 'json') {
  testWebhook(false); // Use generic JSON format
} else {
  testWebhook(true); // Use Mailgun format (default)
}

console.log('\n📝 Usage:');
console.log('  node server/test-email-webhook.js          # Test with Mailgun format');
console.log('  node server/test-email-webhook.js generic  # Test with generic JSON format');
console.log('');
