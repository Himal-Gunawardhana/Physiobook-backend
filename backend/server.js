'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { initWebSocket } = require('./src/websocket/chatHandler');
const logger = require('./src/utils/logger');
const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    // ── Connect to PostgreSQL ────────────────────────────────
    await connectDB();
    logger.info('✅  PostgreSQL connected');

    // ── Connect to Redis ─────────────────────────────────────
    await connectRedis();
    logger.info('✅  Redis connected');

    // ── Create HTTP server ───────────────────────────────────
    const server = http.createServer(app);

    // ── Attach WebSocket (real-time chat) ────────────────────
    initWebSocket(server);
    logger.info('✅  WebSocket server attached');

    // ── Start listening ──────────────────────────────────────
    server.listen(PORT, () => {
      logger.info(`🚀  Physiobook API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    // ── Graceful shutdown ────────────────────────────────────
    const shutdown = (signal) => {
      logger.warn(`${signal} received – shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('❌  Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
