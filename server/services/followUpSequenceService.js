const pool = require('../config/database');
const cron = require('node-cron');
const { sendEmail } = require('./emailService');

/**
 * Start a follow-up sequence for a booking
 * @param {number} userId - User ID
 * @param {number} bookingId - Booking ID
 * @param {string} triggerEvent - Trigger event type
 * @returns {Promise<void>}
 */
async function startFollowUpSequence(userId, bookingId, triggerEvent) {
  try {
    console.log(`🔄 Starting follow-up sequence for booking ${bookingId}, trigger: ${triggerEvent}`);

    // Find active sequences for this user and trigger
    const sequencesResult = await pool.query(`
      SELECT * FROM follow_up_sequences
      WHERE user_id = $1
        AND trigger_event = $2
        AND is_active = TRUE
    `, [userId, triggerEvent]);

    if (sequencesResult.rows.length === 0) {
      console.log(`No active sequences found for trigger: ${triggerEvent}`);
      return;
    }

    // Create sequence runs for each matching sequence
    for (const sequence of sequencesResult.rows) {
      if (!sequence.steps || sequence.steps.length === 0) {
        console.log(`Sequence ${sequence.id} has no steps, skipping`);
        continue;
      }

      const firstStep = sequence.steps[0];
      const nextActionAt = new Date(Date.now() + firstStep.delay_hours * 60 * 60 * 1000);

      await pool.query(`
        INSERT INTO follow_up_sequence_runs (
          sequence_id,
          booking_id,
          current_step,
          next_action_at,
          status
        ) VALUES ($1, $2, $3, $4, 'pending')
      `, [sequence.id, bookingId, 0, nextActionAt]);

      console.log(`✅ Sequence run created: ${sequence.name}, next action at ${nextActionAt.toISOString()}`);
    }

  } catch (error) {
    console.error('Error starting follow-up sequence:', error);
  }
}

/**
 * Process pending follow-up actions (called by cron)
 * @returns {Promise<void>}
 */
async function processFollowUpSequences() {
  try {
    console.log('⏰ Processing follow-up sequences...');

    // Get all pending runs that are due
    const dueRunsResult = await pool.query(`
      SELECT
        fsr.*,
        fs.name as sequence_name,
        fs.steps as sequence_steps,
        fs.user_id,
        b.attendee_name,
        b.attendee_email,
        b.title as booking_title,
        b.start_time,
        u.email as user_email,
        u.name as user_name
      FROM follow_up_sequence_runs fsr
      JOIN follow_up_sequences fs ON fsr.sequence_id = fs.id
      JOIN bookings b ON fsr.booking_id = b.id
      JOIN users u ON fs.user_id = u.id
      WHERE fsr.status = 'pending'
        AND fsr.next_action_at <= NOW()
      ORDER BY fsr.next_action_at ASC
      LIMIT 100
    `);

    console.log(`Found ${dueRunsResult.rows.length} pending actions`);

    for (const run of dueRunsResult.rows) {
      await executeSequenceStep(run);
    }

  } catch (error) {
    console.error('Error processing follow-up sequences:', error);
  }
}

/**
 * Execute a single sequence step
 * @param {object} run - Sequence run data
 * @returns {Promise<void>}
 */
async function executeSequenceStep(run) {
  try {
    const steps = run.sequence_steps;
    const currentStepIndex = run.current_step;

    if (currentStepIndex >= steps.length) {
      // Sequence complete
      await pool.query(`
        UPDATE follow_up_sequence_runs
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `, [run.id]);
      console.log(`✅ Sequence run ${run.id} completed`);
      return;
    }

    const step = steps[currentStepIndex];

    console.log(`▶️  Executing step ${currentStepIndex + 1}/${steps.length} for run ${run.id}: ${step.action}`);

    // Execute the action
    if (step.action === 'send_email') {
      await sendFollowUpEmail(run, step);
    } else {
      console.log(`Unknown action type: ${step.action}`);
    }

    // Move to next step
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex];
      const nextActionAt = new Date(Date.now() + nextStep.delay_hours * 60 * 60 * 1000);

      await pool.query(`
        UPDATE follow_up_sequence_runs
        SET
          current_step = $1,
          next_action_at = $2,
          status = 'pending'
        WHERE id = $3
      `, [nextStepIndex, nextActionAt, run.id]);

      console.log(`Next step scheduled for ${nextActionAt.toISOString()}`);
    } else {
      // No more steps, mark as completed
      await pool.query(`
        UPDATE follow_up_sequence_runs
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `, [run.id]);
      console.log(`✅ Sequence run ${run.id} completed`);
    }

  } catch (error) {
    console.error(`Error executing sequence step for run ${run.id}:`, error);

    // Mark as failed
    await pool.query(`
      UPDATE follow_up_sequence_runs
      SET status = 'failed'
      WHERE id = $1
    `, [run.id]);
  }
}

/**
 * Send a follow-up email as part of a sequence
 * @param {object} run - Sequence run data
 * @param {object} step - Step configuration
 * @returns {Promise<void>}
 */
async function sendFollowUpEmail(run, step) {
  try {
    // Get email template if specified
    let subject = step.subject || 'Follow-up from your recent meeting';
    let body = step.body || '';

    if (step.template_id) {
      const templateResult = await pool.query(
        'SELECT subject, body FROM email_templates WHERE id = $1',
        [step.template_id]
      );

      if (templateResult.rows.length > 0) {
        const template = templateResult.rows[0];
        subject = template.subject || subject;
        body = template.body || body;
      }
    }

    // Replace placeholders
    const replacements = {
      '{{attendee_name}}': run.attendee_name || 'there',
      '{{attendee_email}}': run.attendee_email,
      '{{booking_title}}': run.booking_title,
      '{{user_name}}': run.user_name,
      '{{user_email}}': run.user_email,
      '{{meeting_date}}': new Date(run.start_time).toLocaleDateString()
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      body = body.replace(new RegExp(placeholder, 'g'), value);
    });

    // Send email
    await sendEmail({
      to: run.attendee_email,
      from: run.user_email,
      subject,
      html: body,
      text: body.replace(/<[^>]*>/g, '') // Strip HTML for plain text
    });

    console.log(`📧 Follow-up email sent to ${run.attendee_email}`);

  } catch (error) {
    console.error('Error sending follow-up email:', error);
    throw error;
  }
}

/**
 * Initialize cron job for processing sequences
 * Run every hour
 */
function initializeFollowUpCron() {
  console.log('📅 Initializing follow-up sequence cron job (every hour)');

  cron.schedule('0 * * * *', async () => {
    console.log('\n🔄 Follow-up sequence cron triggered');
    await processFollowUpSequences();
  });
}

/**
 * Cancel a sequence run
 * @param {number} runId - Sequence run ID
 * @returns {Promise<void>}
 */
async function cancelSequenceRun(runId) {
  await pool.query(`
    UPDATE follow_up_sequence_runs
    SET status = 'cancelled'
    WHERE id = $1 AND status = 'pending'
  `, [runId]);

  console.log(`❌ Sequence run ${runId} cancelled`);
}

/**
 * Get active sequences for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Active sequences
 */
async function getActiveSequences(userId) {
  const result = await pool.query(`
    SELECT * FROM follow_up_sequences
    WHERE user_id = $1 AND is_active = TRUE
    ORDER BY name ASC
  `, [userId]);

  return result.rows;
}

module.exports = {
  startFollowUpSequence,
  processFollowUpSequences,
  initializeFollowUpCron,
  cancelSequenceRun,
  getActiveSequences,
  executeSequenceStep
};
