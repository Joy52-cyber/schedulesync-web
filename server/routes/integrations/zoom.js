const express = require('express');
const router = express.Router();
const { handleZoomWebhook, verifyZoomWebhook } = require('../../services/zoomService');

/**
 * POST /api/integrations/zoom/webhook
 * Handle Zoom webhook events (recording.completed, meeting.started, etc.)
 */
router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-zm-signature'];
    const timestamp = req.headers['x-zm-request-timestamp'];
    const rawBody = JSON.stringify(req.body);

    if (!verifyZoomWebhook(rawBody, signature, timestamp)) {
      console.warn('⚠️  Invalid Zoom webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Handle the webhook event
    await handleZoomWebhook(req.body);

    res.status(200).json({ message: 'Webhook processed' });

  } catch (error) {
    console.error('Error processing Zoom webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/integrations/zoom/validate
 * Zoom webhook validation endpoint (challenge-response)
 */
router.post('/webhook/validate', (req, res) => {
  // Zoom sends a validation request when you first set up the webhook
  const { plainToken, encryptedToken } = req.body;

  if (plainToken) {
    // Respond with the plain token in a JSON object with specific structure
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET)
      .update(plainToken)
      .digest('hex');

    return res.json({
      plainToken: plainToken,
      encryptedToken: hash
    });
  }

  res.status(200).json({ message: 'OK' });
});

module.exports = router;
