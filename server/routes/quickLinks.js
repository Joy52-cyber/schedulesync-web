const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// ============================================
// MAGIC LINKS ENDPOINTS
// ============================================

// POST /api/magic-links - Create magic link
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      attendee_email,
      attendee_name,
      team_id,
      member_ids,
      scheduling_mode,
      usage_limit,
      expires_in_days
    } = req.body;

    // Check user's limit
    const limitResult = await pool.query(
      'SELECT subscription_tier, magic_links_used, magic_links_limit FROM users WHERE id = $1',
      [userId]
    );

    const userLimits = limitResult.rows[0];
    const tier = userLimits?.subscription_tier || 'free';
    const magicLinksUsed = userLimits?.magic_links_used || 0;
    const magicLinksLimit = userLimits?.magic_links_limit || 3;
    const isUnlimited = ['pro', 'team', 'enterprise'].includes(tier) || magicLinksLimit >= 1000;

    if (!isUnlimited && magicLinksUsed >= magicLinksLimit) {
      return res.status(403).json({ error: 'Magic link limit reached', upgrade_required: true });
    }

    const magicToken = crypto.randomBytes(16).toString('hex');

    // Handle expiration - null means never expires
    let expiresAt = null;
    if (expires_in_days && expires_in_days !== 'never') {
      const daysToExpire = parseInt(expires_in_days) || 7;
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysToExpire);
    }

    // Get user's default event type
    let eventTypeId = null;
    const etResult = await pool.query(
      'SELECT id FROM event_types WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );
    if (etResult.rows.length > 0) {
      eventTypeId = etResult.rows[0].id;
    }

    const memberIdsArray = Array.isArray(member_ids) ? member_ids : (member_ids ? [member_ids] : []);
    const primaryMemberId = memberIdsArray.length > 0 ? memberIdsArray[0] : null;

    // Insert magic link
    const insertResult = await pool.query(
      `INSERT INTO magic_links (
        token, created_by_user_id, event_type_id, expires_at,
        is_active, is_used, created_at,
        attendee_email, attendee_name, team_id, assigned_member_id,
        scheduling_mode, usage_limit, usage_count, link_name
      ) VALUES ($1, $2, $3, $4, true, false, NOW(), $5, $6, $7, $8, $9, $10, 0, $11)
      RETURNING id`,
      [
        magicToken, userId, eventTypeId, expiresAt,
        attendee_email || null, attendee_name || null, team_id || null, primaryMemberId,
        scheduling_mode || 'collective', usage_limit || 1, name || null
      ]
    );

    const magicLinkId = insertResult.rows[0].id;

    // Insert all members
    if (memberIdsArray.length > 0) {
      for (let i = 0; i < memberIdsArray.length; i++) {
        await pool.query(
          `INSERT INTO magic_link_members (magic_link_id, team_member_id, is_host, is_required, display_order)
           VALUES ($1, $2, $3, true, $4)
           ON CONFLICT (magic_link_id, team_member_id) DO NOTHING`,
          [magicLinkId, memberIdsArray[i], i === 0, i]
        );
      }
    }

    await pool.query(
      'UPDATE users SET magic_links_used = COALESCE(magic_links_used, 0) + 1 WHERE id = $1',
      [userId]
    );

    // Fetch member details for response
    const membersResult = await pool.query(
      `SELECT tm.id, tm.name, tm.email, mlm.is_host, mlm.is_required
       FROM magic_link_members mlm
       JOIN team_members tm ON mlm.team_member_id = tm.id
       WHERE mlm.magic_link_id = $1
       ORDER BY mlm.display_order ASC`,
      [magicLinkId]
    );

    const baseUrl = process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app';

    res.json({
      success: true,
      link: {
        id: magicLinkId,
        token: magicToken,
        url: `${baseUrl}/m/${magicToken}`,
        name: name || null,
        scheduling_mode: scheduling_mode || 'collective',
        usage_limit: usage_limit || 1,
        expires_at: expiresAt,
        members: membersResult.rows
      }
    });

  } catch (error) {
    console.error('Create magic link error:', error);
    res.status(500).json({ error: 'Failed to create magic link' });
  }
});

// GET /api/magic-links - List magic links
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ml.*,
              t.name as team_name,
              et.title as event_type_title,
              et.duration as event_type_duration
       FROM magic_links ml
       LEFT JOIN teams t ON ml.team_id = t.id
       LEFT JOIN event_types et ON ml.event_type_id = et.id
       WHERE ml.created_by_user_id = $1
       ORDER BY ml.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    const linksWithMembers = await Promise.all(result.rows.map(async (link) => {
      const membersResult = await pool.query(
        `SELECT tm.id, tm.name, tm.email, mlm.is_host, mlm.is_required
         FROM magic_link_members mlm
         JOIN team_members tm ON mlm.team_member_id = tm.id
         WHERE mlm.magic_link_id = $1
         ORDER BY mlm.display_order ASC`,
        [link.id]
      );

      const baseUrl = process.env.FRONTEND_URL || 'https://schedulesync-web-production.up.railway.app';

      return {
        ...link,
        url: `${baseUrl}/m/${link.token}`,
        members: membersResult.rows,
        is_expired: new Date(link.expires_at) < new Date(),
        is_exhausted: link.usage_limit && link.usage_count >= link.usage_limit
      };
    }));

    res.json({ success: true, links: linksWithMembers });

  } catch (error) {
    console.error('Get magic links error:', error);
    res.status(500).json({ error: 'Failed to fetch magic links' });
  }
});

// GET /api/magic-links/available-members - Get available team members
router.get('/available-members', authenticateToken, async (req, res) => {
  try {
    const teamsResult = await pool.query(
      `SELECT DISTINCT t.id, t.name
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id
       WHERE (t.owner_id = $1 OR tm.user_id = $1)
         AND t.name NOT LIKE '%Personal Bookings%'
       ORDER BY t.name ASC`,
      [req.user.id]
    );

    const teamIds = teamsResult.rows.map(t => t.id);

    let membersResult = { rows: [] };
    if (teamIds.length > 0) {
      membersResult = await pool.query(
        `SELECT tm.id, tm.name, tm.email, tm.team_id, t.name as team_name
         FROM team_members tm
         JOIN teams t ON tm.team_id = t.id
         WHERE tm.team_id = ANY($1)
           AND (tm.is_active = true OR tm.is_active IS NULL)
         ORDER BY t.name, tm.name ASC`,
        [teamIds]
      );
    }

    res.json({
      success: true,
      teams: teamsResult.rows,
      members: membersResult.rows
    });

  } catch (error) {
    console.error('Get available members error:', error);
    res.status(500).json({ error: 'Failed to fetch available members' });
  }
});

// DELETE /api/magic-links/:id - Delete magic link
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const linkResult = await pool.query(
      'SELECT id FROM magic_links WHERE id = $1 AND created_by_user_id = $2',
      [id, req.user.id]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Magic link not found' });
    }

    await pool.query('DELETE FROM magic_link_members WHERE magic_link_id = $1', [id]);
    await pool.query('DELETE FROM magic_links WHERE id = $1', [id]);

    res.json({ success: true, message: 'Magic link deleted' });

  } catch (error) {
    console.error('Delete magic link error:', error);
    res.status(500).json({ error: 'Failed to delete magic link' });
  }
});

// ============================================
// SINGLE-USE LINKS ENDPOINTS
// ============================================

// POST /api/single-use-links - Generate single-use link
router.post('/single-use', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    // Get user's member_id
    const memberResult = await pool.query(
      'SELECT id FROM team_members WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(400).json({ error: 'No team membership found' });
    }

    const memberId = memberResult.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO single_use_links (token, member_id, name, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [token, memberId, name || null, expiresAt]
    );

    console.log('Single-use link created:', { token, name, expires_at: expiresAt });

    res.json({
      success: true,
      token,
      name: name || null,
      expires_at: expiresAt
    });
  } catch (error) {
    console.error('Generate single-use link error:', error);
    res.status(500).json({ error: 'Failed to generate single-use link' });
  }
});

// GET /api/single-use-links/recent - Get recent single-use links
router.get('/single-use/recent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const memberResult = await pool.query(
      'SELECT id FROM team_members WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.json({ links: [] });
    }

    const memberId = memberResult.rows[0].id;

    const result = await pool.query(
      `SELECT token, name, used, created_at, expires_at
       FROM single_use_links
       WHERE member_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [memberId]
    );

    res.json({ links: result.rows });
  } catch (error) {
    console.error('Get recent single-use links error:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

module.exports = router;
