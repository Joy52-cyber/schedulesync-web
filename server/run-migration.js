const fs = require('fs');
const path = require('path');
const pool = require('./config/database');

async function runMigration(migrationFile) {
  const client = await pool.connect();

  try {
    console.log(`Running migration: ${migrationFile}`);

    // Read SQL file
    const sqlPath = path.join(__dirname, 'migrations', migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('SQL to execute:');
    console.log(sql);
    console.log('\n---\n');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 100)}...`);
      await client.query(statement);
      console.log('✓ Success');
    }

    console.log('\n✅ Migration completed successfully!');

    // Verify the columns were added
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('onboarded', 'available_from', 'available_to', 'work_days')
      ORDER BY column_name;
    `);

    console.log('\n📊 Verification - Columns added:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}): ${row.column_default || 'no default'}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
const migrationFile = process.argv[2] || 'add_onboarding.sql';
runMigration(migrationFile)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
