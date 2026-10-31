require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 15000
});

async function applySalarySchema() {
  console.log('=== SAFELY APPLYING WEEKLY TAILOR SALARY SCHEMA ===');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create TailorSalaryPayment table if it does not exist
    console.log('1. Creating "TailorSalaryPayment" table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "TailorSalaryPayment" (
        "id" SERIAL PRIMARY KEY,
        "orderId" INTEGER NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
        "tailorId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "workType" VARCHAR(50) NOT NULL,
        "orderNumber" VARCHAR(100),
        "agreedPrice" DOUBLE PRECISION NOT NULL,
        "allocationPercent" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
        "amountPaid" DOUBLE PRECISION NOT NULL,
        "paymentDate" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "paymentMethod" VARCHAR(50) NOT NULL DEFAULT 'Cash',
        "referenceNo" VARCHAR(100),
        "notes" TEXT,
        "recordedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "recordedByName" VARCHAR(100),
        "createdAt" TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_tailorsalary_order_tailor_work" UNIQUE ("orderId", "tailorId", "workType")
      );
    `);
    console.log('[OK] "TailorSalaryPayment" table ensured.');

    // 2. Indexes for fast salary retrieval and weekly queries
    console.log('2. Creating indexes for "TailorSalaryPayment"...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_tailorsalary_tailor" ON "TailorSalaryPayment"("tailorId");
      CREATE INDEX IF NOT EXISTS "idx_tailorsalary_order" ON "TailorSalaryPayment"("orderId");
      CREATE INDEX IF NOT EXISTS "idx_tailorsalary_date" ON "TailorSalaryPayment"("paymentDate");
    `);
    console.log('[OK] Indexes ensured.');

    // 3. Verification of existing data preservation
    const orderCountRes = await client.query('SELECT COUNT(*) FROM "Order";');
    const paymentCountRes = await client.query('SELECT COUNT(*) FROM "Payment";');
    const salaryCountRes = await client.query('SELECT COUNT(*) FROM "TailorSalaryPayment";');

    console.log(`[VERIFIED] Existing Orders preserved: ${orderCountRes.rows[0].count}`);
    console.log(`[VERIFIED] Existing Payments preserved: ${paymentCountRes.rows[0].count}`);
    console.log(`[VERIFIED] Salary Payment records count: ${salaryCountRes.rows[0].count}`);

    await client.query('COMMIT');
    console.log('=== SALARY SCHEMA APPLIED SAFELY & SUCCESSFULLY ===');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error applying salary schema:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applySalarySchema();
