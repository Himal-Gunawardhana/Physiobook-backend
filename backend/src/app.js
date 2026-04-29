'use strict';

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const cookieParser = require('cookie-parser');
const pinoHttp     = require('pino-http');
const config       = require('./config');
const logger       = require('./utils/logger');
const routes       = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = config.cors.origins;
logger.info({ origins: allowedOrigins }, '🌐 CORS origins configured');

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Allow non-browser clients
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Allow any *.vercel.app subdomain
    if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) return cb(null, true);
    logger.warn({ origin }, '⚠️ CORS blocked');
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
  maxAge: 86400,
}));

// ── Raw body for Stripe webhook MUST be before json() ────────────────────
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// ── Request logging (pino-http) ───────────────────────────────────────────
app.use(pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbStatus  = 'disconnected';
  let redisStatus = 'disconnected';

  try {
    const db = require('./config/database');
    await db.query('SELECT 1');
    dbStatus = 'connected';
  } catch (_) {}

  try {
    const redis = require('./config/redis');
    await redis.ping();
    redisStatus = 'connected';
  } catch (_) {}

  const status = dbStatus === 'connected' && redisStatus === 'connected' ? 'ok' : 'degraded';
  return res.status(status === 'ok' ? 200 : 503).json({
    success: true,
    data: {
      status,
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
      version:   '2.0.0',
      db:        dbStatus,
      redis:     redisStatus,
    },
  });
});

// ── API routes ────────────────────────────────────────────────────────────
app.use(`/api/${config.api.version}`, routes);

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
