const { pool } = require('../src/prisma');

async function run() {
  await pool.query(`
    ALTER TABLE "Order" 
    ADD COLUMN IF NOT EXISTS "deliveryNotificationSent" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "deliveryNotificationSentAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deliveryNotificationSentBy" TEXT,
    ADD COLUMN IF NOT EXISTS "deliveryNotificationStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "deliveryNotificationPhone" TEXT,
    ADD COLUMN IF NOT EXISTS "deliveryNotificationMessage" TEXT;
  `);

  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Order' AND column_name LIKE '%deliveryNotification%';
  `);

  console.log('Columns ensured:');
  console.table(res.rows);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

