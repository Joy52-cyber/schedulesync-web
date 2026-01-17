const axios = require('axios');
const pool = require('../config/database');

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

/**
 * Get Zoom access token using Server-to-Server OAuth
 * @returns {Promise<string>} - Access token
 */
async function getZoomAccessToken() {
  try {
    const response = await axios.post('https://zoom.us/oauth/token', null, {
      params: {
        grant_type: 'account_credentials',
        account_id: ZOOM_ACCOUNT_ID
      },
      headers: {
        'Authorization': `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Zoom access token:', error.message);
    throw error;
  }
}

/**
 * Create a Zoom meeting with auto-recording enabled
 * @param {object} booking - Booking object
 * @param {string} userId - Zoom user ID (email)
 * @returns {Promise<object>} - Meeting details
 */
async function createZoomMeeting(booking, userId = 'me') {
  try {
    const accessToken = await getZoomAccessToken();

    const meetingData = {
      topic: booking.title || 'Meeting',
      type: 2, // Scheduled meeting
      start_time: new Date(booking.start_time).toISOString(),
      duration: booking.duration || 30,
      timezone: booking.timezone || 'UTC',
      agenda: booking.notes || '',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        auto_recording: 'cloud', // Auto-record to cloud
        approval_type: 0, // Automatically approve
        registration_type: 1,
        audio: 'both',
        alternative_hosts: '',
        close_registration: false,
        show_share_button: true,
        allow_multiple_devices: true,
        email_notification: true,
        meeting_authentication: false
      }
    };

    const response = await axios.post(
      `https://api.zoom.us/v2/users/${userId}/meetings`,
      meetingData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Zoom meeting created: ${response.data.id}`);

    return {
      meetLink: response.data.join_url,
      meetId: response.data.id.toString(),
      password: response.data.password,
      startUrl: response.data.start_url,
      hostEmail: response.data.host_email
    };

  } catch (error) {
    console.error('Error creating Zoom meeting:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update a Zoom meeting
 * @param {string} meetingId - Zoom meeting ID
 * @param {object} updates - Meeting updates
 * @returns {Promise<void>}
 */
async function updateZoomMeeting(meetingId, updates) {
  try {
    const accessToken = await getZoomAccessToken();

    await axios.patch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      updates,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Zoom meeting updated: ${meetingId}`);

  } catch (error) {
    console.error('Error updating Zoom meeting:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Delete a Zoom meeting
 * @param {string} meetingId - Zoom meeting ID
 * @returns {Promise<void>}
 */
async function deleteZoomMeeting(meetingId) {
  try {
    const accessToken = await getZoomAccessToken();

    await axios.delete(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log(`✅ Zoom meeting deleted: ${meetingId}`);

  } catch (error) {
    console.error('Error deleting Zoom meeting:', error.response?.data || error.message);
    // Don't throw error if meeting doesn't exist
    if (error.response?.status !== 404) {
      throw error;
    }
  }
}

/**
 * Get Zoom meeting details
 * @param {string} meetingId - Zoom meeting ID
 * @returns {Promise<object>} - Meeting details
 */
async function getZoomMeeting(meetingId) {
  try {
    const accessToken = await getZoomAccessToken();

    const response = await axios.get(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    return response.data;

  } catch (error) {
    console.error('Error getting Zoom meeting:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get Zoom cloud recordings for a meeting
 * @param {string} meetingId - Zoom meeting ID
 * @returns {Promise<array>} - Array of recording files
 */
async function getZoomRecordings(meetingId) {
  try {
    const accessToken = await getZoomAccessToken();

    const response = await axios.get(
      `https://api.zoom.us/v2/meetings/${meetingId}/recordings`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    return response.data.recording_files || [];

  } catch (error) {
    // No recordings available
    if (error.response?.status === 404) {
      return [];
    }

    console.error('Error getting Zoom recordings:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Handle Zoom webhook event (recording completed)
 * @param {object} event - Zoom webhook event payload
 * @returns {Promise<void>}
 */
async function handleZoomWebhook(event) {
  try {
    const eventType = event.event;

    if (eventType === 'recording.completed') {
      const meetingId = event.payload.object.id.toString();
      const recordingFiles = event.payload.object.recording_files || [];

      console.log(`📹 Recording completed for meeting ${meetingId}`);

      // Find the MP4 recording (shared screen with speaker view)
      const mp4Recording = recordingFiles.find(
        file => file.file_type === 'MP4' && file.recording_type === 'shared_screen_with_speaker_view'
      ) || recordingFiles.find(file => file.file_type === 'MP4');

      if (!mp4Recording) {
        console.log('No MP4 recording found');
        return;
      }

      const recordingUrl = mp4Recording.download_url;
      const recordingId = event.payload.object.uuid;

      // Update booking with recording URL
      const result = await pool.query(`
        UPDATE bookings
        SET recording_url = $1, updated_at = NOW()
        WHERE meet_id = $2
        RETURNING id, user_id
      `, [recordingUrl, meetingId]);

      if (result.rows.length > 0) {
        const booking = result.rows[0];
        console.log(`✅ Recording URL saved for booking ${booking.id}`);

        // TODO: Optionally trigger meeting summary generation with recording
        // const { generateMeetingSummary } = require('./meetingSummaryService');
        // await generateMeetingSummary(booking.id, { includeRecording: true });
      } else {
        console.log(`No booking found with meet_id ${meetingId}`);
      }

    } else if (eventType === 'meeting.started') {
      console.log(`🎥 Meeting started: ${event.payload.object.id}`);
      // Could update booking status to 'in_progress'
    } else if (eventType === 'meeting.ended') {
      console.log(`🏁 Meeting ended: ${event.payload.object.id}`);
      // Could update booking status to 'completed'
    }

  } catch (error) {
    console.error('Error handling Zoom webhook:', error);
  }
}

/**
 * Verify Zoom webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - x-zm-signature header
 * @param {string} timestamp - x-zm-request-timestamp header
 * @returns {boolean} - Whether signature is valid
 */
function verifyZoomWebhook(payload, signature, timestamp) {
  try {
    const crypto = require('crypto');
    const ZOOM_WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET;

    if (!ZOOM_WEBHOOK_SECRET) {
      console.warn('ZOOM_WEBHOOK_SECRET not configured');
      return false;
    }

    const message = `v0:${timestamp}:${payload}`;
    const hashForVerify = crypto
      .createHmac('sha256', ZOOM_WEBHOOK_SECRET)
      .update(message)
      .digest('hex');

    const expectedSignature = `v0=${hashForVerify}`;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );

  } catch (error) {
    console.error('Error verifying Zoom webhook:', error);
    return false;
  }
}

module.exports = {
  createZoomMeeting,
  updateZoomMeeting,
  deleteZoomMeeting,
  getZoomMeeting,
  getZoomRecordings,
  handleZoomWebhook,
  verifyZoomWebhook
};
