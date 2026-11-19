require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false }
});

const ADDITIONAL_CATEGORIES = [
  { code: 'EXP_WATER', name: 'Water Utility Bill', type: 'EXPENSE', desc: 'Monthly water supply and sewage bills' },
  { code: 'EXP_INTERNET', name: 'Internet & Fiber Bill', type: 'EXPENSE', desc: 'Broadband internet, fiber connection, and WiFi bills' },
  { code: 'EXP_TELEPHONE', name: 'Telephone & Mobile Bill', type: 'EXPENSE', desc: 'Landline and official company mobile bills' },
  { code: 'EXP_SECURITY', name: 'Security & Surveillance Charges', type: 'EXPENSE', desc: 'Security guard services and alarm monitoring' },
  { code: 'EXP_CLEANING', name: 'Cleaning & Janitorial Charges', type: 'EXPENSE', desc: 'Showroom and workshop regular cleaning services' },
  { code: 'EXP_TRANSPORT', name: 'Transport & Travel Expenses', type: 'EXPENSE', desc: 'Fuel, delivery transport, taxi, and staff official travel' },
  { code: 'EXP_FOOD', name: 'Food & Refreshments', type: 'EXPENSE', desc: 'Staff tea, refreshments, and working meals' },
  { code: 'EXP_EMERGENCY', name: 'Emergency Expenses', type: 'EXPENSE', desc: 'Unforeseen and urgent operational expenses' },
  { code: 'EXP_OFFICE', name: 'Office & Stationery Expenses', type: 'EXPENSE', desc: 'Printing, paper, office supplies, and consumables' },
  { code: 'EXP_WELFARE', name: 'Staff Welfare & Support', type: 'EXPENSE', desc: 'Employee medical support, welfare, and assistance' },
  { code: 'EXP_REPAIRS', name: 'Repairs & Fixes', type: 'EXPENSE', desc: 'Plumbing, electrical repairs, and fixture fixes' },
  { code: 'EXP_MISC', name: 'Miscellaneous Expenses', type: 'EXPENSE', desc: 'Other extra cash and operating expenses' }
];

async function applyMonthlyBillsSchema() {
  console.log('===============================================================');
  console.log('   APPLYING MONTHLY BILLS & EXPENSE MANAGEMENT SCHEMA          ');
  console.log('===============================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('[1/4] Transaction started.');

    // 1. Create MonthlyBill table if not exists
    console.log('[2/4] Creating MonthlyBill table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "MonthlyBill" (
        "id" SERIAL PRIMARY KEY,
        "billNumber" VARCHAR(60) NOT NULL UNIQUE,
        "billName" VARCHAR(150) NOT NULL,
        "category" VARCHAR(60) NOT NULL,
        "branchId" INTEGER NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
        "providerName" VARCHAR(150),
        "expectedAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "actualAmount" NUMERIC(12, 2),
        "paidAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "billReference" VARCHAR(100),
        "billingMonth" VARCHAR(10) NOT NULL,
        "billDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dueDate" TIMESTAMPTZ NOT NULL,
        "status" VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
        "paymentMethod" VARCHAR(30),
        "paymentAccountId" INTEGER REFERENCES "FinancialAccount"("id") ON DELETE SET NULL,
        "paymentDate" TIMESTAMPTZ,
        "receiptImage" TEXT,
        "notes" TEXT,
        "createdById" INTEGER NOT NULL,
        "createdByName" VARCHAR(150) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create unique constraint to prevent duplicate bill for same branch, category and billingMonth
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'MonthlyBill_branch_cat_month_key'
        ) THEN
          ALTER TABLE "MonthlyBill"
          ADD CONSTRAINT "MonthlyBill_branch_cat_month_key"
          UNIQUE ("branchId", "category", "billingMonth");
        END IF;
      END $$;
    `);

    // Indexes for fast lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS "MonthlyBill_branchId_idx" ON "MonthlyBill"("branchId");
      CREATE INDEX IF NOT EXISTS "MonthlyBill_billingMonth_idx" ON "MonthlyBill"("billingMonth");
      CREATE INDEX IF NOT EXISTS "MonthlyBill_status_idx" ON "MonthlyBill"("status");
      CREATE INDEX IF NOT EXISTS "MonthlyBill_dueDate_idx" ON "MonthlyBill"("dueDate");
    `);

    // 2. Insert additional standard categories
    console.log('[3/4] Ensuring additional expense categories in AccountingCategory...');
    for (const cat of ADDITIONAL_CATEGORIES) {
      await client.query(`
        INSERT INTO "AccountingCategory" ("code", "name", "categoryType", "description", "isSystem", "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("code") DO UPDATE
        SET "name" = EXCLUDED."name",
            "description" = EXCLUDED."description",
            "isActive" = true,
            "updatedAt" = CURRENT_TIMESTAMP;
      `, [cat.code, cat.name, cat.type, cat.desc]);
    }

    await client.query('COMMIT');
    console.log('[4/4] Transaction committed successfully!\n');

    // Verification
    const countRes = await client.query(`SELECT count(*) FROM "MonthlyBill";`);
    const catCountRes = await client.query(`SELECT count(*) FROM "AccountingCategory";`);
    console.log('✅ MonthlyBill table verified: ' + countRes.rows[0].count + ' rows.');
    console.log('✅ AccountingCategory count: ' + catCountRes.rows[0].count + ' categories.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMonthlyBillsSchema().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});

