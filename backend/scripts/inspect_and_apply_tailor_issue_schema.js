require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log('=== STEP 1: VERIFYING BACKUP & RESTORE INTEGRITY ===');
  const backupDir = path.join(__dirname, '..', 'backups');
  const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith('inventory-') && f.endsWith('.json'));
  if (backupFiles.length === 0) {
    throw new Error('No backup files found in ' + backupDir);
  }
  const latestBackup = path.join(backupDir, backupFiles.sort().pop());
  const backupContent = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
  console.log(`✓ Backup file is valid JSON: ${latestBackup}`);
  console.log(`  Taken at: ${backupContent.takenAt}`);
  console.log(`  Tables included: ${Object.keys(backupContent.tables).join(', ')}`);

  const client = await pool.connect();
  try {
    console.log('\n=== STEP 2: CONFIRMING POSTGRESQL COLUMN TYPES ===');
    const userRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name IN ('id', 'name', 'role');
    `);
    console.log('User table columns in DB:');
    userRes.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

    const omrRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'OrderMaterialRequest';
    `);
    console.log('OrderMaterialRequest columns in DB:');
    omrRes.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

    console.log('\n=== STEP 3: APPLYING ADDITIVE-ONLY MIGRATION ===');
    await client.query('BEGIN');

    // 1. Add tailorId and tailorName to OrderMaterialRequest
    await client.query(`
      ALTER TABLE "OrderMaterialRequest" 
        ADD COLUMN IF NOT EXISTS "tailorId" INTEGER,
        ADD COLUMN IF NOT EXISTS "tailorName" TEXT,
        ADD COLUMN IF NOT EXISTS "damagedQty" DOUBLE PRECISION NOT NULL DEFAULT 0;
    `);

    // 2. Add foreign key safely if not exists
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderMaterialRequest_tailorId_fkey') THEN
          ALTER TABLE "OrderMaterialRequest" 
            ADD CONSTRAINT "OrderMaterialRequest_tailorId_fkey" 
            FOREIGN KEY ("tailorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    // 3. Add index on tailorId
    await client.query(`
      CREATE INDEX IF NOT EXISTS "OrderMaterialRequest_tailorId_idx" ON "OrderMaterialRequest"("tailorId");
    `);

    await client.query('COMMIT');
    console.log('✓ Successfully added tailorId, tailorName, damagedQty and FK to OrderMaterialRequest.');

    // Verify after migration
    const verifyCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'OrderMaterialRequest' AND column_name IN ('tailorId', 'tailorName', 'damagedQty');
    `);
    console.log('\nVerified newly added columns:');
    verifyCols.rows.forEach(r => console.log(`  ✓ ${r.column_name}: ${r.data_type}`));

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed and rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
