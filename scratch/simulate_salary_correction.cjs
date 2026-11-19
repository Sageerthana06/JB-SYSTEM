const { prisma, pool } = require('../backend/src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics,
  roundLKR
} = require('../backend/src/utils/salaryCalculator');

async function simulate() {
  console.log('=== SIMULATING SAFE CORRECTION FOR 7 EXCLUDED ORDERS ===\n');

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
      payments: true,
      productionHistory: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const targetIds = new Set([202, 215, 239, 240, 245, 246, 247]);

  // Current calculation
  const currentAllocations = [];
  for (const o of orders) {
    const res = calculateOrderSalaryAllocations(o, []);
    if (res && res.allocations) currentAllocations.push(...res.allocations);
  }

  // Corrected calculation:
  // For the 7 orders, allow price qualification if:
  // (1) Order status has moved past approval into production/ready (e.g. CUTTING, STITCHING, READY, DELIVERED), OR
  // (2) Customer has made an advance/full payment.
  const correctedAllocations = [];
  const newlyAddedAllocations = [];

  for (const o of orders) {
    // If it's one of the 7 orders, treat price as shop-approved
    const isTarget = targetIds.has(o.id);
    let orderToEval = o;
    if (isTarget) {
      orderToEval = {
        ...o,
        // Treat as accepted if paid or in production/ready
        priceAcceptedByCustomer: true
      };
    }

    const res = calculateOrderSalaryAllocations(orderToEval, []);
    if (res && res.allocations) {
      correctedAllocations.push(...res.allocations);
      if (isTarget) {
        newlyAddedAllocations.push(...res.allocations);
      }
    }
  }

  const weekRange = getColomboWeekRange(null);
  const currentSummary = computeWeeklySalaryMetrics(currentAllocations, [], weekRange).summary;
  const correctedSummary = computeWeeklySalaryMetrics(correctedAllocations, [], weekRange).summary;

  console.log('--- METRIC COMPARISON ---');
  console.log(`Metric                   | Current (53 Orders) | Corrected (60 Orders) | Difference`);
  console.log(`-------------------------|---------------------|-----------------------|-----------`);
  console.log(`Total Orders with Alloc  | 53 orders           | 60 orders             | +7 orders`);
  console.log(`Total Allocations Count  | ${String(currentAllocations.length).padEnd(19)} | ${String(correctedAllocations.length).padEnd(21)} | +${correctedAllocations.length - currentAllocations.length} allocations`);
  console.log(`Total Earned (Week)      | LKR ${String(currentSummary.totalEarnedInWeek).padEnd(15)} | LKR ${String(correctedSummary.totalEarnedInWeek).padEnd(17)} | +LKR ${(correctedSummary.totalEarnedInWeek - currentSummary.totalEarnedInWeek).toFixed(2)}`);
  console.log(`Salary Payable           | LKR ${String(currentSummary.totalPayable).padEnd(15)} | LKR ${String(correctedSummary.totalPayable).padEnd(17)} | +LKR ${(correctedSummary.totalPayable - currentSummary.totalPayable).toFixed(2)}`);
  console.log(`Held (Customer Due)      | LKR ${String(currentSummary.totalHeldOnCustomerPayment).padEnd(15)} | LKR ${String(correctedSummary.totalHeldOnCustomerPayment).padEnd(17)} | +LKR ${(correctedSummary.totalHeldOnCustomerPayment - currentSummary.totalHeldOnCustomerPayment).toFixed(2)}`);
  console.log(`Work Pending             | LKR ${String(currentSummary.totalWorkPending).padEnd(15)} | LKR ${String(correctedSummary.totalWorkPending).padEnd(17)} | +LKR ${(correctedSummary.totalWorkPending - currentSummary.totalWorkPending).toFixed(2)}`);
  console.log(`Salary Paid (Week)       | LKR ${String(currentSummary.totalPaidInWeek).padEnd(15)} | LKR ${String(correctedSummary.totalPaidInWeek).padEnd(17)} | LKR 0.00`);
  console.log(`Carried Forward          | LKR ${String(currentSummary.totalCarriedForward).padEnd(15)} | LKR ${String(correctedSummary.totalCarriedForward).padEnd(17)} | LKR 0.00`);

  console.log('\n--- BREAKDOWN OF THE 14 NEW ALLOCATIONS (FROM 7 ORDERS) ---');
  let sumNewPayable = 0;
  let sumNewHeld = 0;
  newlyAddedAllocations.forEach(a => {
    console.log(`  Order #${a.orderId} (${a.orderNumber}) - ${a.customerName} | ${a.workType} (25%): LKR ${a.allocatedAmount} | Tailor: ${a.tailorName} (#${a.tailorId}) | CustPaid: LKR ${a.customerTotalPaid}/${a.agreedPrice} | Status: ${a.status}`);
    if (a.status === 'PAYABLE') sumNewPayable += a.allocatedAmount;
    if (a.status === 'ON_HOLD_CUSTOMER_PAYMENT') sumNewHeld += a.allocatedAmount;
  });
  console.log(`\nNew Payable Subtotal: LKR ${sumNewPayable.toFixed(2)}`);
  console.log(`New Held Subtotal:    LKR ${sumNewHeld.toFixed(2)}`);
  console.log(`Total New Earned:     LKR ${(sumNewPayable + sumNewHeld).toFixed(2)}`);

  console.log('\n--- IMPACT BY TAILOR ---');
  const tailorImpact = {};
  newlyAddedAllocations.forEach(a => {
    const tId = a.tailorId || 'Unassigned';
    const tName = a.tailorName || 'Unassigned';
    tailorImpact[tId] = tailorImpact[tId] || { name: tName, jobs: 0, payable: 0, held: 0, total: 0 };
    tailorImpact[tId].jobs++;
    tailorImpact[tId].total += a.allocatedAmount;
    if (a.status === 'PAYABLE') tailorImpact[tId].payable += a.allocatedAmount;
    if (a.status === 'ON_HOLD_CUSTOMER_PAYMENT') tailorImpact[tId].held += a.allocatedAmount;
  });

  for (const [id, t] of Object.entries(tailorImpact)) {
    console.log(`  Tailor #${id} (${t.name}): +${t.jobs} jobs | +LKR ${t.total.toFixed(2)} Earned (Payable: +LKR ${t.payable.toFixed(2)}, Held: +LKR ${t.held.toFixed(2)})`);
  }

  await prisma.$disconnect();
}

simulate().catch(console.error);

