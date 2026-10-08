require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const orders = await pool.query('SELECT id, "orderNumber", "orderDate", "createdAt", "totalAmount", "advancePayment", "balanceAmount", status, "paymentStatus" FROM "Order" ORDER BY id ASC;');
  console.log('--- Orders in DB ---');
  console.table(orders.rows);

  const payments = await pool.query('SELECT * FROM "Payment" ORDER BY id ASC;');
  console.log('--- Payments in DB ---');
  console.table(payments.rows);

  const garmentDetails = await pool.query('SELECT id, "orderId", "dressType", quantity FROM "GarmentDetails" ORDER BY id ASC;');
  console.log('--- GarmentDetails in DB ---');
  console.table(garmentDetails.rows);

  await pool.end();
}

check().catch(console.error);
