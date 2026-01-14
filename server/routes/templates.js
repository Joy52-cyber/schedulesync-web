const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/email-templates - List user's templates
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM email_templates
       WHERE user_id = $1 AND is_active = true
       ORDER BY is_default DESC, name ASC`,
      [req.user.id]
    );

    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/email-templates - Create template
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, type, subject, body, is_default } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ error: 'Name, subject, and body are required' });
    }

    const validTypes = ['reminder', 'confirmation', 'follow_up', 'reschedule', 'cancellation', 'other'];
    const templateType = validTypes.includes(type) ? type : 'other';

    const result = await pool.query(
      `INSERT INTO email_templates (user_id, name, type, subject, body, is_default, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       RETURNING *`,
      [req.user.id, name, templateType, subject, body, is_default || false]
    );

    console.log('Email template created:', result.rows[0].id);
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/email-templates/:id - Update template
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, type, subject, body, is_default } = req.body;

    const result = await pool.query(
      `UPDATE email_templates
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           subject = COALESCE($3, subject),
           body = COALESCE($4, body),
           is_default = COALESCE($5, is_default),
           updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [name, type, subject, body, is_default, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/email-templates/:id - Delete template
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`DELETE template request: id=${id}, userId=${userId}`);

    // Verify ownership before deleting
    const check = await pool.query(
      'SELECT id, user_id FROM email_templates WHERE id = $1',
      [id]
    );

    console.log(`Template check result:`, check.rows[0] || 'NOT FOUND');

    if (check.rows.length === 0) {
      console.log(`Template ${id} not found in database`);
      return res.status(404).json({ error: 'Template not found' });
    }

    if (check.rows[0].user_id !== userId) {
      console.log(`Template ${id} belongs to user ${check.rows[0].user_id}, not ${userId}`);
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }

    await pool.query('DELETE FROM email_templates WHERE id = $1', [id]);

    console.log(`Email template deleted: ${id}`);
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// PATCH /api/email-templates/:id/favorite - Toggle default status
router.patch('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE email_templates
       SET is_default = NOT is_default, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Toggle default error:', error);
    res.status(500).json({ error: 'Failed to toggle default' });
  }
});

// POST /api/email-templates/test - Send test email
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.body;

    // Get user info
    const user = await pool.query(
      'SELECT email, name FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get template if templateId provided
    let template = null;
    if (templateId) {
      const templateResult = await pool.query(
        'SELECT * FROM email_templates WHERE id = $1 AND user_id = $2',
        [templateId, req.user.id]
      );
      template = templateResult.rows[0];
    }

    // Import email service
    const { sendBookingEmail } = require('../services/email');

    // Sample data for test email
    const sampleData = {
      guestName: 'Test Guest',
      hostName: user.rows[0].name || 'Host',
      meetingTitle: 'Test Meeting',
      meetingDate: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      meetingTime: '2:00 PM',
      meetingDuration: '30 minutes',
      meetingLocation: 'Google Meet',
      manageLink: 'https://example.com/manage/test'
    };

    // Build HTML content
    let subject = template?.subject || 'Test Email - Meeting Confirmed';
    let body = template?.body || getDefaultTestEmailBody();

    // Replace variables in subject and body
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });

    // Send test email
    await sendBookingEmail({
      to: user.rows[0].email,
      subject: `[TEST] ${subject}`,
      html: body
    });

    console.log(`Test email sent to ${user.rows[0].email}`);
    res.json({ success: true, message: 'Test email sent to your email address' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

function getDefaultTestEmailBody() {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #8b5cf6, #ec4899); padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Test Email</h1>
      </div>
      <div style="padding: 32px; background: #f9fafb;">
        <p style="color: #374151; font-size: 16px;">Hi {{guestName}},</p>
        <p style="color: #374151; font-size: 16px;">This is a test email from ScheduleSync.</p>
        <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb;">
          <table style="width: 100%;">
            <tr><td style="padding: 8px 0; color: #6b7280;">Date</td><td style="color: #111827; font-weight: 500;">{{meetingDate}}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Time</td><td style="color: #111827; font-weight: 500;">{{meetingTime}}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Duration</td><td style="color: #111827; font-weight: 500;">{{meetingDuration}}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Location</td><td style="color: #111827; font-weight: 500;">{{meetingLocation}}</td></tr>
          </table>
        </div>
        <p style="color: #6b7280; font-size: 14px;">If you received this email, your email templates are working correctly!</p>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
        Powered by ScheduleSync
      </div>
    </div>
  `;
}

module.exports = router;
