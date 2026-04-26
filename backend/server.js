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
  let dbConnected = false;
  let redisConnected = false;

  // ── Connect to PostgreSQL ────────────────────────────────
  try {
    await connectDB();
    logger.info('✅  PostgreSQL connected');
    dbConnected = true;
  } catch (err) {
    logger.error('⚠️  PostgreSQL connection failed:', err.message);
    logger.error('   Server will start in degraded mode without database');
  }

  // ── Connect to Redis ─────────────────────────────────────
  try {
    await connectRedis();
    logger.info('✅  Redis connected');
    redisConnected = true;
  } catch (err) {
    logger.error('⚠️  Redis connection failed:', err.message);
    logger.error('   Server will start in degraded mode without cache');
  }

  // ── Create HTTP server ───────────────────────────────────
  const server = http.createServer(app);

  // ── Attach WebSocket (real-time chat) ────────────────────
  initWebSocket(server);
  logger.info('✅  WebSocket server attached');

  // ── Start listening ──────────────────────────────────────
  server.listen(PORT, () => {
    const mode = (dbConnected && redisConnected) ? 'normal' : 'degraded';
    logger.info(`🚀  Physiobook API running on port ${PORT} [${process.env.NODE_ENV}] (${mode} mode)`);
    
    if (!dbConnected || !redisConnected) {
      logger.warn('⚠️  Server started but some services are unavailable.');
      logger.warn('   API endpoints may fail until services are restored.');
    }
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
}

bootstrap();
