// Near the TOP with other require statements, add:
const subscriptionRoutes = require('./routes/subscription');

// Then find where other routes are defined (look for similar app.use lines) and add:
app.use('/api/user', subscriptionRoutes);