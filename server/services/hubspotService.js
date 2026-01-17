const axios = require('axios');
const pool = require('../config/database');

/**
 * Get HubSpot integration for a user
 * @param {number} userId - User ID
 * @returns {Promise<object|null>} - Integration object or null
 */
async function getHubSpotIntegration(userId) {
  const result = await pool.query(`
    SELECT * FROM crm_integrations
    WHERE user_id = $1 AND provider = 'hubspot' AND is_active = TRUE
  `, [userId]);

  return result.rows[0] || null;
}

/**
 * Sync a booking to HubSpot
 * @param {number} userId - User ID
 * @param {object} booking - Booking object
 * @returns {Promise<void>}
 */
async function syncBookingToHubSpot(userId, booking) {
  try {
    const integration = await getHubSpotIntegration(userId);

    if (!integration) {
      console.log('No active HubSpot integration found');
      return;
    }

    console.log(`🔄 Syncing booking ${booking.id} to HubSpot...`);

    // 1. Find or create contact
    const contact = await findOrCreateContact(integration, booking.attendee_email, {
      firstname: extractFirstName(booking.attendee_name),
      lastname: extractLastName(booking.attendee_name),
      email: booking.attendee_email
    });

    if (!contact) {
      console.error('Failed to create/find HubSpot contact');
      return;
    }

    console.log(`✅ Contact synced: ${contact.id}`);

    // 2. Create deal if sync_deals is enabled
    if (integration.sync_deals) {
      const deal = await createDeal(integration, {
        dealname: `Meeting: ${booking.title || 'Booking'}`,
        amount: booking.booking_fee || 0,
        closedate: booking.start_time,
        dealstage: 'appointmentscheduled'
      }, contact.id);

      if (deal) {
        console.log(`✅ Deal created: ${deal.id}`);
      }
    }

    // 3. Create engagement (meeting activity) if sync_activities is enabled
    if (integration.sync_activities) {
      await createEngagement(integration, {
        engagement: {
          type: 'MEETING',
          timestamp: new Date(booking.start_time).getTime()
        },
        associations: {
          contactIds: [contact.id]
        },
        metadata: {
          title: booking.title || 'Meeting',
          body: booking.notes || '',
          startTime: new Date(booking.start_time).getTime(),
          endTime: new Date(booking.end_time).getTime()
        }
      });

      console.log('✅ Engagement created');
    }

    // Save mapping
    await saveCRMMapping(userId, booking.attendee_email, 'hubspot', contact.id);

    // Update last sync time
    await pool.query(`
      UPDATE crm_integrations
      SET last_sync_at = NOW()
      WHERE id = $1
    `, [integration.id]);

  } catch (error) {
    console.error('Error syncing booking to HubSpot:', error.message);
  }
}

/**
 * Find or create a contact in HubSpot
 * @param {object} integration - HubSpot integration
 * @param {string} email - Email address
 * @param {object} properties - Contact properties
 * @returns {Promise<object|null>} - Contact object or null
 */
async function findOrCreateContact(integration, email, properties) {
  try {
    // Check if mapping exists
    const mappingResult = await pool.query(`
      SELECT crm_contact_id FROM crm_mappings
      WHERE user_id = (SELECT user_id FROM crm_integrations WHERE id = $1)
        AND attendee_email = $2
        AND crm_provider = 'hubspot'
    `, [integration.id, email]);

    if (mappingResult.rows.length > 0) {
      const contactId = mappingResult.rows[0].crm_contact_id;

      // Fetch existing contact
      const response = await axios.get(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
        headers: { 'Authorization': `Bearer ${integration.access_token}` }
      });

      return response.data;
    }

    // Create new contact
    const response = await axios.post('https://api.hubapi.com/crm/v3/objects/contacts', {
      properties: {
        email,
        firstname: properties.firstname || '',
        lastname: properties.lastname || ''
      }
    }, {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;

  } catch (error) {
    // If contact already exists, search for it
    if (error.response?.status === 409) {
      try {
        const searchResponse = await axios.post('https://api.hubapi.com/crm/v3/objects/contacts/search', {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: email
            }]
          }]
        }, {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        return searchResponse.data.results[0] || null;
      } catch (searchError) {
        console.error('Error searching for contact:', searchError.message);
        return null;
      }
    }

    console.error('Error creating/finding contact:', error.message);
    return null;
  }
}

/**
 * Create a deal in HubSpot
 * @param {object} integration - HubSpot integration
 * @param {object} properties - Deal properties
 * @param {string} contactId - Contact ID to associate
 * @returns {Promise<object|null>} - Deal object or null
 */
async function createDeal(integration, properties, contactId) {
  try {
    const response = await axios.post('https://api.hubapi.com/crm/v3/objects/deals', {
      properties,
      associations: contactId ? [{
        to: { id: contactId },
        types: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 3 // Contact to Deal
        }]
      }] : []
    }, {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;

  } catch (error) {
    console.error('Error creating deal:', error.message);
    return null;
  }
}

/**
 * Create an engagement (meeting activity) in HubSpot
 * @param {object} integration - HubSpot integration
 * @param {object} engagement - Engagement object
 * @returns {Promise<object|null>} - Engagement object or null
 */
async function createEngagement(integration, engagement) {
  try {
    // Note: HubSpot engagements API is being deprecated in favor of activities API
    // This is a simplified version
    const response = await axios.post('https://api.hubapi.com/engagements/v1/engagements', engagement, {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;

  } catch (error) {
    console.error('Error creating engagement:', error.message);
    return null;
  }
}

/**
 * Save CRM mapping
 * @param {number} userId - User ID
 * @param {string} email - Attendee email
 * @param {string} provider - CRM provider
 * @param {string} contactId - CRM contact ID
 * @param {string} dealId - Optional CRM deal ID
 * @returns {Promise<void>}
 */
async function saveCRMMapping(userId, email, provider, contactId, dealId = null) {
  await pool.query(`
    INSERT INTO crm_mappings (
      user_id,
      attendee_email,
      crm_provider,
      crm_contact_id,
      crm_deal_id
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, attendee_email, crm_provider)
    DO UPDATE SET
      crm_contact_id = $4,
      crm_deal_id = COALESCE($5, crm_mappings.crm_deal_id),
      last_synced_at = NOW()
  `, [userId, email, provider, contactId, dealId]);
}

/**
 * Sync all recent bookings to HubSpot
 * @param {number} userId - User ID
 * @returns {Promise<void>}
 */
async function syncAllBookingsToHubSpot(userId) {
  try {
    // Get bookings from last 30 days
    const bookingsResult = await pool.query(`
      SELECT * FROM bookings
      WHERE user_id = $1
        AND start_time > NOW() - INTERVAL '30 days'
        AND status IN ('confirmed', 'completed')
      ORDER BY start_time DESC
      LIMIT 100
    `, [userId]);

    console.log(`Syncing ${bookingsResult.rows.length} bookings to HubSpot...`);

    for (const booking of bookingsResult.rows) {
      await syncBookingToHubSpot(userId, booking);
    }

    console.log('✅ Sync complete');

  } catch (error) {
    console.error('Error syncing bookings to HubSpot:', error);
    throw error;
  }
}

/**
 * Extract first name from full name
 * @param {string} fullName - Full name
 * @returns {string} - First name
 */
function extractFirstName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts[0] || '';
}

/**
 * Extract last name from full name
 * @param {string} fullName - Full name
 * @returns {string} - Last name
 */
function extractLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

module.exports = {
  syncBookingToHubSpot,
  syncAllBookingsToHubSpot,
  getHubSpotIntegration
};
