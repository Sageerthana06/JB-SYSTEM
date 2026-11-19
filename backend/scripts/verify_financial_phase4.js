require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pool } = require('../src/prisma');

async function main() {
  console.log('===============================================================');
  console.log('   JB GROUP PHASE 4 — FRONTEND FINANCIAL CONTROL UI AUDIT      ');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  const test = (name, fn) => {
    total++;
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }
  };

  const asyncTest = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }
  };

  // 1. Verify existence of all 9 Phase 4 frontend screen components
  test('1. All 9 Required Financial Control Screens and Master Container Exist', () => {
    const requiredFiles = [
      'src/components/FinanceERP.jsx',
      'src/components/Finance/financeUtils.js',
      'src/components/Finance/ExecutiveDashboardView.jsx',
      'src/components/Finance/CashBankAccountsView.jsx',
      'src/components/Finance/IncomeExpenseLedgerView.jsx',
      'src/components/Finance/BranchTransfersView.jsx',
      'src/components/Finance/StaffPayrollView.jsx',
      'src/components/Finance/SalaryAdvancesView.jsx',
      'src/components/Finance/ProfitLossReportView.jsx',
      'src/components/Finance/CustomerOutstandingView.jsx',
      'src/components/Finance/FinancialAuditLogsView.jsx'
    ];

    for (const f of requiredFiles) {
      const fullPath = path.join(__dirname, '..', '..', f);
      assert.strictEqual(fs.existsSync(fullPath), true, `File ${f} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.length > 200, `File ${f} must not be empty`);
    }
  });

  // 2. Verify ModuleRenderer routing integration
  test('2. ModuleRenderer.jsx wires FinanceERP into activeTab === "finance"', () => {
    const modRenderer = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'ModuleRenderer.jsx'), 'utf8');
    assert.ok(modRenderer.includes("import { FinanceERP } from './FinanceERP';"), 'Must import FinanceERP');
    assert.ok(modRenderer.includes("activeTab === 'finance'"), 'Must handle activeTab === "finance"');
    assert.ok(modRenderer.includes("<FinanceERP />"), 'Must render <FinanceERP />');
    assert.ok(modRenderer.includes("hasPermission(user?.role, 'finance.view')"), 'Must guard with finance.view permission');
  });

  // 3. Verify Role Permissions for Financial System
  test('3. RBAC Permissions correctly configured across all roles', () => {
    const permsFile = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'utils', 'permissions.js'), 'utf8');

    // Extract ROLE_PERMISSIONS definition
    assert.ok(permsFile.includes('finance.view'), 'Permissions must define finance.view');
    assert.ok(permsFile.includes('finance.manage'), 'Permissions must define finance.manage');

    // Test permission logic via Node module simulation
    const { hasPermission } = require('../../src/utils/permissions');

    // Authorized
    assert.strictEqual(hasPermission('SUPER_ADMIN', 'finance.view'), true, 'SUPER_ADMIN must have finance.view');
    assert.strictEqual(hasPermission('SUPER_ADMIN', 'finance.manage'), true, 'SUPER_ADMIN must have finance.manage');
    assert.strictEqual(hasPermission('CEO', 'finance.view'), true, 'CEO must have finance.view');
    assert.strictEqual(hasPermission('ADMIN', 'finance.view'), true, 'ADMIN must have finance.view');
    assert.strictEqual(hasPermission('ADMIN', 'finance.manage'), true, 'ADMIN must have finance.manage');
    assert.strictEqual(hasPermission('MANAGER', 'finance.view'), true, 'MANAGER must have finance.view');
    assert.strictEqual(hasPermission('MANAGER', 'finance.manage'), true, 'MANAGER must have finance.manage');

    // Unauthorized roles must be strictly DENIED
    assert.strictEqual(hasPermission('STAFF', 'finance.view'), false, 'STAFF must NOT have finance.view');
    assert.strictEqual(hasPermission('STAFF', 'finance.manage'), false, 'STAFF must NOT have finance.manage');
    assert.strictEqual(hasPermission('TAILOR', 'finance.view'), false, 'TAILOR must NOT have finance.view');
    assert.strictEqual(hasPermission('CUTTING', 'finance.view'), false, 'CUTTING must NOT have finance.view');
    assert.strictEqual(hasPermission('EMBROIDERY', 'finance.view'), false, 'EMBROIDERY must NOT have finance.view');
    assert.strictEqual(hasPermission('CUSTOMER', 'finance.view'), false, 'CUSTOMER must NOT have finance.view');
  });

  // 4. Verify Frontend Branch Isolation Helper
  test('4. Frontend branch isolation helper locks Managers and empowers Executives', () => {
    const { resolveEffectiveBranch } = require('../../src/components/Finance/financeUtils');

    // Manager with branchId 1 -> always returns 1, even if activeBranch is 'ALL' or '2'
    const mgr1 = { role: 'MANAGER', branchId: 1 };
    assert.strictEqual(resolveEffectiveBranch('ALL', mgr1), 1, 'Manager 1 querying ALL must resolve strictly to branch 1');
    assert.strictEqual(resolveEffectiveBranch('2', mgr1), 1, 'Manager 1 querying branch 2 must resolve strictly to branch 1');
    assert.strictEqual(resolveEffectiveBranch(2, mgr1), 1, 'Manager 1 querying branch 2 (number) must resolve to branch 1');

    // Manager with branchId 2 -> always returns 2
    const mgr2 = { role: 'MANAGER', branchId: 2 };
    assert.strictEqual(resolveEffectiveBranch('ALL', mgr2), 2, 'Manager 2 querying ALL must resolve strictly to branch 2');
    assert.strictEqual(resolveEffectiveBranch('1', mgr2), 2, 'Manager 2 querying branch 1 must resolve strictly to branch 2');

    // CEO / Super Admin -> Can view consolidated ALL or specific branches
    const ceo = { role: 'SUPER_ADMIN' };
    assert.strictEqual(resolveEffectiveBranch('ALL', ceo), 'ALL', 'CEO querying ALL must resolve to ALL');
    assert.strictEqual(resolveEffectiveBranch('1', ceo), 1, 'CEO querying branch 1 must resolve to 1');
    assert.strictEqual(resolveEffectiveBranch('2', ceo), 2, 'CEO querying branch 2 must resolve to 2');

    const admin = { role: 'ADMIN' };
    assert.strictEqual(resolveEffectiveBranch('ALL', admin), 'ALL', 'ADMIN querying ALL must resolve to ALL');
    assert.strictEqual(resolveEffectiveBranch('1', admin), 1, 'ADMIN querying branch 1 must resolve to 1');
    assert.strictEqual(resolveEffectiveBranch('2', admin), 2, 'ADMIN querying branch 2 must resolve to 2');
  });

  // 5. Verify database integrity: 25 pre-existing tables intact
  await asyncTest('5. Pre-existing 25 table records 100% preserved in database', async () => {
    const baselineFile = path.join(__dirname, '..', 'backups_financial_phase2', 'baseline_table_counts.json');
    assert.strictEqual(fs.existsSync(baselineFile), true, 'Baseline counts file must exist');
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));

    for (const [table, expectedCount] of Object.entries(baseline)) {
      const res = await pool.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      const actualCount = res.rows[0].count;
      if (['AuditLog', 'InventoryAuditLog', 'Attendance'].includes(table)) {
        assert.ok(actualCount >= expectedCount, `Table "${table}" has fewer rows than baseline! Expected >= ${expectedCount}, got ${actualCount}`);
      } else {
        assert.strictEqual(actualCount, expectedCount, `Table "${table}" count mismatch! Expected ${expectedCount}, got ${actualCount}`);
      }
    }
  });

  // 6. Verify strictly only 2 branches exist in database
  await asyncTest('6. Only the exact 2 authorized branches exist in database', async () => {
    const branches = await pool.query('SELECT id, name, status FROM "Branch" ORDER BY id');
    assert.strictEqual(branches.rows.length, 2, 'Must have exactly 2 branches');
    assert.strictEqual(branches.rows[0].id, 1);
    assert.strictEqual(branches.rows[0].name, 'JB Group (Main)');
    assert.strictEqual(branches.rows[1].id, 2);
    assert.strictEqual(branches.rows[1].name, 'Bella Design');
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
  console.error('Phase 4 verification script crashed:', err);
  process.exit(1);
});
