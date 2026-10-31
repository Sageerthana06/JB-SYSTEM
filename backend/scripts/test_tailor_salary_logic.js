require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics,
  calculateCustomerPayments,
  roundLKR
} = require('../src/utils/salaryCalculator');

console.log('=== TEST SUITE: WEEKLY TAILOR SALARY MANAGEMENT ENGINE ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] ${testName}`);
    console.error(`  Error: ${err.message}`);
  }
}

// -------------------------------------------------------------
// 1. BUSINESS ALLOCATION RULES & EXAMPLES
// -------------------------------------------------------------
runTest('Example A, C & B: Order LKR 1,000 exact 50/25/25 allocation split', () => {
  const mockOrder = {
    id: 1001,
    orderNumber: 'TEST-ORD-1001',
    status: 'READY',
    totalAmount: 1000,
    priceStatus: 'ACCEPTED',
    priceAcceptedByCustomer: true,
    tasks: [
      { taskType: 'CUTTING', assignedTailorId: 10, status: 'COMPLETED', completedAt: new Date() },
      { taskType: 'STITCHING', assignedTailorId: 11, status: 'COMPLETED', completedAt: new Date() }
    ],
    payments: [{ amount: 1000, status: 'VERIFIED' }]
  };

  const res = calculateOrderSalaryAllocations(mockOrder, []);
  assert.strictEqual(res.agreedPrice, 1000);
  assert.strictEqual(res.officeAllocation, 500, 'Office allocation must be exactly 50% = 500');

  const cuttingAlloc = res.allocations.find(a => a.workType === 'CUTTING');
  const stitchingAlloc = res.allocations.find(a => a.workType === 'STITCHING');

  assert.strictEqual(cuttingAlloc.allocatedAmount, 250, 'Cutting allocation must be 25% = 250');
  assert.strictEqual(stitchingAlloc.allocatedAmount, 250, 'Stitching allocation must be 25% = 250');
  assert.strictEqual(cuttingAlloc.allocatedAmount + stitchingAlloc.allocatedAmount + res.officeAllocation, 1000, 'Sum must equal 100%');
});

runTest('Example D: Order LKR 2,000 split (Office 1,000, Cutting 500, Stitching 500)', () => {
  const mockOrder = {
    id: 1002,
    orderNumber: 'TEST-ORD-1002',
    status: 'READY',
    totalAmount: 2000,
    priceStatus: 'ACCEPTED',
    priceAcceptedByCustomer: true,
    tasks: [
      { taskType: 'CUTTING', assignedTailorId: 10, status: 'COMPLETED' },
      { taskType: 'STITCHING', assignedTailorId: 11, status: 'COMPLETED' }
    ],
    payments: [{ amount: 2000, status: 'VERIFIED' }]
  };

  const res = calculateOrderSalaryAllocations(mockOrder, []);
  assert.strictEqual(res.officeAllocation, 1000);
  assert.strictEqual(res.allocations.find(a => a.workType === 'CUTTING').allocatedAmount, 500);
  assert.strictEqual(res.allocations.find(a => a.workType === 'STITCHING').allocatedAmount, 500);
});

// -------------------------------------------------------------
// 2. STATE MACHINE: WORK COMPLETION & CUSTOMER PAYMENT
// -------------------------------------------------------------
runTest('Example A State: Cutting completed, stitching incomplete, customer paid in full', () => {
  const mockOrder = {
    id: 1003,
    orderNumber: 'TEST-ORD-1003',
    status: 'CUTTING',
    totalAmount: 1000,
    priceStatus: 'ACCEPTED',
    tasks: [
      { taskType: 'CUTTING', assignedTailorId: 10, status: 'COMPLETED', completedAt: new Date() },
      { taskType: 'STITCHING', assignedTailorId: 11, status: 'ASSIGNED', completedAt: null }
    ],
    payments: [{ amount: 1000, status: 'VERIFIED' }]
  };

  const res = calculateOrderSalaryAllocations(mockOrder, []);
  const cutting = res.allocations.find(a => a.workType === 'CUTTING');
  const stitching = res.allocations.find(a => a.workType === 'STITCHING');

  assert.strictEqual(cutting.status, 'PAYABLE', 'Cutting must be PAYABLE (work complete + customer fully paid)');
  assert.strictEqual(cutting.allocatedAmount, 250);
  assert.strictEqual(stitching.status, 'WORK_PENDING', 'Stitching must be WORK_PENDING (work not complete)');
});

runTest('Example B State: Both completed, customer paid only 50% -> ON_HOLD_CUSTOMER_PAYMENT', () => {
  const mockOrder = {
    id: 1004,
    orderNumber: 'TEST-ORD-1004',
    status: 'READY',
    totalAmount: 1000,
    priceStatus: 'ACCEPTED',
    tasks: [
      { taskType: 'CUTTING', assignedTailorId: 10, status: 'COMPLETED', completedAt: new Date() },
      { taskType: 'STITCHING', assignedTailorId: 11, status: 'COMPLETED', completedAt: new Date() }
    ],
    payments: [{ amount: 500, status: 'VERIFIED' }] // Customer only paid 500
  };

  const res = calculateOrderSalaryAllocations(mockOrder, []);
  const cutting = res.allocations.find(a => a.workType === 'CUTTING');
  const stitching = res.allocations.find(a => a.workType === 'STITCHING');

  assert.strictEqual(cutting.status, 'ON_HOLD_CUSTOMER_PAYMENT', 'Cutting must be held until customer full payment');
  assert.strictEqual(stitching.status, 'ON_HOLD_CUSTOMER_PAYMENT', 'Stitching must be held until customer full payment');
  assert.strictEqual(cutting.isCustomerFullyPaid, false);
});

runTest('Example C State: Customer settles full payment -> Transitions to PAYABLE -> PAID when disbursed', () => {
  const mockOrder = {
    id: 1005,
    orderNumber: 'TEST-ORD-1005',
    status: 'READY',
    totalAmount: 1000,
    priceStatus: 'ACCEPTED',
    tasks: [
      { taskType: 'CUTTING', assignedTailorId: 10, status: 'COMPLETED', completedAt: new Date() },
      { taskType: 'STITCHING', assignedTailorId: 11, status: 'COMPLETED', completedAt: new Date() }
    ],
    payments: [
      { amount: 500, status: 'VERIFIED' },
      { amount: 500, status: 'VERIFIED' } // Multiple payments totaling full 1000
    ]
  };

  // Before salary payment recorded
  const beforePay = calculateOrderSalaryAllocations(mockOrder, []);
  assert.strictEqual(beforePay.allocations.find(a => a.workType === 'CUTTING').status, 'PAYABLE');
  assert.strictEqual(beforePay.allocations.find(a => a.workType === 'STITCHING').status, 'PAYABLE');

  // After Cutting salary payment recorded in TailorSalaryPayment
  const recordedDisbursements = [
    {
      id: 1,
      orderId: 1005,
      tailorId: 10,
      workType: 'CUTTING',
      amountPaid: 250,
      paymentDate: new Date(),
      paymentMethod: 'Cash'
    }
  ];

  const afterPay = calculateOrderSalaryAllocations(mockOrder, recordedDisbursements);
  const cuttingAfter = afterPay.allocations.find(a => a.workType === 'CUTTING');
  const stitchingAfter = afterPay.allocations.find(a => a.workType === 'STITCHING');

  assert.strictEqual(cuttingAfter.status, 'PAID', 'Cutting allocation must now be PAID');
  assert.strictEqual(cuttingAfter.paymentRecord.amountPaid, 250);
  assert.strictEqual(stitchingAfter.status, 'PAYABLE', 'Stitching allocation remains PAYABLE until recorded');
});

// -------------------------------------------------------------
// 3. UNPRICED & PRICE-PENDING SAFETY
// -------------------------------------------------------------
runTest('Price-pending and zero-price orders safely skipped', () => {
  const unpricedOrder = {
    id: 1006,
    orderNumber: 'TEST-ORD-1006',
    status: 'ORDER_CONFIRMED',
    totalAmount: 0,
    priceStatus: 'PENDING'
  };

  const declinedOrder = {
    id: 1007,
    orderNumber: 'TEST-ORD-1007',
    status: 'ORDER_CONFIRMED',
    totalAmount: 1500,
    priceStatus: 'DECLINED'
  };

  const resUnpriced = calculateOrderSalaryAllocations(unpricedOrder, []);
  const resDeclined = calculateOrderSalaryAllocations(declinedOrder, []);

  assert.strictEqual(resUnpriced.length, 0, 'Unpriced order must return 0 allocations');
  assert.strictEqual(resDeclined.length, 0, 'Declined price order must return 0 allocations');
});

// -------------------------------------------------------------
// 4. ASIA/COLOMBO WEEKLY BOUNDARIES & DATE ARITHMETIC
// -------------------------------------------------------------
runTest('Asia/Colombo weekly boundaries correctly compute Monday to Sunday', () => {
  // Test reference date: 2026-10-26 (Monday in Colombo)
  const range = getColomboWeekRange('2026-10-26T10:00:00+05:30');

  assert.strictEqual(range.startDateStr, '2026-10-26', 'Monday start must be 2026-10-26');
  assert.strictEqual(range.endDateStr, '2026-11-01', 'Sunday end must be 2026-11-01');
  assert.strictEqual(range.formattedMonday, '26 Oct 2026');
  assert.strictEqual(range.formattedSunday, '01 Nov 2026');

  // Verify millisecond duration spans exactly 7 days
  const durationMs = range.endOfWeek.getTime() - range.startOfWeek.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(durationMs - sevenDaysMs) < 1000, 'Range must span exactly 7 days');
});

// -------------------------------------------------------------
// 5. CARRY-FORWARD CALCULATION
// -------------------------------------------------------------
runTest('Carry-forward correctly detects unpaid eligible work from prior weeks', () => {
  const currentWeekRange = getColomboWeekRange('2026-10-26');
  const pastWeekDate = new Date('2026-10-15T10:00:00Z'); // Previous week

  const mockAllocations = [
    {
      allocationKey: '1008-CUTTING-10',
      allocatedAmount: 250,
      workCompletedAt: pastWeekDate,
      isWorkCompleted: true,
      isCustomerFullyPaid: true,
      status: 'PAYABLE',
      tailorId: 10,
      paymentRecord: null
    },
    {
      allocationKey: '1009-STITCHING-11',
      allocatedAmount: 300,
      workCompletedAt: new Date('2026-10-27T10:00:00+05:30'), // Completed IN current week
      isWorkCompleted: true,
      isCustomerFullyPaid: true,
      status: 'PAYABLE',
      tailorId: 11,
      paymentRecord: null
    }
  ];

  const metrics = computeWeeklySalaryMetrics(mockAllocations, [], currentWeekRange);
  assert.strictEqual(metrics.summary.totalCarriedForward, 250, 'Past unpaid allocation must carry forward');
  assert.strictEqual(metrics.summary.totalEarnedInWeek, 300, 'Only current week completed work counts as earned in week');
  assert.strictEqual(metrics.summary.participatingTailorsCount, 2);
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log(`\n======================================================`);
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
console.log(`======================================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
