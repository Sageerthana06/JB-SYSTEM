require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixCashier() {
  const hash = await bcrypt.hash('Cashier@Bella2026', 12);
  await pool.query('UPDATE "User" SET password = $1 WHERE email = $2;', [hash, 'cashier@jbgroup.com']);
  console.log('Updated cashier@jbgroup.com password to Cashier@Bella2026');
  await pool.end();
}

fixCashier().catch(console.error);
