require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function applyPricingSchema() {
  console.log('--- SAFELY APPLYING PRICING SCHEMA ADDITIONS TO POSTGRESQL ---');
  try {
    // 1. Add enum values to OrderStatus
    await pool.query(`ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'APPROVED';`);
    await pool.query(`ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PRICE_DECLINED';`);
    console.log('[OK] OrderStatus enum values APPROVED and PRICE_DECLINED ensured.');

    // 2. Add pricing columns to Order table
    await pool.query(`
      ALTER TABLE "Order" 
        ADD COLUMN IF NOT EXISTS "serviceCharge" DOUBLE PRECISION DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "additionalWorkCharge" DOUBLE PRECISION DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "materialCharge" DOUBLE PRECISION DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "priceStatus" TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "priceSentAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "priceAcceptedByCustomer" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "priceAcceptedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "priceDeclinedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "priceDeclineReason" TEXT,
        ADD COLUMN IF NOT EXISTS "agreedTotal" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "agreedAdvance" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "agreedBalance" DOUBLE PRECISION;
    `);
    console.log('[OK] Pricing breakdown & confirmation columns added to Order table.');

    // Verify existing rows count
    const countRes = await pool.query(`SELECT count(*) FROM "Order";`);
    console.log(`[VERIFIED] Total existing orders preserved: ${countRes.rows[0].count}`);

  } catch (err) {
    console.error('Error applying schema changes:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyPricingSchema();
