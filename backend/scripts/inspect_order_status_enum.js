const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const res = await pool.query(`
    SELECT e.enumlabel 
    FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'OrderStatus' 
    ORDER BY e.enumsortorder;
  `);
  console.log('OrderStatus enum values in DB:', res.rows.map(r => r.enumlabel));

  const orderCounts = await pool.query(`
    SELECT status, count(*) 
    FROM "Order" 
    GROUP BY status;
  `);
  console.log('Orders count by status:');
  console.table(orderCounts.rows);
}

check().catch(console.error).finally(() => pool.end());
