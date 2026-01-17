const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../../middleware/auth');
const pool = require('../../config/database');

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || `${process.env.BACKEND_URL}/api/integrations/hubspot/callback`;

/**
 * GET /api/integrations/hubspot/connect
 * Redirect to HubSpot OAuth authorization
 */
router.get('/connect', authenticateToken, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');

  const scopes = [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.deals.read',
    'crm.objects.deals.write',
    'crm.schemas.contacts.read',
    'crm.schemas.deals.read'
  ].join(' ');

  const hubspotAuthUrl = `https://app.hubspot.com/oauth/authorize?client_id=${HUBSPOT_CLIENT_ID}&redirect_uri=${encodeURIComponent(HUBSPOT_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&state=${state}`;

  res.redirect(hubspotAuthUrl);
});

/**
 * GET /api/integrations/hubspot/callback
 * Handle HubSpot OAuth callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect('/settings?hubspot=error&message=No+authorization+code');
    }

    // Decode state to get user ID
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for access token
    const response = await axios.post('https://api.hubapi.com/oauth/v1/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        code
      }
    });

    const {
      access_token,
      refresh_token,
      expires_in
    } = response.data;

    // Get portal ID (hub ID)
    const accountInfo = await axios.get('https://api.hubapi.com/account-info/v3/details', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const portalId = accountInfo.data.portalId;

    // Store integration
    await pool.query(`
      INSERT INTO crm_integrations (
        user_id,
        provider,
        access_token,
        refresh_token,
        portal_id
      ) VALUES ($1, 'hubspot', $2, $3, $4)
      ON CONFLICT (user_id, provider)
      DO UPDATE SET
        access_token = $2,
        refresh_token = $3,
        portal_id = $4,
        is_active = TRUE,
        updated_at = NOW()
    `, [userId, access_token, refresh_token, portalId]);

    console.log(`✅ HubSpot integration saved for user ${userId}`);

    res.redirect('/settings?hubspot=connected');

  } catch (error) {
    console.error('Error handling HubSpot OAuth callback:', error);
    res.redirect('/settings?hubspot=error&message=Connection+failed');
  }
});

/**
 * GET /api/integrations/hubspot/status
 * Get HubSpot integration status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        id,
        portal_id,
        sync_contacts,
        sync_deals,
        sync_activities,
        last_sync_at,
        is_active,
        created_at
      FROM crm_integrations
      WHERE user_id = $1 AND provider = 'hubspot'
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      integration: result.rows[0]
    });

  } catch (error) {
    console.error('Error getting HubSpot status:', error);
    res.status(500).json({ error: 'Failed to get HubSpot status' });
  }
});

/**
 * POST /api/integrations/hubspot/sync
 * Manually trigger a sync
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Import sync service
    const { syncAllBookingsToHubSpot } = require('../../services/hubspotService');

    await syncAllBookingsToHubSpot(userId);

    res.json({ message: 'Sync started successfully' });

  } catch (error) {
    console.error('Error starting HubSpot sync:', error);
    res.status(500).json({ error: 'Failed to start sync' });
  }
});

/**
 * DELETE /api/integrations/hubspot
 * Disconnect HubSpot integration
 */
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM crm_integrations WHERE user_id = $1 AND provider = $2',
      [userId, 'hubspot']
    );

    res.json({ message: 'HubSpot integration disconnected' });

  } catch (error) {
    console.error('Error disconnecting HubSpot:', error);
    res.status(500).json({ error: 'Failed to disconnect HubSpot' });
  }
});

module.exports = router;
