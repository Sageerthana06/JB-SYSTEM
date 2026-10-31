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
    console.log('=== Adding Material Photo & Material Details columns to CustomerFabric ===');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE "CustomerFabric"
        ADD COLUMN IF NOT EXISTS "photoUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "materialCategory" TEXT DEFAULT 'Fabric',
        ADD COLUMN IF NOT EXISTS "materialName" TEXT,
        ADD COLUMN IF NOT EXISTS "conditionOnReceipt" TEXT DEFAULT 'Good',
        ADD COLUMN IF NOT EXISTS "notes" TEXT;
    `);

    await client.query('COMMIT');
    console.log('✓ Successfully added photoUrl, materialCategory, materialName, conditionOnReceipt, notes columns.');

    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'CustomerFabric' 
        AND column_name IN ('photoUrl', 'materialCategory', 'materialName', 'conditionOnReceipt', 'notes');
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
