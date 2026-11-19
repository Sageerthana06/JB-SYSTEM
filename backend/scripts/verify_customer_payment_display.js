/**
 * Verification Script for Customer Payment Display Logic
 * Tests calculateOrderPaymentSummary against real DB schema & diverse scenarios
 */

const assert = require('assert');

// Logic extracted identically from SalesERP.jsx
const calculateOrderPaymentSummary = (order) => {
  if (!order) {
    return {
      orderTotal: 0,
      paidAmount: 0,
      balanceDue: 0,
      isFullyPaid: false,
      isPartiallyPaid: false,
      isUnpaid: true,
      hasPendingSlip: false
    };
  }

  const raw = order.rawOrder || order;

  // 1. Order Total: prefers agreedTotal when positive, falls back to totalAmount, then total
  const orderTotal = Number(raw.agreedTotal) > 0
    ? Number(raw.agreedTotal)
    : (raw.totalAmount !== null && raw.totalAmount !== undefined
      ? Number(raw.totalAmount)
      : (order.total !== null && order.total !== undefined ? Number(order.total) : 0));

  // 2. Paid Amount: Sum of ONLY VERIFIED payments
  const paymentsList = Array.isArray(raw.payments) ? raw.payments : [];

  let verifiedSum = 0;
  let hasPendingSlip = false;

  for (const p of paymentsList) {
    if (!p) continue;
    const pStatus = p.status ? String(p.status).trim().toUpperCase() : 'VERIFIED';
    if (pStatus === 'VERIFIED') {
      verifiedSum += Number(p.amount) || 0;
    } else if (pStatus === 'PENDING_VERIFICATION') {
      hasPendingSlip = true;
    }
  }

  // Handle legacy orders without Payment records carefully by checking residual advancePayment
  const advance = Number(raw.advancePayment) || 0;
  const legacyAdvance = Math.max(0, advance - verifiedSum);
  const paidAmount = Math.round((verifiedSum + legacyAdvance) * 100) / 100;

  // 3. Balance Due: Remaining amount customer needs to pay
  const balanceDue = orderTotal > 0 ? Math.max(0, Math.round((orderTotal - paidAmount) * 100) / 100) : 0;

  const isFullyPaid = orderTotal > 0 && paidAmount >= orderTotal;
  const isPartiallyPaid = orderTotal > 0 && paidAmount > 0 && paidAmount < orderTotal;
  const isUnpaid = orderTotal > 0 && paidAmount === 0;

  return {
    orderTotal,
    paidAmount,
    balanceDue,
    isFullyPaid,
    isPartiallyPaid,
    isUnpaid,
    hasPendingSlip
  };
};

console.log('===============================================================');
console.log('   CUSTOMER PAYMENT DISPLAY CALCULATION VERIFICATION SUITE    ');
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

// Test 1: User's Example 1 (Partial Payment)
// Order Total: LKR 1,600 | Paid Amount: LKR 500 | Balance Due: LKR 1,100
test('1. User Example 1: Partial payment (Total: 1600, Paid: 500 -> Balance: 1100)', () => {
  const order = {
    totalAmount: 1600,
    payments: [{ id: 1, amount: 500, status: 'VERIFIED' }]
  };
  const res = calculateOrderPaymentSummary(order);
  assert.strictEqual(res.orderTotal, 1600);
  assert.strictEqual(res.paidAmount, 500);
  assert.strictEqual(res.balanceDue, 1100);
  assert.strictEqual(res.isPartiallyPaid, true);
  assert.strictEqual(res.isFullyPaid, false);
});

// Test 2: User's Example 2 (Fully Paid)
// Order Total: LKR 1,600 | Paid Amount: LKR 1,600 | Balance Due: LKR 0
test('2. User Example 2: Fully paid (Total: 1600, Paid: 1600 -> Balance: 0)', () => {
  const order = {
    totalAmount: 1600,
    payments: [{ id: 1, amount: 1600, status: 'VERIFIED' }]
  };
  const res = calculateOrderPaymentSummary(order);
  assert.strictEqual(res.orderTotal, 1600);
  assert.strictEqual(res.paidAmount, 1600);
  assert.strictEqual(res.balanceDue, 0);
  assert.strictEqual(res.isFullyPaid, true);
  assert.strictEqual(res.isPartiallyPaid, false);
});

// Test 3: Multiple partial payments (Multiple payment records in database)
test('3. Multiple partial payments (500 + 300 + 300 on 1600 order -> Paid: 1100, Balance: 500)', () => {
  const order = {
    totalAmount: 1600,
    payments: [
      { id: 1, amount: 500, status: 'VERIFIED' },
      { id: 2, amount: 300, status: 'VERIFIED' },
      { id: 3, amount: 300, status: 'VERIFIED' }
    ]
  };
  const res = calculateOrderPaymentSummary(order);
  assert.strictEqual(res.orderTotal, 1600);
  assert.strictEqual(res.paidAmount, 1100);
  assert.strictEqual(res.balanceDue, 500);
  assert.strictEqual(res.isPartiallyPaid, true);
});

// Test 4: Pending slip should NOT be counted in Paid Amount
test('4. Exclude PENDING_VERIFICATION payments from Paid Amount', () => {
  const order = {
    totalAmount: 1600,
    payments: [
      { id: 1, amount: 500, status: 'VERIFIED' },
      { id: 2, amount: 1100, status: 'PENDING_VERIFICATION' }
    ]
  };
  const res = calculateOrderPaymentSummary(order);
  assert.strictEqual(res.paidAmount, 500, 'Pending slip of 1100 must not be counted in Paid Amount');
  assert.strictEqual(res.balanceDue, 1100, 'Balance must remain 1100 until verified');
  assert.strictEqual(res.hasPendingSlip, true);
});

// Test 5: Rejected slip should NOT be counted in Paid Amount
test('5. Exclude REJECTED payments from Paid Amount', () => {
  const order = {
    totalAmount: 1600,
    payments: [
      { id: 1, amount: 500, status: 'VERIFIED' },
      { id: 2, amount: 1100, status: 'REJECTED' }
    ]
  };
  const res = calculateOrderPaymentSummary(order);
  assert.strictEqual(res.paidAmount, 500);
  assert.strictEqual(res.balanceDue, 1100);
  assert.strictEqual(res.hasPendingSlip, false);
});

// Test 6: Unpaid order with 0 payments
test('6. Unpaid order with 0 payments (Total: 1600, Payments: [] -> Paid: 0, Balance: 1600)', () => {
  const order = {
    totalAmount: 1600,
    advancePayment: 0,
    payments: []
  };
  const res = calculateOrderPaymentSummary(order);
  assert.strictEqual(res.orderTotal, 1600);
  assert.strictEqual(res.paidAmount, 0);
  assert.strictEqual(res.balanceDue, 1600);
  assert.strictEqual(res.isUnpaid, true);
});

// Test 7: Price pending order
test('7. Price pending order (Total: 0 -> Paid: 0, Balance: 0)', () => {
  const order = {
    totalAmount: 0,
    payments: []
  };
  const res = calculateOrderPaymentSummary(order);
  assert.strictEqual(res.orderTotal, 0);
  assert.strictEqual(res.paidAmount, 0);
  assert.strictEqual(res.balanceDue, 0);
});

// Test 8: Agreed total priority over totalAmount
test('8. Agreed total priority (agreedTotal: 2500, totalAmount: 3000 -> Order Total: 2500)', () => {
  const order = {
    agreedTotal: 2500,
    totalAmount: 3000,
    payments: [{ id: 1, amount: 1000, status: 'VERIFIED' }]
  };
  const res = calculateOrderPaymentSummary(order);
  assert.strictEqual(res.orderTotal, 2500);
  assert.strictEqual(res.paidAmount, 1000);
  assert.strictEqual(res.balanceDue, 1500);
});

// Test 9: Legacy advancePayment preserved when pending slip is attached
test('9. Legacy advance payment preserved when pending slip uploaded (advance: 500, pending: 1100)', () => {
  const order = {
    totalAmount: 1600,
    advancePayment: 500,
    payments: [{ id: 1, amount: 1100, status: 'PENDING_VERIFICATION' }]
  };
  const res = calculateOrderPaymentSummary(order);
  assert.strictEqual(res.orderTotal, 1600);
  assert.strictEqual(res.paidAmount, 500, 'Legacy advance payment must not be wiped out by pending slip');
  assert.strictEqual(res.balanceDue, 1100);
  assert.strictEqual(res.hasPendingSlip, true);
});

// Test 10: Real database records test (Order 200, 201, 204, 224 from Neon DB)
test('10. Real DB orders verification', () => {
  // Real DB Order #200: total: 1000, 1 verified payment of 1000
  const realOrder200 = {
    id: 200,
    orderNumber: 'JB-20261031-0001',
    totalAmount: 1000,
    payments: [{ id: 118, amount: 1000, status: 'VERIFIED' }]
  };
  const res200 = calculateOrderPaymentSummary(realOrder200);
  assert.strictEqual(res200.orderTotal, 1000);
  assert.strictEqual(res200.paidAmount, 1000);
  assert.strictEqual(res200.balanceDue, 0);
  assert.strictEqual(res200.isFullyPaid, true);

  // Real DB Order #224: total: 1600, 0 payments
  const realOrder224 = {
    id: 224,
    orderNumber: 'JB-20261103-0011',
    totalAmount: 1600,
    payments: []
  };
  const res224 = calculateOrderPaymentSummary(realOrder224);
  assert.strictEqual(res224.orderTotal, 1600);
  assert.strictEqual(res224.paidAmount, 0);
  assert.strictEqual(res224.balanceDue, 1600);
  assert.strictEqual(res224.isUnpaid, true);
});

console.log('\n===============================================================');
console.log(`   PAYMENT DISPLAY TESTS: ${passed} / ${total} PASSED`);
console.log('===============================================================\n');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
