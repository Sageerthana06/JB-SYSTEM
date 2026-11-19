require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false }
});

async function applySchema() {
  console.log('===============================================================');
  console.log('   APPLYING SUPPLIER PAYABLES & BUSINESS LOANS SCHEMA          ');
  console.log('===============================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('[1/5] Transaction started.');

    // 1. Create SupplierPayable table
    console.log('[2/5] Creating SupplierPayable table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "SupplierPayable" (
        "id" SERIAL PRIMARY KEY,
        "invoiceNumber" VARCHAR(80) NOT NULL UNIQUE,
        "supplierId" INTEGER NOT NULL REFERENCES "Supplier"("id") ON DELETE RESTRICT,
        "purchaseDescription" TEXT NOT NULL,
        "branchId" INTEGER NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
        "totalAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "paidAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "outstandingAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "invoiceDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dueDate" TIMESTAMPTZ,
        "paymentStatus" VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
        "receiptImage" TEXT,
        "notes" TEXT,
        "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "createdByName" VARCHAR(150) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "SupplierPayable_supplierId_idx" ON "SupplierPayable"("supplierId");
      CREATE INDEX IF NOT EXISTS "SupplierPayable_branchId_idx" ON "SupplierPayable"("branchId");
      CREATE INDEX IF NOT EXISTS "SupplierPayable_paymentStatus_idx" ON "SupplierPayable"("paymentStatus");
      CREATE INDEX IF NOT EXISTS "SupplierPayable_dueDate_idx" ON "SupplierPayable"("dueDate");
      CREATE INDEX IF NOT EXISTS "SupplierPayable_invoiceDate_idx" ON "SupplierPayable"("invoiceDate");
    `);

    // 2. Create SupplierPaymentHistory table
    console.log('[3/5] Creating SupplierPaymentHistory table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "SupplierPaymentHistory" (
        "id" SERIAL PRIMARY KEY,
        "payableId" INTEGER NOT NULL REFERENCES "SupplierPayable"("id") ON DELETE CASCADE,
        "paymentNumber" VARCHAR(80) NOT NULL UNIQUE,
        "amount" NUMERIC(12, 2) NOT NULL,
        "paymentDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "paymentMethod" VARCHAR(30) NOT NULL DEFAULT 'CASH',
        "accountId" INTEGER REFERENCES "FinancialAccount"("id") ON DELETE SET NULL,
        "paidBy" VARCHAR(150) NOT NULL,
        "referenceNo" VARCHAR(100),
        "receiptImage" TEXT,
        "notes" TEXT,
        "transactionId" INTEGER REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL,
        "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "SupplierPaymentHistory_payableId_idx" ON "SupplierPaymentHistory"("payableId");
      CREATE INDEX IF NOT EXISTS "SupplierPaymentHistory_paymentDate_idx" ON "SupplierPaymentHistory"("paymentDate");
      CREATE INDEX IF NOT EXISTS "SupplierPaymentHistory_accountId_idx" ON "SupplierPaymentHistory"("accountId");
    `);

    // 3. Create BusinessLoan table
    console.log('[4/5] Creating BusinessLoan table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "BusinessLoan" (
        "id" SERIAL PRIMARY KEY,
        "loanNumber" VARCHAR(80) NOT NULL UNIQUE,
        "loanType" VARCHAR(40) NOT NULL DEFAULT 'BANK_LOAN',
        "providerName" VARCHAR(200) NOT NULL,
        "branchId" INTEGER REFERENCES "Branch"("id") ON DELETE SET NULL,
        "originalPrincipal" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "outstandingPrincipal" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "interestRate" NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
        "monthlyInstalment" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "disbursementDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "nextPaymentDate" TIMESTAMPTZ,
        "maturityDate" TIMESTAMPTZ,
        "depositAccountId" INTEGER REFERENCES "FinancialAccount"("id") ON DELETE SET NULL,
        "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        "notes" TEXT,
        "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "createdByName" VARCHAR(150) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "BusinessLoan_branchId_idx" ON "BusinessLoan"("branchId");
      CREATE INDEX IF NOT EXISTS "BusinessLoan_status_idx" ON "BusinessLoan"("status");
      CREATE INDEX IF NOT EXISTS "BusinessLoan_nextPaymentDate_idx" ON "BusinessLoan"("nextPaymentDate");
    `);

    // 4. Create LoanRepaymentHistory table
    console.log('[5/5] Creating LoanRepaymentHistory table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "LoanRepaymentHistory" (
        "id" SERIAL PRIMARY KEY,
        "loanId" INTEGER NOT NULL REFERENCES "BusinessLoan"("id") ON DELETE CASCADE,
        "repaymentNumber" VARCHAR(80) NOT NULL UNIQUE,
        "paymentDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "principalAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "interestAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "totalPaid" NUMERIC(12, 2) NOT NULL,
        "paymentMethod" VARCHAR(30) NOT NULL DEFAULT 'BANK_TRANSFER',
        "paidFromAccountId" INTEGER REFERENCES "FinancialAccount"("id") ON DELETE SET NULL,
        "referenceNo" VARCHAR(100),
        "receiptImage" TEXT,
        "notes" TEXT,
        "transactionId" INTEGER REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL,
        "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "createdByName" VARCHAR(150) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "LoanRepaymentHistory_loanId_idx" ON "LoanRepaymentHistory"("loanId");
      CREATE INDEX IF NOT EXISTS "LoanRepaymentHistory_paymentDate_idx" ON "LoanRepaymentHistory"("paymentDate");
      CREATE INDEX IF NOT EXISTS "LoanRepaymentHistory_paidFromAccountId_idx" ON "LoanRepaymentHistory"("paidFromAccountId");
    `);

    await client.query('COMMIT');
    console.log('\n✓ Successfully applied SupplierPayable, SupplierPaymentHistory, BusinessLoan, and LoanRepaymentHistory tables to PostgreSQL.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed. Transaction rolled back:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applySchema().catch(console.error);

