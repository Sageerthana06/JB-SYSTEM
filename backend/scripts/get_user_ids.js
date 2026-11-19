require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const users = await pool.query('SELECT id, email, role, "branchId" FROM "User" ORDER BY id');
  console.log('Real database users:');
  console.log(users.rows);
  await pool.end();
}
main().catch(console.error);

