'use strict';

const Redis  = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let client;

async function connectRedis() {
  const opts = {
    host:            config.redis.host,
    port:            config.redis.port,
    password:        config.redis.password,
    tls:             config.redis.tls,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect:     true,
    connectTimeout:  10000,
    retryStrategy:   (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };

  client = new Redis(opts);

  client.on('error',   (err) => logger.debug('Redis error:', err.message));
  client.on('connect', ()    => logger.debug('Redis connection established'));

  try {
    await client.connect();
    await client.ping();
    logger.info('✅  Redis connected');
  } catch (err) {
    logger.error('❌  Redis connection failed:', err.message);
    logger.error('    Host:', config.redis.host);
    logger.error('    Port:', config.redis.port);
    throw err;
  }
  
  return client;
}

function getRedis() {
  if (!client) {
    logger.warn('Redis not initialised. Returning null for graceful degradation.');
    return null;
  }
  return client;
}

/**
 * Store a key with optional TTL (seconds).
 */
async function set(key, value, ttlSeconds) {
  const serialised = JSON.stringify(value);
  if (ttlSeconds) {
    await client.set(key, serialised, 'EX', ttlSeconds);
  } else {
    await client.set(key, serialised);
  }
}

/**
 * Retrieve and parse a stored value.
 */
async function get(key) {
  const raw = await client.get(key);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Delete one or more keys.
 */
async function del(...keys) {
  return client.del(...keys);
}

/**
 * Check if a key exists.
 */
async function exists(key) {
  return (await client.exists(key)) === 1;
}

module.exports = { connectRedis, getRedis, set, get, del, exists };
