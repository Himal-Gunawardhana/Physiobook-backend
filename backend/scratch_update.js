const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'physiobook',
  user: 'physiobook_user',
  password: 'physiobook_pass'
});

async function run() {
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
    '$2a$12$n.nEvn5ycTQK7rMqptqqQeumardKSv0g.770wbbgrws/fvMajyC.C',
    'admin@physiobook.com'
  ]);
  console.log('Password hash updated');
  process.exit(0);
}

run();
