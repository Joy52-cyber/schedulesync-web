require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('../config/database');  // ← Fixed
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes - FIXED PATHS
const authRoutes = require('../routes/auth');
const teamRoutes = require('../routes/teams');
const bookingRoutes = require('../routes/bookings');
const availabilityRoutes = require('../routes/availability');
const dashboardRoutes = require('../routes/dashboard');
const aiRoutes = require('../routes/ai');
const bookingLinksRoutes = require('../routes/bookingLinks');  // ← Fixed

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api', bookingRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', bookingLinksRoutes);

console.log('✅ Routes registered:');
console.log('  - /api/auth/*');
console.log('  - /api/teams/*');
console.log('  - /api/bookings/*');
console.log('  - /api/book/:token');
console.log('  - /api/chatgpt/book-meeting (with Smart Rules)');
console.log('  - /api/public/booking/create (with Smart Rules)');
console.log('  - /api/availability/*');
console.log('  - /api/dashboard/*');
console.log('  - /api/ai/* (with Smart Rules)');
console.log('  - /api/my-booking-link ✨');

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../dist-built');
  console.log('📁 Serving static files from:', distPath);
  app.use(express.static(distPath));
  
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection test
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected:', res.rows[0].now);
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  pool.end(() => {
    console.log('✅ Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  pool.end(() => {
    console.log('✅ Database pool closed');
    process.exit(0);
  });
});

module.exports = app;