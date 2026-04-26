'use strict';

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const cookieParser = require('cookie-parser');
const morgan       = require('morgan');
const logger       = require('./utils/logger');
const routes       = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Security headers ─────────────────────────────────────────
app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS policy does not allow origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
}));

// ── Body parsing ──────────────────────────────────────────────
// Raw body needed for Stripe webhook signature verification
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Compression ───────────────────────────────────────────────
app.use(compression());

// ── HTTP request logging ──────────────────────────────────────
const stream = { write: (msg) => logger.http(msg.trim()) };
app.use(morgan('combined', { stream }));

// ── Health check (no auth needed) ────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'physiobook-api', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────
app.use(`/api/${process.env.API_VERSION || 'v1'}`, routes);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Global error handler ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
