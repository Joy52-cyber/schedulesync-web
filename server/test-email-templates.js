/**
 * Test script to send preview emails for all 4 MJML templates
 * Usage: node server/test-email-templates.js your-email@example.com
 */

require('dotenv').config();
const { Resend } = require('resend');
const {
  generatePickATimeEmail,
  generateConfirmationEmail,
  generateCancelledEmail,
  generateNoSlotsEmail
} = require('./services/emailTemplates');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

const BOT_EMAIL = 'schedule@trucal.xyz';
const BOT_NAME = 'TruCal Scheduling Assistant';

async function sendTestEmail(to, subject, html) {
  try {
    const result = await resend.emails.send({
      from: `${BOT_NAME} <${BOT_EMAIL}>`,
      to: to,
      subject: subject,
      html: html
    });
    console.log(`✅ Sent: ${subject}`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to send ${subject}:`, error.message);
    throw error;
  }
}

async function sendAllTestEmails(recipientEmail) {
  console.log('\n📧 Sending test emails to:', recipientEmail);
  console.log('From:', `${BOT_NAME} <${BOT_EMAIL}>`);
  console.log('Via: Resend API\n');

  const baseUrl = process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app';
  console.log('🔗 Base URL:', baseUrl);

  try {
    // 1. Pick a Time email (with premium styling)
    console.log('1️⃣  Generating "Pick a Time" email...');
    const pickTimeHtml = generatePickATimeEmail({
      guestName: 'Sarah',
      introMessage: "I'm helping Jane Doe schedule a meeting with you.",
      duration: 30,
      slots: [
        { start: '2024-01-22T10:00:00', end: '2024-01-22T10:30:00', formatted: 'Jan 22 at 10:00 AM', dayLabel: 'Today' },
        { start: '2024-01-23T14:00:00', end: '2024-01-23T14:30:00', formatted: 'Jan 23 at 2:00 PM', dayLabel: 'Tomorrow' },
        { start: '2024-01-26T11:00:00', end: '2024-01-26T11:30:00', formatted: 'Jan 26 at 11:00 AM', dayLabel: 'Friday' }
      ],
      baseUrl: baseUrl,
      username: 'janedoe',
      threadId: 123,
      hostName: 'Jane Doe',
      calendarUrl: `${baseUrl}/janedoe`,
      signature: 'Powered by TruCal'
    });
    await sendTestEmail(recipientEmail, '✨ [PREMIUM] Pick a Time - TruCal', pickTimeHtml);

    // 2. Meeting Confirmed email
    console.log('2️⃣  Generating "Meeting Confirmed" email...');
    const confirmationHtml = generateConfirmationEmail({
      formattedDate: 'Monday, January 22, 2024',
      formattedTime: '10:00 AM',
      duration: 30,
      participants: 'Jane Doe & John Smith',
      manageUrl: `${baseUrl}/manage/test-token-123`
    });
    await sendTestEmail(recipientEmail, '✨ [PREMIUM] Meeting Confirmed - TruCal', confirmationHtml);

    // 3. Meeting Cancelled email
    console.log('3️⃣  Generating "Meeting Cancelled" email...');
    const cancelledHtml = generateCancelledEmail({
      hostName: 'Jane Doe',
      calendarUrl: `${baseUrl}/janedoe`
    });
    await sendTestEmail(recipientEmail, '✨ [PREMIUM] Meeting Cancelled - TruCal', cancelledHtml);

    // 4. No Available Times email
    console.log('4️⃣  Generating "No Available Times" email...');
    const noSlotsHtml = generateNoSlotsEmail({
      guestName: 'Sarah',
      hostName: 'Jane Doe',
      calendarUrl: `${baseUrl}/janedoe`
    });
    await sendTestEmail(recipientEmail, '✨ [PREMIUM] No Available Times - TruCal', noSlotsHtml);

    console.log('\n🎉 All test emails sent successfully!');
    console.log('📬 Check your inbox at:', recipientEmail);
    console.log('\n💡 Tip: Check your spam folder if you don\'t see them');

  } catch (error) {
    console.error('\n❌ Error sending test emails:', error);
    process.exit(1);
  }
}

// Get recipient email from command line argument
const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('❌ Error: Please provide a recipient email address');
  console.log('\nUsage: node server/test-email-templates.js your-email@example.com');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipientEmail)) {
  console.error('❌ Error: Invalid email format');
  process.exit(1);
}

// Check Resend credentials
if (!process.env.RESEND_API_KEY) {
  console.error('❌ Error: RESEND_API_KEY not found in environment variables');
  console.log('Please set RESEND_API_KEY in your .env file');
  process.exit(1);
}

// Send all test emails
sendAllTestEmails(recipientEmail);
