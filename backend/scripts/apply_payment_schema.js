require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function applyPaymentSchema() {
  console.log('--- SAFELY APPLYING PAYMENT SCHEMA TO POSTGRESQL ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add advanceRequired and paymentStatus to Order table if not exists
    await client.query(`
      ALTER TABLE "Order" 
        ADD COLUMN IF NOT EXISTS "advanceRequired" DOUBLE PRECISION DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'Unpaid';
    `);
    console.log('[OK] Added advanceRequired and paymentStatus to Order table.');

    // 2. Create Payment table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Payment" (
        "id" SERIAL PRIMARY KEY,
        "orderId" INTEGER NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
        "amount" DOUBLE PRECISION NOT NULL,
        "paymentMethod" TEXT DEFAULT 'Cash',
        "notes" TEXT,
        "recordedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[OK] Payment table ensured.');

    // 3. Create index on orderId in Payment table
    await client.query(`
      CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");
    `);

    // 4. Backfill paymentStatus for existing orders safely
    await client.query(`
      UPDATE "Order"
      SET "paymentStatus" = CASE
        WHEN "totalAmount" > 0 AND "balanceAmount" <= 0 THEN 'Paid'
        WHEN "advancePayment" > 0 THEN 'Partially Paid'
        ELSE 'Unpaid'
      END
      WHERE "paymentStatus" IS NULL OR "paymentStatus" = 'Unpaid';
    `);
    console.log('[OK] Backfilled paymentStatus for existing orders.');

    // 5. Backfill initial Payment records for orders with advancePayment > 0 that have no payments yet
    const ordersWithAdvance = await client.query(`
      SELECT o.id, o."advancePayment", o."createdAt"
      FROM "Order" o
      WHERE o."advancePayment" > 0
        AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."orderId" = o.id);
    `);

    for (const ord of ordersWithAdvance.rows) {
      await client.query(`
        INSERT INTO "Payment" ("orderId", "amount", "paymentMethod", "notes", "recordedBy", "createdAt", "updatedAt")
        VALUES ($1, $2, 'Initial Advance', 'Advance recorded at order creation', 'System Initializer', $3, $3);
      `, [ord.id, ord.advancePayment, ord.createdAt]);
    }
    console.log(`[OK] Created initial Payment records for ${ordersWithAdvance.rows.length} existing orders with advance payments.`);

    // 6. Verify row count to ensure existing orders remain unchanged
    const countRes = await client.query(`SELECT count(*) FROM "Order";`);
    const paymentCount = await client.query(`SELECT count(*) FROM "Payment";`);
    console.log(`[VERIFIED] Total orders preserved: ${countRes.rows[0].count}`);
    console.log(`[VERIFIED] Total payments recorded: ${paymentCount.rows[0].count}`);

    await client.query('COMMIT');
    console.log('--- PAYMENT SCHEMA APPLIED SUCCESSFULLY ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error applying payment schema:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyPaymentSchema();
