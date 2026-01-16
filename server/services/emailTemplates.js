/**
 * Email Templates Service
 * Compiles MJML templates to HTML with dynamic content
 */

const mjml2html = require('mjml');
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../templates');

/**
 * Compile an MJML template to HTML
 * @param {string} templateName - Name of the MJML file (without extension)
 * @param {object} data - Data to replace in the template
 * @returns {string} Compiled HTML
 */
function compileTemplate(templateName, data) {
  try {
    // Read MJML template
    const mjmlPath = path.join(TEMPLATES_DIR, `${templateName}.mjml`);
    let mjmlContent = fs.readFileSync(mjmlPath, 'utf8');

    // Replace placeholders in MJML
    mjmlContent = replacePlaceholders(mjmlContent, data);

    // Compile MJML to HTML
    const result = mjml2html(mjmlContent, {
      minify: false,
      validationLevel: 'soft'
    });

    if (result.errors.length > 0) {
      console.warn('⚠️ MJML compilation warnings:', result.errors);
    }

    return result.html;
  } catch (error) {
    console.error(`❌ Error compiling template ${templateName}:`, error);
    throw error;
  }
}

/**
 * Replace placeholders in template content
 * @param {string} content - Template content with {{placeholders}}
 * @param {object} data - Data object with values
 * @returns {string} Content with replaced placeholders
 */
function replacePlaceholders(content, data) {
  let result = content;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(placeholder, value || '');
  }

  return result;
}

/**
 * Generate HTML for a single time slot using table structure for email compatibility
 * @param {object} slot - Slot object with bookUrl, dayLabel, timeFormatted
 * @param {boolean} isSelected - Whether this is the selected/first slot
 * @returns {string} HTML table for slot
 */
function generateSlotHtml(slot, isSelected) {
  if (isSelected) {
    return `
      <tr>
        <td style="padding:0 16px 12px 16px;">
          <a href="${slot.bookUrl}" style="text-decoration:none; display:block;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="width:100%; border-radius:12px; background:linear-gradient(90deg,#7c3aed 0%,#ec4899 100%); box-shadow:0 10px 18px rgba(124,58,237,0.20);">
              <tr>
                <td style="padding:14px 16px; font-family:Arial,sans-serif; color:#ffffff;">
                  <span style="display:inline-block; vertical-align:middle; margin-right:10px; font-size:16px;">✓</span>
                  <span style="display:inline-block; vertical-align:middle; font-size:14px; opacity:0.95;"><strong>${slot.dayLabel}</strong></span>
                  <span style="display:inline-block; vertical-align:middle; margin-left:14px; font-size:14px;"><strong>${slot.timeFormatted}</strong></span>
                </td>
                <td align="right" style="padding:14px 16px; font-family:Arial,sans-serif; color:#ffffff; font-size:18px;">→</td>
              </tr>
            </table>
          </a>
        </td>
      </tr>
    `;
  }

  return `
    <tr>
      <td style="padding:0 16px 10px 16px;">
        <a href="${slot.bookUrl}" style="text-decoration:none; display:block;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
            style="width:100%; border-radius:12px; background:#f6f6f8; border:1px solid #eeeeef;">
            <tr>
              <td style="padding:14px 16px; font-family:Arial,sans-serif;">
                <span style="color:#6b7280; font-size:14px;">${slot.dayLabel}</span>
                <span style="display:inline-block; margin-left:14px; color:#111827; font-size:14px;"><strong>${slot.timeFormatted}</strong></span>
              </td>
            </tr>
          </table>
        </a>
      </td>
    </tr>
  `;
}

/**
 * Generate HTML for all time slots using email-safe table structure
 * @param {array} slots - Array of slot objects with bookUrl, dayLabel, timeFormatted
 * @returns {string} HTML table containing all slots
 */
function generateSlotsHtml(slots) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:16px 0 6px 0;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px; max-width:100%;">
          ${slots.map((slot, i) => generateSlotHtml(slot, i === 0)).join('')}
        </table>
      </td></tr>
    </table>
  `;
}

/**
 * Generate "Pick a Time" email
 */
function generatePickATimeEmail(data) {
  const {
    guestName = 'there',
    introMessage,
    duration,
    slots,
    baseUrl,
    username,
    threadId,
    hostName,
    calendarUrl,
    signature = 'Powered by <span style="color: #71717a; font-weight: 600;">TruCal</span>'
  } = data;

  // Transform slots to include bookUrl and timeFormatted
  const transformedSlots = slots.map(slot => ({
    bookUrl: `${baseUrl}/quick-book?user=${username}&time=${encodeURIComponent(slot.start)}&thread=${threadId}`,
    dayLabel: slot.dayLabel || 'Available',
    timeFormatted: slot.formatted
  }));

  const slotsHtml = generateSlotsHtml(transformedSlots);

  return compileTemplate('pick-a-time', {
    guestName,
    introMessage,
    duration,
    slotsHtml,
    hostName,
    calendarUrl,
    signature
  });
}

/**
 * Generate "Meeting Confirmed" email
 */
function generateConfirmationEmail(data) {
  const {
    formattedDate,
    formattedTime,
    duration,
    participants,
    manageUrl
  } = data;

  return compileTemplate('confirmation', {
    formattedDate,
    formattedTime,
    duration,
    participants,
    manageUrl
  });
}

/**
 * Generate "Meeting Cancelled" email
 */
function generateCancelledEmail(data) {
  const {
    calendarUrl
  } = data;

  return compileTemplate('cancelled', {
    calendarUrl
  });
}

/**
 * Generate "No Available Times" email
 */
function generateNoSlotsEmail(data) {
  const {
    guestName = 'there',
    hostName,
    calendarUrl
  } = data;

  return compileTemplate('no-slots', {
    guestName,
    hostName,
    calendarUrl
  });
}

module.exports = {
  compileTemplate,
  generateSlotHtml,
  generateSlotsHtml,
  generatePickATimeEmail,
  generateConfirmationEmail,
  generateCancelledEmail,
  generateNoSlotsEmail
};
