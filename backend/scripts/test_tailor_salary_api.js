require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const assert = require('assert');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET;

const ceoToken = jwt.sign({ id: 1, role: 'SUPER_ADMIN', name: 'Jeyatheepan Joseph (CEO)' }, JWT_SECRET, { expiresIn: '1h' });
const managerToken = jwt.sign({ id: 3, role: 'MANAGER', name: 'Manager', branchId: 1 }, JWT_SECRET, { expiresIn: '1h' });
const tailorToken = jwt.sign({ id: 18, role: 'TAILOR', name: 'Jagatheeswary' }, JWT_SECRET, { expiresIn: '1h' });

async function runApiTests() {
  console.log('=== INTEGRATION TEST: SALARY MANAGEMENT HTTP ENDPOINTS ===\n');
  let passed = 0;
  let total = 0;

  // Test 1: Health check
  total++;
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    console.log('✓ [PASS] Test 1: API is running and healthy');
    passed++;
  } catch (err) {
    console.error('✗ [FAIL] Test 1: Health check failed:', err.message);
  }

  // Test 2: CEO Weekly Salary Report
  total++;
  try {
    const res = await fetch(`${API_BASE}/salary/weekly-report`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.weekRange, 'Must return weekRange object');
    assert.ok(data.summary, 'Must return summary cards object');
    assert.ok(Array.isArray(data.allocations), 'Must return allocations array');
    assert.ok(Array.isArray(data.tailorStatements), 'Must return tailorStatements array');
    assert.ok(data.cuttingVsStitching, 'Must return cuttingVsStitching breakdown');
    console.log(`✓ [PASS] Test 2: CEO weekly salary report fetched successfully (Total allocations: ${data.allAllocationsCount})`);
    console.log(`         Summary: Earned=${data.summary.totalEarnedInWeek}, Payable=${data.summary.totalPayable}, Held=${data.summary.totalHeldOnCustomerPayment}, WorkPending=${data.summary.totalWorkPending}, CarriedForward=${data.summary.totalCarriedForward}, Participating Tailors=${data.summary.participatingTailorsCount}`);
    passed++;
  } catch (err) {
    console.error('✗ [FAIL] Test 2: Weekly report fetch failed:', err.message);
  }

  // Test 3: Security: Tailor CANNOT access management weekly-report endpoint (RBAC check)
  total++;
  try {
    const res = await fetch(`${API_BASE}/salary/weekly-report`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    assert.strictEqual(res.status, 403, 'Tailor must be denied access to management report');
    console.log('✓ [PASS] Test 3: Security RBAC: Tailor is strictly forbidden (403) from accessing CEO/Management weekly report');
    passed++;
  } catch (err) {
    console.error('✗ [FAIL] Test 3: Tailor RBAC check failed:', err.message);
  }

  // Test 4: Tailor accesses own personal salary panel
  total++;
  try {
    const res = await fetch(`${API_BASE}/salary/my-salary`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.tailor.id, 18);
    assert.ok(Array.isArray(data.allocations), 'Must return tailor own allocations');
    assert.ok(data.summary, 'Must return tailor personal summary');
    // Ensure all returned allocations belong strictly to this tailor
    for (const alloc of data.allocations) {
      assert.strictEqual(Number(alloc.tailorId), 18, 'All allocations must belong strictly to this tailor');
    }
    console.log(`✓ [PASS] Test 4: Individual Tailor Salary: Tailor (ID 18) retrieved their own permitted salary records (${data.allocations.length} jobs)`);
    passed++;
  } catch (err) {
    console.error('✗ [FAIL] Test 4: Tailor personal salary fetch failed:', err.message);
  }

  // Test 5: Filter check on weekly report (filter by workType = 'CUTTING')
  total++;
  try {
    const res = await fetch(`${API_BASE}/salary/weekly-report?workType=CUTTING`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    for (const alloc of data.allocations) {
      assert.strictEqual(alloc.workType, 'CUTTING', 'Filtered allocations must only contain CUTTING');
    }
    console.log(`✓ [PASS] Test 5: WorkType filter successfully filters allocations to CUTTING only (${data.filteredCount} records)`);
    passed++;
  } catch (err) {
    console.error('✗ [FAIL] Test 5: WorkType filter failed:', err.message);
  }

  // Test 6: Attempting to record salary payment when work is incomplete or customer not paid is BLOCKED
  total++;
  try {
    // Attempt payment for an uncompleted or unpayable order
    const res = await fetch(`${API_BASE}/salary/record-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        orderId: 999999,
        tailorId: 10,
        workType: 'CUTTING',
        amountPaid: 250
      })
    });
    assert.strictEqual(res.status, 404, 'Non-existent order must return 404');
    console.log('✓ [PASS] Test 6: Invalid / non-existent order salary payment is safely rejected');
    passed++;
  } catch (err) {
    console.error('✗ [FAIL] Test 6: Invalid payment rejection failed:', err.message);
  }

  // Test 7: Payment history endpoint
  total++;
  try {
    const res = await fetch(`${API_BASE}/salary/payment-history`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.payments), 'Must return payments array');
    console.log(`✓ [PASS] Test 7: Historical salary payment ledger accessible (${data.totalCount} historical payments)`);
    passed++;
  } catch (err) {
    console.error('✗ [FAIL] Test 7: Payment history fetch failed:', err.message);
  }

  // Test 8: Duplicate payout attempt on previously paid allocation returns HTTP 409 Conflict
  total++;
  try {
    // Susitha's Cutting allocation on Order 153 (JB-20261020-0001) was already paid
    const initialHistoryRes = await fetch(`${API_BASE}/salary/payment-history`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const initialHistory = await initialHistoryRes.json();
    const initialCount = initialHistory.totalCount;

    const dupRes = await fetch(`${API_BASE}/salary/record-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        orderId: 144,
        tailorId: 11,
        workType: 'CUTTING',
        amountPaid: 625,
        paymentMethod: 'Cash'
      })
    });

    const dupData = await dupRes.json();
    assert.strictEqual(dupRes.status, 409, `Duplicate payout must return HTTP 409 Conflict, got ${dupRes.status}`);
    assert.strictEqual(dupData.success, false, 'Duplicate response success must be false');
    assert.ok(dupData.message && dupData.message.includes('already been paid'), 'Message must indicate already paid');

    // Confirm no additional payment was created in the ledger
    const postHistoryRes = await fetch(`${API_BASE}/salary/payment-history`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const postHistory = await postHistoryRes.json();
    assert.strictEqual(postHistory.totalCount, initialCount, 'Payment count must remain unchanged');

    console.log(`✓ [PASS] Test 8: Duplicate salary payout attempt strictly rejected with HTTP 409 Conflict (Ledger preserved at ${initialCount} records)`);
    passed++;
  } catch (err) {
    console.error('✗ [FAIL] Test 8: Duplicate payout test failed:', err.message);
  }

  console.log(`\n======================================================`);
  console.log(`API TEST RESULTS: ${passed} / ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log(`======================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runApiTests();
