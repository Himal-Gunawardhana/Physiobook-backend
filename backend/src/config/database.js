'use strict';

const { Pool } = require('pg');
const config   = require('./index');
const logger   = require('../utils/logger');

let pool;

/**
 * Initialise the PostgreSQL connection pool.
 * Called once at server start. Exposed for testing overrides.
 */
async function connectDB() {
  pool = new Pool({
    host:     config.db.host,
    port:     config.db.port,
    database: config.db.database,
    user:     config.db.user,
    password: config.db.password,
    ssl:      config.db.ssl,
    min:      config.db.pool.min,
    max:      config.db.pool.max,
    idleTimeoutMillis:    30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    logger.error('PostgreSQL pool error:', err);
  });

  // Verify connectivity
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();

  return pool;
}

/**
 * Execute a single query and return rows.
 * @param {string} text  - SQL query string
 * @param {any[]}  params - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('SQL query executed', { query: text, duration, rows: res.rowCount });
  return res;
}

/**
 * Acquire a client for transactions.
 * Remember to release the client after use.
 */
async function getClient() {
  return pool.connect();
}

/**
 * Run a function inside a transaction.
 * Automatically commits or rolls back.
 * @param {Function} fn - async (client) => result
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { connectDB, query, getClient, withTransaction };
