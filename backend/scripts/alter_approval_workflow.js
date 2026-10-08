require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('1. Adding enum values PENDING_APPROVAL and REJECTED to OrderStatus enum...');
    await client.query(`ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';`);
    await client.query(`ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';`);
    console.log('✓ OrderStatus enum updated.');

    console.log('2. Adding approval, rejection, and tailor assignment columns to Order table...');
    await client.query(`
      ALTER TABLE "Order"
      ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
      ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "rejectedBy" TEXT,
      ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
      ADD COLUMN IF NOT EXISTS "assignedTailorId" INTEGER REFERENCES "User"(id),
      ADD COLUMN IF NOT EXISTS "tailorAccepted" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "tailorAcceptedAt" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "tailorRejectedAt" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "tailorRejectionReason" TEXT;
    `);
    console.log('✓ Order table columns added.');

    // Verify
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Order' AND column_name IN (
        'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt', 'rejectionReason',
        'assignedTailorId', 'tailorAccepted', 'tailorAcceptedAt', 'tailorRejectedAt', 'tailorRejectionReason'
      );
    `);
    console.log('Verified added columns in Order table:');
    cols.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

  } catch (err) {
    console.error('Error modifying schema:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
