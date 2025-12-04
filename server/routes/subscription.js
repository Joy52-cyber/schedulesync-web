const express = require('express');
const router = express.Router();

// GET /api/user/subscription
router.get('/subscription', (req, res) => {
  res.json({
    plan: 'free',
    status: 'active'
  });
});

module.exports = router;
