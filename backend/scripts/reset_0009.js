require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function reset() {
  const res = await pool.query(
    'UPDATE "Order" SET status = \'ORDER_CONFIRMED\', "tailorAccepted" = false, "tailorAcceptedAt" = null WHERE "orderNumber" = \'ORD-2026-0009\' RETURNING id, "orderNumber", status, "assignedTailorId", "tailorAccepted";'
  );
  console.log('RESET RESULT:', res.rows[0]);
  await pool.end();
}
reset();
