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
  let attempts = 0;
  const maxAttempts = 5;
  const initialDelay = 2000; // 2 seconds

  while (attempts < maxAttempts) {
    try {
      pool = new Pool({
        connectionString: config.db.url,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis:       30000,
        connectionTimeoutMillis: 10000,
      });

      pool.on('error', (err) => {
        logger.error('PostgreSQL pool error:', err);
      });

      // Verify connectivity
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      logger.info(`✅  PostgreSQL connected after ${attempts} attempt(s)`);
      return pool;
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        logger.error(`❌  Failed to connect to PostgreSQL after ${maxAttempts} attempts:`, err.message);
        logger.error('    Code:', err.code);
        logger.error('    Host:', config.db.host);
        logger.error('    Port:', config.db.port);
        // Throw the error to let the caller handle it gracefully
        throw new Error(`Database connection failed: ${err.message}`);
      }
      const delay = initialDelay * Math.pow(2, attempts - 1);
      logger.warn(`⚠️  PostgreSQL connection failed (attempt ${attempts}/${maxAttempts}), retrying in ${delay}ms...`);
      logger.debug('Error details:', err.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Execute a single query and return rows.
 * @param {string} text  - SQL query string
 * @param {any[]}  params - Query parameters
 */
async function query(text, params) {
  if (!pool) {
    throw new Error('Database not initialised. PostgreSQL connection failed.');
  }
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
  if (!pool) {
    throw new Error('Database not initialised. PostgreSQL connection failed.');
  }
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

async function connect() {
  if (!pool) await connectDB();
  return pool.connect();
}

async function end() {
  if (pool) await pool.end();
}

module.exports = { connectDB, query, connect, getClient, withTransaction, end,
  // Expose pool getter for health check
  get pool() { return pool; } };
