require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pool, prisma } = require('../src/prisma');

async function main() {
  console.log('===============================================================');
  console.log('   JB GROUP PHASE 2 VERIFICATION & DATA INTEGRITY SUITE       ');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }
  };

  // 1. Verify all pre-existing table counts against pre-migration baseline
  await test('1. Pre-existing 25 table record counts 100% preserved', async () => {
    const baselineFile = path.join(__dirname, '..', 'backups_financial_phase2', 'baseline_table_counts.json');
    assert.strictEqual(fs.existsSync(baselineFile), true, 'Baseline counts file must exist');
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));

    for (const [table, expectedCount] of Object.entries(baseline)) {
      const res = await pool.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      const actualCount = res.rows[0].count;
      assert.strictEqual(actualCount, expectedCount, `Table "${table}" count changed! Expected ${expectedCount}, got ${actualCount}`);
    }
  });

  // 2. Verify exact two active branches (ID 1: JB Group Main, ID 2: Bella Design)
  await test('2. Only the exact 2 authorized branches exist in database', async () => {
    const branches = await pool.query('SELECT id, name, status FROM "Branch" ORDER BY id');
    assert.strictEqual(branches.rows.length, 2, 'Must have exactly 2 branches');
    assert.strictEqual(branches.rows[0].id, 1, 'Branch 1 must have id=1');
    assert.strictEqual(branches.rows[0].name, 'JB Group (Main)', 'Branch 1 name must be JB Group (Main)');
    assert.strictEqual(branches.rows[1].id, 2, 'Branch 2 must have id=2');
    assert.strictEqual(branches.rows[1].name, 'Bella Design', 'Branch 2 name must be Bella Design');
  });

  // 3. Verify user accounts, roles, and branch assignments intact
  await test('3. Existing 21 user accounts, roles, and branch links intact', async () => {
    const users = await pool.query('SELECT role, count(*)::int AS count FROM "User" GROUP BY role ORDER BY role');
    const roleCounts = {};
    users.rows.forEach(r => { roleCounts[r.role] = r.count; });

    // Validate expected roles exist
    const expectedRoles = ['ADMIN', 'CASHIER', 'CUTTING', 'EMBROIDERY', 'MANAGER', 'STAFF', 'SUPER_ADMIN', 'TAILOR'];
    for (const r of expectedRoles) {
      assert.ok(roleCounts[r] > 0, `Role ${r} must have existing users`);
    }

    const totalUsers = await pool.query('SELECT COUNT(*)::int as count FROM "User"');
    assert.strictEqual(totalUsers.rows[0].count, 21, 'User count must remain exactly 21');
  });

  // 4. Verify all 7 new financial tables exist in PostgreSQL
  await test('4. All 7 new financial tables exist in PostgreSQL schema', async () => {
    const newTables = [
      'FinancialAccount',
      'AccountingCategory',
      'FinancialTransaction',
      'EmployeeSalary',
      'SalaryAdvance',
      'BankReconciliation',
      'FinancialAuditLog'
    ];

    for (const table of newTables) {
      const res = await pool.query(`
        SELECT COUNT(*)::int AS count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);
      assert.strictEqual(res.rows[0].count, 1, `Table "${table}" must exist in PostgreSQL`);
    }
  });

  // 5. Verify default system accounting categories were seeded
  await test('5. Default system accounting categories seeded properly', async () => {
    const catCount = await pool.query('SELECT COUNT(*)::int AS count FROM "AccountingCategory" WHERE "isSystem" = true');
    assert.ok(catCount.rows[0].count >= 15, 'At least 15 default system categories must be seeded');

    const salesCat = await pool.query('SELECT code, name, "categoryType" FROM "AccountingCategory" WHERE code = \'INC_ORDER_SALES\'');
    assert.strictEqual(salesCat.rows[0].code, 'INC_ORDER_SALES');
    assert.strictEqual(salesCat.rows[0].categoryType, 'INCOME');
  });

  // 6. Verify zero fake financial accounts or fake transactions
  await test('6. Zero fake accounts, balances, or transactions created', async () => {
    const accounts = await pool.query('SELECT COUNT(*)::int AS count FROM "FinancialAccount"');
    assert.strictEqual(accounts.rows[0].count, 0, 'No financial accounts should be invented');

    const txns = await pool.query('SELECT COUNT(*)::int AS count FROM "FinancialTransaction"');
    assert.strictEqual(txns.rows[0].count, 0, 'No financial transactions should be invented');

    const salaries = await pool.query('SELECT COUNT(*)::int AS count FROM "EmployeeSalary"');
    assert.strictEqual(salaries.rows[0].count, 0, 'No employee salaries should be invented');

    const advances = await pool.query('SELECT COUNT(*)::int AS count FROM "SalaryAdvance"');
    assert.strictEqual(advances.rows[0].count, 0, 'No salary advances should be invented');
  });

  // 7. Verify anti-duplication unique constraint on FinancialTransaction (sourceModule + sourceRecordId)
  await test('7. Anti-duplication unique constraint blocks double posting', async () => {
    // Create a temporary dummy account and category for the test
    const accRes = await pool.query(`
      INSERT INTO "FinancialAccount" ("branchId", "accountType", "accountName", "openingBalance", "currentBalance")
      VALUES (1, 'CASH', '__TEST_DRAWER__', 0, 0)
      RETURNING id;
    `);
    const testAccountId = accRes.rows[0].id;

    const catRes = await pool.query('SELECT id FROM "AccountingCategory" LIMIT 1');
    const testCatId = catRes.rows[0].id;

    const adminUser = await pool.query('SELECT id, name FROM "User" WHERE role = \'SUPER_ADMIN\' LIMIT 1');
    const adminId = adminUser.rows[0].id;
    const adminName = adminUser.rows[0].name;

    // First insertion: should succeed
    const firstInsert = await pool.query(`
      INSERT INTO "FinancialTransaction" (
        "transactionNumber", "branchId", "type", "categoryId", "accountId", "amount", 
        "createdById", "createdByName", "sourceModule", "sourceRecordId"
      ) VALUES (
        '__TEST_TXN_001__', 1, 'INCOME', $1, $2, 500.00, $3, $4, 'ORDER_PAYMENT', 999999
      ) RETURNING id;
    `, [testCatId, testAccountId, adminId, adminName]);

    assert.ok(firstInsert.rows[0].id > 0, 'First transaction insert should succeed');

    // Second insertion with DUPLICATE (sourceModule, sourceRecordId): MUST fail with code 23505
    let blocked = false;
    try {
      await pool.query(`
        INSERT INTO "FinancialTransaction" (
          "transactionNumber", "branchId", "type", "categoryId", "accountId", "amount", 
          "createdById", "createdByName", "sourceModule", "sourceRecordId"
        ) VALUES (
          '__TEST_TXN_002__', 1, 'INCOME', $1, $2, 500.00, $3, $4, 'ORDER_PAYMENT', 999999
        );
      `, [testCatId, testAccountId, adminId, adminName]);
    } catch (err) {
      if (err.code === '23505') {
        blocked = true;
      } else {
        throw err;
      }
    }

    // Clean up test data
    await pool.query('DELETE FROM "FinancialTransaction" WHERE "transactionNumber" IN (\'__TEST_TXN_001__\', \'__TEST_TXN_002__\')');
    await pool.query('DELETE FROM "FinancialAccount" WHERE id = $1', [testAccountId]);

    assert.strictEqual(blocked, true, 'Unique constraint must reject duplicate (sourceModule, sourceRecordId)');
  });

  // 8. Verify Prisma Client models can query the new tables
  await test('8. Prisma Client successfully queries all 7 new models', async () => {
    const cats = await prisma.accountingCategory.findMany({ where: { isSystem: true } });
    assert.ok(cats.length >= 15);

    const accounts = await prisma.financialAccount.findMany();
    assert.strictEqual(accounts.length, 0);

    const txns = await prisma.financialTransaction.findMany();
    assert.strictEqual(txns.length, 0);

    const salaries = await prisma.employeeSalary.findMany();
    assert.strictEqual(salaries.length, 0);

    const advances = await prisma.salaryAdvance.findMany();
    assert.strictEqual(advances.length, 0);

    const recons = await prisma.bankReconciliation.findMany();
    assert.strictEqual(recons.length, 0);

    const audits = await prisma.financialAuditLog.findMany();
    assert.strictEqual(audits.length, 0);
  });

  console.log('\n===============================================================');
  console.log(`   PHASE 2 VERIFICATION SUITE: ${passed} / ${total} TESTS PASSED`);
  console.log('===============================================================\n');

  await pool.end();
  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});

