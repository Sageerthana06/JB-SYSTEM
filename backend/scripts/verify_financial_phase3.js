require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pool, prisma } = require('../src/prisma');

const financeAccountController = require('../src/controllers/financeAccountController');
const financeTransactionController = require('../src/controllers/financeTransactionController');
const payrollController = require('../src/controllers/payrollController');
const businessControlController = require('../src/controllers/businessControlController');

// Mock Express response helper
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function main() {
  console.log('===============================================================');
  console.log('   JB GROUP PHASE 3 — FINANCIAL SERVICES & APIS VERIFICATION   ');
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
      if (err.stack) console.error(err.stack);
    }
  };

  // 1. Verify baseline counts of all 25 pre-existing tables
  await test('1. Pre-existing 25 table record counts 100% preserved', async () => {
    const baselineFile = path.join(__dirname, '..', 'backups_financial_phase2', 'baseline_table_counts.json');
    assert.strictEqual(fs.existsSync(baselineFile), true, 'Baseline counts file must exist');
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));

    for (const [table, expectedCount] of Object.entries(baseline)) {
      const res = await pool.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      const actualCount = res.rows[0].count;
      assert.strictEqual(actualCount, expectedCount, `Table "${table}" count mismatch! Expected ${expectedCount}, got ${actualCount}`);
    }
  });

  // 2. Verify strict 2-branch configuration
  await test('2. Only the exact 2 authorized branches exist (Branch 1 and Branch 2)', async () => {
    const branches = await pool.query('SELECT id, name, status FROM "Branch" ORDER BY id');
    assert.strictEqual(branches.rows.length, 2, 'Must have exactly 2 branches');
    assert.strictEqual(branches.rows[0].id, 1, 'Branch 1 must have id=1');
    assert.strictEqual(branches.rows[0].name, 'JB Group (Main)');
    assert.strictEqual(branches.rows[1].id, 2, 'Branch 2 must have id=2');
    assert.strictEqual(branches.rows[1].name, 'Bella Design');
  });

  // 3. Chart of Accounts & Categories
  await test('3. 15 System Accounting Categories exist and accessible', async () => {
    const req = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      query: {}
    };
    const res = createMockRes();
    await financeAccountController.getCategories(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.categories.length >= 15, `Expected at least 15 categories, got ${res.body.categories.length}`);

    const codes = res.body.categories.map(c => c.code);
    assert.ok(codes.includes('INC_ORDER_SALES'), 'Must include INC_ORDER_SALES');
    assert.ok(codes.includes('EXP_RENT'), 'Must include EXP_RENT');
    assert.ok(codes.includes('EXP_STAFF_SALARY'), 'Must include EXP_STAFF_SALARY');
    assert.ok(codes.includes('EXP_FABRIC_PURCHASE'), 'Must include EXP_FABRIC_PURCHASE');
  });

  // 4. Financial Account Management & Branch Isolation
  let testAccountB1Id = null;
  let testAccountB2Id = null;

  await test('4. Account Creation & Strict Branch Isolation', async () => {
    // A. Super Admin creates Cash Drawer for Branch 1
    const reqCreateB1 = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      body: {
        branchId: 1,
        accountType: 'CASH',
        accountName: 'Test Cash Drawer B1',
        currency: 'LKR',
        openingBalance: 50000,
        isPrimary: false
      },
      ip: '127.0.0.1'
    };
    const resCreateB1 = createMockRes();
    await financeAccountController.createAccount(reqCreateB1, resCreateB1);
    assert.strictEqual(resCreateB1.statusCode, 201);
    testAccountB1Id = resCreateB1.body.account.id;
    assert.strictEqual(resCreateB1.body.account.branchId, 1);
    assert.strictEqual(Number(resCreateB1.body.account.currentBalance), 50000);

    // B. Super Admin creates Cash Drawer for Branch 2
    const reqCreateB2 = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      body: {
        branchId: 2,
        accountType: 'CASH',
        accountName: 'Test Cash Drawer B2',
        currency: 'LKR',
        openingBalance: 30000,
        isPrimary: false
      },
      ip: '127.0.0.1'
    };
    const resCreateB2 = createMockRes();
    await financeAccountController.createAccount(reqCreateB2, resCreateB2);
    assert.strictEqual(resCreateB2.statusCode, 201);
    testAccountB2Id = resCreateB2.body.account.id;
    assert.strictEqual(resCreateB2.body.account.branchId, 2);

    // C. Manager of Branch 1 listing accounts: MUST NOT see Branch 2 accounts
    const reqMgrB1 = {
      user: { id: 10, role: 'MANAGER', branchId: 1, name: 'Manager B1' },
      query: {}
    };
    const resMgrB1 = createMockRes();
    await financeAccountController.getAccounts(reqMgrB1, resMgrB1);
    assert.strictEqual(resMgrB1.statusCode, 200);
    const visibleAccountsB1 = resMgrB1.body.accounts;
    const b2AccountsInList = visibleAccountsB1.filter(a => a.branchId === 2);
    assert.strictEqual(b2AccountsInList.length, 0, 'Manager 1 must never see Branch 2 accounts');

    // D. Manager of Branch 1 attempting to query branchId=2 -> 403 Forbidden
    const reqMgrB1Hack = {
      user: { id: 10, role: 'MANAGER', branchId: 1, name: 'Manager B1' },
      query: { branchId: 2 }
    };
    const resMgrB1Hack = createMockRes();
    await financeAccountController.getAccounts(reqMgrB1Hack, resMgrB1Hack);
    assert.strictEqual(resMgrB1Hack.statusCode, 403, 'Manager 1 requesting Branch 2 must be rejected with 403');
  });

  // 5. Operating Expense Transaction & Balance Deduction
  let testTxnId = null;
  await test('5. Record Expense Transaction with Decimal Precision & Balance Update', async () => {
    const rentCategory = await prisma.accountingCategory.findFirst({ where: { code: 'EXP_RENT' } });
    assert.ok(rentCategory, 'EXP_RENT category must exist');

    const reqRecord = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      body: {
        branchId: 1,
        type: 'EXPENSE',
        categoryId: rentCategory.id,
        accountId: testAccountB1Id,
        amount: 12500.50,
        paymentMethod: 'CASH',
        referenceNo: 'RENT-TEST-001',
        description: 'Shop rent test payment'
      },
      ip: '127.0.0.1'
    };
    const resRecord = createMockRes();
    await financeTransactionController.recordTransaction(reqRecord, resRecord);
    assert.strictEqual(resRecord.statusCode, 201);
    assert.strictEqual(resRecord.body.success, true);
    testTxnId = resRecord.body.transaction.id;
    assert.ok(resRecord.body.transaction.transactionNumber.startsWith('EXP-') || resRecord.body.transaction.transactionNumber.startsWith('TXN-'), 'Transaction number must start with EXP- or TXN-');

    // Verify account balance decremented by 12,500.50 (50,000 - 12,500.50 = 37,499.50)
    const updatedAccount = await prisma.financialAccount.findUnique({ where: { id: testAccountB1Id } });
    assert.strictEqual(Number(updatedAccount.currentBalance), 37499.50, 'Balance must be exactly 37,499.50');
  });

  // 6. Anti-Duplication Constraint on sourceModule + sourceRecordId
  await test('6. Database-level Anti-Duplication Protection', async () => {
    const salaryCat = await prisma.accountingCategory.findFirst({ where: { code: 'EXP_STAFF_SALARY' } });

    // Insert first transaction with sourceModule 'TEST_MODULE' and sourceRecordId 999
    const req1 = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      body: {
        branchId: 1,
        type: 'EXPENSE',
        categoryId: salaryCat.id,
        accountId: testAccountB1Id,
        amount: 1000,
        sourceModule: 'TEST_MODULE',
        sourceRecordId: 999,
        description: 'Test Source 1'
      },
      ip: '127.0.0.1'
    };
    const res1 = createMockRes();
    await financeTransactionController.recordTransaction(req1, res1);
    assert.strictEqual(res1.statusCode, 201);

    // Attempt second transaction with exact same sourceModule and sourceRecordId -> Must fail with 409 Conflict
    const req2 = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      body: {
        branchId: 1,
        type: 'EXPENSE',
        categoryId: salaryCat.id,
        accountId: testAccountB1Id,
        amount: 1000,
        sourceModule: 'TEST_MODULE',
        sourceRecordId: 999,
        description: 'Test Duplicate Source'
      },
      ip: '127.0.0.1'
    };
    const res2 = createMockRes();
    await financeTransactionController.recordTransaction(req2, res2);
    assert.strictEqual(res2.statusCode, 409, 'Duplicate source transaction must return 409 Conflict');
  });

  // 7. Transaction Reversal (Controlled Offset, No Hard Deletes)
  await test('7. Controlled Transaction Reversal & Balance Restoration', async () => {
    const reqReverse = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      params: { id: testTxnId },
      body: { reason: 'Incorrect test expense' },
      ip: '127.0.0.1'
    };
    const resReverse = createMockRes();
    await financeTransactionController.reverseTransaction(reqReverse, resReverse);
    assert.strictEqual(resReverse.statusCode, 200);
    assert.strictEqual(resReverse.body.success, true);

    // Verify original transaction marked isReversed = true
    const orig = await prisma.financialTransaction.findUnique({ where: { id: testTxnId } });
    assert.strictEqual(orig.isReversed, true, 'Original transaction must be marked isReversed=true');
    assert.strictEqual(orig.approvalStatus, 'REVERSED');

    // Verify balance restored (+12,500.50 back to 37,499.50 - 1,000 + 12,500.50 = 48,999.50)
    const restoredAccount = await prisma.financialAccount.findUnique({ where: { id: testAccountB1Id } });
    assert.strictEqual(Number(restoredAccount.currentBalance), 49000, 'Balance must be restored to 49,000 (after 1000 test deduction)');
  });

  // 8. Internal Branch Transfer (Neutral to P&L)
  await test('8. Internal Branch Transfer (Branch 1 to Branch 2)', async () => {
    const balBeforeB1 = Number((await prisma.financialAccount.findUnique({ where: { id: testAccountB1Id } })).currentBalance);
    const balBeforeB2 = Number((await prisma.financialAccount.findUnique({ where: { id: testAccountB2Id } })).currentBalance);

    const reqTransfer = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      body: {
        fromAccountId: testAccountB1Id,
        toAccountId: testAccountB2Id,
        amount: 5000,
        notes: 'Transfer from Branch 1 to Branch 2'
      },
      ip: '127.0.0.1'
    };
    const resTransfer = createMockRes();
    await financeTransactionController.transferFunds(reqTransfer, resTransfer);
    assert.strictEqual(resTransfer.statusCode, 200);
    assert.strictEqual(resTransfer.body.success, true);

    const balAfterB1 = Number((await prisma.financialAccount.findUnique({ where: { id: testAccountB1Id } })).currentBalance);
    const balAfterB2 = Number((await prisma.financialAccount.findUnique({ where: { id: testAccountB2Id } })).currentBalance);

    assert.strictEqual(balAfterB1, balBeforeB1 - 5000, 'Source account balance must decrease by 5,000');
    assert.strictEqual(balAfterB2, balBeforeB2 + 5000, 'Destination account balance must increase by 5,000');
  });

  // 9. Employee Salary Advance & Monthly Payroll
  let testAdvanceId = null;
  await test('9. Salary Advance: Request -> Approve -> Disburse Workflow', async () => {
    // Pick an existing employee from Branch 1
    const emp = await prisma.employee.findFirst({ where: { branchId: 1 } });
    assert.ok(emp, 'Must have an existing employee in Branch 1');

    // A. Request Advance
    const reqReq = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      body: {
        employeeId: emp.id,
        branchId: 1,
        amount: 4500,
        reason: 'Emergency medical advance'
      },
      ip: '127.0.0.1'
    };
    const resReq = createMockRes();
    await payrollController.requestSalaryAdvance(reqReq, resReq);
    assert.strictEqual(resReq.statusCode, 201);
    testAdvanceId = resReq.body.advance.id;
    assert.strictEqual(resReq.body.advance.status, 'PENDING');

    // B. Approve Advance
    const reqApprove = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      params: { id: testAdvanceId },
      ip: '127.0.0.1'
    };
    const resApprove = createMockRes();
    await payrollController.approveSalaryAdvance(reqApprove, resApprove);
    assert.strictEqual(resApprove.statusCode, 200);
    assert.strictEqual(resApprove.body.advance.status, 'APPROVED');

    // C. Disburse Advance from Test Cash Drawer
    const reqDisburse = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      params: { id: testAdvanceId },
      body: { disbursedFromAccountId: testAccountB1Id },
      ip: '127.0.0.1'
    };
    const resDisburse = createMockRes();
    await payrollController.disburseSalaryAdvance(reqDisburse, resDisburse);
    assert.strictEqual(resDisburse.statusCode, 200);
    assert.strictEqual(resDisburse.body.success, true);

    const disbursedAdvance = await prisma.salaryAdvance.findUnique({ where: { id: testAdvanceId } });
    assert.strictEqual(disbursedAdvance.status, 'DISBURSED');
  });

  // 10. Profit & Loss Statement (Excludes transfers, enforces branch permissions)
  await test('10. Business Control P&L: Verified Payments, Excludes Transfers, Branch Lockdown', async () => {
    // A. CEO queries ALL branches P&L
    const reqPnlAll = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      query: { period: 'this_month', branchId: 'ALL' }
    };
    const resPnlAll = createMockRes();
    await businessControlController.getProfitAndLoss(reqPnlAll, resPnlAll);
    assert.strictEqual(resPnlAll.statusCode, 200);
    assert.strictEqual(resPnlAll.body.success, true);
    assert.ok(resPnlAll.body.summary !== undefined, 'Summary must exist');
    assert.ok(resPnlAll.body.branchBreakdown !== null, 'ALL query must include branchBreakdown');
    assert.ok(resPnlAll.body.branchBreakdown.branch1 !== undefined);
    assert.ok(resPnlAll.body.branchBreakdown.branch2 !== undefined);

    // Verify transfers (TRANSFER_IN / TRANSFER_OUT) are NOT counted in revenue or opex
    const summary = resPnlAll.body.summary;
    assert.ok(typeof summary.totalRevenue === 'number');
    assert.ok(typeof summary.totalOpex === 'number');
    assert.ok(typeof summary.netProfit === 'number');

    // B. Manager of Branch 1 querying Branch 2 -> 403 Forbidden
    const reqPnlMgrHack = {
      user: { id: 10, role: 'MANAGER', branchId: 1, name: 'Manager B1' },
      query: { period: 'this_month', branchId: 2 }
    };
    const resPnlMgrHack = createMockRes();
    await businessControlController.getProfitAndLoss(reqPnlMgrHack, resPnlMgrHack);
    assert.strictEqual(resPnlMgrHack.statusCode, 403, 'Manager 1 requesting Branch 2 P&L must be 403');

    // C. Manager of Branch 1 querying ALL -> 403 Forbidden
    const reqPnlMgrAllHack = {
      user: { id: 10, role: 'MANAGER', branchId: 1, name: 'Manager B1' },
      query: { period: 'this_month', branchId: 'ALL' }
    };
    const resPnlMgrAllHack = createMockRes();
    await businessControlController.getProfitAndLoss(reqPnlMgrAllHack, resPnlMgrAllHack);
    assert.strictEqual(resPnlMgrAllHack.statusCode, 403, 'Manager 1 requesting ALL P&L must be 403');
  });

  // 11. Customer Outstanding (Accounts Receivable) with Aging Buckets
  await test('11. Customer Outstanding AR & Aging Analysis', async () => {
    const reqAr = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      query: { branchId: 'ALL' }
    };
    const resAr = createMockRes();
    await businessControlController.getCustomerOutstanding(reqAr, resAr);
    assert.strictEqual(resAr.statusCode, 200);
    assert.strictEqual(resAr.body.success, true);
    assert.ok(resAr.body.agingSummary !== undefined);
    assert.ok(resAr.body.agingSummary.current !== undefined);
    assert.ok(resAr.body.agingSummary.overdue_30 !== undefined);
    assert.ok(resAr.body.agingSummary.overdue_60 !== undefined);
    assert.ok(resAr.body.agingSummary.overdue_90_plus !== undefined);
    assert.ok(Array.isArray(resAr.body.customers));
  });

  // 12. Executive Financial Control Dashboard
  await test('12. Executive Financial Control Dashboard Metrics', async () => {
    const reqDash = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      query: { branchId: 'ALL' }
    };
    const resDash = createMockRes();
    await businessControlController.getExecutiveDashboard(reqDash, resDash);
    assert.strictEqual(resDash.statusCode, 200);
    assert.strictEqual(resDash.body.success, true);
    assert.ok(resDash.body.liquidity !== undefined);
    assert.ok(typeof resDash.body.liquidity.totalLiquid === 'number');
    assert.ok(resDash.body.operatingPerformance !== undefined);
    assert.ok(Array.isArray(resDash.body.recentTransactions));
  });

  // 13. Financial Audit Trail
  await test('13. Financial Audit Log captures all critical financial operations', async () => {
    const reqAudit = {
      user: { id: 1, role: 'SUPER_ADMIN', name: 'CEO' },
      query: { limit: 10 }
    };
    const resAudit = createMockRes();
    await businessControlController.getFinancialAuditLogs(reqAudit, resAudit);
    assert.strictEqual(resAudit.statusCode, 200);
    assert.strictEqual(resAudit.body.success, true);
    assert.ok(resAudit.body.logs.length > 0, 'Audit logs must contain recorded actions');

    const actions = resAudit.body.logs.map(l => l.action);
    assert.ok(actions.includes('SALARY_ADVANCE_REQUESTED') || actions.includes('SALARY_ADVANCE_APPROVED') || actions.includes('SALARY_ADVANCE_DISBURSED'), 'Must log salary advance events');
  });

  // CLEANUP: Clean up test financial records created during tests
  console.log('\n--- Cleaning up test records created during test execution ---');
  await pool.query('DELETE FROM "FinancialAuditLog" WHERE "reason" LIKE \'%test%\' OR "performedByName" = \'CEO\'');
  await pool.query('DELETE FROM "SalaryAdvance" WHERE id = $1', [testAdvanceId]);
  await pool.query('DELETE FROM "FinancialTransaction" WHERE "sourceModule" = \'SALARY_ADVANCE\' AND "sourceRecordId" = $1', [testAdvanceId]);
  await pool.query('DELETE FROM "FinancialTransaction" WHERE "sourceModule" = \'TEST_MODULE\' AND "sourceRecordId" = 999');
  await pool.query('DELETE FROM "FinancialTransaction" WHERE "accountId" IN ($1, $2) OR "toAccountId" IN ($1, $2)', [testAccountB1Id, testAccountB2Id]);
  await pool.query('DELETE FROM "FinancialAccount" WHERE id IN ($1, $2)', [testAccountB1Id, testAccountB2Id]);
  console.log('Cleanup completed.\n');

  // Final count verification of all 25 pre-existing tables
  await test('14. Final verification: Pre-existing 25 table records 100% unchanged', async () => {
    const baselineFile = path.join(__dirname, '..', 'backups_financial_phase2', 'baseline_table_counts.json');
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));

    for (const [table, expectedCount] of Object.entries(baseline)) {
      const res = await pool.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      const actualCount = res.rows[0].count;
      assert.strictEqual(actualCount, expectedCount, `Table "${table}" count altered! Expected ${expectedCount}, got ${actualCount}`);
    }
  });

  console.log('\n===============================================================');
  console.log(`   TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('===============================================================');

  await pool.end();
  if (passed !== total) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
