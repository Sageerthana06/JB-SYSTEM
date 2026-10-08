require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const users = await pool.query('SELECT id, name, email, role, "branchId" FROM "User" ORDER BY id;');
  console.log('Users in DB:');
  console.table(users.rows);

  const enumValues = await pool.query(`
    SELECT e.enumlabel
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OrderStatus';
  `);
  console.log('OrderStatus enum values in DB:', enumValues.rows.map(r => r.enumlabel));
  await pool.end();
}

run().catch(console.error);
