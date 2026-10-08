const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('1. Adding new OrderStatus enum values to PostgreSQL if not present...');
    const newStatuses = [
      'CHANGES_REQUIRED',
      'WAITING_CUSTOMER_APPROVAL',
      'PRICE_SET',
      'CUSTOMER_APPROVED',
      'PRICE_REVISION_REQUIRED',
      'TAILOR_ASSIGNED',
      'IN_PROGRESS',
      'ALTERATION',
      'COMPLETED'
    ];

    for (const status of newStatuses) {
      try {
        await client.query(`ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS '${status}';`);
        console.log(`  + Status enum: ${status}`);
      } catch (err) {
        console.log(`  - Note on ${status}: ${err.message}`);
      }
    }

    console.log('2. Adding workflow and pricing breakdown columns to "Order" table...');
    await client.query(`
      ALTER TABLE "Order"
      ADD COLUMN IF NOT EXISTS "basePrice" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "designCharge" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "cuttingCharge" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "stitchingCharge" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "embroideryCharge" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "additionalCharge" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "priceSetBy" TEXT,
      ADD COLUMN IF NOT EXISTS "priceSetAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "changesRequestedBy" TEXT,
      ADD COLUMN IF NOT EXISTS "changesRequestedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "changesReason" TEXT,
      ADD COLUMN IF NOT EXISTS "customerApprovedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "revisionReason" TEXT,
      ADD COLUMN IF NOT EXISTS "deliveredBy" TEXT,
      ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "deliveryNotes" TEXT,
      ADD COLUMN IF NOT EXISTS "completedBy" TEXT,
      ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP;
    `);

    console.log('3. Checking updated columns on Order table...');
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Order' AND column_name IN (
        'basePrice', 'designCharge', 'cuttingCharge', 'stitchingCharge', 
        'embroideryCharge', 'additionalCharge', 'priceSetBy', 'deliveredBy', 'completedBy'
      );
    `);
    console.table(res.rows);

    console.log('Migration completed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
