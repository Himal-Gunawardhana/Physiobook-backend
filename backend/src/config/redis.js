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
  };

  client = new Redis(opts);

  client.on('error',   (err) => logger.error('Redis error:', err));
  client.on('connect', ()    => logger.debug('Redis connection established'));

  await client.connect();
  await client.ping();
  return client;
}

function getRedis() {
  if (!client) throw new Error('Redis not initialised. Call connectRedis() first.');
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
