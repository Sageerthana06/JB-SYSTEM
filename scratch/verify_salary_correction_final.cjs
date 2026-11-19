const { prisma, pool } = require('../backend/src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics,
  toCents,
  roundLKR
} = require('../backend/src/utils/salaryCalculator');

async function runVerification() {
  console.log('=== JB GROUP WEEKLY TAILOR SALARY CORRECTION VERIFICATION ===\n');

  const weekRange = getColomboWeekRange(new Date('2026-11-08T12:00:00+05:30'));
  console.log(`Business Week: ${weekRange.weekLabel}`);
  console.log(`Range: ${weekRange.formattedMonday} to ${weekRange.formattedSunday} (Asia/Colombo)\n`);

  // Fetch all orders matching the production database
  const orders = await prisma.order.findMany({
    where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
    include: {
      customer: { select: { id: true, name: true, primaryPhone: true } },
      garmentDetails: { select: { dressType: true, quantity: true } },
      branch: { select: { id: true, name: true } },
      assignedTailor: { select: { id: true, name: true, email: true, role: true } },
      tasks: {
        include: {
          assignedTailor: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { sequence: 'asc' }
      },
      payments: {
        orderBy: { createdAt: 'asc' }
      },
      productionHistory: {
        orderBy: { startedAt: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Fetched ${orders.length} non-cancelled orders from PostgreSQL.`);

  // 1. Verify the 7 specific orders individually
  const targetIds = [202, 215, 239, 240, 245, 246, 247];
  console.log('\n--- VERIFYING 7 ORDERS INDIVIDUALLY ---');
  for (const id of targetIds) {
    const ord = orders.find(o => o.id === id);
    if (!ord) {
      console.error(`ERROR: Order with id ${id} not found!`);
      continue;
    }
    const orderSalary = calculateOrderSalaryAllocations(ord, []);
    console.log(`\nOrder #${ord.orderNumber} (ID: ${ord.id}):`);
    console.log(`  Price: LKR ${ord.totalAmount}, Status: ${ord.status}, priceStatus: ${ord.priceStatus}, priceAcceptedByCustomer: ${ord.priceAcceptedByCustomer}`);
    console.log(`  Allocations generated: ${orderSalary.allocations ? orderSalary.allocations.length : 0}`);
    for (const a of orderSalary.allocations) {
      console.log(`    -> Type: ${a.workType}, Tailor: ${a.tailorName} (${a.tailorId}), Rate: ${a.allocationPercent}%, Amount: LKR ${a.allocatedAmount.toFixed(2)}, Status: ${a.status}`);
    }
  }

  // 2. Aggregate allocations across all qualifying orders up to week end
  const startMs = weekRange.startOfWeek.getTime();
  const endMs = weekRange.endOfWeek.getTime();
  const allRawAllocations = [];
  const uniqueOrders = new Set();

  for (const order of orders) {
    const orderDateVal = order.orderDate || order.createdAt;
    const orderTimeMs = orderDateVal ? new Date(orderDateVal).getTime() : null;
    if (orderTimeMs !== null && !isNaN(orderTimeMs) && orderTimeMs > endMs) {
      continue;
    }

    const orderSalary = calculateOrderSalaryAllocations(order, []);
    if (orderSalary && Array.isArray(orderSalary.allocations) && orderSalary.allocations.length > 0) {
      uniqueOrders.add(order.id);
      for (const a of orderSalary.allocations) {
        allRawAllocations.push(a);
      }
    }
  }

  // 3. Compute Weekly Metrics using production backend function
  const metrics = computeWeeklySalaryMetrics(allRawAllocations, [], weekRange);

  console.log('\n--- OVERALL WEEK 45 METRICS ---');
  console.log(`Total Orders Qualifying: ${uniqueOrders.size}`);
  console.log(`Total Allocations: ${allRawAllocations.length}`);
  console.log(`Total Earned (in week): LKR ${metrics.summary.totalEarnedInWeek.toFixed(2)}`);
  console.log(`Salary Payable: LKR ${metrics.summary.totalPayable.toFixed(2)}`);
  console.log(`Held (Customer Payment): LKR ${metrics.summary.totalHeldOnCustomerPayment.toFixed(2)}`);
  console.log(`Work Pending: LKR ${metrics.summary.totalWorkPending.toFixed(2)}`);
  console.log(`Salary Paid: LKR ${metrics.summary.totalPaidInWeek.toFixed(2)}`);
  console.log(`Carried Forward: LKR ${metrics.summary.totalCarriedForward.toFixed(2)}`);
  console.log(`Active Participating Tailors: ${metrics.summary.participatingTailorsCount}`);

  // 4. Mathematical Reconciliation Check
  const earnedCheck = Math.abs(metrics.summary.totalEarnedInWeek - (metrics.summary.totalPayable + metrics.summary.totalHeldOnCustomerPayment)) < 0.01;
  console.log(`\nReconciliation Check: Total Earned = Payable + Held? ${earnedCheck ? 'PASSED (0.00 discrepancy)' : 'FAILED'}`);

  // 5. Tailor Statements Breakdown
  const tailorMap = new Map();
  for (const alloc of allRawAllocations) {
    if (!alloc.tailorId) continue;
    if (!tailorMap.has(alloc.tailorId)) {
      tailorMap.set(alloc.tailorId, {
        tailorId: alloc.tailorId,
        tailorName: alloc.tailorName,
        earnedCents: 0,
        payableCents: 0,
        heldCents: 0,
        workPendingCents: 0,
        carriedForwardCents: 0,
        jobsCount: 0
      });
    }
    const stmt = tailorMap.get(alloc.tailorId);
    const allocCents = toCents(alloc.allocatedAmount);
    stmt.jobsCount += 1;

    const workCompletedMs = alloc.workCompletedAt ? new Date(alloc.workCompletedAt).getTime() : null;
    if (alloc.isWorkCompleted && workCompletedMs !== null && workCompletedMs >= startMs && workCompletedMs <= endMs) {
      stmt.earnedCents += allocCents;
    }
    if (alloc.isWorkCompleted && workCompletedMs !== null && workCompletedMs < startMs && alloc.isCustomerFullyPaid && alloc.status === 'PAYABLE') {
      stmt.carriedForwardCents += allocCents;
    }
    if (alloc.status === 'PAYABLE') stmt.payableCents += allocCents;
    if (alloc.status === 'ON_HOLD_CUSTOMER_PAYMENT') stmt.heldCents += allocCents;
    if (alloc.status === 'WORK_PENDING') stmt.workPendingCents += allocCents;
  }

  console.log('\n--- TAILOR STATEMENTS BREAKDOWN ---');
  for (const [, t] of tailorMap) {
    const earned = t.earnedCents / 100;
    const payable = t.payableCents / 100;
    const held = t.heldCents / 100;
    const pending = t.workPendingCents / 100;
    console.log(`Tailor: ${t.tailorName.padEnd(16)} | Jobs: ${String(t.jobsCount).padStart(2)} | Payable: LKR ${payable.toFixed(2).padStart(9)} | Held: LKR ${held.toFixed(2).padStart(8)} | Pending: LKR ${pending.toFixed(2).padStart(8)} | Earned: LKR ${earned.toFixed(2).padStart(9)}`);
  }

  // 6. Duplicate Allocation Check
  const allocationKeys = new Set();
  let duplicateCount = 0;
  for (const a of allRawAllocations) {
    const key = `${a.orderId}_${a.workType}`;
    if (allocationKeys.has(key)) {
      console.error(`DUPLICATE FOUND: ${key}`);
      duplicateCount++;
    }
    allocationKeys.add(key);
  }
  console.log(`\nDuplicate Allocations Check: ${duplicateCount === 0 ? 'PASSED (Zero duplicates)' : 'FAILED'}`);

  // 7. Test mock unaccepted quote without payment or production
  const mockUnacceptedQuote = {
    orderNumber: 9999,
    status: 'PENDING_APPROVAL',
    priceStatus: 'SENT',
    priceAcceptedByCustomer: false,
    agreedTotal: 5000,
    advancePayment: 0,
    payments: [],
    tasks: []
  };
  const mockSalary = calculateOrderSalaryAllocations(mockUnacceptedQuote, []);
  const mockAllocsCount = mockSalary && mockSalary.allocations ? mockSalary.allocations.length : 0;
  console.log(`Mock Unaccepted Quote (No payment, no production) -> Allocations: ${mockAllocsCount} (Expected: 0) -> ${mockAllocsCount === 0 ? 'PASSED' : 'FAILED'}`);

  await prisma.$disconnect();
  await pool.end();
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
