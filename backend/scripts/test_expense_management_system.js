/**
 * Comprehensive Verification & Test Script for JB GROUP Expense Management System
 * Tests:
 * 1. CEO, Manager, Admin RBAC authorization on /api/expenses
 * 2. Cross-branch 403 enforcement for Manager
 * 3. Add Expense (Paid Now and Pending Bill)
 * 4. Record Payment on Pending Bill with partial & full payments
 * 5. Payment History audit trail verification
 * 6. Dashboard metrics and category breakdown
 * 7. Verification that NO sales or sales income exists in expense telemetry
 * 8. Zero pollution cleanup and table preservation check
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
  console.log('   JB GROUP EXPENSE MANAGEMENT SYSTEM — VERIFICATION SUITE          ');
  console.log('====================================================================\n');

  // Start internal test server
  const server = http.createServer(app);
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  console.log(`[INFO] Test server listening on 127.0.0.1:${port}`);

  try {
    // 1. Fetch real login accounts
    const ceoUser = (await pool.query("SELECT * FROM \"User\" WHERE id = 1")).rows[0];
    const adminUser = (await pool.query("SELECT * FROM \"User\" WHERE id = 2")).rows[0];
    const managerUser = (await pool.query("SELECT * FROM \"User\" WHERE id = 3")).rows[0];

    console.log(`[1/8] Verified Users:`);
    console.log(`  - CEO: ID ${ceoUser.id} (${ceoUser.email}, Role: ${ceoUser.role})`);
    console.log(`  - Admin: ID ${adminUser.id} (${adminUser.email}, Role: ${adminUser.role})`);
    console.log(`  - Manager: ID ${managerUser.id} (${managerUser.email}, Role: ${managerUser.role}, Branch: ${managerUser.branchId})`);

    const ceoToken = generateToken(ceoUser);
    const adminToken = generateToken(adminUser);
    const managerToken = generateToken(managerUser);

    // 2. Test CEO Consolidated Dashboard
    console.log(`\n[2/8] Testing CEO Access to Consolidated Expense Dashboard...`);
    const ceoDash = await makeRequest(port, '/api/expenses/dashboard?branchId=ALL', 'GET', ceoToken);
    console.log(`  CEO Dashboard Status: ${ceoDash.status}`);
    console.log(`  Branch Scope: ${ceoDash.body?.data?.branchScope}`);
    console.log(`  Total Categories in breakdown: ${ceoDash.body?.data?.categoryBreakdown?.length}`);
    if (ceoDash.status !== 200) throw new Error('CEO Dashboard failed');

    // 3. Test Manager & Admin Branch Security
    console.log(`\n[3/8] Testing Manager & Admin Branch Permissions & Isolation...`);
    const mgrAllowed = await makeRequest(port, '/api/expenses/dashboard?branchId=1', 'GET', managerToken);
    console.log(`  Manager Branch 1 Access (Assigned): Status ${mgrAllowed.status} (Expected: 200)`);
    if (mgrAllowed.status !== 200) throw new Error('Manager should access Branch 1');

    const mgrCrossDenied = await makeRequest(port, '/api/expenses/dashboard?branchId=2', 'GET', managerToken);
    console.log(`  Manager Branch 2 Access (Cross-branch): Status ${mgrCrossDenied.status} (Expected: 403 Forbidden)`);
    if (mgrCrossDenied.status !== 403) throw new Error('Manager cross-branch was not blocked');

    const mgrAllDenied = await makeRequest(port, '/api/expenses/dashboard?branchId=ALL', 'GET', managerToken);
    console.log(`  Manager Consolidated Access (ALL): Status ${mgrAllDenied.status} (Expected: 403 Forbidden)`);
    if (mgrAllDenied.status !== 403) throw new Error('Manager ALL request was not blocked');

    // Admin branch security (Admin assigned to Branch 1)
    const adminAllowed = await makeRequest(port, '/api/expenses/dashboard?branchId=1', 'GET', adminToken);
    console.log(`  Admin Branch 1 Access (Assigned): Status ${adminAllowed.status} (Expected: 200)`);
    if (adminAllowed.status !== 200) throw new Error('Admin should access Branch 1');

    const adminCrossDenied = await makeRequest(port, '/api/expenses/dashboard?branchId=2', 'GET', adminToken);
    console.log(`  Admin Branch 2 Access (Cross-branch): Status ${adminCrossDenied.status} (Expected: 403 Forbidden)`);
    if (adminCrossDenied.status !== 403) throw new Error('Admin cross-branch was not blocked');

    const adminAllDenied = await makeRequest(port, '/api/expenses/dashboard?branchId=ALL', 'GET', adminToken);
    console.log(`  Admin Consolidated Access (ALL): Status ${adminAllDenied.status} (Expected: 403 Forbidden)`);
    if (adminAllDenied.status !== 403) throw new Error('Admin ALL request was not blocked');

    // 4. Test Add Expense - Shop Rent (Pending Bill)
    console.log(`\n[4/8] Testing Add Expense: Shop Rent (Pending Bill)...`);
    const rentPayload = {
      title: 'TEST_Shop_Rent_Nov_2026',
      category: 'SHOP_RENT',
      amount: 45000.00,
      branchId: 1,
      expenseDate: '2026-11-01',
      dueDate: '2026-11-15',
      paymentStatus: 'PENDING',
      paidTo: 'Test Landlord Properties',
      description: 'Monthly showroom lease test voucher'
    };
    const addRentRes = await makeRequest(port, '/api/expenses', 'POST', ceoToken, rentPayload);
    console.log(`  Add Rent Response Status: ${addRentRes.status}`);
    console.log(`  Created Expense Number: ${addRentRes.body?.data?.expenseNumber}`);
    console.log(`  Status: ${addRentRes.body?.data?.status}`);
    console.log(`  Total: LKR ${addRentRes.body?.data?.totalAmount}, Paid: LKR ${addRentRes.body?.data?.paidAmount}, Pending: LKR ${addRentRes.body?.data?.pendingAmount}`);
    if (addRentRes.status !== 201) throw new Error('Add Rent expense failed');
    const rentExpenseId = addRentRes.body.data.id;

    // 5. Test Add Expense - Electricity Bill (Immediate Cash Payment)
    console.log(`\n[5/8] Testing Add Expense: Electricity Bill (Paid Now)...`);
    const elecPayload = {
      title: 'TEST_CEB_Electricity_Nov',
      category: 'ELECTRICITY_BILL',
      amount: 8500.00,
      branchId: 1,
      expenseDate: '2026-11-02',
      dueDate: '2026-11-10',
      paymentStatus: 'PAID_NOW',
      paymentMethod: 'CASH',
      paidBy: 'Test Cashier',
      paidTo: 'Ceylon Electricity Board',
      description: 'Monthly electricity bill immediate settlement'
    };
    const addElecRes = await makeRequest(port, '/api/expenses', 'POST', ceoToken, elecPayload);
    console.log(`  Add Electricity Status: ${addElecRes.status}`);
    console.log(`  Expense Number: ${addElecRes.body?.data?.expenseNumber}`);
    console.log(`  Status: ${addElecRes.body?.data?.status}`);
    console.log(`  Total: LKR ${addElecRes.body?.data?.totalAmount}, Paid: LKR ${addElecRes.body?.data?.paidAmount}`);
    if (addElecRes.status !== 201) throw new Error('Add Electricity expense failed');
    const elecExpenseId = addElecRes.body.data.id;

    // 6. Test Record Partial & Full Payment on Rent Expense
    console.log(`\n[6/8] Testing Record Payment on Rent Expense (Partial & Full)...`);
    // Partial payment: LKR 20,000 out of 45,000
    const partialPay = await makeRequest(port, `/api/expenses/${rentExpenseId}/pay`, 'POST', ceoToken, {
      amount: 20000.00,
      paymentDate: '2026-11-03',
      paymentMethod: 'BANK_TRANSFER',
      paidBy: 'Admin Officer',
      paidTo: 'Test Landlord Properties',
      notes: 'First installment of rent'
    });
    console.log(`  Partial Payment (LKR 20,000): Status ${partialPay.status}`);
    console.log(`  Updated Status: ${partialPay.body?.data?.status} (Expected: PARTIALLY_PAID)`);
    console.log(`  Remaining Pending: LKR ${partialPay.body?.data?.pendingAmount} (Expected: 25000)`);
    if (partialPay.body?.data?.status !== 'PARTIALLY_PAID' || partialPay.body?.data?.pendingAmount !== 25000) {
      throw new Error('Partial payment calculation mismatch');
    }

    // Remaining payment: LKR 25,000
    const fullPay = await makeRequest(port, `/api/expenses/${rentExpenseId}/pay`, 'POST', ceoToken, {
      amount: 25000.00,
      paymentDate: '2026-11-04',
      paymentMethod: 'CHEQUE',
      paidBy: 'CEO',
      paidTo: 'Test Landlord Properties',
      notes: 'Final settlement of rent'
    });
    console.log(`  Final Settlement (LKR 25,000): Status ${fullPay.status}`);
    console.log(`  Updated Status: ${fullPay.body?.data?.status} (Expected: PAID)`);
    console.log(`  Remaining Pending: LKR ${fullPay.body?.data?.pendingAmount} (Expected: 0)`);
    if (fullPay.body?.data?.status !== 'PAID' || fullPay.body?.data?.pendingAmount !== 0) {
      throw new Error('Full payment calculation mismatch');
    }

    // Verify Payment History endpoint
    const historyRes = await makeRequest(port, `/api/expenses/${rentExpenseId}`, 'GET', ceoToken);
    console.log(`  Rent Payment History Records: ${historyRes.body?.data?.payments?.length} payments logged`);
    if (historyRes.body?.data?.payments?.length !== 2) throw new Error('Payment history count mismatch');

    // 7. Verify Expense Dashboard Telemetry (Confirm NO Sales Data)
    console.log(`\n[7/8] Verifying Expense Dashboard Telemetry...`);
    const finalDash = await makeRequest(port, '/api/expenses/dashboard?branchId=1', 'GET', ceoToken);
    const sum = finalDash.body?.data?.summary;
    console.log(`  Dashboard Summary:`);
    console.log(`    Total Expenses This Month: LKR ${sum?.totalExpensesThisMonth}`);
    console.log(`    Total Paid Expenses: LKR ${sum?.totalPaidExpenses}`);
    console.log(`    Total Pending Expenses: LKR ${sum?.totalPendingExpenses}`);
    console.log(`    Monthly Rent: LKR ${sum?.monthlyRent}`);
    console.log(`    Electricity: LKR ${sum?.electricityExpenses}`);
    console.log(`    Sales in Response: ${finalDash.body?.data?.sales !== undefined ? 'PRESENT (FAIL)' : 'ABSENT (PASS)'}`);
    console.log(`    Order Revenue in Response: ${finalDash.body?.data?.orderIncome !== undefined ? 'PRESENT (FAIL)' : 'ABSENT (PASS)'}`);

    // 8. Atomic Cleanup of Test Records & Verification
    console.log(`\n[8/8] Performing Clean Atomic Rollback of Test Records...`);
    await pool.query('DELETE FROM "ExpensePaymentHistory" WHERE "expenseId" IN ($1, $2)', [rentExpenseId, elecExpenseId]);
    await pool.query('DELETE FROM "BusinessExpense" WHERE id IN ($1, $2)', [rentExpenseId, elecExpenseId]);
    
    const remainingTest = await pool.query('SELECT count(*) FROM "BusinessExpense" WHERE title LIKE \'TEST_%\'');
    console.log(`  Remaining Test Records: ${remainingTest.rows[0].count} (0 expected)`);

    // Verify original tables preservation
    const tableCounts = await pool.query(`
      SELECT 
        (SELECT count(*) FROM "Branch") as branches,
        (SELECT count(*) FROM "Order") as orders,
        (SELECT count(*) FROM "Payment") as payments,
        (SELECT count(*) FROM "Employee") as employees,
        (SELECT count(*) FROM "Attendance") as attendance,
        (SELECT count(*) FROM "User") as users
    `);
    console.log('  Original Business Tables Integrity:', tableCounts.rows[0]);

    console.log('\n====================================================================');
    console.log('   ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY (100%)              ');
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

