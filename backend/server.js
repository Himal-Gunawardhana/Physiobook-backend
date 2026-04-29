'use strict';

require('dotenv').config();
const app    = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const db     = require('./src/config/database');
const redis  = require('./src/config/redis');

async function start() {
  // Initialize PostgreSQL pool (retries internally)
  try {
    await db.connectDB();
  } catch (err) {
    logger.warn({ err: err.message }, '⚠️  DB connection failed on startup — server will start anyway');
  }

  const server = app.listen(config.port, () => {
    logger.info(`🚀 Physiobook API v2 running on port ${config.port} [${config.env}]`);
    logger.info(`   Health: http://localhost:${config.port}/health`);
    logger.info(`   API:    http://localhost:${config.port}/api/${config.api.version}`);
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Shutting down gracefully...');
    server.close(async () => {
      try { await db.end();     logger.info('PostgreSQL pool closed'); } catch (_) {}
      try { await redis.quit(); logger.info('Redis connection closed'); } catch (_) {}
      logger.info('Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => { logger.error('Forced exit after timeout'); process.exit(1); }, 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled promise rejection'));
  process.on('uncaughtException',  (err)    => { logger.fatal({ err }, 'Uncaught exception'); process.exit(1); });

  return server;
}

start().catch((err) => { console.error('Fatal startup error:', err); process.exit(1); });
