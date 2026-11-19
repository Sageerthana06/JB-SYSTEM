// backend/scripts/apply_action_followup_schema.js
const { pool } = require('../src/prisma');

async function applyActionFollowUpSchema() {
  console.log('====================================================');
  console.log('🛠️ APPLYING ACTION FOLLOW-UP SCHEMA MIGRATION');
  console.log('====================================================');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create ActionFollowUp Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ActionFollowUp" (
        "id" SERIAL PRIMARY KEY,
        "orderId" INTEGER NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
        "queueType" VARCHAR(30) NOT NULL,
        "followUpDate" TIMESTAMP WITH TIME ZONE,
        "responsiblePersonId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "responsiblePersonName" VARCHAR(120),
        "assignedBy" VARCHAR(120),
        "assignedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        "outcome" TEXT,
        "nextAction" VARCHAR(255),
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "completedBy" VARCHAR(120),
        "notes" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ Created "ActionFollowUp" table with safety constraints.');

    // 2. Create Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS "ActionFollowUp_orderId_idx" ON "ActionFollowUp"("orderId");
      CREATE INDEX IF NOT EXISTS "ActionFollowUp_queueType_status_idx" ON "ActionFollowUp"("queueType", "status");
      CREATE INDEX IF NOT EXISTS "ActionFollowUp_responsiblePersonId_idx" ON "ActionFollowUp"("responsiblePersonId");
      CREATE INDEX IF NOT EXISTS "ActionFollowUp_followUpDate_idx" ON "ActionFollowUp"("followUpDate");
      CREATE INDEX IF NOT EXISTS "ActionFollowUp_createdAt_idx" ON "ActionFollowUp"("createdAt");
    `);
    console.log('✓ Created indexes for "ActionFollowUp".');

    await client.query('COMMIT');
    console.log('🎉 Action Follow-Up migration committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  applyActionFollowUpSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { applyActionFollowUpSchema };

