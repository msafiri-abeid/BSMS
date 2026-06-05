require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');

const app = express();

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));

// Rate limiting
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: 'Too many login attempts' } }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  const status = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : err.message || 'Internal server error';
  res.status(status).json({ success: false, message, ...(err.errors && { errors: err.errors }) });
});

module.exports = app;
