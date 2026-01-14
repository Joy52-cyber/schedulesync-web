const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Parse natural language rule into structured format
async function parseSchedulingRule(ruleText) {
  const lowerText = ruleText.toLowerCase();

  // Default structure
  let parsed = {
    type: 'custom',
    conditions: {},
    actions: {}
  };

  // Detect routing rules: "route X to Y", "assign X to Y"
  if (lowerText.includes('route') || lowerText.includes('assign')) {
    parsed.type = 'routing';

    // Extract "to [name]" pattern
    const toMatch = lowerText.match(/to\s+(\w+(?:\s+(?:and|&)\s+\w+)*)/i);
    if (toMatch) {
      parsed.actions.assign_to = toMatch[1].split(/\s+(?:and|&)\s+/);
    }

    // Extract meeting type if mentioned
    if (lowerText.includes('demo')) parsed.conditions.event_type = 'demo';
    if (lowerText.includes('sales')) parsed.conditions.event_type = 'sales';
    if (lowerText.includes('support')) parsed.conditions.event_type = 'support';
  }

  // Detect buffer rules: "add X min buffer", "X minute gap"
  else if (lowerText.includes('buffer') || lowerText.includes('gap') || lowerText.includes('break')) {
    parsed.type = 'buffer';

    const minMatch = lowerText.match(/(\d+)\s*(?:min|minute)/i);
    if (minMatch) {
      parsed.actions.buffer_minutes = parseInt(minMatch[1]);
    }

    if (lowerText.includes('before')) parsed.actions.buffer_position = 'before';
    else if (lowerText.includes('after')) parsed.actions.buffer_position = 'after';
    else parsed.actions.buffer_position = 'after'; // default
  }

  // Detect availability rules: "no meetings on X", "only available X"
  else if (lowerText.includes('no meeting') || lowerText.includes('block') || lowerText.includes('only available')) {
    parsed.type = 'availability';

    // Days
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const blockedDays = days.filter(d => lowerText.includes(d));
    if (blockedDays.length > 0) {
      if (lowerText.includes('no meeting') || lowerText.includes('block')) {
        parsed.actions.block_days = blockedDays;
      } else {
        parsed.actions.allow_days = blockedDays;
      }
    }

    // Time ranges
    const timeMatch = lowerText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi);
    if (timeMatch) {
      parsed.conditions.time_range = timeMatch;
    }
  }

  // Detect priority rules: "VIP", "priority", "important"
  else if (lowerText.includes('vip') || lowerText.includes('priority') || lowerText.includes('important')) {
    parsed.type = 'priority';
    parsed.actions.priority_level = 'high';

    // Extract email domain or contact pattern
    const domainMatch = lowerText.match(/@([\w.-]+)/);
    if (domainMatch) {
      parsed.conditions.email_domain = domainMatch[1];
    }
  }

  // Detect auto-response rules
  else if (lowerText.includes('auto') || lowerText.includes('automatically')) {
    parsed.type = 'auto_response';

    if (lowerText.includes('confirm')) parsed.actions.auto_action = 'confirm';
    if (lowerText.includes('decline') || lowerText.includes('reject')) parsed.actions.auto_action = 'decline';
    if (lowerText.includes('reschedule')) parsed.actions.auto_action = 'suggest_reschedule';
  }

  return parsed;
}

// GET /api/scheduling-rules - List user's rules
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM scheduling_rules
       WHERE user_id = $1
       ORDER BY priority DESC, created_at DESC`,
      [req.user.id]
    );
    res.json({ rules: result.rows });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ error: 'Failed to get rules' });
  }
});

// POST /api/scheduling-rules - Create rule from natural language
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { rule_text } = req.body;

    if (!rule_text || rule_text.trim().length < 5) {
      return res.status(400).json({ error: 'Please provide a rule description' });
    }

    // Parse the rule using AI to extract type, conditions, actions
    const parsed = await parseSchedulingRule(rule_text);

    const result = await pool.query(
      `INSERT INTO scheduling_rules (user_id, rule_text, rule_type, conditions, actions)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, rule_text, parsed.type, JSON.stringify(parsed.conditions), JSON.stringify(parsed.actions)]
    );

    console.log(`New scheduling rule created: "${rule_text}"`);
    res.json({ rule: result.rows[0], parsed });
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// DELETE /api/scheduling-rules/:id - Delete rule
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'DELETE FROM scheduling_rules WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// PATCH /api/scheduling-rules/:id/toggle - Toggle rule active/inactive
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE scheduling_rules
       SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );
    res.json({ rule: result.rows[0] });
  } catch (error) {
    console.error('Toggle rule error:', error);
    res.status(500).json({ error: 'Failed to toggle rule' });
  }
});

module.exports = router;
