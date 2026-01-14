/**
 * Migration: Add ai_pending_actions table
 *
 * This table stores temporary state for multi-step AI interactions,
 * such as booking with template selection.
 *
 * Run with: node server/migrations/add_ai_pending_actions.js
 */

require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Starting migration: add_ai_pending_actions');

    // Create ai_pending_actions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_pending_actions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL,
        action_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '5 minutes',
        UNIQUE(user_id, action_type)
      )
    `);
    console.log('✅ Created ai_pending_actions table');

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_user_type
      ON ai_pending_actions(user_id, action_type)
    `);
    console.log('✅ Created index on ai_pending_actions');

    // Create index for cleanup of expired actions
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_expires
      ON ai_pending_actions(expires_at)
    `);
    console.log('✅ Created expiry index on ai_pending_actions');

    // Add default_template_id column to event_types if it doesn't exist
    const columnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'event_types' AND column_name = 'default_template_id'
    `);

    if (columnCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE event_types
        ADD COLUMN IF NOT EXISTS default_template_id INTEGER REFERENCES email_templates(id) ON DELETE SET NULL
      `);
      console.log('✅ Added default_template_id column to event_types');
    } else {
      console.log('ℹ️  default_template_id column already exists in event_types');
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
