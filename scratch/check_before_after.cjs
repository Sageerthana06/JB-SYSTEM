const { prisma, pool } = require('../backend/src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics
} = require('../backend/src/utils/salaryCalculator');

async function checkBeforeAfter() {
  const weekRange = getColomboWeekRange(new Date('2026-11-08T12:00:00+05:30'));
  const allOrders = await prisma.order.findMany({
    include: {
      customer: true,
      garmentDetails: true,
      branch: true,
      assignedTailor: true,
      tasks: { include: { assignedTailor: true } },
      payments: true,
      productionHistory: true
    }
  });

  const target7Ids = new Set([202, 215, 239, 240, 245, 246, 247]);

  let non7Orders = 0;
  let non7Allocs = 0;
  let non7Payable = 0, non7Held = 0, non7Pending = 0;
  let non7PayableAmt = 0, non7HeldAmt = 0, non7PendingAmt = 0;

  let target7Orders = 0;
  let target7Allocs = 0;
  let target7Payable = 0, target7Held = 0, target7Pending = 0;
  let target7PayableAmt = 0, target7HeldAmt = 0, target7PendingAmt = 0;

  for (const o of allOrders) {
    if (['CANCELLED', 'REJECTED'].includes(o.status)) continue;
    const res = calculateOrderSalaryAllocations(o, []);
    const isTarget = target7Ids.has(o.id);

    if (isTarget) {
      target7Orders++;
      for (const a of res.allocations) {
        target7Allocs++;
        if (a.status === 'PAYABLE') { target7Payable++; target7PayableAmt += a.allocatedAmount; }
        if (a.status === 'ON_HOLD_CUSTOMER_PAYMENT') { target7Held++; target7HeldAmt += a.allocatedAmount; }
        if (a.status === 'WORK_PENDING') { target7Pending++; target7PendingAmt += a.allocatedAmount; }
      }
    } else {
      non7Orders++;
      for (const a of res.allocations) {
        non7Allocs++;
        if (a.status === 'PAYABLE') { non7Payable++; non7PayableAmt += a.allocatedAmount; }
        if (a.status === 'ON_HOLD_CUSTOMER_PAYMENT') { non7Held++; non7HeldAmt += a.allocatedAmount; }
        if (a.status === 'WORK_PENDING') { non7Pending++; non7PendingAmt += a.allocatedAmount; }
      }
    }
  }

  console.log('--- NON-7 ORDERS (BASE 54 ORDERS) ---');
  console.log(`Orders: ${non7Orders}, Allocs: ${non7Allocs}`);
  console.log(`Payable: ${non7Payable} (LKR ${non7PayableAmt})`);
  console.log(`Held: ${non7Held} (LKR ${non7HeldAmt})`);
  console.log(`Pending: ${non7Pending} (LKR ${non7PendingAmt})`);
  console.log(`Earned (Payable + Held): ${non7Payable + non7Held} allocs (LKR ${non7PayableAmt + non7HeldAmt})`);

  console.log('\n--- 7 NEWLY QUALIFIED ORDERS ---');
  console.log(`Orders: ${target7Orders}, Allocs: ${target7Allocs}`);
  console.log(`Payable: ${target7Payable} (LKR ${target7PayableAmt})`);
  console.log(`Held: ${target7Held} (LKR ${target7HeldAmt})`);
  console.log(`Pending: ${target7Pending} (LKR ${target7PendingAmt})`);
  console.log(`Earned (Payable + Held): ${target7Payable + target7Held} allocs (LKR ${target7PayableAmt + target7HeldAmt})`);

  console.log('\n--- COMBINED TOTALS ---');
  console.log(`Orders: ${non7Orders + target7Orders} (${non7Orders} + ${target7Orders})`);
  console.log(`Allocs: ${non7Allocs + target7Allocs} (${non7Allocs} + ${target7Allocs})`);
  console.log(`Payable: ${non7Payable + target7Payable} allocs (LKR ${non7PayableAmt + target7PayableAmt})`);
  console.log(`Held: ${non7Held + target7Held} allocs (LKR ${non7HeldAmt + target7HeldAmt})`);
  console.log(`Pending: ${non7Pending + target7Pending} allocs (LKR ${non7PendingAmt + target7PendingAmt})`);
  console.log(`Total Earned: LKR ${non7PayableAmt + target7PayableAmt + non7HeldAmt + target7HeldAmt}`);

  await prisma.$disconnect();
  await pool.end();
}

checkBeforeAfter().catch(console.error);

