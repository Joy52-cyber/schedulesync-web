/**
 * Check Thread 10 for Premium UI Slots
 */

const pool = require('./db');

async function checkThread() {
  const client = await pool.connect();
  try {
    // Get thread details
    const thread = await client.query(`
      SELECT id, status, guest_email, proposed_slots
      FROM email_bot_threads
      WHERE id = 10
    `);

    console.log('📧 Thread 10 Details:');
    console.log(JSON.stringify(thread.rows[0], null, 2));
    console.log('');

    // Show proposed slots with day labels
    if (thread.rows[0]?.proposed_slots) {
      console.log('🕒 Proposed Time Slots with Premium UI:');
      thread.rows[0].proposed_slots.forEach((slot, i) => {
        const icon = i === 0 ? '✓' : ' ';
        console.log(`  ${icon} ${slot.dayLabel || 'N/A'} - ${slot.formatted}`);
      });
      console.log('');

      // Check if day labels are present
      const hasLabels = thread.rows[0].proposed_slots.every(s => s.dayLabel);
      if (hasLabels) {
        console.log('✅ Premium UI confirmed: All slots have smart day labels');
      } else {
        console.log('❌ Missing day labels - Premium UI not working');
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkThread().catch(console.error);
