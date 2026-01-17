const axios = require('axios');
const crypto = require('crypto');
const pool = require('../config/database');

/**
 * Trigger webhooks for a user and event type
 * @param {number} userId - User ID
 * @param {string} eventType - Event type (e.g., 'booking.created')
 * @param {object} payload - Event payload
 * @returns {Promise<void>}
 */
async function triggerWebhook(userId, eventType, payload) {
  try {
    console.log(`🪝 Triggering webhooks for user ${userId}, event: ${eventType}`);

    // Get all active webhooks for this user that listen to this event
    const webhooksResult = await pool.query(`
      SELECT * FROM user_webhooks
      WHERE user_id = $1
        AND is_active = TRUE
        AND $2 = ANY(events)
    `, [userId, eventType]);

    if (webhooksResult.rows.length === 0) {
      console.log('No active webhooks found for this event');
      return;
    }

    console.log(`Found ${webhooksResult.rows.length} webhooks to trigger`);

    // Deliver to each webhook
    for (const webhook of webhooksResult.rows) {
      await deliverWebhook(webhook, eventType, payload);
    }

  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

/**
 * Deliver a webhook to a single endpoint
 * @param {object} webhook - Webhook configuration
 * @param {string} eventType - Event type
 * @param {object} payload - Payload to send
 * @returns {Promise<object>} - Delivery result
 */
async function deliverWebhook(webhook, eventType, payload) {
  try {
    // Create signature for verification
    const signature = createSignature(payload, webhook.secret);

    // Generate unique delivery ID
    const deliveryId = crypto.randomUUID();

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'X-TruCal-Event': eventType,
      'X-TruCal-Signature': signature,
      'X-TruCal-Delivery': deliveryId,
      'X-TruCal-Timestamp': new Date().toISOString()
    };

    console.log(`📤 Delivering webhook ${webhook.id} to ${webhook.url}`);

    // Send webhook
    const response = await axios.post(webhook.url, payload, {
      headers,
      timeout: 10000, // 10 second timeout
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });

    // Log delivery
    await logDelivery(webhook.id, eventType, payload, response.status, response.data);

    // Update webhook status
    if (response.status >= 200 && response.status < 300) {
      // Success - reset failure count
      await pool.query(`
        UPDATE user_webhooks
        SET
          failure_count = 0,
          last_triggered_at = NOW()
        WHERE id = $1
      `, [webhook.id]);

      console.log(`✅ Webhook delivered successfully (status ${response.status})`);

      return {
        success: true,
        statusCode: response.status,
        responseBody: response.data
      };
    } else {
      // Non-2xx status
      await handleFailure(webhook.id, response.status);

      return {
        success: false,
        statusCode: response.status,
        responseBody: response.data
      };
    }

  } catch (error) {
    console.error(`Error delivering webhook ${webhook.id}:`, error.message);

    // Log failed delivery
    await logDelivery(
      webhook.id,
      eventType,
      payload,
      error.response?.status || 0,
      error.message
    );

    // Handle failure
    await handleFailure(webhook.id, error.response?.status || 0);

    return {
      success: false,
      statusCode: error.response?.status || 0,
      responseBody: error.message
    };
  }
}

/**
 * Create HMAC signature for webhook verification
 * @param {object} payload - Payload object
 * @param {string} secret - Webhook secret
 * @returns {string} - HMAC signature
 */
function createSignature(payload, secret) {
  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString);
  return hmac.digest('hex');
}

/**
 * Log webhook delivery
 * @param {number} webhookId - Webhook ID
 * @param {string} eventType - Event type
 * @param {object} payload - Payload
 * @param {number} statusCode - HTTP status code
 * @param {any} responseBody - Response body
 * @returns {Promise<void>}
 */
async function logDelivery(webhookId, eventType, payload, statusCode, responseBody) {
  try {
    // Truncate response body if too large
    let responseStr = '';
    if (typeof responseBody === 'object') {
      responseStr = JSON.stringify(responseBody).substring(0, 1000);
    } else if (typeof responseBody === 'string') {
      responseStr = responseBody.substring(0, 1000);
    }

    await pool.query(`
      INSERT INTO webhook_deliveries (
        webhook_id,
        event_type,
        payload,
        response_status,
        response_body
      ) VALUES ($1, $2, $3, $4, $5)
    `, [webhookId, eventType, JSON.stringify(payload), statusCode, responseStr]);

  } catch (error) {
    console.error('Error logging webhook delivery:', error);
  }
}

/**
 * Handle webhook delivery failure
 * @param {number} webhookId - Webhook ID
 * @param {number} statusCode - HTTP status code
 * @returns {Promise<void>}
 */
async function handleFailure(webhookId, statusCode) {
  try {
    // Increment failure count
    const result = await pool.query(`
      UPDATE user_webhooks
      SET failure_count = failure_count + 1
      WHERE id = $1
      RETURNING failure_count
    `, [webhookId]);

    const failureCount = result.rows[0]?.failure_count || 0;

    console.log(`⚠️  Webhook ${webhookId} failed (failure count: ${failureCount})`);

    // Disable webhook after 10 consecutive failures
    if (failureCount >= 10) {
      await pool.query(`
        UPDATE user_webhooks
        SET is_active = FALSE
        WHERE id = $1
      `, [webhookId]);

      console.log(`❌ Webhook ${webhookId} disabled due to excessive failures`);
    }

  } catch (error) {
    console.error('Error handling webhook failure:', error);
  }
}

/**
 * Retry failed webhook deliveries
 * This can be called by a cron job if needed
 * @returns {Promise<void>}
 */
async function retryFailedDeliveries() {
  try {
    // Get recent failed deliveries (last 24 hours, max 3 retries)
    const failedDeliveriesResult = await pool.query(`
      SELECT
        wd.*,
        uw.url,
        uw.secret,
        uw.is_active
      FROM webhook_deliveries wd
      JOIN user_webhooks uw ON wd.webhook_id = uw.id
      WHERE wd.response_status >= 500
        AND wd.retry_count < 3
        AND wd.delivered_at > NOW() - INTERVAL '24 hours'
        AND uw.is_active = TRUE
      ORDER BY wd.delivered_at DESC
      LIMIT 50
    `);

    console.log(`Found ${failedDeliveriesResult.rows.length} failed deliveries to retry`);

    for (const delivery of failedDeliveriesResult.rows) {
      const webhook = {
        id: delivery.webhook_id,
        url: delivery.url,
        secret: delivery.secret
      };

      await deliverWebhook(webhook, delivery.event_type, delivery.payload);

      // Update retry count
      await pool.query(`
        UPDATE webhook_deliveries
        SET retry_count = retry_count + 1
        WHERE id = $1
      `, [delivery.id]);
    }

  } catch (error) {
    console.error('Error retrying failed deliveries:', error);
  }
}

module.exports = {
  triggerWebhook,
  deliverWebhook,
  createSignature,
  retryFailedDeliveries
};
