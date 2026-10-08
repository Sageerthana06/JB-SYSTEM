require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const r = await p.query('SELECT * FROM "Attendance"');
  console.log(r.rows);
  await p.end();
}
run().catch(console.error);
