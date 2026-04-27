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
// Build list of allowed origins from environment or use defaults for development
const defaultOrigins = [
  'http://localhost:5173',      // Vite dev server (main)
  'http://localhost:3000',      // Alternative local dev
  'http://localhost:5174',      // Vite alternative port
  'http://127.0.0.1:5173',      // Localhost alternative
];

const envOrigins = (process.env.CORS_ORIGINS || '').split(',')
  .map(o => o.trim())
  .filter(o => o.length > 0);

const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultOrigins;

logger.info(`🌐 CORS enabled for ${allowedOrigins.length} origin(s):`);
allowedOrigins.forEach(origin => logger.info(`   - ${origin}`));

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps, curl, Postman, etc)
    // This is safe because we have authentication middleware
    if (!origin) return cb(null, true);
    
    // Allow if origin is in whitelist
    if (allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    
    // Reject if origin not in whitelist
    const errorMsg = `CORS policy violation: origin '${origin}' not allowed`;
    logger.warn(`⚠️  ${errorMsg}`);
    cb(new Error(errorMsg));
  },
  credentials: true,  // Allow cookies and Authorization headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
  maxAge: 86400,  // 24 hours - cache preflight requests
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
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// ── Global error handler ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
