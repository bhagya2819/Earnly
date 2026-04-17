require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const policyRoutes = require('./routes/policy');
const claimsRoutes = require('./routes/claims');
const disruptionsRoutes = require('./routes/disruptions');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');
const otpRoutes = require('./routes/otp');
const disruptionScheduler = require('./services/disruptionScheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// --------------- Middleware ---------------
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --------------- Routes ---------------
app.use('/api/auth', authRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/disruptions', disruptionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/otp', otpRoutes);

// Health check (API)
app.get('/api/health', (req, res) => {
  res.json({
    name: 'Earnly API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// --------------- Serve React Frontend ---------------
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// All non-API routes serve the React app (SPA fallback)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found', path: req.originalUrl });
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// --------------- Start ---------------
app.listen(PORT, () => {
  console.log(`\n  Earnly API server running on port ${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
  disruptionScheduler.start();
});

module.exports = app;
