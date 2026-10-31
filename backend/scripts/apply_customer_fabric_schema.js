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
    console.log('=== Step 1: Beginning transaction for Customer Fabric schema ===');
    await client.query('BEGIN');

    // 1. Create CustomerFabric table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CustomerFabric" (
        "id" SERIAL PRIMARY KEY,
        "code" TEXT NOT NULL UNIQUE,
        "customerId" INTEGER NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT,
        "customerName" TEXT NOT NULL,
        "customerPhone" TEXT,
        "orderId" INTEGER NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT,
        "orderNumber" TEXT NOT NULL,
        "fabricType" TEXT NOT NULL,
        "fabricColour" TEXT NOT NULL,
        "fabricDescription" TEXT,
        "receivedQty" DOUBLE PRECISION NOT NULL,
        "availableQty" DOUBLE PRECISION NOT NULL,
        "issuedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "tailorBalanceQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "consumedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "returnedToStoreQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "returnedToCustomerQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "wasteQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "unit" TEXT NOT NULL DEFAULT 'Meters',
        "dateReceived" TIMESTAMP NOT NULL DEFAULT NOW(),
        "conditionNotes" TEXT,
        "branchId" INTEGER REFERENCES "Branch"("id") ON DELETE SET NULL,
        "branchName" TEXT,
        "receivedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "receivedByName" TEXT,
        "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "ck_cf_received_qty" CHECK ("receivedQty" > 0),
        CONSTRAINT "ck_cf_available_qty" CHECK ("availableQty" >= 0),
        CONSTRAINT "ck_cf_tailor_balance" CHECK ("tailorBalanceQty" >= 0),
        CONSTRAINT "ck_cf_consumed_qty" CHECK ("consumedQty" >= 0),
        CONSTRAINT "ck_cf_waste_qty" CHECK ("wasteQty" >= 0),
        CONSTRAINT "ck_cf_returned_store" CHECK ("returnedToStoreQty" >= 0),
        CONSTRAINT "ck_cf_returned_customer" CHECK ("returnedToCustomerQty" >= 0)
      );
    `);
    console.log('✓ Created "CustomerFabric" table with safety constraints.');

    // 2. Indexes for CustomerFabric
    await client.query(`
      CREATE INDEX IF NOT EXISTS "CustomerFabric_customerId_idx" ON "CustomerFabric"("customerId");
      CREATE INDEX IF NOT EXISTS "CustomerFabric_orderId_idx" ON "CustomerFabric"("orderId");
      CREATE INDEX IF NOT EXISTS "CustomerFabric_orderNumber_idx" ON "CustomerFabric"("orderNumber");
      CREATE INDEX IF NOT EXISTS "CustomerFabric_branchId_idx" ON "CustomerFabric"("branchId");
      CREATE INDEX IF NOT EXISTS "CustomerFabric_fabricType_idx" ON "CustomerFabric"("fabricType");
      CREATE INDEX IF NOT EXISTS "CustomerFabric_status_idx" ON "CustomerFabric"("status");
      CREATE INDEX IF NOT EXISTS "CustomerFabric_createdAt_idx" ON "CustomerFabric"("createdAt");
    `);
    console.log('✓ Created indexes for "CustomerFabric".');

    // 3. Create CustomerFabricMovement table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CustomerFabricMovement" (
        "id" SERIAL PRIMARY KEY,
        "customerFabricId" INTEGER NOT NULL REFERENCES "CustomerFabric"("id") ON DELETE CASCADE,
        "movementType" TEXT NOT NULL,
        "quantity" DOUBLE PRECISION NOT NULL,
        "previousAvailableQty" DOUBLE PRECISION NOT NULL,
        "newAvailableQty" DOUBLE PRECISION NOT NULL,
        "previousTailorQty" DOUBLE PRECISION NOT NULL,
        "newTailorQty" DOUBLE PRECISION NOT NULL,
        "tailorId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "tailorName" TEXT,
        "notes" TEXT,
        "branchId" INTEGER REFERENCES "Branch"("id") ON DELETE SET NULL,
        "performedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "performedByName" TEXT,
        "performedByRole" TEXT,
        "idempotencyKey" TEXT UNIQUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "ck_cfm_qty" CHECK ("quantity" > 0)
      );
    `);
    console.log('✓ Created "CustomerFabricMovement" table.');

    // 4. Indexes for CustomerFabricMovement
    await client.query(`
      CREATE INDEX IF NOT EXISTS "CustomerFabricMovement_cfId_idx" ON "CustomerFabricMovement"("customerFabricId");
      CREATE INDEX IF NOT EXISTS "CustomerFabricMovement_type_idx" ON "CustomerFabricMovement"("movementType");
      CREATE INDEX IF NOT EXISTS "CustomerFabricMovement_tailorId_idx" ON "CustomerFabricMovement"("tailorId");
      CREATE INDEX IF NOT EXISTS "CustomerFabricMovement_createdAt_idx" ON "CustomerFabricMovement"("createdAt");
    `);
    console.log('✓ Created indexes for "CustomerFabricMovement".');

    await client.query('COMMIT');
    console.log('=== Transaction committed successfully! ===');

    // Verification
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('CustomerFabric', 'CustomerFabricMovement');
    `);
    console.log('Verified created tables:', res.rows.map(r => r.table_name));

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
