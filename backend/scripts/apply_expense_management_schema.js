require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false }
});

async function applyExpenseSchema() {
  console.log('===============================================================');
  console.log('   APPLYING DEDICATED EXPENSE MANAGEMENT SYSTEM SCHEMA         ');
  console.log('===============================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('[1/4] Transaction started.');

    // 1. Create BusinessExpense table
    console.log('[2/4] Creating BusinessExpense table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "BusinessExpense" (
        "id" SERIAL PRIMARY KEY,
        "expenseNumber" VARCHAR(60) NOT NULL UNIQUE,
        "title" VARCHAR(200) NOT NULL,
        "category" VARCHAR(50) NOT NULL,
        "branchId" INTEGER NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
        "totalAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "paidAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "pendingAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "dueDate" TIMESTAMPTZ,
        "expenseDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "paymentMethod" VARCHAR(30),
        "paidBy" VARCHAR(150),
        "paidTo" VARCHAR(150),
        "receiptImage" TEXT,
        "description" TEXT,
        "notes" TEXT,
        "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        "approvalStatus" VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
        "approvedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "approvedByName" VARCHAR(150),
        "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "createdByName" VARCHAR(150) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes for BusinessExpense
    await client.query(`
      CREATE INDEX IF NOT EXISTS "BusinessExpense_branchId_idx" ON "BusinessExpense"("branchId");
      CREATE INDEX IF NOT EXISTS "BusinessExpense_category_idx" ON "BusinessExpense"("category");
      CREATE INDEX IF NOT EXISTS "BusinessExpense_status_idx" ON "BusinessExpense"("status");
      CREATE INDEX IF NOT EXISTS "BusinessExpense_dueDate_idx" ON "BusinessExpense"("dueDate");
      CREATE INDEX IF NOT EXISTS "BusinessExpense_expenseDate_idx" ON "BusinessExpense"("expenseDate");
    `);

    // 2. Create ExpensePaymentHistory table
    console.log('[3/4] Creating ExpensePaymentHistory table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ExpensePaymentHistory" (
        "id" SERIAL PRIMARY KEY,
        "expenseId" INTEGER NOT NULL REFERENCES "BusinessExpense"("id") ON DELETE CASCADE,
        "paymentNumber" VARCHAR(60) NOT NULL UNIQUE,
        "amount" NUMERIC(12, 2) NOT NULL,
        "paymentDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "paymentMethod" VARCHAR(30) NOT NULL DEFAULT 'CASH',
        "accountId" INTEGER REFERENCES "FinancialAccount"("id") ON DELETE SET NULL,
        "paidBy" VARCHAR(150) NOT NULL,
        "paidTo" VARCHAR(150),
        "receiptImage" TEXT,
        "notes" TEXT,
        "transactionId" INTEGER REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL,
        "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes for ExpensePaymentHistory
    await client.query(`
      CREATE INDEX IF NOT EXISTS "ExpensePaymentHistory_expenseId_idx" ON "ExpensePaymentHistory"("expenseId");
      CREATE INDEX IF NOT EXISTS "ExpensePaymentHistory_paymentDate_idx" ON "ExpensePaymentHistory"("paymentDate");
    `);

    await client.query('COMMIT');
    console.log('[4/4] Transaction committed successfully.');
    console.log('Dedicated Expense Management Schema applied with 0 data loss.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Schema application failed, rolled back:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyExpenseSchema().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

