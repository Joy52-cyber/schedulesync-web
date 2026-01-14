/**
 * Create Test Accounts Script
 * Run with: node server/scripts/create-test-accounts.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const testAccounts = [
  {
    email: 'test1@schedulesync.test',
    name: 'Test User One',
    username: 'testuser1',
    password: 'Test123!'
  },
  {
    email: 'test2@schedulesync.test',
    name: 'Test User Two',
    username: 'testuser2',
    password: 'Test123!'
  },
  {
    email: 'test3@schedulesync.test',
    name: 'Test User Three',
    username: 'testuser3',
    password: 'Test123!'
  },
  {
    email: 'test4@schedulesync.test',
    name: 'Test User Four',
    username: 'testuser4',
    password: 'Test123!'
  }
];

async function createTestAccounts() {
  console.log('Creating test accounts...\n');

  for (const account of testAccounts) {
    try {
      // Check if user already exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [account.email, account.username]
      );

      if (existing.rows.length > 0) {
        console.log(`⏭️  Skipping ${account.email} - already exists`);
        continue;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(account.password, salt);

      // Create user with email_verified = true so they can login immediately
      const result = await pool.query(
        `INSERT INTO users (email, name, username, password_hash, provider, email_verified)
         VALUES ($1, $2, $3, $4, 'email', true)
         RETURNING id, email, name, username`,
        [account.email, account.name, account.username, passwordHash]
      );

      const user = result.rows[0];
      console.log(`✅ Created: ${user.email} (username: ${user.username})`);

      // Create a default event type for each test user
      await pool.query(
        `INSERT INTO event_types (user_id, title, slug, duration, description, is_active)
         VALUES ($1, '30 Minute Meeting', '30min', 30, 'A quick 30 minute meeting', true)`,
        [user.id]
      );
      console.log(`   📅 Created default event type for ${user.name}`);

    } catch (error) {
      console.error(`❌ Error creating ${account.email}:`, error.message);
    }
  }

  console.log('\n========================================');
  console.log('Test Account Credentials:');
  console.log('========================================');
  testAccounts.forEach(acc => {
    console.log(`Email: ${acc.email}`);
    console.log(`Password: ${acc.password}`);
    console.log(`Username: ${acc.username}`);
    console.log(`Public URL: /book/public:${acc.username}`);
    console.log('---');
  });

  await pool.end();
  console.log('\nDone!');
}

createTestAccounts().catch(console.error);
