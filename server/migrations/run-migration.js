/**
 * Migration Runner
 * Usage: node server/migrations/run-migration.js <migration-file.sql>
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigration(migrationFile) {
  const migrationPath = path.join(__dirname, migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading migration: ${migrationFile}`);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    console.log('🔄 Running migration...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Usage: node run-migration.js <migration-file.sql>');
  console.log('\nAvailable migrations:');
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.sql'));
  files.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}

runMigration(migrationFile);
