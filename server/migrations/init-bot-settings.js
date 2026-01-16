/**
 * Initialize Email Bot Settings
 * Creates default bot settings for a user
 * Usage: node server/migrations/init-bot-settings.js <user_id>
 */

require('dotenv').config();
const pool = require('../config/database');

async function initBotSettings(userId) {
  console.log(`🤖 Initializing email bot settings for user ${userId}...\n`);

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT id, username, email, name FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      console.error(`❌ User with ID ${userId} not found`);
      process.exit(1);
    }

    const user = userCheck.rows[0];
    console.log(`✅ Found user: ${user.name} (${user.email})`);
    console.log(`   Username: ${user.username}\n`);

    // Check if bot settings already exist
    const existingSettings = await pool.query(
      'SELECT * FROM email_bot_settings WHERE user_id = $1',
      [userId]
    );

    if (existingSettings.rows.length > 0) {
      console.log('⚠️  Bot settings already exist for this user:');
      console.log(JSON.stringify(existingSettings.rows[0], null, 2));
      console.log('\nTo update settings, delete the existing record first.');
      return;
    }

    // Create default bot settings
    const result = await pool.query(`
      INSERT INTO email_bot_settings (
        user_id,
        is_enabled,
        bot_email_prefix,
        default_duration,
        intro_message,
        signature,
        max_slots_to_show,
        prefer_time_of_day
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `, [
      userId,
      true, // is_enabled
      user.username, // bot_email_prefix (e.g., "john" for john@trucal.xyz)
      30, // default_duration
      `I'm helping ${user.name} schedule a meeting with you.`, // intro_message
      'Powered by <span style="color: #71717a; font-weight: 600;">TruCal</span>', // signature
      5, // max_slots_to_show
      null // prefer_time_of_day (any time)
    ]);

    console.log('✅ Email bot settings created successfully!');
    console.log('\nSettings:');
    console.log(JSON.stringify(result.rows[0], null, 2));

    console.log('\n📧 Bot Email Address:');
    console.log(`   schedule@mg.trucal.xyz (global bot address)`);
    console.log(`   All emails to schedule@mg.trucal.xyz will be processed by the bot\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get user ID from command line argument
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Usage: node init-bot-settings.js <user_id>');
  console.log('\nExample: node init-bot-settings.js 1');
  process.exit(1);
}

initBotSettings(parseInt(userId));
