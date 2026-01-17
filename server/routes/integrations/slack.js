const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../../middleware/auth');
const pool = require('../../config/database');

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || `${process.env.BACKEND_URL}/api/integrations/slack/callback`;

/**
 * GET /api/integrations/slack/connect
 * Redirect to Slack OAuth authorization
 */
router.get('/connect', authenticateToken, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');

  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=chat:write,commands&state=${state}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}`;

  res.redirect(slackAuthUrl);
});

/**
 * GET /api/integrations/slack/callback
 * Handle Slack OAuth callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect('/settings?slack=error&message=No+authorization+code');
    }

    // Decode state to get user ID
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for access token
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: SLACK_REDIRECT_URI
      }
    });

    if (!response.data.ok) {
      console.error('Slack OAuth error:', response.data.error);
      return res.redirect('/settings?slack=error&message=' + encodeURIComponent(response.data.error));
    }

    const {
      access_token,
      team,
      bot_user_id
    } = response.data;

    // Store integration
    await pool.query(`
      INSERT INTO slack_integrations (
        user_id,
        team_id,
        team_name,
        access_token,
        bot_user_id
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        team_id = $2,
        team_name = $3,
        access_token = $4,
        bot_user_id = $5,
        is_active = TRUE,
        updated_at = NOW()
    `, [userId, team.id, team.name, access_token, bot_user_id]);

    console.log(`✅ Slack integration saved for user ${userId}`);

    res.redirect('/settings?slack=connected');

  } catch (error) {
    console.error('Error handling Slack OAuth callback:', error);
    res.redirect('/settings?slack=error&message=Connection+failed');
  }
});

/**
 * GET /api/integrations/slack/status
 * Get Slack integration status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        id,
        team_id,
        team_name,
        default_channel,
        notify_on_booking,
        notify_on_summary,
        notify_on_action_items,
        is_active,
        created_at
      FROM slack_integrations
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      integration: result.rows[0]
    });

  } catch (error) {
    console.error('Error getting Slack status:', error);
    res.status(500).json({ error: 'Failed to get Slack status' });
  }
});

/**
 * PUT /api/integrations/slack/settings
 * Update Slack notification settings
 */
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      default_channel,
      notify_on_booking,
      notify_on_summary,
      notify_on_action_items
    } = req.body;

    const result = await pool.query(`
      UPDATE slack_integrations
      SET
        default_channel = COALESCE($1, default_channel),
        notify_on_booking = COALESCE($2, notify_on_booking),
        notify_on_summary = COALESCE($3, notify_on_summary),
        notify_on_action_items = COALESCE($4, notify_on_action_items),
        updated_at = NOW()
      WHERE user_id = $5
      RETURNING *
    `, [default_channel, notify_on_booking, notify_on_summary, notify_on_action_items, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slack integration not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error updating Slack settings:', error);
    res.status(500).json({ error: 'Failed to update Slack settings' });
  }
});

/**
 * DELETE /api/integrations/slack
 * Disconnect Slack integration
 */
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query('DELETE FROM slack_integrations WHERE user_id = $1', [userId]);

    res.json({ message: 'Slack integration disconnected' });

  } catch (error) {
    console.error('Error disconnecting Slack:', error);
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

module.exports = router;
