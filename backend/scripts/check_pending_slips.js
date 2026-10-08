const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const payments = await pool.query(`SELECT id, "orderId", amount, status, "slipImage", "paymentMethod" FROM "Payment" ORDER BY id DESC LIMIT 10`);
  console.log('Recent Payments:');
  console.table(payments.rows);

  const pendingPayments = await pool.query(`SELECT id, "orderId", amount, status, "slipImage", "paymentMethod" FROM "Payment" WHERE status = 'PENDING_VERIFICATION'`);
  console.log('Pending Verification Payments:');
  console.table(pendingPayments.rows);
}

check().finally(() => pool.end());
