require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateExisting() {
  const res = await pool.query(`
    UPDATE "Order" 
    SET "priceAcceptedByCustomer" = true, "priceStatus" = 'ACCEPTED'
    WHERE status NOT IN ('PENDING_APPROVAL', 'APPROVED', 'PRICE_DECLINED', 'REJECTED');
  `);
  console.log('Preserved existing confirmed/production orders priceAcceptedByCustomer count:', res.rowCount);
  await pool.end();
}
updateExisting();
