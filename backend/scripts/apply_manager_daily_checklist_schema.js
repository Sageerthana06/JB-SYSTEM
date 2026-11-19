// backend/scripts/apply_manager_daily_checklist_schema.js
const { pool } = require('../src/prisma');

async function applyManagerDailyChecklistSchema() {
  console.log('====================================================');
  console.log('🛠️ APPLYING MANAGER DAILY CHECKLIST SCHEMA MIGRATION');
  console.log('====================================================');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create ManagerDailyChecklist Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ManagerDailyChecklist" (
        "id" SERIAL PRIMARY KEY,
        "branchId" INTEGER NOT NULL REFERENCES "Branch"("id") ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "checklistItemId" VARCHAR(50) NOT NULL,
        "businessDate" VARCHAR(10) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "completedByUserId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "completedByName" VARCHAR(120),
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "notes" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_manager_daily_checklist" UNIQUE ("branchId", "userId", "checklistItemId", "businessDate")
      );
    `);
    console.log('✓ Created "ManagerDailyChecklist" table with unique constraint.');

    // 2. Create Indexes for ManagerDailyChecklist
    await client.query(`
      CREATE INDEX IF NOT EXISTS "ManagerDailyChecklist_branchId_businessDate_idx" 
        ON "ManagerDailyChecklist"("branchId", "businessDate");
      CREATE INDEX IF NOT EXISTS "ManagerDailyChecklist_userId_businessDate_idx" 
        ON "ManagerDailyChecklist"("userId", "businessDate");
      CREATE INDEX IF NOT EXISTS "ManagerDailyChecklist_businessDate_idx" 
        ON "ManagerDailyChecklist"("businessDate");
      CREATE INDEX IF NOT EXISTS "ManagerDailyChecklist_status_idx" 
        ON "ManagerDailyChecklist"("status");
    `);
    console.log('✓ Created indexes for "ManagerDailyChecklist".');

    // 3. Create ManagerChecklistAuditLog Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ManagerChecklistAuditLog" (
        "id" SERIAL PRIMARY KEY,
        "checklistRecordId" INTEGER REFERENCES "ManagerDailyChecklist"("id") ON DELETE SET NULL,
        "branchId" INTEGER NOT NULL REFERENCES "Branch"("id") ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "checklistItemId" VARCHAR(50) NOT NULL,
        "businessDate" VARCHAR(10) NOT NULL,
        "action" VARCHAR(30) NOT NULL,
        "performedByUserId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "performedByName" VARCHAR(120) NOT NULL,
        "notes" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ Created "ManagerChecklistAuditLog" table.');

    // 4. Create Indexes for ManagerChecklistAuditLog
    await client.query(`
      CREATE INDEX IF NOT EXISTS "ManagerChecklistAuditLog_branchId_businessDate_idx" 
        ON "ManagerChecklistAuditLog"("branchId", "businessDate");
      CREATE INDEX IF NOT EXISTS "ManagerChecklistAuditLog_businessDate_idx" 
        ON "ManagerChecklistAuditLog"("businessDate");
      CREATE INDEX IF NOT EXISTS "ManagerChecklistAuditLog_createdAt_idx" 
        ON "ManagerChecklistAuditLog"("createdAt");
    `);
    console.log('✓ Created indexes for "ManagerChecklistAuditLog".');

    await client.query('COMMIT');
    console.log('🎉 Manager Daily Checklist migration committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  applyManagerDailyChecklistSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { applyManagerDailyChecklistSchema };

