require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false }
});

const DEFAULT_CATEGORIES = [
  { code: 'INC_ORDER_SALES', name: 'Order Sales Revenue', type: 'INCOME', desc: 'Customer garment orders and custom tailoring sales' },
  { code: 'INC_ALTERATION', name: 'Alteration & Fitting Revenue', type: 'INCOME', desc: 'Garment alteration, fitting, and adjustment charges' },
  { code: 'INC_OTHER', name: 'Other Operating Income', type: 'INCOME', desc: 'Miscellaneous operating income and customer service fees' },
  { code: 'EXP_FABRIC_PURCHASE', name: 'Fabric & Sub-Materials Purchases', type: 'EXPENSE', desc: 'Raw fabrics, thread spools, buttons, zips, and inventory purchases' },
  { code: 'EXP_TAILOR_WAGE', name: 'Tailor & Craftsmen Wages', type: 'EXPENSE', desc: 'Cutting, stitching, and embroidery tailor piecework allocations' },
  { code: 'EXP_STAFF_SALARY', name: 'Staff & Management Salaries', type: 'EXPENSE', desc: 'Monthly salaries for managers, cashiers, and non-craftsmen staff' },
  { code: 'EXP_RENT', name: 'Showroom & Workshop Rent', type: 'EXPENSE', desc: 'Premises rent for main branch and Bella Design showroom' },
  { code: 'EXP_ELECTRICITY', name: 'Electricity & Water Utilities', type: 'EXPENSE', desc: 'Utility bills, electricity for sewing machines and showroom lighting' },
  { code: 'EXP_MAINTENANCE', name: 'Equipment & Machine Maintenance', type: 'EXPENSE', desc: 'Sewing machine servicing, cutting tools, and workshop maintenance' },
  { code: 'EXP_MARKETING', name: 'Marketing & Advertising', type: 'EXPENSE', desc: 'Digital marketing, social media promotions, and branding' },
  { code: 'EXP_PACKAGING', name: 'Packaging & Delivery', type: 'EXPENSE', desc: 'Garment bags, luxury boxes, tags, and customer parcel delivery' },
  { code: 'EXP_BANK_CHARGES', name: 'Bank & POS Card Charges', type: 'EXPENSE', desc: 'Bank account fees, card merchant fees, and transaction charges' },
  { code: 'EXP_GENERAL', name: 'General & Administrative Overhead', type: 'EXPENSE', desc: 'Office supplies, cleaning, refreshments, and miscellaneous expenses' },
  { code: 'TRF_INTERNAL', name: 'Internal Account Transfer', type: 'TRANSFER', desc: 'Movement between cash drawer and bank account' },
  { code: 'TRF_BRANCH', name: 'Inter-Branch Transfer', type: 'TRANSFER', desc: 'Funds transferred between JB Group branches' }
];

async function applyMigration() {
  console.log('===============================================================');
  console.log('   APPLYING PHASE 2 FINANCIAL ACCOUNTING SCHEMA MIGRATION     ');
  console.log('===============================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('[1/4] Transaction started.');

    // 1. FinancialAccount
    console.log('[2/4] Creating 7 financial tables if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "FinancialAccount" (
        "id" SERIAL PRIMARY KEY,
        "branchId" INTEGER REFERENCES "Branch"("id") ON DELETE SET NULL,
        "accountType" VARCHAR(30) NOT NULL,
        "accountName" VARCHAR(150) NOT NULL,
        "accountNumber" VARCHAR(100),
        "bankName" VARCHAR(100),
        "bankBranch" VARCHAR(100),
        "currency" VARCHAR(10) NOT NULL DEFAULT 'LKR',
        "openingBalance" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "currentBalance" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. AccountingCategory
    await client.query(`
      CREATE TABLE IF NOT EXISTS "AccountingCategory" (
        "id" SERIAL PRIMARY KEY,
        "categoryType" VARCHAR(30) NOT NULL,
        "code" VARCHAR(60) NOT NULL UNIQUE,
        "name" VARCHAR(150) NOT NULL,
        "description" TEXT,
        "parentCategoryId" INTEGER REFERENCES "AccountingCategory"("id") ON DELETE SET NULL,
        "isSystem" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. FinancialTransaction
    await client.query(`
      CREATE TABLE IF NOT EXISTS "FinancialTransaction" (
        "id" SERIAL PRIMARY KEY,
        "transactionNumber" VARCHAR(60) NOT NULL UNIQUE,
        "transactionDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "branchId" INTEGER NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
        "type" VARCHAR(30) NOT NULL,
        "categoryId" INTEGER NOT NULL REFERENCES "AccountingCategory"("id") ON DELETE RESTRICT,
        "accountId" INTEGER NOT NULL REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT,
        "toAccountId" INTEGER REFERENCES "FinancialAccount"("id") ON DELETE SET NULL,
        "amount" NUMERIC(12, 2) NOT NULL,
        "paymentMethod" VARCHAR(30) NOT NULL DEFAULT 'CASH',
        "referenceNo" VARCHAR(100),
        "description" TEXT,
        "notes" TEXT,
        "receiptImage" VARCHAR(255),
        "approvalStatus" VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
        "approvedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "approvedByName" VARCHAR(150),
        "approvedAt" TIMESTAMPTZ,
        "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "createdByName" VARCHAR(150) NOT NULL,
        "isReversed" BOOLEAN NOT NULL DEFAULT false,
        "reversalOfId" INTEGER,
        "reversalReason" TEXT,
        "sourceModule" VARCHAR(50),
        "sourceRecordId" INTEGER,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. EmployeeSalary
    await client.query(`
      CREATE TABLE IF NOT EXISTS "EmployeeSalary" (
        "id" SERIAL PRIMARY KEY,
        "payrollNumber" VARCHAR(60) NOT NULL UNIQUE,
        "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
        "userId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "branchId" INTEGER NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
        "month" VARCHAR(10) NOT NULL,
        "basicSalary" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "allowances" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "overtimeAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "grossSalary" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "advanceDeductions" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "epfDeduction" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "otherDeductions" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "netSalary" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        "paymentDate" TIMESTAMPTZ,
        "paidFromAccountId" INTEGER REFERENCES "FinancialAccount"("id") ON DELETE SET NULL,
        "paymentMethod" VARCHAR(30) DEFAULT 'CASH',
        "approvedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "paidById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "notes" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EmployeeSalary_employeeId_month_unique" UNIQUE ("employeeId", "month")
      );
    `);

    // 5. SalaryAdvance
    await client.query(`
      CREATE TABLE IF NOT EXISTS "SalaryAdvance" (
        "id" SERIAL PRIMARY KEY,
        "advanceNumber" VARCHAR(60) NOT NULL UNIQUE,
        "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
        "userId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "branchId" INTEGER NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
        "amount" NUMERIC(12, 2) NOT NULL,
        "advanceDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "reason" TEXT,
        "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        "disbursedFromAccountId" INTEGER REFERENCES "FinancialAccount"("id") ON DELETE SET NULL,
        "disbursedAt" TIMESTAMPTZ,
        "approvedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "deductedInSalaryId" INTEGER REFERENCES "EmployeeSalary"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. BankReconciliation
    await client.query(`
      CREATE TABLE IF NOT EXISTS "BankReconciliation" (
        "id" SERIAL PRIMARY KEY,
        "accountId" INTEGER NOT NULL REFERENCES "FinancialAccount"("id") ON DELETE CASCADE,
        "statementDate" TIMESTAMPTZ NOT NULL,
        "statementBalance" NUMERIC(12, 2) NOT NULL,
        "ledgerBalance" NUMERIC(12, 2) NOT NULL,
        "difference" NUMERIC(12, 2) NOT NULL,
        "status" VARCHAR(30) NOT NULL DEFAULT 'BALANCED',
        "notes" TEXT,
        "reconciledById" INTEGER NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. FinancialAuditLog
    await client.query(`
      CREATE TABLE IF NOT EXISTS "FinancialAuditLog" (
        "id" SERIAL PRIMARY KEY,
        "action" VARCHAR(60) NOT NULL,
        "entityType" VARCHAR(30) NOT NULL,
        "entityId" INTEGER NOT NULL,
        "amount" NUMERIC(12, 2),
        "branchId" INTEGER,
        "performedById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "performedByName" VARCHAR(150) NOT NULL,
        "performedByRole" VARCHAR(50) NOT NULL,
        "previousState" JSONB,
        "newState" JSONB,
        "ipAddress" VARCHAR(50),
        "reason" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Indexes & Anti-Duplication Constraints
    console.log('[3/4] Creating performance indexes and anti-duplication unique constraints...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS "FinancialAccount_branchId_idx" ON "FinancialAccount"("branchId");
      CREATE INDEX IF NOT EXISTS "FinancialAccount_accountType_idx" ON "FinancialAccount"("accountType");
      CREATE INDEX IF NOT EXISTS "FinancialAccount_status_idx" ON "FinancialAccount"("status");

      CREATE INDEX IF NOT EXISTS "AccountingCategory_categoryType_idx" ON "AccountingCategory"("categoryType");
      CREATE INDEX IF NOT EXISTS "AccountingCategory_isActive_idx" ON "AccountingCategory"("isActive");

      CREATE UNIQUE INDEX IF NOT EXISTS "FinancialTransaction_source_unique_idx"
        ON "FinancialTransaction"("sourceModule", "sourceRecordId")
        WHERE "sourceModule" IS NOT NULL AND "sourceRecordId" IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS "FinancialTransaction_branch_date_idx" ON "FinancialTransaction"("branchId", "transactionDate");
      CREATE INDEX IF NOT EXISTS "FinancialTransaction_categoryId_idx" ON "FinancialTransaction"("categoryId");
      CREATE INDEX IF NOT EXISTS "FinancialTransaction_accountId_idx" ON "FinancialTransaction"("accountId");
      CREATE INDEX IF NOT EXISTS "FinancialTransaction_type_idx" ON "FinancialTransaction"("type");
      CREATE INDEX IF NOT EXISTS "FinancialTransaction_approvalStatus_idx" ON "FinancialTransaction"("approvalStatus");

      CREATE INDEX IF NOT EXISTS "EmployeeSalary_branch_month_idx" ON "EmployeeSalary"("branchId", "month");
      CREATE INDEX IF NOT EXISTS "EmployeeSalary_status_idx" ON "EmployeeSalary"("status");

      CREATE INDEX IF NOT EXISTS "SalaryAdvance_employeeId_idx" ON "SalaryAdvance"("employeeId");
      CREATE INDEX IF NOT EXISTS "SalaryAdvance_branchId_idx" ON "SalaryAdvance"("branchId");
      CREATE INDEX IF NOT EXISTS "SalaryAdvance_status_idx" ON "SalaryAdvance"("status");

      CREATE INDEX IF NOT EXISTS "BankReconciliation_accountId_idx" ON "BankReconciliation"("accountId");
      CREATE INDEX IF NOT EXISTS "BankReconciliation_statementDate_idx" ON "BankReconciliation"("statementDate");

      CREATE INDEX IF NOT EXISTS "FinancialAuditLog_entity_idx" ON "FinancialAuditLog"("entityType", "entityId");
      CREATE INDEX IF NOT EXISTS "FinancialAuditLog_performedById_idx" ON "FinancialAuditLog"("performedById");
      CREATE INDEX IF NOT EXISTS "FinancialAuditLog_branchId_idx" ON "FinancialAuditLog"("branchId");
      CREATE INDEX IF NOT EXISTS "FinancialAuditLog_createdAt_idx" ON "FinancialAuditLog"("createdAt");
    `);

    // Seed default system accounting categories safely (no fake data)
    console.log('[4/4] Seeding default system accounting categories if not present...');
    for (const cat of DEFAULT_CATEGORIES) {
      await client.query(`
        INSERT INTO "AccountingCategory" ("categoryType", "code", "name", "description", "isSystem", "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("code") DO NOTHING;
      `, [cat.type, cat.code, cat.name, cat.desc]);
    }

    await client.query('COMMIT');
    console.log('\n[PASS] Migration committed successfully with 0 errors.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[ROLLBACK] Migration failed and was rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
