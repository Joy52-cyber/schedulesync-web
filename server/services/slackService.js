const axios = require('axios');
const pool = require('../config/database');

/**
 * Send a Slack notification
 * @param {number} userId - User ID
 * @param {object} message - Message object
 * @param {string} channel - Optional channel override
 * @returns {Promise<void>}
 */
async function sendSlackNotification(userId, message, channel = null) {
  try {
    // Get user's Slack integration
    const integrationResult = await pool.query(`
      SELECT * FROM slack_integrations
      WHERE user_id = $1 AND is_active = TRUE
    `, [userId]);

    if (integrationResult.rows.length === 0) {
      console.log(`No active Slack integration for user ${userId}`);
      return;
    }

    const integration = integrationResult.rows[0];
    const targetChannel = channel || integration.default_channel;

    if (!targetChannel) {
      console.log('No Slack channel configured');
      return;
    }

    // Send message to Slack
    const response = await axios.post('https://slack.com/api/chat.postMessage', {
      channel: targetChannel,
      text: message.text,
      blocks: message.blocks || undefined,
      attachments: message.attachments || undefined
    }, {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.ok) {
      console.error('Slack API error:', response.data.error);
      return;
    }

    console.log(`✅ Slack notification sent to ${targetChannel}`);

  } catch (error) {
    console.error('Error sending Slack notification:', error.message);
  }
}

/**
 * Send booking created notification
 * @param {number} userId - User ID
 * @param {object} booking - Booking object
 * @returns {Promise<void>}
 */
async function notifyBookingCreated(userId, booking) {
  try {
    // Check if user has notifications enabled
    const integration = await pool.query(`
      SELECT * FROM slack_integrations
      WHERE user_id = $1 AND is_active = TRUE AND notify_on_booking = TRUE
    `, [userId]);

    if (integration.rows.length === 0) {
      return;
    }

    const startTime = new Date(booking.start_time);
    const formattedDate = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = startTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const message = {
      text: `📅 New booking created: ${booking.title || 'Meeting'}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📅 New Booking Created',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Title:*\n${booking.title || 'Meeting'}`
            },
            {
              type: 'mrkdwn',
              text: `*Attendee:*\n${booking.attendee_name || booking.attendee_email}`
            },
            {
              type: 'mrkdwn',
              text: `*Date:*\n${formattedDate}`
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${formattedTime}`
            }
          ]
        }
      ]
    };

    if (booking.meet_link) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<${booking.meet_link}|Join Meeting>`
        }
      });
    }

    await sendSlackNotification(userId, message);

  } catch (error) {
    console.error('Error sending booking notification to Slack:', error);
  }
}

/**
 * Send meeting summary notification
 * @param {number} userId - User ID
 * @param {object} booking - Booking object with summary
 * @returns {Promise<void>}
 */
async function notifyMeetingSummary(userId, booking) {
  try {
    // Check if user has summary notifications enabled
    const integration = await pool.query(`
      SELECT * FROM slack_integrations
      WHERE user_id = $1 AND is_active = TRUE AND notify_on_summary = TRUE
    `, [userId]);

    if (integration.rows.length === 0) {
      return;
    }

    const message = {
      text: `📝 Meeting summary: ${booking.title || 'Meeting'}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📝 Meeting Summary Ready',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Meeting:* ${booking.title || 'Meeting'}\n*With:* ${booking.attendee_name || booking.attendee_email}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: booking.meeting_summary.substring(0, 500) + (booking.meeting_summary.length > 500 ? '...' : '')
          }
        }
      ]
    };

    await sendSlackNotification(userId, message);

  } catch (error) {
    console.error('Error sending summary notification to Slack:', error);
  }
}

/**
 * Send action item notification
 * @param {number} userId - User ID
 * @param {object} actionItem - Action item object
 * @param {object} booking - Related booking
 * @returns {Promise<void>}
 */
async function notifyActionItem(userId, actionItem, booking) {
  try {
    // Check if user has action item notifications enabled
    const integration = await pool.query(`
      SELECT * FROM slack_integrations
      WHERE user_id = $1 AND is_active = TRUE AND notify_on_action_items = TRUE
    `, [userId]);

    if (integration.rows.length === 0) {
      return;
    }

    const message = {
      text: `✅ New action item from: ${booking.title || 'Meeting'}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*✅ New Action Item*\n${actionItem.description}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `From meeting: ${booking.title || 'Meeting'} with ${booking.attendee_name || booking.attendee_email}`
            }
          ]
        }
      ]
    };

    if (actionItem.due_date) {
      message.blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📅 Due: ${new Date(actionItem.due_date).toLocaleDateString()}`
          }
        ]
      });
    }

    await sendSlackNotification(userId, message);

  } catch (error) {
    console.error('Error sending action item notification to Slack:', error);
  }
}

module.exports = {
  sendSlackNotification,
  notifyBookingCreated,
  notifyMeetingSummary,
  notifyActionItem
};
