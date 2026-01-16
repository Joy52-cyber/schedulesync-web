/**
 * Detailed Email Bot Vanity URL Test
 * Shows full bot response with logs
 */

const axios = require('axios');
const pool = require('./server/config/database');

const API_URL = 'http://localhost:3000/api';

async function testVanityURL() {
  console.log('🧪 Detailed Email Bot Vanity URL Test\n');
  console.log('=' .repeat(70));

  try {
    // 1. Check what users exist in the database
    console.log('\n📊 Checking users in database...');
    const users = await pool.query(`
      SELECT id, username, email, name
      FROM users
      WHERE username IS NOT NULL
      LIMIT 5
    `);

    console.log(`Found ${users.rows.length} users with usernames:`);
    users.rows.forEach(user => {
      console.log(`  - ${user.username}@mg.trucal.xyz (${user.name}, ${user.email})`);
    });

    if (users.rows.length === 0) {
      console.log('\n❌ No users with usernames found in database!');
      console.log('   Create a user first or update existing user with a username.');
      return;
    }

    // 2. Test with the first user
    const testUser = users.rows[0];
    console.log(`\n📧 Testing with: ${testUser.username}@mg.trucal.xyz`);
    console.log('-'.repeat(70));

    const testEmail = {
      from: 'client@example.com',
      to: ['john@client.com'],
      cc: [`${testUser.username}@mg.trucal.xyz`],
      subject: 'Partnership Discussion',
      text: 'Let\'s schedule a meeting to discuss the partnership.',
      html: '<p>Let\'s schedule a meeting to discuss the partnership.</p>'
    };

    console.log('\n📤 Sending test email:');
    console.log(`   From: ${testEmail.from}`);
    console.log(`   To: ${testEmail.to.join(', ')}`);
    console.log(`   CC: ${testEmail.cc.join(', ')}`);
    console.log(`   Subject: ${testEmail.subject}`);

    const response = await axios.post(`${API_URL}/email/inbound/test`, testEmail, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('\n📥 Bot Response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log(`\n✅ SUCCESS! Thread ID: ${response.data.threadId}`);

      // 3. Check the thread in database
      const thread = await pool.query(
        'SELECT * FROM email_bot_threads WHERE id = $1',
        [response.data.threadId]
      );

      if (thread.rows.length > 0) {
        console.log('\n📊 Thread Details:');
        console.log(`   Thread ID: ${thread.rows[0].id}`);
        console.log(`   User ID: ${thread.rows[0].user_id}`);
        console.log(`   Status: ${thread.rows[0].status}`);
        console.log(`   Subject: ${thread.rows[0].subject}`);
        console.log(`   Created: ${thread.rows[0].created_at}`);
      }

      // 4. Check messages in thread
      const messages = await pool.query(
        'SELECT * FROM email_bot_messages WHERE thread_id = $1 ORDER BY created_at',
        [response.data.threadId]
      );

      console.log(`\n💬 Messages (${messages.rows.length}):`);
      messages.rows.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.direction.toUpperCase()} - From: ${msg.from_email}`);
      });

    } else {
      console.log(`\n⚠️  FAILED: ${response.data.reason}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Test complete!\n');

  } catch (error) {
    if (error.response) {
      console.log('\n❌ ERROR:', error.response.status, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n❌ ERROR: Server not running. Start with: cd server && npm start');
    } else {
      console.log('\n❌ ERROR:', error.message);
    }
  } finally {
    await pool.end();
  }
}

// Run test
testVanityURL().catch(console.error);
