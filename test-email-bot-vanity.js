/**
 * Test Email Bot Vanity URL
 * Tests that the bot correctly identifies users from {username}@mg.trucal.xyz
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

// Test cases
const testCases = [
  {
    name: 'Test with joylacaba@mg.trucal.xyz',
    email: {
      from: 'client@example.com',
      to: ['john@client.com'],
      cc: ['joylacaba@mg.trucal.xyz'],
      subject: 'Partnership Discussion',
      text: 'Let\'s schedule a meeting to discuss the partnership.',
      html: '<p>Let\'s schedule a meeting to discuss the partnership.</p>'
    }
  },
  {
    name: 'Test with testuser1@mg.trucal.xyz',
    email: {
      from: 'jane@example.com',
      to: ['testuser1@mg.trucal.xyz', 'bob@company.com'],
      cc: [],
      subject: 'Project Kickoff',
      text: 'We should meet to kick off the project.',
      html: '<p>We should meet to kick off the project.</p>'
    }
  },
  {
    name: 'Test with invalid username (should fail)',
    email: {
      from: 'someone@example.com',
      to: ['nonexistentuser@mg.trucal.xyz'],
      cc: [],
      subject: 'Meeting Request',
      text: 'Can we schedule a time?',
      html: '<p>Can we schedule a time?</p>'
    }
  }
];

async function runTests() {
  console.log('🧪 Testing Email Bot with Vanity URLs\n');
  console.log('=' .repeat(60));

  for (const testCase of testCases) {
    console.log(`\n📧 ${testCase.name}`);
    console.log('-'.repeat(60));

    try {
      const response = await axios.post(`${API_URL}/email/inbound/test`, testCase.email, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log('✅ Response:', JSON.stringify(response.data, null, 2));

      if (response.data.success) {
        console.log(`✅ SUCCESS: Bot processed email for thread ${response.data.threadId}`);
      } else {
        console.log(`⚠️  FAILED: ${response.data.reason}`);
      }

    } catch (error) {
      if (error.response) {
        console.log('❌ ERROR:', error.response.status, error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        console.log('❌ ERROR: Server not running. Please start the server with: cd server && npm start');
        break;
      } else {
        console.log('❌ ERROR:', error.message);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Tests complete!\n');
}

// Run tests
runTests().catch(console.error);
