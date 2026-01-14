const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Logo upload configuration
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `logo_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
    cb(null, filename);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, SVG, and WebP are allowed.'));
    }
  }
});

// GET /api/user/branding - Get authenticated user's branding
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT brand_logo_url, brand_primary_color, brand_accent_color, hide_powered_by
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ error: 'Failed to fetch branding settings' });
  }
});

// GET /api/user/:userId/branding - Get branding by user ID (public endpoint)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT brand_logo_url, brand_primary_color, brand_accent_color, hide_powered_by
       FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ error: 'Failed to fetch branding' });
  }
});

// PUT /api/user/branding - Update branding settings
router.put('/', authenticateToken, async (req, res) => {
  try {
    // Check subscription tier
    const userResult = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [req.user.id]
    );
    const tier = userResult.rows[0]?.subscription_tier || 'free';
    if (!['pro', 'team', 'enterprise'].includes(tier)) {
      return res.status(403).json({ error: 'Custom branding requires Pro plan or higher' });
    }

    const { brand_logo_url, brand_primary_color, brand_accent_color, hide_powered_by } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET brand_logo_url = $1, brand_primary_color = $2, brand_accent_color = $3,
           hide_powered_by = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING brand_logo_url, brand_primary_color, brand_accent_color, hide_powered_by`,
      [
        brand_logo_url || null,
        brand_primary_color || '#8B5CF6',
        brand_accent_color || '#EC4899',
        hide_powered_by || false,
        req.user.id
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ error: 'Failed to update branding settings' });
  }
});

// POST /api/user/branding/logo - Upload logo
router.post('/logo', authenticateToken, logoUpload.single('logo'), async (req, res) => {
  try {
    // Check subscription tier
    const userResult = await pool.query(
      'SELECT subscription_tier, brand_logo_url FROM users WHERE id = $1',
      [req.user.id]
    );
    const tier = userResult.rows[0]?.subscription_tier || 'free';

    if (!['pro', 'team', 'enterprise'].includes(tier)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Custom branding requires Pro plan or higher' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old logo if exists
    const oldLogoUrl = userResult.rows[0].brand_logo_url;
    if (oldLogoUrl && oldLogoUrl.startsWith('/uploads/logos/')) {
      const oldLogoPath = path.join(uploadsDir, path.basename(oldLogoUrl));
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    await pool.query(
      'UPDATE users SET brand_logo_url = $1, updated_at = NOW() WHERE id = $2',
      [logoUrl, req.user.id]
    );

    res.json({ logo_url: logoUrl, message: 'Logo uploaded successfully' });
  } catch (error) {
    console.error('Error uploading logo:', error);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// DELETE /api/user/branding/logo - Delete logo
router.delete('/logo', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT brand_logo_url FROM users WHERE id = $1',
      [req.user.id]
    );

    const oldLogoUrl = userResult.rows[0]?.brand_logo_url;
    if (oldLogoUrl && oldLogoUrl.startsWith('/uploads/logos/')) {
      const oldLogoPath = path.join(uploadsDir, path.basename(oldLogoUrl));
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    await pool.query(
      'UPDATE users SET brand_logo_url = NULL, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );

    res.json({ message: 'Logo deleted successfully' });
  } catch (error) {
    console.error('Error deleting logo:', error);
    res.status(500).json({ error: 'Failed to delete logo' });
  }
});

module.exports = router;
