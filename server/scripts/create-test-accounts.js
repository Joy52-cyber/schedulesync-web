/**
 * Create Test Accounts Script
 * Run with: railway run node server/scripts/create-test-accounts.js
 */

const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const testAccounts = [
  { email: 'test1@schedulesync.test', name: 'Test User One', username: 'testuser1', tier: 'pro' },
  { email: 'test2@schedulesync.test', name: 'Test User Two', username: 'testuser2', tier: 'team' },
  { email: 'test3@schedulesync.test', name: 'Test User Three', username: 'testuser3', tier: 'free' },
  { email: 'test4@schedulesync.test', name: 'Test User Four', username: 'testuser4', tier: 'plus' },
];

const TEST_PASSWORD = 'Test123!';

async function createTestAccounts() {
  console.log('Creating test accounts...\n');

  // Generate password hash on the server
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  console.log('Generated password hash on server');

  for (const account of testAccounts) {
    try {
      // Delete existing account if it exists (to reset password)
      await pool.query('DELETE FROM users WHERE email = $1', [account.email]);

      // Create user with email_verified = true and onboarding_completed = true so they can login immediately
      const result = await pool.query(
        `INSERT INTO users (email, name, username, password_hash, provider, email_verified, subscription_tier, onboarding_completed, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'email', true, $5, true, NOW(), NOW())
         RETURNING id, email, name, username`,
        [account.email, account.name, account.username, passwordHash, account.tier]
      );

      const user = result.rows[0];
      console.log(`✅ Created: ${user.email} (ID: ${user.id}, username: ${user.username})`);

      // Create default event types for each test user
      await pool.query(
        `INSERT INTO event_types (user_id, title, slug, duration, description, is_active, created_at)
         VALUES
           ($1, '30 Minute Meeting', '30min', 30, 'A quick 30 minute chat', true, NOW()),
           ($1, '60 Minute Consultation', '60min', 60, 'In-depth consultation session', true, NOW())
         ON CONFLICT DO NOTHING`,
        [user.id]
      );
      console.log(`   📅 Created event types for ${user.name}`);

    } catch (error) {
      console.error(`❌ Error creating ${account.email}:`, error.message);
    }
  }

  console.log('\n========================================');
  console.log('Test Account Credentials:');
  console.log('========================================');
  testAccounts.forEach(acc => {
    console.log(`Email: ${acc.email}`);
    console.log(`Password: ${TEST_PASSWORD}`);
    console.log(`Username: ${acc.username}`);
    console.log(`Tier: ${acc.tier}`);
    console.log(`Public URL: /${acc.username}`);
    console.log('---');
  });

  await pool.end();
  console.log('\nDone!');
}

createTestAccounts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
