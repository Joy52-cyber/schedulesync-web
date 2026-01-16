require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
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

// API Routes - Core
const authRoutes = require('../routes/auth');
const teamRoutes = require('../routes/teams');
const bookingRoutes = require('../routes/bookings');
const availabilityRoutes = require('../routes/availability');
const dashboardRoutes = require('../routes/dashboard');
const aiRoutes = require('../routes/ai');
const bookingLinksRoutes = require('../routes/bookingLinks');

// API Routes - New Modular Routes
const eventTypesRoutes = require('../routes/eventTypes');
const quickLinksRoutes = require('../routes/quickLinks');
const templatesRoutes = require('../routes/templates');
const billingRoutes = require('../routes/billing');
const webhooksRoutes = require('../routes/webhooks');
const settingsRoutes = require('../routes/settings');
const adminRoutes = require('../routes/admin');
const rulesRoutes = require('../routes/rules');
const preferencesRoutes = require('../routes/preferences');
const calendarRoutes = require('../routes/calendar');
const publicRoutes = require('../routes/public');
const brandingRoutes = require('../routes/branding');
const notificationsRoutes = require('../routes/notifications');
const paymentsRoutes = require('../routes/payments');
const invitationsRoutes = require('../routes/invitations');
const teamMembersRoutes = require('../routes/team-members');
const subscriptionRoutes = require('../routes/subscription');
const analyticsRoutes = require('../routes/analytics');
const emailWebhookRoutes = require('../routes/emailWebhook');
const usersRoutes = require('../routes/users');

// Register core routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/public', publicRoutes);  // Public booking pages - must be before /api catch-all
app.use('/api', bookingRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', bookingLinksRoutes);

// Register new modular routes
app.use('/api/event-types', eventTypesRoutes);
app.use('/api/magic-links', quickLinksRoutes);
app.use('/api/single-use-links', quickLinksRoutes);  // Single-use links share quickLinks router
app.use('/api/email-templates', templatesRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/subscriptions', billingRoutes);  // Subscriptions share billing router
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/user', settingsRoutes);  // User settings share settings router
app.use('/api/user', subscriptionRoutes);  // User subscription routes
app.use('/api/users', usersRoutes);  // User onboarding and management
app.use('/api/autonomous-settings', settingsRoutes);  // Autonomous settings
app.use('/api/admin', adminRoutes);
app.use('/api/scheduling-rules', rulesRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/reschedule-suggestions', preferencesRoutes);  // Reschedule suggestions share preferences router
app.use('/api/check-conflicts', preferencesRoutes);  // Conflict check shares preferences router
app.use('/api/calendar', calendarRoutes);  // Calendar status
app.use('/api/auth', calendarRoutes);  // Google/Microsoft OAuth (shares with auth routes)
app.use('/api/user/branding', brandingRoutes);  // User branding settings
app.use('/api/notifications', notificationsRoutes);  // Notifications
app.use('/api/payments', paymentsRoutes);  // Payment processing
app.use('/api/invitations', invitationsRoutes);  // Team invitations
app.use('/api/team-members', teamMembersRoutes);  // Team member availability
app.use('/api/analytics', analyticsRoutes);  // Booking analytics
app.use('/api/email', emailWebhookRoutes);  // Email Bot Webhooks (inbound emails)

console.log('Routes registered:');
console.log('  - /api/auth/*');
console.log('  - /api/teams/*');
console.log('  - /api/bookings/*');
console.log('  - /api/availability/*');
console.log('  - /api/dashboard/*');
console.log('  - /api/ai/*');
console.log('  - /api/event-types/*');
console.log('  - /api/magic-links/*');
console.log('  - /api/email-templates/*');
console.log('  - /api/billing/*');
console.log('  - /api/webhooks/*');
console.log('  - /api/settings/*');
console.log('  - /api/admin/*');
console.log('  - /api/scheduling-rules/*');
console.log('  - /api/preferences/*');
console.log('  - /api/calendar/*');
console.log('  - /api/public/*');
console.log('  - /api/user/branding/*');
console.log('  - /api/notifications/*');
console.log('  - /api/payments/*');
console.log('  - /api/invitations/*');
console.log('  - /api/team-members/*');
console.log('  - /api/email/*');


// Serve uploaded files (logos)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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