'use strict';

/**
 * Redis client — exposes the raw ioredis instance directly so all code can
 * call redis.set(), redis.get(), redis.exists(), redis.call(), etc.
 * This is the pattern used by the auth middleware, rate limiter, and services.
 */

const Redis  = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

const client = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck:     true,
  lazyConnect:          true,
  connectTimeout:       10000,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

client.on('connect', () => logger.info('✅ Redis connected'));
client.on('error',   (err) => logger.warn({ err: err.message }, '⚠️ Redis error'));

// Eagerly connect (non-blocking — failure is logged, not thrown)
client.connect().catch((err) => logger.warn({ err: err.message }, '⚠️ Redis initial connect failed'));

module.exports = client;
