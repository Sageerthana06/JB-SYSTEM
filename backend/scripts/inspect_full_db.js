require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function inspectDb() {
  const branches = await pool.query('SELECT * FROM "Branch" ORDER BY id ASC;');
  console.log('Branches:', branches.rows);

  const users = await pool.query('SELECT id, name, email, role, "branchId" FROM "User" ORDER BY id ASC;');
  console.log('Users:', users.rows);

  const customers = await pool.query('SELECT id, name, "primaryPhone", email, "branchId" FROM "Customer" ORDER BY id ASC;');
  console.log('Customers count:', customers.rows.length);
  console.log('Sample Customers:', customers.rows.slice(0, 5));

  await pool.end();
}

inspectDb().catch(console.error);
