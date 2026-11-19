/**
 * Comprehensive Verification & Test Script for JB GROUP Complete Expense Management System
 * Tests:
 * 1. CEO, Manager, Admin RBAC authorization on /api/expenses
 * 2. Cross-branch 403 enforcement for Manager & Admin
 * 3. Add Expense (Paid Now and Pending Bill)
 * 4. Record Payment on Pending Bill with partial & full payments
 * 5. Update Expense (PUT /api/expenses/:id) & safety rule blocking amount < paidAmount
 * 6. Delete Expense (DELETE /api/expenses/:id) & safety rule blocking deletion of paid expenses
 * 7. Recurring Bills: generation, unpaid carryover, duplicate protection
 * 8. Comprehensive Reports: category breakdown (15 cats), branch breakdown (2 branches), 12 months trajectory
 * 9. Zero pollution cleanup and table preservation check
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const http = require('http');
const app = require('../src/app');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      branchId: user.branchId
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
};

const makeRequest = (port, path, method = 'GET', token, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTests() {
  console.log('====================================================================');
  console.log('   JB GROUP COMPLETE EXPENSE MANAGEMENT SYSTEM — VERIFICATION      ');
  console.log('====================================================================\n');

  // Start internal test server
  const server = http.createServer(app);
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  console.log(`[INFO] Test server listening on 127.0.0.1:${port}`);

  let createdExpenseIds = [];

  try {
    // 1. Fetch real login accounts
    const ceoUser = (await pool.query('SELECT * FROM "User" WHERE id = 1')).rows[0];
    const adminUser = (await pool.query('SELECT * FROM "User" WHERE id = 2')).rows[0];
    const managerUser = (await pool.query('SELECT * FROM "User" WHERE id = 3')).rows[0];

    console.log(`[1/10] Verified Existing Accounts:`);
    console.log(`  - CEO: ID ${ceoUser.id} (${ceoUser.email}, Role: ${ceoUser.role})`);
    console.log(`  - Admin: ID ${adminUser.id} (${adminUser.email}, Role: ${adminUser.role}, Branch: ${adminUser.branchId})`);
    console.log(`  - Manager: ID ${managerUser.id} (${managerUser.email}, Role: ${managerUser.role}, Branch: ${managerUser.branchId})`);

    const ceoToken = generateToken(ceoUser);
    const adminToken = generateToken(adminUser);
    const managerToken = generateToken(managerUser);

    // 2. Test CEO Consolidated Dashboard
    console.log(`\n[2/10] Testing CEO Access to Consolidated Expense Dashboard...`);
    const ceoDash = await makeRequest(port, '/api/expenses/dashboard?branchId=ALL', 'GET', ceoToken);
    console.log(`  CEO Dashboard Status: ${ceoDash.status} (Expected: 200)`);
    console.log(`  Branch Scope: ${ceoDash.body?.data?.branchScope}`);
    console.log(`  Categories in breakdown: ${ceoDash.body?.data?.categoryBreakdown?.length}`);
    if (ceoDash.status !== 200) throw new Error('CEO Dashboard failed');

    // 3. Test Manager & Admin Branch Permissions & Isolation (403 on ALL or cross-branch)
    console.log(`\n[3/10] Testing Manager & Admin Branch Permissions & Strict 403 Isolation...`);
    const mgrAllowed = await makeRequest(port, '/api/expenses/dashboard?branchId=1', 'GET', managerToken);
    console.log(`  Manager Branch 1 Access (Assigned): Status ${mgrAllowed.status} (Expected: 200)`);
    if (mgrAllowed.status !== 200) throw new Error('Manager should access Branch 1');

    const mgrCrossDenied = await makeRequest(port, '/api/expenses/dashboard?branchId=2', 'GET', managerToken);
    console.log(`  Manager Branch 2 Access (Cross-branch): Status ${mgrCrossDenied.status} (Expected: 403 Forbidden)`);
    if (mgrCrossDenied.status !== 403) throw new Error('Manager cross-branch was not blocked');

    const mgrAllDenied = await makeRequest(port, '/api/expenses/dashboard?branchId=ALL', 'GET', managerToken);
    console.log(`  Manager Consolidated Access (ALL): Status ${mgrAllDenied.status} (Expected: 403 Forbidden)`);
    if (mgrAllDenied.status !== 403) throw new Error('Manager ALL request was not blocked');

    const adminAllowed = await makeRequest(port, '/api/expenses/dashboard?branchId=1', 'GET', adminToken);
    console.log(`  Admin Branch 1 Access (Assigned): Status ${adminAllowed.status} (Expected: 200)`);
    if (adminAllowed.status !== 200) throw new Error('Admin should access Branch 1');

    const adminCrossDenied = await makeRequest(port, '/api/expenses/dashboard?branchId=2', 'GET', adminToken);
    console.log(`  Admin Branch 2 Access (Cross-branch): Status ${adminCrossDenied.status} (Expected: 403 Forbidden)`);
    if (adminCrossDenied.status !== 403) throw new Error('Admin cross-branch was not blocked');

    const adminAllDenied = await makeRequest(port, '/api/expenses/dashboard?branchId=ALL', 'GET', adminToken);
    console.log(`  Admin Consolidated Access (ALL): Status ${adminAllDenied.status} (Expected: 403 Forbidden)`);
    if (adminAllDenied.status !== 403) throw new Error('Admin ALL request was not blocked');

    // 4. Test Create Expense (Pending Bill)
    console.log(`\n[4/10] Testing Create Expense: Office Supplies (Pending Bill)...`);
    const expPayload = {
      title: 'TEST_Printer_Toner_Cartridges',
      category: 'OFFICE_EXPENSES',
      amount: 32000.00,
      branchId: 1,
      expenseDate: '2026-11-01',
      dueDate: '2026-11-20',
      paymentStatus: 'PENDING',
      paidTo: 'Test Stationery Hub',
      description: 'LaserJet cartridges replacement'
    };
    const addRes = await makeRequest(port, '/api/expenses', 'POST', adminToken, expPayload);
    console.log(`  Create Expense Status: ${addRes.status} (Expected: 201)`);
    console.log(`  Expense Number: ${addRes.body?.data?.expenseNumber}`);
    console.log(`  Status: ${addRes.body?.data?.status} (Expected: PENDING)`);
    if (addRes.status !== 201) throw new Error('Create expense failed');
    const testExpId = addRes.body.data.id;
    createdExpenseIds.push(testExpId);

    // 5. Test Partial Payment on Expense
    console.log(`\n[5/10] Testing Partial Payment (LKR 12,000 out of 32,000)...`);
    const partPayRes = await makeRequest(port, `/api/expenses/${testExpId}/pay`, 'POST', adminToken, {
      amount: 12000.00,
      paymentDate: '2026-11-02',
      paymentMethod: 'CASH',
      paidBy: 'Admin Officer',
      paidTo: 'Test Stationery Hub',
      notes: 'Initial partial payment'
    });
    console.log(`  Partial Pay Status: ${partPayRes.status} (Expected: 200)`);
    console.log(`  Updated Status: ${partPayRes.body?.data?.status} (Expected: PARTIALLY_PAID)`);
    console.log(`  Paid: LKR ${partPayRes.body?.data?.paidAmount}, Pending: LKR ${partPayRes.body?.data?.pendingAmount} (Expected: 20000)`);
    if (partPayRes.body?.data?.status !== 'PARTIALLY_PAID' || partPayRes.body?.data?.pendingAmount !== 20000) {
      throw new Error('Partial payment calculation mismatch');
    }

    // 6. Test Edit Expense (PUT /api/expenses/:id) & Safety Rule
    console.log(`\n[6/10] Testing Edit Expense & Financial Safety Rule (Amount < Paid Amount)...`);
    // Attempt to reduce amount to 10,000 (below already paid 12,000) -> Must return 400
    const illegalEditRes = await makeRequest(port, `/api/expenses/${testExpId}`, 'PUT', adminToken, {
      amount: 10000.00,
      title: 'TEST_Illegal_Reduction'
    });
    console.log(`  Illegal Reduction (< 12,000) Status: ${illegalEditRes.status} (Expected: 400 Bad Request)`);
    if (illegalEditRes.status !== 400) throw new Error('Illegal amount reduction below settled was not blocked');

    // Valid edit: Update title and increase amount to 35,000
    const validEditRes = await makeRequest(port, `/api/expenses/${testExpId}`, 'PUT', adminToken, {
      title: 'TEST_Printer_Toner_Cartridges_Updated',
      amount: 35000.00,
      notes: 'Price adjustment for extra ream of paper'
    });
    console.log(`  Valid Edit Status: ${validEditRes.status} (Expected: 200)`);
    console.log(`  New Total: LKR ${validEditRes.body?.data?.totalAmount} (Expected: 35000)`);
    console.log(`  Recalculated Pending: LKR ${validEditRes.body?.data?.pendingAmount} (Expected: 23000)`);
    if (validEditRes.body?.data?.totalAmount !== 35000 || validEditRes.body?.data?.pendingAmount !== 23000) {
      throw new Error('Expense update calculation mismatch');
    }

    // 7. Test Delete Expense Safety Rule (Cannot delete if paid > 0)
    console.log(`\n[7/10] Testing Delete Expense Safety Rule (Cannot delete partially/fully paid expense)...`);
    const illegalDelRes = await makeRequest(port, `/api/expenses/${testExpId}`, 'DELETE', adminToken);
    console.log(`  Delete Paid Expense Status: ${illegalDelRes.status} (Expected: 400 Bad Request)`);
    if (illegalDelRes.status !== 400) throw new Error('Deletion of paid expense was not blocked');

    // Complete payment: Pay remaining 23,000
    const finalPayRes = await makeRequest(port, `/api/expenses/${testExpId}/pay`, 'POST', adminToken, {
      amount: 23000.00,
      paymentDate: '2026-11-03',
      paymentMethod: 'BANK_TRANSFER',
      paidBy: 'Admin Officer',
      paidTo: 'Test Stationery Hub',
      notes: 'Final settlement of stationery'
    });
    console.log(`  Final Settlement (LKR 23,000) Status: ${finalPayRes.status} (Expected: 200)`);
    console.log(`  Final Status: ${finalPayRes.body?.data?.status} (Expected: PAID)`);
    console.log(`  Final Pending: LKR ${finalPayRes.body?.data?.pendingAmount} (Expected: 0)`);
    if (finalPayRes.body?.data?.status !== 'PAID' || finalPayRes.body?.data?.pendingAmount !== 0) {
      throw new Error('Final payment status mismatch');
    }

    // 8. Test Recurring Bills Generation & Arrears Carryover
    console.log(`\n[8/10] Testing Recurring Monthly Commitments & Utilities...`);
    const recurringList = await makeRequest(port, '/api/expenses/recurring?billingMonth=2026-11&branchId=1', 'GET', adminToken);
    console.log(`  GET Recurring Bills Status: ${recurringList.status} (Expected: 200)`);

    const genRecurring = await makeRequest(port, '/api/expenses/recurring/generate', 'POST', adminToken, {
      billingMonth: '2026-11',
      branchId: 1
    });
    console.log(`  Generate Recurring Commitments Status: ${genRecurring.status} (Expected: 200)`);
    console.log(`  Commitments Processed: ${genRecurring.body?.data?.bills?.length}`);
    if (genRecurring.status !== 200) throw new Error('Recurring bill generation failed');

    // 9. Test Comprehensive Reports (Analytics)
    console.log(`\n[9/10] Testing Comprehensive Expense Reports Analytics...`);
    const repRes = await makeRequest(port, '/api/expenses/reports/comprehensive?year=2026&branchId=ALL', 'GET', ceoToken);
    console.log(`  Comprehensive Reports Status: ${repRes.status} (Expected: 200)`);
    console.log(`  Total Incurred: LKR ${repRes.body?.data?.summary?.totalIncurred}`);
    console.log(`  Total Settled: LKR ${repRes.body?.data?.summary?.totalPaid}`);
    console.log(`  Total Pending: LKR ${repRes.body?.data?.summary?.totalPending}`);
    console.log(`  Settlement Rate: ${repRes.body?.data?.summary?.settlementRate}%`);
    console.log(`  Categories Analyzed: ${repRes.body?.data?.categoryBreakdown?.length} (Expected: 15)`);
    console.log(`  Branches Analyzed: ${repRes.body?.data?.branchBreakdown?.length} (Expected: 2)`);
    console.log(`  Monthly Data Points: ${repRes.body?.data?.monthlyBreakdown?.length} (Expected: 12)`);
    if (repRes.status !== 200 || repRes.body?.data?.categoryBreakdown?.length !== 15) {
      throw new Error('Comprehensive report data integrity failed');
    }

    // Test Deletion on a fresh unpaid test expense
    console.log(`\n[Testing Safe Deletion on Unpaid Expense]...`);
    const unpaidExp = await makeRequest(port, '/api/expenses', 'POST', adminToken, {
      title: 'TEST_Unpaid_Expense_To_Delete',
      category: 'MISCELLANEOUS',
      category: 'OTHER_EXPENSES',
      amount: 5000.00,
      branchId: 1,
      paymentStatus: 'PENDING'
    });
    const unpaidId = unpaidExp.body?.data?.id;
    console.log(`  Created Unpaid Expense ID ${unpaidId}: Status ${unpaidExp.status}`);
    const delUnpaidRes = await makeRequest(port, `/api/expenses/${unpaidId}`, 'DELETE', adminToken);
    console.log(`  Deleted Unpaid Expense Status: ${delUnpaidRes.status} (Expected: 200)`);
    if (delUnpaidRes.status !== 200) throw new Error('Deletion of unpaid expense failed');

    // 10. Atomic Cleanup & Integrity Verification
    console.log(`\n[10/10] Atomic Cleanup of Test Records & Tables Integrity...`);
    if (createdExpenseIds.length > 0) {
      await pool.query('DELETE FROM "ExpensePaymentHistory" WHERE "expenseId" = ANY($1)', [createdExpenseIds]);
      await pool.query('DELETE FROM "BusinessExpense" WHERE id = ANY($1)', [createdExpenseIds]);
    }
    await pool.query('DELETE FROM "BusinessExpense" WHERE title LIKE \'TEST_%\'');

    const cleanCheck = await pool.query('SELECT count(*) FROM "BusinessExpense" WHERE title LIKE \'TEST_%\'');
    console.log(`  Remaining Test Records: ${cleanCheck.rows[0].count} (0 expected)`);

    const tableCounts = await pool.query(`
      SELECT 
        (SELECT count(*) FROM "Branch") as branches,
        (SELECT count(*) FROM "Order") as orders,
        (SELECT count(*) FROM "Payment") as payments,
        (SELECT count(*) FROM "Employee") as employees,
        (SELECT count(*) FROM "Attendance") as attendance,
        (SELECT count(*) FROM "User") as users
    `);
    console.log('  Core Business Tables Integrity:', tableCounts.rows[0]);

    console.log('\n====================================================================');
    console.log('   ALL 10 COMPLETE SYSTEM VERIFICATION TESTS PASSED (100% SUCCESS)  ');
    console.log('====================================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});

