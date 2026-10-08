const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('1. Adding payment slip verification columns to "Payment" table...');
    await client.query(`
      ALTER TABLE "Payment" 
      ADD COLUMN IF NOT EXISTS "slipImage" TEXT,
      ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'VERIFIED',
      ADD COLUMN IF NOT EXISTS "transactionRef" TEXT,
      ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT,
      ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
    `);

    // Ensure any existing payments have status 'VERIFIED'
    await client.query(`
      UPDATE "Payment" 
      SET "status" = 'VERIFIED' 
      WHERE "status" IS NULL;
    `);

    console.log('2. Verifying Payment table columns...');
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Payment'
      ORDER BY ordinal_position;
    `);
    console.table(res.rows);
    console.log('Migration completed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
