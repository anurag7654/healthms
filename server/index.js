/**
 * HealthMS – Full Stack Health Management System
 * Backend: Express.js + JSON file-based DB (lowdb)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Route Imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const appointmentRoutes = require('./routes/appointments');
const healthRoutes = require('./routes/health');
const prescriptionRoutes = require('./routes/prescriptions');
const medicineRoutes = require('./routes/medicines');
const statsRoutes = require('./routes/stats');

const app = express();

// 1. Render assigns a dynamic port; 10000 is a safe default for local
const PORT = process.env.PORT || 10000;

// ── Security & Middleware ──────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); 
app.use(cors()); // Simplified for better compatibility on Render[cite: 1]
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── API Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/stats', statsRoutes);

// Health Check for Render uptime monitoring
app.get('/api/ping', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Static files & SPA Fallback ──────────────────────────────────
// Serve static assets from public folder[cite: 3]
app.use(express.static(path.join(__dirname, '../public')));

// Standard SPA fallback: Any request not matching an API route serves index.html[cite: 3]
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Error Handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 HealthMS Server running on port ${PORT}`);
  console.log(`🏠 Mode: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;