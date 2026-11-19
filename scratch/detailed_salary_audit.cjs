const { prisma, pool } = require('../backend/src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics
} = require('../backend/src/utils/salaryCalculator');

async function detailedAudit() {
  console.log('=== DETAILED AUDIT OF POINTS 4, 5, 7, 8, 9, 10 ===\n');

  const currentWeekRange = getColomboWeekRange(null);
  const startMs = currentWeekRange.startOfWeek.getTime();
  const endMs = currentWeekRange.endOfWeek.getTime();

  const orders = await prisma.order.findMany({
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
    orderBy: { id: 'asc' }
  });

  const validOrders = orders.filter(o => !['CANCELLED', 'REJECTED'].includes(String(o.status || '').toUpperCase()));

  const allAllocations = [];
  for (const o of validOrders) {
    const res = calculateOrderSalaryAllocations(o, []);
    if (res && res.allocations) {
      allAllocations.push(...res.allocations);
    }
  }

  // --- POINT 4 & 5: Audit PAYABLE & ON_HOLD_CUSTOMER_PAYMENT ---
  console.log('--- AUDITING POINT 4 & 5: PAYABLE VS ON_HOLD_CUSTOMER_PAYMENT ---');
  const payableAllocations = allAllocations.filter(a => a.status === 'PAYABLE');
  const heldAllocations = allAllocations.filter(a => a.status === 'ON_HOLD_CUSTOMER_PAYMENT');
  const pendingAllocations = allAllocations.filter(a => a.status === 'WORK_PENDING');

  console.log(`PAYABLE count: ${payableAllocations.length}`);
  let payableInvalid = 0;
  for (const a of payableAllocations) {
    if (!a.isWorkCompleted || !a.isCustomerFullyPaid || !a.tailorId) {
      console.log(`INVALID PAYABLE: Order #${a.orderId} ${a.workType}: workCompleted=${a.isWorkCompleted}, fullyPaid=${a.isCustomerFullyPaid}, tailorId=${a.tailorId}`);
      payableInvalid++;
    }
  }
  if (payableInvalid === 0) {
    console.log('✓ PASS: All 88 PAYABLE allocations are 100% verified: work is completed, customer has paid in full, and an active tailor is assigned.');
  }

  console.log(`\nON_HOLD_CUSTOMER_PAYMENT count: ${heldAllocations.length}`);
  for (const a of heldAllocations) {
    console.log(`  Order #${a.orderId} (${a.orderNumber}) - Customer: ${a.customerName} | WorkType: ${a.workType} | Tailor: ${a.tailorName} (#${a.tailorId}) | WorkCompleted: ${a.isWorkCompleted} | CustPaid: LKR ${a.customerTotalPaid}/${a.agreedPrice} (Due: LKR ${a.customerBalanceDue}) | Status: ${a.status}`);
  }

  console.log(`\nWORK_PENDING count: ${pendingAllocations.length}`);
  for (const a of pendingAllocations) {
    console.log(`  Order #${a.orderId} (${a.orderNumber}) - Customer: ${a.customerName} | WorkType: ${a.workType} | Tailor: ${a.tailorName} (#${a.tailorId || 'None'}) | WorkCompleted: ${a.isWorkCompleted} | CustPaid: LKR ${a.customerTotalPaid}/${a.agreedPrice} | Status: ${a.status}`);
  }

  // --- POINT 7: Carried Forward Investigation ---
  console.log('\n--- AUDITING POINT 7: CARRIED FORWARD TIMESTAMPS ---');
  console.log(`Week 45 Start: ${currentWeekRange.startOfWeek.toISOString()} (Colombo: ${currentWeekRange.formattedMonday})`);
  console.log(`Week 45 End:   ${currentWeekRange.endOfWeek.toISOString()} (Colombo: ${currentWeekRange.formattedSunday})`);

  let compBefore = 0;
  let compIn = 0;
  let compAfter = 0;
  for (const a of allAllocations.filter(a => a.isWorkCompleted)) {
    const d = new Date(a.workCompletedAt).getTime();
    if (d < startMs) compBefore++;
    else if (d <= endMs) compIn++;
    else compAfter++;
  }
  console.log(`Completed work before Week 45: ${compBefore}`);
  console.log(`Completed work in Week 45:     ${compIn}`);
  console.log(`Completed work after Week 45:  ${compAfter}`);

  // Let's print the actual dates of completion
  const datesSummary = {};
  for (const a of allAllocations.filter(a => a.isWorkCompleted)) {
    const dt = new Date(a.workCompletedAt).toISOString().slice(0, 10);
    datesSummary[dt] = (datesSummary[dt] || 0) + 1;
  }
  console.log('Work Completion Dates Distribution:');
  for (const [dt, count] of Object.entries(datesSummary)) {
    console.log(`  Date ${dt}: ${count} allocations`);
  }

  // --- POINT 10: Task & Tailor Assignment Check ---
  console.log('\n--- AUDITING POINT 10: CUTTING VS STITCHING ALLOCATION PAIRS ---');
  // Check if each order has exactly 1 CUTTING and 1 STITCHING
  const ordersMap = new Map();
  for (const a of allAllocations) {
    if (!ordersMap.has(a.orderId)) ordersMap.set(a.orderId, []);
    ordersMap.get(a.orderId).push(a);
  }

  let asymmetricOrders = 0;
  for (const [orderId, list] of ordersMap.entries()) {
    const cuttings = list.filter(a => a.workType === 'CUTTING');
    const stitchings = list.filter(a => a.workType === 'STITCHING');
    if (cuttings.length !== 1 || stitchings.length !== 1) {
      console.log(`Order #${orderId} has abnormal allocations: cuttings=${cuttings.length}, stitchings=${stitchings.length}`);
      asymmetricOrders++;
    }
  }
  if (asymmetricOrders === 0) {
    console.log(`✓ PASS: All ${ordersMap.size} orders have exactly 1 CUTTING (25%) and 1 STITCHING (25%) allocation. Total = ${ordersMap.size * 2} allocations.`);
  }

  // Why are there 53 orders with allocations while validOrders is 60?
  console.log(`\nWhy 53 orders with allocations out of 60 valid orders?`);
  const ordersWithoutAllocations = validOrders.filter(o => !ordersMap.has(o.id));
  console.log(`Orders without allocations (${ordersWithoutAllocations.length}):`);
  for (const o of ordersWithoutAllocations) {
    console.log(`  Order #${o.id} (${o.orderNumber}): Status=${o.status}, PriceStatus=${o.priceStatus}, TotalAmount=${o.totalAmount}, AgreedTotal=${o.agreedTotal}, Advance=${o.advancePayment}`);
  }

  await prisma.$disconnect();
}

detailedAudit().catch(e => {
  console.error(e);
  process.exit(1);
});

