const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { checkTeamAccess } = require('../middleware/featureGates');
const { sendEmail } = require('../services/email');

// ============ TEAM ROUTES ============

// GET /api/teams - Get all teams for current user
router.get('/', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         t.id,
         t.name,
         t.description,
         t.booking_mode,
         t.owner_id,
         t.created_at,
         t.updated_at,
         t.team_booking_token,
         MAX(tm.booking_token) as booking_token,
         COUNT(DISTINCT tm.id) as member_count,
         COUNT(DISTINCT b.id) as booking_count,
         CASE WHEN t.name LIKE '%Personal Bookings%' THEN true ELSE false END as is_personal
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id
           AND (tm.user_id = t.owner_id OR tm.id = (
               SELECT id FROM team_members WHERE team_id = t.id ORDER BY id ASC LIMIT 1
           ))
       LEFT JOIN bookings b ON t.id = b.team_id
       WHERE t.owner_id = $1
       GROUP BY t.id, t.name, t.description, t.booking_mode, t.owner_id, t.created_at, t.updated_at, t.team_booking_token
       ORDER BY
         CASE WHEN t.name LIKE '%Personal Bookings%' THEN 0 ELSE 1 END,
         t.created_at DESC`,
      [req.user.id]
    );

    console.log('Teams loaded:', result.rows.map(t => ({
      id: t.id,
      name: t.name,
      booking_token: t.booking_token,
      team_booking_token: t.team_booking_token,
      is_personal: t.is_personal
    })));

    res.json({ teams: result.rows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// GET /api/teams/:id - Get single team
router.get('/:id', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM teams WHERE id = $1 AND owner_id = $2`,
      [teamId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// GET /api/teams/:id/booking-stats - Get booking distribution stats
router.get('/:id/booking-stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { period = 'all' } = req.query;

    // Verify team access
    const teamCheck = await pool.query(
      'SELECT id FROM teams WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Build date filter
    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND b.start_time >= NOW() - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND b.start_time >= NOW() - INTERVAL '30 days'";
    }

    // Get booking stats per member
    const stats = await pool.query(`
      SELECT
        tm.id as member_id,
        tm.name as member_name,
        u.email as member_email,
        COUNT(b.id) as total_bookings,
        COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
        COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
        COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN EXTRACT(EPOCH FROM (b.end_time - b.start_time))/60 END), 0) as total_minutes
      FROM team_members tm
      LEFT JOIN users u ON tm.user_id = u.id
      LEFT JOIN bookings b ON tm.id = b.member_id ${dateFilter}
      WHERE tm.team_id = $1
      GROUP BY tm.id, tm.name, u.email
      ORDER BY total_bookings DESC
    `, [id]);

    // Calculate distribution fairness
    const bookingCounts = stats.rows.map(s => parseInt(s.total_bookings) || 0);
    const total = bookingCounts.reduce((a, b) => a + b, 0);
    const avg = total / (bookingCounts.length || 1);
    const maxDeviation = Math.max(...bookingCounts.map(c => Math.abs(c - avg)), 0);
    const fairnessScore = avg > 0 ? Math.max(0, 100 - (maxDeviation / avg * 100)) : 100;

    res.json({
      members: stats.rows,
      summary: {
        total_bookings: total,
        total_members: stats.rows.length,
        average_per_member: Math.round(avg * 10) / 10,
        fairness_score: Math.round(fairnessScore),
        fairness_status: fairnessScore >= 80 ? 'even' : fairnessScore >= 50 ? 'moderate' : 'uneven'
      },
      period
    });
  } catch (error) {
    console.error('Team booking stats error:', error);
    res.status(500).json({ error: 'Failed to get booking stats' });
  }
});

// GET /api/teams/:id/availability-grid - Get all members' availability
router.get('/:id/availability-grid', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify team access
    const teamCheck = await pool.query(
      'SELECT id, name, booking_mode FROM teams WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get all members with their working hours
    const members = await pool.query(`
      SELECT
        tm.id,
        tm.name,
        tm.working_hours,
        tm.is_active,
        u.email,
        u.timezone
      FROM team_members tm
      LEFT JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.name ASC
    `, [id]);

    res.json({
      team: teamCheck.rows[0],
      members: members.rows
    });
  } catch (error) {
    console.error('Team availability grid error:', error);
    res.status(500).json({ error: 'Failed to get availability grid' });
  }
});

// PUT /api/teams/:id - Update team settings
router.put('/:id', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const userId = req.user.id;
    const { name, description, booking_mode } = req.body;

    console.log('Updating team settings:', { teamId, booking_mode });

    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to update this team' });
    }

    // Validate booking mode
    const validModes = ['individual', 'round_robin', 'first_available', 'collective'];
    if (booking_mode && !validModes.includes(booking_mode)) {
      return res.status(400).json({ error: 'Invalid booking mode' });
    }

    // Update team
    const result = await pool.query(
      `UPDATE teams
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           booking_mode = COALESCE($3, booking_mode)
       WHERE id = $4
       RETURNING *`,
      [name, description, booking_mode, teamId]
    );

    console.log('Team settings updated');
    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// POST /api/teams - Create new team
router.post('/', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const { name, description, booking_mode } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;
    const userEmail = req.user.email;

    console.log('Creating new team:', name);

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Validate booking mode
    const validModes = ['individual', 'round_robin', 'first_available', 'collective'];
    const mode = booking_mode || 'individual';

    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: 'Invalid booking mode' });
    }

    // Generate team booking token
    const teamBookingToken = crypto.randomBytes(16).toString('hex');

    // Create team
    const result = await pool.query(
      `INSERT INTO teams (name, description, owner_id, booking_mode, team_booking_token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [name.trim(), description || '', userId, mode, teamBookingToken]
    );

    const team = result.rows[0];

    // Create owner as first team member
    const memberToken = crypto.randomBytes(16).toString('hex');

    await pool.query(
      `INSERT INTO team_members (team_id, user_id, email, name, booking_token, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [team.id, userId, userEmail, userName, memberToken, userId]
    );

    console.log('Team created:', team.id);

    res.json({
      success: true,
      team: team,
      message: 'Team created successfully'
    });

  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// DELETE /api/teams/:id - Delete team
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM teams WHERE id = $1 AND owner_id = $2 RETURNING *',
      [id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ============ TEAM MEMBER ROUTES ============

// GET /api/teams/:teamId/members - Get team members
router.get('/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  try {
    const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1 AND owner_id = $2', [teamId, req.user.id]);
    if (teamCheck.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `SELECT tm.*,
              tm.is_active,
              u.name as user_name,
              u.email as user_email
       FROM team_members tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.created_at DESC`,
      [teamId]
    );
    res.json({ members: result.rows });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// POST /api/teams/:teamId/members - Add team member / send invitation
router.post('/:teamId/members', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { email, name, role = 'member' } = req.body;

  try {
    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, req.user.id]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const team = teamCheck.rows[0];

    // Check if already a member
    const existingMember = await pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND email = $2',
      [teamId, email]
    );

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'This person is already a team member' });
    }

    // Check for existing pending invitation
    const existingInvite = await pool.query(
      `SELECT * FROM team_invitations
       WHERE team_id = $1 AND email = $2 AND status = 'pending'`,
      [teamId, email]
    );

    if (existingInvite.rows.length > 0) {
      return res.status(400).json({
        error: 'An invitation is already pending for this email. You can resend it from the invitations list.',
        invitation_id: existingInvite.rows[0].id
      });
    }

    // Generate invitation token
    const inviteToken = crypto.randomBytes(32).toString('hex');

    // Create invitation (NOT direct member)
    const result = await pool.query(
      `INSERT INTO team_invitations (
        team_id, email, name, invited_by_user_id, token, role, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW() + INTERVAL '7 days')
      RETURNING *`,
      [teamId, email.toLowerCase(), name || null, req.user.id, inviteToken, role]
    );

    const invitation = result.rows[0];

    // Build invitation URL
    const inviteUrl = `${process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app'}/invite/${inviteToken}`;

    // Send invitation email
    try {
      await sendEmail(
        email,
        `You've been invited to join ${team.name} on ScheduleSync`,
        `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Team Invitation</h2>
          <p>Hi${name ? ' ' + name : ''},</p>
          <p><strong>${req.user.name || req.user.email}</strong> has invited you to join <strong>${team.name}</strong> on ScheduleSync.</p>
          <p style="margin: 24px 0;">
            <a href="${inviteUrl}" style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
        `
      );
      console.log(`Team invitation sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
    }

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        status: invitation.status,
        expires_at: invitation.expires_at
      },
      invite_url: inviteUrl,
      message: 'Invitation sent successfully'
    });

  } catch (error) {
    console.error('Error sending team invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// PATCH /api/teams/:teamId/members/:memberId - Update team member
router.patch('/:teamId/members/:memberId', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;
  const { name, role, priority, is_active } = req.body;

  try {
    // Verify ownership or admin status
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, req.user.id]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update member with all settings
    const result = await pool.query(
      `UPDATE team_members
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           priority = COALESCE($3, priority),
           is_active = COALESCE($4, is_active)
       WHERE id = $5 AND team_id = $6
       RETURNING *`,
      [name || null, role, priority, is_active, memberId, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({
      success: true,
      member: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// PATCH /api/teams/:teamId/members/:memberId/status - Toggle member active status
router.patch('/:teamId/members/:memberId/status', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;
  const { is_active } = req.body;

  try {
    // Verify ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, req.user.id]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update member status
    const result = await pool.query(
      `UPDATE team_members
       SET is_active = $1
       WHERE id = $2 AND team_id = $3
       RETURNING *`,
      [is_active, memberId, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log(`Member ${memberId} status updated to ${is_active ? 'active' : 'inactive'}`);
    res.json({ success: true, member: result.rows[0] });
  } catch (error) {
    console.error('Update member status error:', error);
    res.status(500).json({ error: 'Failed to update member status' });
  }
});

// PUT /api/teams/:teamId/members/:memberId - Update all member settings
router.put('/:teamId/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const userId = req.user.id;
    const {
      external_booking_platform,
      external_booking_link,
      buffer_time,
      booking_horizon_days,
      timezone,
    } = req.body;

    console.log('Updating member settings:', { memberId, teamId });

    // Verify ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to update this team' });
    }

    // Update the member
    const result = await pool.query(
      `UPDATE team_members
       SET
         external_booking_platform = COALESCE($1, external_booking_platform),
         external_booking_link = $2,
         buffer_time = COALESCE($3, buffer_time),
         booking_horizon_days = COALESCE($4, booking_horizon_days),
         timezone = COALESCE($5, timezone)
       WHERE id = $6 AND team_id = $7
       RETURNING *`,
      [
        external_booking_platform,
        external_booking_link,
        buffer_time,
        booking_horizon_days,
        timezone,
        memberId,
        teamId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    console.log('Member settings updated:', memberId);
    res.json({ member: result.rows[0] });

  } catch (error) {
    console.error('Update member settings error:', error);
    res.status(500).json({ error: 'Failed to update team member settings' });
  }
});

// PATCH /api/teams/:teamId/members/:memberId/routing - Update member routing settings
router.patch('/:teamId/members/:memberId/routing', authenticateToken, async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const { routing_priority, is_available, skip_until, max_daily_bookings } = req.body;

    // Verify team ownership
    const teamCheck = await pool.query(
      'SELECT id FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, req.user.id]
    );
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const updates = [];
    const values = [memberId, teamId];
    let paramIndex = 3;

    if (routing_priority !== undefined) {
      updates.push(`routing_priority = $${paramIndex++}`);
      values.push(routing_priority);
    }
    if (is_available !== undefined) {
      updates.push(`is_available = $${paramIndex++}`);
      values.push(is_available);
    }
    if (skip_until !== undefined) {
      updates.push(`skip_until = $${paramIndex++}`);
      values.push(skip_until);
    }
    if (max_daily_bookings !== undefined) {
      updates.push(`max_daily_bookings = $${paramIndex++}`);
      values.push(max_daily_bookings);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const result = await pool.query(`
      UPDATE team_members
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1 AND team_id = $2
      RETURNING *
    `, values);

    console.log(`Updated routing for member ${memberId}: ${updates.join(', ')}`);
    res.json({ member: result.rows[0] });
  } catch (error) {
    console.error('Update member routing error:', error);
    res.status(500).json({ error: 'Failed to update routing settings' });
  }
});

// DELETE /api/teams/:teamId/members/:memberId - Remove member
router.delete('/:teamId/members/:memberId', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;
  try {
    const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1 AND owner_id = $2', [teamId, req.user.id]);
    if (teamCheck.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    await pool.query('DELETE FROM team_members WHERE id = $1 AND team_id = $2', [memberId, teamId]);
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// PUT /api/teams/:teamId/members/:memberId/external-link - Update external link
router.put('/:teamId/members/:memberId/external-link', authenticateToken, async (req, res) => {
  const { teamId, memberId } = req.params;
  const { external_booking_link, external_booking_platform } = req.body;

  try {
    const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1 AND owner_id = $2', [teamId, req.user.id]);
    if (teamCheck.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `UPDATE team_members SET external_booking_link = $1, external_booking_platform = $2
       WHERE id = $3 AND team_id = $4 RETURNING *`,
      [external_booking_link || null, external_booking_platform || 'calendly', memberId, teamId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });

    console.log(`External link updated for member ${memberId}`);
    res.json({ member: result.rows[0] });
  } catch (error) {
    console.error('Update external link error:', error);
    res.status(500).json({ error: 'Failed to update external link' });
  }
});

// PUT /api/teams/:teamId/members/:memberId/pricing - Update pricing settings
router.put('/:teamId/members/:memberId/pricing', authenticateToken, async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const { booking_price, currency, payment_required } = req.body;
    const userId = req.user.id;

    console.log('Updating pricing for member:', memberId);
    console.log('Received data:', { booking_price, currency, payment_required });

    // Verify ownership
    const teamCheck = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [teamId, userId]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update member pricing
    const result = await pool.query(
      `UPDATE team_members
       SET booking_price = $1,
           currency = $2,
           payment_required = $3
       WHERE id = $4 AND team_id = $5
       RETURNING *`,
      [parseFloat(booking_price) || 0, currency || 'USD', payment_required === true, memberId, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log('Pricing updated:', result.rows[0]);

    res.json({
      success: true,
      member: result.rows[0],
      message: 'Pricing settings updated successfully'
    });
  } catch (error) {
    console.error('Update pricing error:', error);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// ============ REMINDER SETTINGS ROUTES ============

// GET /api/teams/:teamId/reminder-settings
router.get('/:teamId/reminder-settings', authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.teamId, 10);

  try {
    const result = await pool.query(
      `SELECT team_id, enabled, hours_before, send_to_host, send_to_guest
       FROM team_reminder_settings
       WHERE team_id = $1`,
      [teamId]
    );

    if (result.rowCount === 0) {
      // Defaults if nothing saved yet
      return res.json({
        settings: {
          team_id: teamId,
          enabled: true,
          hours_before: 24,
          send_to_host: true,
          send_to_guest: true,
        },
      });
    }

    res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error('Error loading reminder settings:', err);
    res.status(500).json({ error: 'Failed to load reminder settings' });
  }
});

// PUT /api/teams/:teamId/reminder-settings
router.put('/:teamId/reminder-settings', authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.teamId, 10);
  const { enabled, hours_before, send_to_host, send_to_guest } = req.body;

  try {
    const upsertQuery = `
      INSERT INTO team_reminder_settings (team_id, enabled, hours_before, send_to_host, send_to_guest)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (team_id) DO UPDATE
      SET enabled      = EXCLUDED.enabled,
          hours_before = EXCLUDED.hours_before,
          send_to_host = EXCLUDED.send_to_host,
          send_to_guest = EXCLUDED.send_to_guest,
          updated_at   = NOW()
      RETURNING *;
    `;

    const result = await pool.query(upsertQuery, [
      teamId,
      enabled,
      hours_before,
      send_to_host,
      send_to_guest,
    ]);

    console.log(`Updated reminder settings for team ${teamId}`);
    res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error('Error updating reminder settings:', err);
    res.status(500).json({ error: 'Failed to update reminder settings' });
  }
});

module.exports = router;
