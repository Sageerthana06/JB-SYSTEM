require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkLocks() {
  const res = await pool.query(`
    SELECT pid, state, query_start, query
    FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid();
  `);
  console.log('Active queries in DB:');
  console.table(res.rows);
  await pool.end();
}

checkLocks().catch(console.error);
