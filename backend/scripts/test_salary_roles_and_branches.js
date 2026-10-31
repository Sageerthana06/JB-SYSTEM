/**
 * Test Suite: Role-Based Visibility & Branch Scoping for Weekly Tailor Salary
 * Tests CEO, Manager, Admin, and Tailor roles against backend APIs.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api/salary';
const JWT_SECRET = process.env.JWT_SECRET;

// Helper to generate test JWT token
function createTestToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// User accounts representing each role
const CEO_USER = { id: 1, name: 'CEO Joseph', email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: 1 };
const MGR_USER = { id: 3, name: 'Manager S.', email: 'manager@jbgroup.com', role: 'MANAGER', branchId: 1 };
const ADMIN_USER = { id: 2, name: 'Admin User', email: 'admin@jbgroup.com', role: 'ADMIN', branchId: 1 };
const TAILOR_USER = { id: 18, name: 'Jagatheeswary', email: 'jagatheeswary@jbgroup.com', role: 'TAILOR', branchId: 1 };

const ceoToken = createTestToken(CEO_USER);
const mgrToken = createTestToken(MGR_USER);
const adminToken = createTestToken(ADMIN_USER);
const tailorToken = createTestToken(TAILOR_USER);

async function runRoleVisibilityTests() {
  console.log('=== TEST SUITE: ROLE-BASED SALARY VISIBILITY & BRANCH ISOLATION ===\n');
  let passed = 0;
  let total = 0;

  async function test(title, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ [PASS] Test ${total}: ${title}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] Test ${total}: ${title}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  // 1. CEO Organization-Wide Visibility
  await test('CEO has full organization-wide visibility across all branches', async () => {
    const res = await fetch(`${API_BASE}/weekly-report?branchId=ALL`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'CEO report fetch failed');
    if (!data.roleContext?.isCeo) throw new Error('Role context did not identify user as CEO');
    if (!data.roleContext?.canDisburse) throw new Error('CEO should have payment disbursement authority');
    if (data.roleContext?.branchScope !== 'ALL') throw new Error('CEO branch scope should be ALL');
  });

  // 2. Manager Assigned Branch Visibility
  await test('Manager successfully retrieves weekly salary report for their assigned branch', async () => {
    const res = await fetch(`${API_BASE}/weekly-report`, {
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Manager report fetch failed');
    if (!data.roleContext?.isManager) throw new Error('Role context did not identify user as Manager');
    if (data.roleContext?.branchScope !== 1) throw new Error(`Expected branchScope to be 1, got ${data.roleContext?.branchScope}`);
    if (!data.roleContext?.canDisburse) throw new Error('Manager should have payment disbursement authority for their branch');
  });

  // 3. Manager Cross-Branch Isolation (Security Guard)
  await test('Manager is strictly forbidden (403) from accessing another branch (branchId=2)', async () => {
    const res = await fetch(`${API_BASE}/weekly-report?branchId=2`, {
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    if (res.status !== 403) {
      throw new Error(`Expected status 403 Forbidden, but received ${res.status}`);
    }
    const data = await res.json();
    if (!data.message.includes('Managers are restricted to their assigned branch')) {
      throw new Error(`Unexpected error message: ${data.message}`);
    }
  });

  // 4. Admin View & Financial Authority Guard
  await test('Admin accesses weekly salary report, but canDisburse is false (read-only financial authority)', async () => {
    const res = await fetch(`${API_BASE}/weekly-report`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Admin report fetch failed');
    if (!data.roleContext?.isAdmin) throw new Error('Role context did not identify user as Admin');
    if (data.roleContext?.canDisburse !== false) {
      throw new Error('Admin should NOT have payout disbursement authority');
    }
  });

  // 5. Admin Payout Blockage
  await test('Admin is strictly forbidden (403) from recording salary disbursements via /record-payment', async () => {
    const res = await fetch(`${API_BASE}/record-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        orderId: 106,
        tailorId: 18,
        workType: 'CUTTING',
        amountPaid: 250
      })
    });
    if (res.status !== 403) {
      throw new Error(`Expected status 403 Forbidden, but received ${res.status}`);
    }
    const data = await res.json();
    if (!data.message.includes('Access denied')) {
      throw new Error(`Expected access denied message, got: ${data.message}`);
    }
  });

  // 6. Tailor Management Blockage
  await test('Tailor is strictly forbidden (403) from accessing management weekly report', async () => {
    const res = await fetch(`${API_BASE}/weekly-report`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    if (res.status !== 403) {
      throw new Error(`Expected status 403 Forbidden, but received ${res.status}`);
    }
  });

  // 7. Tailor Personal Isolation
  await test('Tailor successfully retrieves their personal salary panel scoped strictly to themselves', async () => {
    const res = await fetch(`${API_BASE}/my-salary`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'My-salary fetch failed');
    if (data.tailor?.id !== 18) throw new Error(`Expected tailor ID 18, got ${data.tailor?.id}`);
    // Check that every allocation belongs to tailor 18
    for (const alloc of data.allocations || []) {
      if (Number(alloc.tailorId) !== 18) {
        throw new Error(`Security breach: Allocation belonging to tailor ${alloc.tailorId} returned to tailor 18`);
      }
    }
  });

  // 8. Payment History Branch Scoping
  await test('Payment history is scoped by branch for Manager and all records for CEO', async () => {
    const ceoRes = await fetch(`${API_BASE}/payment-history`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const ceoData = await ceoRes.json();
    if (!ceoRes.ok || !ceoData.success) throw new Error('CEO payment history failed');

    const mgrRes = await fetch(`${API_BASE}/payment-history`, {
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    const mgrData = await mgrRes.json();
    if (!mgrRes.ok || !mgrData.success) throw new Error('Manager payment history failed');
    if (mgrData.branchScope !== 1) throw new Error(`Expected manager branchScope to be 1, got ${mgrData.branchScope}`);
  });

  console.log(`\n======================================================`);
  console.log(`TEST RESULTS: ${passed} / ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log(`======================================================\n`);

  if (passed !== total) process.exit(1);
}

runRoleVisibilityTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
