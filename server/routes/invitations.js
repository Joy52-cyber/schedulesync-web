const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============ INVITATION ROUTES ============

// GET /api/invitations/:token - Get invitation details (public - for accept page)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT ti.*, t.name as team_name, t.description as team_description,
              u.name as inviter_name, u.email as inviter_email,
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
       FROM team_invitations ti
       JOIN teams t ON ti.team_id = t.id
       LEFT JOIN users u ON ti.invited_by_user_id = u.id
       WHERE ti.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found', code: 'NOT_FOUND' });
    }

    const invitation = result.rows[0];

    // Check if expired
    if (new Date(invitation.expires_at) < new Date() && invitation.status === 'pending') {
      return res.status(410).json({
        error: 'This invitation has expired',
        code: 'EXPIRED',
        expired_at: invitation.expires_at
      });
    }

    // Check if already used
    if (invitation.status === 'accepted') {
      return res.status(410).json({
        error: 'This invitation has already been accepted',
        code: 'ALREADY_ACCEPTED',
        accepted_at: invitation.accepted_at
      });
    }

    if (invitation.status === 'declined') {
      return res.status(410).json({
        error: 'This invitation was declined',
        code: 'DECLINED'
      });
    }

    // Check if invitee already has an account
    const userCheck = await pool.query(
      'SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1)',
      [invitation.email]
    );

    const hasAccount = userCheck.rows.length > 0;

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
        team: {
          id: invitation.team_id,
          name: invitation.team_name,
          description: invitation.team_description,
          member_count: parseInt(invitation.member_count)
        },
        inviter: {
          name: invitation.inviter_name,
          email: invitation.inviter_email
        },
        has_account: hasAccount
      }
    });

  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ error: 'Failed to fetch invitation' });
  }
});

// POST /api/invitations/:token/accept - Accept invitation (authenticated)
router.post('/:token/accept', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;

    const inviteResult = await pool.query(
      `SELECT ti.*, t.name as team_name
       FROM team_invitations ti
       JOIN teams t ON ti.team_id = t.id
       WHERE ti.token = $1`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitation = inviteResult.rows[0];

    // Verify email matches
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({
        error: 'This invitation was sent to a different email address',
        invited_email: invitation.email
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `Invitation is already ${invitation.status}` });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This invitation has expired' });
    }

    // Check if already a member
    const memberCheck = await pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [invitation.team_id, userId]
    );

    if (memberCheck.rows.length > 0) {
      await pool.query(
        `UPDATE team_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
        [invitation.id]
      );
      return res.json({
        success: true,
        message: 'You are already a member of this team',
        team_id: invitation.team_id
      });
    }

    // Create team member
    const bookingToken = crypto.randomBytes(16).toString('hex');
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, email, name, booking_token, invited_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [invitation.team_id, userId, userEmail, invitation.name || req.user.name, bookingToken, invitation.invited_by_user_id]
    );

    // Update invitation status
    await pool.query(
      `UPDATE team_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
      [invitation.id]
    );

    console.log(`User ${userEmail} joined team ${invitation.team_name}`);

    res.json({
      success: true,
      message: `You have joined ${invitation.team_name}!`,
      team: { id: invitation.team_id, name: invitation.team_name }
    });

  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// POST /api/invitations/:token/decline - Decline invitation
router.post('/:token/decline', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `UPDATE team_invitations SET status = 'declined'
       WHERE token = $1 AND status = 'pending'
       RETURNING *`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or already processed' });
    }

    res.json({ success: true, message: 'Invitation declined' });

  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

module.exports = router;
