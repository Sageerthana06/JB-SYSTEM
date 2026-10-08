require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const columns = [
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;',
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE;',
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rejectedBy" TEXT;',
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP WITH TIME ZONE;',
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;',
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assignedTailorId" INTEGER;',
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tailorAccepted" BOOLEAN DEFAULT FALSE;',
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tailorAcceptedAt" TIMESTAMP WITH TIME ZONE;',
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tailorRejectedAt" TIMESTAMP WITH TIME ZONE;',
  'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tailorRejectionReason" TEXT;'
];

async function run() {
  for (const sql of columns) {
    const colName = sql.split('"')[3];
    try {
      await pool.query(sql);
      console.log(`✓ Added/verified column ${colName}`);
    } catch (e) {
      console.error(`Error on ${colName}:`, e.message);
    }
  }

  // Add foreign key constraint if not exists
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'Order_assignedTailorId_fkey'
        ) THEN
          ALTER TABLE "Order" 
          ADD CONSTRAINT "Order_assignedTailorId_fkey" 
          FOREIGN KEY ("assignedTailorId") REFERENCES "User"(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log('✓ Foreign key Order_assignedTailorId_fkey added/verified');
  } catch (e) {
    console.error('FK error:', e.message);
  }

  await pool.end();
}

run();
