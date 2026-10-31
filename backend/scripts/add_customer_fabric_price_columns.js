require('dotenv').config();
const { Pool } = require('pg');

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('sslmode=require') && !connectionString.includes('uselibpqcompat')) {
  connectionString = connectionString.replace('sslmode=require', 'sslmode=verify-full');
}

const pool = new Pool({
  connectionString,
  max: 2,
  connectionTimeoutMillis: 10000
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('=== Adding Customer Purchase Price fields to CustomerFabric ===');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE "CustomerFabric"
        ADD COLUMN IF NOT EXISTS "customerPurchasePrice" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "customerPurchaseCurrency" TEXT DEFAULT 'LKR',
        ADD COLUMN IF NOT EXISTS "customerPurchasePriceType" TEXT DEFAULT 'TOTAL',
        ADD COLUMN IF NOT EXISTS "customerPurchaseReceiptUrl" TEXT;
    `);

    // Ensure non-negative check constraint if price is entered
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_cf_purchase_price') THEN
          ALTER TABLE "CustomerFabric"
            ADD CONSTRAINT "ck_cf_purchase_price" CHECK ("customerPurchasePrice" IS NULL OR "customerPurchasePrice" >= 0);
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('✓ Successfully added customer purchase price columns and check constraint.');

    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'CustomerFabric' 
        AND column_name IN ('customerPurchasePrice', 'customerPurchaseCurrency', 'customerPurchasePriceType', 'customerPurchaseReceiptUrl');
    `);
    console.log('Verified columns in DB:');
    res.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
