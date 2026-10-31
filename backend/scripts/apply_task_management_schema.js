require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000
});

async function applyTaskSchema() {
  console.log('=== APPLYING ORDER TASK MANAGEMENT SCHEMA ===\n');

  try {
    // 1. Create OrderTask Table
    console.log('1. Creating "OrderTask" table if not exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "OrderTask" (
        "id" SERIAL PRIMARY KEY,
        "orderId" INTEGER NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
        "taskType" VARCHAR(50) NOT NULL,
        "taskName" VARCHAR(100) NOT NULL,
        "assignedTailorId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "assignedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "assignedBy" VARCHAR(100),
        "assignedAt" TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "status" VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
        "startedAt" TIMESTAMP(3) WITH TIME ZONE,
        "completedAt" TIMESTAMP(3) WITH TIME ZONE,
        "notes" TEXT,
        "sequence" INTEGER DEFAULT 1,
        "branchId" INTEGER REFERENCES "Branch"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ "OrderTask" table ready.');

    // 2. Indexes
    console.log('2. Creating indexes for "OrderTask"...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "idx_ordertask_orderid" ON "OrderTask"("orderId");
      CREATE INDEX IF NOT EXISTS "idx_ordertask_tailorid" ON "OrderTask"("assignedTailorId");
      CREATE INDEX IF NOT EXISTS "idx_ordertask_status" ON "OrderTask"("status");
      CREATE INDEX IF NOT EXISTS "idx_ordertask_branchid" ON "OrderTask"("branchId");
    `);
    console.log('✓ Indexes created.');

    console.log('\n=== SCHEMA APPLICATION COMPLETE ===\n');
  } catch (error) {
    console.error('Error applying task schema:', error.message);
  } finally {
    await pool.end();
  }
}

applyTaskSchema();
