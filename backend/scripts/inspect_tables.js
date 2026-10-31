require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;");
  console.log('Tables:', tables.rows.map(r => r.table_name));

  const userCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='User' ORDER BY ordinal_position;");
  console.log('User columns:', userCols.rows);

  const roles = await pool.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'Role';");
  console.log('Role enum values:', roles.rows.map(r => r.enumlabel));

  await pool.end();
}

main().catch(console.error);
