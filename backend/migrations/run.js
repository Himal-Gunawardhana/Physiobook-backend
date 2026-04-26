'use strict';

/**
 * Migration runner — executes SQL files in order.
 * Usage: node migrations/run.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../src/config/index');

const pool = new Pool({
  host:     config.db.host,
  port:     config.db.port,
  database: config.db.database,
  user:     config.db.user,
  password: config.db.password,
  ssl:      config.db.ssl,
  connectionTimeoutMillis: 10000,  // 10 second timeout
  idleTimeoutMillis: 30000,
});

async function run() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const { rows: applied } = await client.query('SELECT filename FROM _migrations');
    const appliedSet = new Set(applied.map(r => r.filename));

    // Read SQL files from migrations directory
    const dir   = __dirname;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`⏭  Skipping (already applied): ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`🔄  Applying migration: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅  Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌  Failed: ${file}`, err.message);
        process.exit(1);
      }
    }
    console.log('\n✅  All migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations with error handling
run().catch(err => { 
  console.error('❌  Migration error:', err.message);
  console.error('Database:', config.db.host);
  console.error('Details:', err.code, '-', err.syscall);
  // Don't exit with code 1 - allow server to start
  // This allows the server to run even if migrations fail initially
  process.exit(0);
});
