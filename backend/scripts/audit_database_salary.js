/**
 * READ-ONLY Audit of Salary Records for Week 26 Oct - 1 Nov 2026
 * Branch: 1 (Manager scope)
 */
require('dotenv').config();
const { prisma, pool } = require('../src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics
} = require('../src/utils/salaryCalculator');

async function runAudit() {
  console.log('=== STARTING READ-ONLY AUDIT FOR WEEK 26 OCT - 1 NOV 2026 ===');

  const refDate = '2026-10-26';
  const weekRange = getColomboWeekRange(refDate);
  console.log('Target Week:', weekRange.weekLabel);
  console.log('Start (UTC):', weekRange.startOfWeek.toISOString(), 'End (UTC):', weekRange.endOfWeek.toISOString());

  // 1. All records from TailorSalaryPayment
  const paymentsRes = await pool.query('SELECT * FROM "TailorSalaryPayment" ORDER BY "id" ASC');
  console.log('\n--- 1. TAILOR SALARY PAYMENT LEDGER ---');
  console.table(paymentsRes.rows.map(p => ({
    id: p.id,
    orderId: p.orderId,
    tailorId: p.tailorId,
    workType: p.workType,
    orderNumber: p.orderNumber,
    amountPaid: Number(p.amountPaid),
    paymentDate: p.paymentDate ? p.paymentDate.toISOString() : null,
    recordedByName: p.recordedByName
  })));

  // 2. Fetch orders for Branch 1
  const orders = await prisma.order.findMany({
    where: {
      branchId: 1,
      status: { notIn: ['CANCELLED', 'REJECTED'] }
    },
    include: {
      customer: { select: { id: true, name: true, primaryPhone: true } },
      garmentDetails: { select: { dressType: true, quantity: true } },
      branch: { select: { id: true, name: true } },
      assignedTailor: { select: { id: true, name: true, email: true, role: true } },
      tasks: {
        include: { assignedTailor: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { sequence: 'asc' }
      },
      payments: { orderBy: { createdAt: 'asc' } },
      productionHistory: { orderBy: { startedAt: 'asc' } }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`\n--- 2. ORDERS FETCHED FOR BRANCH 1 (${orders.length} orders) ---`);

  // 3. Compute allocations
  const allAllocations = [];
  for (const o of orders) {
    const res = calculateOrderSalaryAllocations(o, paymentsRes.rows);
    if (res && res.allocations) {
      allAllocations.push(...res.allocations);
    }
  }

  console.log(`Total Allocations Generated: ${allAllocations.length}`);

  const { summary, weeklyAllocationsList, carriedForwardList } = computeWeeklySalaryMetrics(
    allAllocations,
    paymentsRes.rows,
    weekRange
  );

  console.log('\n--- 3. COMPUTED SUMMARY METRICS (MANAGER BRANCH 1) ---');
  console.log(JSON.stringify(summary, null, 2));

  // 4. Focus on order JB-20261020-0001
  console.log('\n--- 4. AUDIT OF ORDER JB-20261020-0001 ---');
  const targetOrder = orders.find(o => o.orderNumber === 'JB-20261020-0001');
  if (targetOrder) {
    console.log({
      id: targetOrder.id,
      orderNumber: targetOrder.orderNumber,
      totalAmount: targetOrder.totalAmount,
      advancePayment: targetOrder.advancePayment,
      balanceAmount: targetOrder.balanceAmount,
      status: targetOrder.status,
      assignedTailor: targetOrder.assignedTailor?.name,
      tasks: targetOrder.tasks.map(t => ({
        id: t.id,
        taskType: t.taskType,
        status: t.status,
        tailor: t.assignedTailor?.name,
        completedAt: t.completedAt
      })),
      customerPayments: targetOrder.payments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        method: p.method,
        createdAt: p.createdAt
      }))
    });

    const targetAllocations = allAllocations.filter(a => a.orderNumber === 'JB-20261020-0001');
    console.log('\nAllocations for JB-20261020-0001:');
    targetAllocations.forEach(a => {
      console.log({
        key: a.allocationKey,
        workType: a.workType,
        tailorName: a.tailorName,
        agreedPrice: a.agreedPrice,
        allocatedAmount: a.allocatedAmount,
        isWorkCompleted: a.isWorkCompleted,
        workCompletedAt: a.workCompletedAt,
        isCustomerFullyPaid: a.isCustomerFullyPaid,
        customerTotalPaid: a.customerTotalPaid,
        customerBalanceDue: a.customerBalanceDue,
        status: a.status,
        paymentRecord: a.paymentRecord
      });
    });
  } else {
    console.log('Order JB-20261020-0001 NOT FOUND in branch 1!');
  }

  // 5. Audit Carried Forward vs Payable
  console.log('\n--- 5. ALLOCATIONS IN CARRIED FORWARD LIST (' + carriedForwardList.length + ') ---');
  console.table(carriedForwardList.map(a => ({
    key: a.allocationKey,
    orderNumber: a.orderNumber,
    workType: a.workType,
    tailor: a.tailorName,
    amount: a.allocatedAmount,
    status: a.status,
    completedAt: a.workCompletedAt ? new Date(a.workCompletedAt).toISOString() : null,
    isPaid: a.paymentRecord ? 'YES' : 'NO'
  })));

  console.log('\n--- 6. ALLOCATIONS IN PAYABLE LIST ---');
  const payableList = allAllocations.filter(a => a.status === 'PAYABLE');
  console.table(payableList.map(a => ({
    key: a.allocationKey,
    orderNumber: a.orderNumber,
    workType: a.workType,
    tailor: a.tailorName,
    amount: a.allocatedAmount,
    status: a.status,
    completedAt: a.workCompletedAt ? new Date(a.workCompletedAt).toISOString() : null
  })));

  // 7. Audit Customer Payment Holds (LKR 1,095)
  console.log('\n--- 7. ALLOCATIONS ON HOLD (CUSTOMER PAYMENT) ---');
  const heldList = allAllocations.filter(a => a.status === 'ON_HOLD_CUSTOMER_PAYMENT');
  console.table(heldList.map(a => ({
    key: a.allocationKey,
    orderNumber: a.orderNumber,
    workType: a.workType,
    tailor: a.tailorName,
    amount: a.allocatedAmount,
    agreedPrice: a.agreedPrice,
    totalPaid: a.customerTotalPaid,
    balanceDue: a.customerBalanceDue
  })));

  // 8. Audit Work Pending (LKR 30,787)
  console.log('\n--- 8. ALLOCATIONS WORK PENDING ---');
  const pendingList = allAllocations.filter(a => a.status === 'WORK_PENDING');
  console.log(`Total Work Pending Count: ${pendingList.length}, Sum: ${pendingList.reduce((s, a) => s + a.allocatedAmount, 0)}`);
  console.table(pendingList.map(a => ({
    key: a.allocationKey,
    orderNumber: a.orderNumber,
    workType: a.workType,
    tailor: a.tailorName,
    amount: a.allocatedAmount,
    isWorkCompleted: a.isWorkCompleted
  })));

  // 9. Per-Tailor Reconciliation
  console.log('\n--- 9. PER-TAILOR RECONCILIATION ---');
  const tailorAgg = {};
  for (const a of allAllocations) {
    const name = a.tailorName || 'Unassigned';
    if (!tailorAgg[name]) {
      tailorAgg[name] = {
        tailorId: a.tailorId,
        tailorName: name,
        earnedThisWeek: 0,
        payableNow: 0,
        heldCustomerDue: 0,
        workPending: 0,
        paidThisWeek: 0,
        carriedForward: 0,
        totalJobs: 0
      };
    }
    tailorAgg[name].totalJobs++;
    if (a.status === 'PAYABLE') tailorAgg[name].payableNow += a.allocatedAmount;
    if (a.status === 'ON_HOLD_CUSTOMER_PAYMENT') tailorAgg[name].heldCustomerDue += a.allocatedAmount;
    if (a.status === 'WORK_PENDING') tailorAgg[name].workPending += a.allocatedAmount;
  }

  for (const c of carriedForwardList) {
    const name = c.tailorName || 'Unassigned';
    if (tailorAgg[name]) {
      tailorAgg[name].carriedForward += c.allocatedAmount;
    }
  }

  for (const w of weeklyAllocationsList) {
    const name = w.tailorName || 'Unassigned';
    if (tailorAgg[name]) {
      tailorAgg[name].earnedThisWeek += w.allocatedAmount;
    }
  }

  const startMs = weekRange.startOfWeek.getTime();
  const endMs = weekRange.endOfWeek.getTime();
  for (const p of paymentsRes.rows) {
    const pDate = new Date(p.paymentDate).getTime();
    if (pDate >= startMs && pDate <= endMs) {
      // Find tailor name
      const tailorEntry = Object.values(tailorAgg).find(t => t.tailorId === p.tailorId);
      if (tailorEntry) {
        tailorEntry.paidThisWeek += Number(p.amountPaid);
      }
    }
  }

  // Calculate Outstanding Due for each tailor
  for (const name in tailorAgg) {
    const t = tailorAgg[name];
    t.outstandingDue = t.payableNow; // Or payableNow + carriedForward if separate
  }

  console.table(Object.values(tailorAgg));

  // 10. Check work completed timestamps
  console.log('\n--- 10. WORK COMPLETED TIMESTAMPS CHECK ---');
  const completedAllocations = allAllocations.filter(a => a.isWorkCompleted);
  console.log(`Total Completed Allocations: ${completedAllocations.length}`);
  completedAllocations.forEach(a => {
    const d = a.workCompletedAt ? new Date(a.workCompletedAt) : null;
    console.log(`${a.orderNumber} - ${a.workType} (${a.tailorName}): CompletedAt: ${d ? d.toISOString() : 'NULL'} | In Selected Week: ${d && d.getTime() >= startMs && d.getTime() <= endMs}`);
  });
}

runAudit()
  .catch(console.error)
  .finally(() => process.exit(0));
