const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkOrder() {
  const ord = await pool.query(`SELECT id, "orderNumber", "branchId", "orderDate", status, "totalAmount", "advancePayment", "balanceAmount" FROM "Order" WHERE id = 103`);
  console.log('Order 103:');
  console.table(ord.rows);

  const branches = await pool.query(`SELECT id, name FROM "Branch"`);
  console.log('Branches:');
  console.table(branches.rows);
}

checkOrder().finally(() => pool.end());
