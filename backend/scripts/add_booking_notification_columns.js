const { pool } = require('../src/prisma');

async function run() {
  console.log('--- Adding Booking Notification Columns to Order table ---');
  await pool.query(`
    ALTER TABLE "Order" 
    ADD COLUMN IF NOT EXISTS "bookingNotificationSent" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "bookingNotificationSentAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "bookingNotificationSentBy" TEXT,
    ADD COLUMN IF NOT EXISTS "bookingNotificationStatus" TEXT DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS "bookingNotificationPhone" TEXT,
    ADD COLUMN IF NOT EXISTS "bookingNotificationMessage" TEXT,
    ADD COLUMN IF NOT EXISTS "bookingNotificationError" TEXT,
    ADD COLUMN IF NOT EXISTS "quotationNumber" TEXT;
  `);

  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Order' AND (column_name LIKE '%bookingNotification%' OR column_name = 'quotationNumber')
    ORDER BY column_name;
  `);

  console.log('Columns verified:');
  console.table(res.rows);
  await pool.end();
  console.log('Migration completed successfully.');
}

run().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});

