/**
 * Verify Email Bot Schema
 * Checks if all email bot tables and indexes were created successfully
 */

require('dotenv').config();
const pool = require('../config/database');

async function verifySchema() {
  console.log('🔍 Verifying email bot database schema...\n');

  try {
    // Check tables
    const tablesToCheck = [
      'email_bot_settings',
      'email_bot_threads',
      'email_bot_messages'
    ];

    for (const table of tablesToCheck) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = $1
        );
      `, [table]);

      if (result.rows[0].exists) {
        console.log(`✅ Table "${table}" exists`);

        // Get column count
        const columns = await pool.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `, [table]);

        console.log(`   Columns (${columns.rows.length}):`);
        columns.rows.forEach(col => {
          console.log(`   - ${col.column_name} (${col.data_type})`);
        });
        console.log('');
      } else {
        console.log(`❌ Table "${table}" NOT FOUND`);
      }
    }

    // Check indexes
    console.log('📊 Checking indexes...');
    const indexes = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename LIKE 'email_bot%'
      ORDER BY tablename, indexname;
    `);

    if (indexes.rows.length > 0) {
      console.log(`✅ Found ${indexes.rows.length} indexes:`);
      indexes.rows.forEach(idx => {
        console.log(`   - ${idx.indexname} on ${idx.tablename}`);
      });
    } else {
      console.log('⚠️  No indexes found');
    }

    console.log('\n✅ Schema verification complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifySchema();
