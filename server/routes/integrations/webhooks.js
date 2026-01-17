const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const pool = require('../../config/database');
const crypto = require('crypto');

/**
 * GET /api/integrations/webhooks
 * Get all user webhooks
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        id,
        name,
        url,
        events,
        is_active,
        last_triggered_at,
        failure_count,
        created_at
      FROM user_webhooks
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

/**
 * POST /api/integrations/webhooks
 * Create a new webhook
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, url, events } = req.body;

    // Validation
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'At least one event type is required' });
    }

    // Valid event types
    const validEvents = [
      'booking.created',
      'booking.cancelled',
      'booking.rescheduled',
      'booking.completed',
      'summary.generated',
      'action_item.created',
      'no_show.detected'
    ];

    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        error: 'Invalid event types',
        invalidEvents,
        validEvents
      });
    }

    // Generate webhook secret for signature verification
    const secret = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(`
      INSERT INTO user_webhooks (
        user_id,
        name,
        url,
        secret,
        events
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [userId, name, url, secret, events]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

/**
 * PUT /api/integrations/webhooks/:id
 * Update a webhook
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, url, events, is_active } = req.body;

    // Check ownership
    const checkResult = await pool.query(
      'SELECT id FROM user_webhooks WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const result = await pool.query(`
      UPDATE user_webhooks
      SET
        name = COALESCE($1, name),
        url = COALESCE($2, url),
        events = COALESCE($3, events),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [name, url, events, is_active, id]);

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

/**
 * DELETE /api/integrations/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM user_webhooks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ message: 'Webhook deleted successfully' });

  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

/**
 * POST /api/integrations/webhooks/:id/test
 * Test a webhook by sending a test payload
 */
router.post('/:id/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Get webhook
    const webhookResult = await pool.query(
      'SELECT * FROM user_webhooks WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (webhookResult.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const webhook = webhookResult.rows[0];

    // Test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from TruCal'
      }
    };

    // Import webhook service
    const { deliverWebhook } = require('../../services/webhookService');

    // Deliver test webhook
    const deliveryResult = await deliverWebhook(webhook, 'webhook.test', testPayload);

    res.json({
      message: 'Test webhook sent',
      success: deliveryResult.success,
      statusCode: deliveryResult.statusCode,
      responseBody: deliveryResult.responseBody
    });

  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

/**
 * GET /api/integrations/webhooks/:id/deliveries
 * Get delivery history for a webhook
 */
router.get('/:id/deliveries', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { limit = 50 } = req.query;

    // Check ownership
    const checkResult = await pool.query(
      'SELECT id FROM user_webhooks WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Get deliveries
    const deliveriesResult = await pool.query(`
      SELECT
        id,
        event_type,
        response_status,
        delivered_at,
        retry_count
      FROM webhook_deliveries
      WHERE webhook_id = $1
      ORDER BY delivered_at DESC
      LIMIT $2
    `, [id, limit]);

    res.json(deliveriesResult.rows);

  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
  }
});

module.exports = router;
