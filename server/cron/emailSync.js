const cron = require('node-cron');
const pool = require('../config/database');
const { syncGmailForUser, syncOutlookForUser } = require('../routes/emailIntegration');

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('📧 Starting email sync cron job...');

  try {
    // Get all active email connections with monitoring enabled
    const connections = await pool.query(`
      SELECT DISTINCT user_id, provider
      FROM email_connections
      WHERE is_active = true AND monitoring_enabled = true
    `);

    console.log(`   Found ${connections.rows.length} connections to sync`);

    for (const conn of connections.rows) {
      try {
        if (conn.provider === 'gmail') {
          await syncGmailForUser(conn.user_id);
        } else if (conn.provider === 'outlook') {
          await syncOutlookForUser(conn.user_id);
        }
      } catch (error) {
        console.error(`   Error syncing ${conn.provider} for user ${conn.user_id}:`, error.message);
      }
    }

    console.log('✅ Email sync cron completed');
  } catch (error) {
    console.error('❌ Email sync cron failed:', error);
  }
});

console.log('📧 Email sync cron job scheduled (every 15 minutes)');

module.exports = {};
