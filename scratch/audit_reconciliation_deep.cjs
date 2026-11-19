const { prisma, pool } = require('../backend/src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics,
  toCents,
  roundLKR
} = require('../backend/src/utils/salaryCalculator');

async function audit() {
  console.log('=== PHASE 1: DEEP RECONCILIATION AUDIT ===\n');

  const weekRange = getColomboWeekRange(new Date('2026-11-08T12:00:00+05:30'));
  console.log(`Week: ${weekRange.weekLabel}`);
  console.log(`Range: ${weekRange.formattedMonday} to ${weekRange.formattedSunday}`);
  const startMs = weekRange.startOfWeek.getTime();
  const endMs = weekRange.endOfWeek.getTime();

  const allOrders = await prisma.order.findMany({
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
      payments: { orderBy: { createdAt: 'asc' } },
      productionHistory: { orderBy: { startedAt: 'asc' } }
    },
    orderBy: { id: 'asc' }
  });

  console.log(`Total orders in DB: ${allOrders.length}`);

  // Examine each order
  const qualifyingOrders = [];
  const excludedOrders = [];
  const allAllocations = [];

  for (const ord of allOrders) {
    const orderDateVal = ord.orderDate || ord.createdAt;
    const orderTimeMs = orderDateVal ? new Date(orderDateVal).getTime() : null;
    const isFuture = orderTimeMs !== null && !isNaN(orderTimeMs) && orderTimeMs > endMs;

    const res = calculateOrderSalaryAllocations(ord, []);
    const allocCount = (res && res.allocations) ? res.allocations.length : 0;

    if (allocCount > 0) {
      qualifyingOrders.push({
        ord,
        res,
        isFuture,
        orderDateVal
      });
      for (const a of res.allocations) {
        allAllocations.push({ ...a, isFutureOrder: isFuture });
      }
    } else {
      excludedOrders.push(ord);
    }
  }

  console.log(`\nQualifying orders count: ${qualifyingOrders.length}`);
  console.log(`Excluded orders count: ${excludedOrders.length}`);
  console.log(`Total allocations generated: ${allAllocations.length}`);

  console.log('\n--- EXCLUDED ORDERS ---');
  for (const o of excludedOrders) {
    console.log(`Order #${o.id} (${o.orderNumber}): Status=${o.status}, priceStatus=${o.priceStatus}, priceAccepted=${o.priceAcceptedByCustomer}, totalAmount=${o.totalAmount}, payments=${o.payments ? o.payments.length : 0}`);
  }

  console.log('\n--- CHECKING ALLOCATIONS BY STATUS ---');
  const byStatus = {
    PAYABLE: [],
    ON_HOLD_CUSTOMER_PAYMENT: [],
    WORK_PENDING: [],
    PAID: []
  };

  for (const a of allAllocations) {
    if (!byStatus[a.status]) byStatus[a.status] = [];
    byStatus[a.status].push(a);
  }

  for (const [st, list] of Object.entries(byStatus)) {
    const totalAmt = list.reduce((sum, x) => sum + x.allocatedAmount, 0);
    console.log(`Status: ${st.padEnd(25)} | Count: ${String(list.length).padStart(3)} | Sum: LKR ${totalAmt.toFixed(2)}`);
  }

  console.log('\n--- DETAILED WORK PENDING ALLOCATIONS ---');
  for (const a of byStatus.WORK_PENDING) {
    console.log(`Order #${a.orderId} (${a.orderNumber}) | Work: ${a.workType} | Tailor: ${a.tailorName} (${a.tailorId || 'UNASSIGNED'}) | Amt: LKR ${a.allocatedAmount} | CustPaid: ${a.customerTotalPaid}/${a.agreedPrice} | isWorkCompleted: ${a.isWorkCompleted}`);
  }

  console.log('\n--- ORDER #260 DETAILS ---');
  const ord260 = allOrders.find(o => o.id === 260 || o.orderNumber.includes('260'));
  if (ord260) {
    console.log(`ID: ${ord260.id}, orderNumber: ${ord260.orderNumber}, status: ${ord260.status}, totalAmount: ${ord260.totalAmount}, assignedTailorId: ${ord260.assignedTailorId}`);
    console.log(`Tasks:`, ord260.tasks.map(t => ({ id: t.id, taskType: t.taskType, status: t.status, assignedTailorId: t.assignedTailorId })));
    const res260 = calculateOrderSalaryAllocations(ord260, []);
    console.log(`Allocations for #260:`, res260.allocations);
  } else {
    console.log('Order #260 not found!');
  }

  console.log('\n--- INDIVIDUAL TAILOR JOB COUNT RECONCILIATION ---');
  const tailorJobCounts = {};
  let unassignedJobs = 0;
  for (const a of allAllocations) {
    if (a.tailorId) {
      if (!tailorJobCounts[a.tailorName]) tailorJobCounts[a.tailorName] = { id: a.tailorId, total: 0, payable: 0, held: 0, pending: 0 };
      tailorJobCounts[a.tailorName].total++;
      if (a.status === 'PAYABLE') tailorJobCounts[a.tailorName].payable++;
      if (a.status === 'ON_HOLD_CUSTOMER_PAYMENT') tailorJobCounts[a.tailorName].held++;
      if (a.status === 'WORK_PENDING') tailorJobCounts[a.tailorName].pending++;
    } else {
      unassignedJobs++;
    }
  }

  let sumTailorJobs = 0;
  for (const [name, stats] of Object.entries(tailorJobCounts)) {
    sumTailorJobs += stats.total;
    console.log(`Tailor: ${name.padEnd(16)} | Total: ${stats.total} (Payable: ${stats.payable}, Held: ${stats.held}, Pending: ${stats.pending})`);
  }
  console.log(`Unassigned Jobs: ${unassignedJobs}`);
  console.log(`Sum of Tailor Jobs + Unassigned = ${sumTailorJobs} + ${unassignedJobs} = ${sumTailorJobs + unassignedJobs}`);
  console.log(`Total Allocations Count = ${allAllocations.length}`);

  await prisma.$disconnect();
  await pool.end();
}

audit().catch(e => {
  console.error(e);
  process.exit(1);
});

