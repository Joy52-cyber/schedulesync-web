require('dotenv').config();
const { generatePickATimeEmail } = require('./services/emailTemplates');

const baseUrl = process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app';
console.log('Environment FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('Using baseUrl:', baseUrl);

const html = generatePickATimeEmail({
  guestName: 'John',
  introMessage: 'Test',
  duration: 30,
  slots: [{ start: '2024-01-22T10:00:00', end: '2024-01-22T10:30:00', formatted: 'Monday, January 22, 10:00 AM' }],
  baseUrl: baseUrl,
  username: 'janedoe',
  threadId: 123,
  hostName: 'Jane Doe',
  calendarUrl: `${baseUrl}/janedoe`,
  signature: 'TruCal'
});

// Extract URLs from the HTML
const urlMatches = html.match(/https?:\/\/[^\s"'<>]+/g);
console.log('\nURLs found in generated HTML:');
if (urlMatches) {
  urlMatches.forEach(url => console.log(' -', url));
} else {
  console.log('No URLs found');
}
