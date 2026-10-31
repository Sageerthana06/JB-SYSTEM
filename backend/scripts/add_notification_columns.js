const { Pool } = require('pg');
require('dotenv').config({ path: 'e:/JB SYSTEM/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query(`
    ALTER TABLE "Order" 
    ADD COLUMN IF NOT EXISTS "readyNotificationSent" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "readyNotificationSentAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "readyNotificationStatus" TEXT;
  `);

  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Order' AND column_name LIKE '%readyNotification%';
  `);

  console.log('Columns added:');
  console.table(res.rows);
  await pool.end();
}

run().catch(console.error);
