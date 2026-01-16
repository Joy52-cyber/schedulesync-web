/**
 * Generate Email Preview with Premium UI
 * Shows what the bot email looks like with smart day labels
 */

const { generatePickATimeEmail } = require('./services/emailTemplates');
const fs = require('fs');
const path = require('path');

// Sample data with premium day labels
const now = new Date();
const today = new Date(now);
today.setHours(14, 0, 0, 0); // 2:00 PM today

const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(10, 0, 0, 0); // 10:00 AM tomorrow

const friday = new Date(now);
friday.setDate(friday.getDate() + (5 - now.getDay() + 7) % 7); // Next Friday
friday.setHours(14, 0, 0, 0); // 2:00 PM

const monday = new Date(now);
monday.setDate(monday.getDate() + (1 - now.getDay() + 7) % 7 + 7); // Next Monday
monday.setHours(9, 0, 0, 0); // 9:00 AM

const tuesday = new Date(monday);
tuesday.setDate(tuesday.getDate() + 1);
tuesday.setHours(11, 0, 0, 0); // 11:00 AM

// Create slots with premium day labels
const slots = [
  {
    start: today.toISOString(),
    end: new Date(today.getTime() + 30 * 60000).toISOString(),
    formatted: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
    dayLabel: 'Today'
  },
  {
    start: tomorrow.toISOString(),
    end: new Date(tomorrow.getTime() + 30 * 60000).toISOString(),
    formatted: tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
    dayLabel: 'Tomorrow'
  },
  {
    start: friday.toISOString(),
    end: new Date(friday.getTime() + 30 * 60000).toISOString(),
    formatted: friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
    dayLabel: 'Friday'
  },
  {
    start: monday.toISOString(),
    end: new Date(monday.getTime() + 30 * 60000).toISOString(),
    formatted: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
    dayLabel: 'Monday'
  },
  {
    start: tuesday.toISOString(),
    end: new Date(tuesday.getTime() + 30 * 60000).toISOString(),
    formatted: tuesday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
    dayLabel: 'Tuesday'
  }
];

console.log('📧 Generating Premium Email Preview...\n');
console.log('Premium Day Labels:');
slots.forEach((slot, i) => {
  const icon = i === 0 ? '✓' : ' ';
  console.log(`  ${icon} ${slot.dayLabel} - ${slot.formatted}`);
});
console.log('');

// Generate email HTML
const emailHtml = generatePickATimeEmail({
  guestName: 'John',
  hostName: 'Joy Lacaba',
  introMessage: "I'm helping Joy Lacaba schedule your meeting.",
  duration: 30,
  slots: slots,
  baseUrl: 'https://schedulesync-web-production.up.railway.app',
  username: 'jaybersales95',
  threadId: 999,
  calendarUrl: 'https://schedulesync-web-production.up.railway.app/jaybersales95',
  signature: 'Powered by <span style="color: #71717a; font-weight: 600;">TruCal</span>'
});

// Save to file
const outputPath = path.join(__dirname, 'premium-email-preview.html');
fs.writeFileSync(outputPath, emailHtml);

console.log('✅ Email preview generated!');
console.log(`📄 Saved to: ${outputPath}`);
console.log('\n🌐 Open in browser to see the premium UI with:');
console.log('   - Smart day labels (Today, Tomorrow, day names)');
console.log('   - Gradient first button');
console.log('   - Clean, short date format');
console.log('   - Professional spacing and styling\n');
