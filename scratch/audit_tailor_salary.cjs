const { prisma, pool } = require('../backend/src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics,
  toCents,
  roundLKR
} = require('../backend/src/utils/salaryCalculator');

async function audit() {
  console.log('===============================================================');
  console.log('   JB GROUP - WEEKLY TAILOR SALARY MANAGEMENT AUDIT');
  console.log('===============================================================\n');

  // 1. Check week ranges
  const currentWeekRange = getColomboWeekRange(null);
  console.log('Current Colombo Week Range:');
  console.log(`  Label: ${currentWeekRange.weekLabel}`);
  console.log(`  Start: ${currentWeekRange.startIso} (${currentWeekRange.formattedMonday})`);
  console.log(`  End:   ${currentWeekRange.endIso} (${currentWeekRange.formattedSunday})\n`);

  // 2. Fetch all orders with relations
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
      payments: {
        orderBy: { createdAt: 'asc' }
      },
      productionHistory: {
        orderBy: { startedAt: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Total orders in DB: ${orders.length}`);
  const validOrders = orders.filter(o => !['CANCELLED', 'REJECTED'].includes(String(o.status || '').toUpperCase()));
  console.log(`Valid orders (non-cancelled/rejected): ${validOrders.length}`);

  // 3. Fetch all salary payments from DB
  let salaryPayments = [];
  try {
    const res = await pool.query('SELECT * FROM "TailorSalaryPayment" ORDER BY "paymentDate" DESC');
    salaryPayments = res.rows || [];
  } catch (e) {
    console.log('TailorSalaryPayment query notice:', e.message);
  }
  console.log(`Total TailorSalaryPayment records in DB: ${salaryPayments.length}\n`);

  // 4. Generate allocations across all orders
  const allAllocations = [];
  const ordersWithAllocations = [];
  let sumOrderPrice = 0;
  let sumOffice = 0;
  let sumCutting = 0;
  let sumStitching = 0;

  for (const order of validOrders) {
    const orderSalary = calculateOrderSalaryAllocations(order, salaryPayments);
    if (orderSalary && orderSalary.allocations && orderSalary.allocations.length > 0) {
      ordersWithAllocations.push(order);
      sumOrderPrice += orderSalary.agreedPrice;
      sumOffice += orderSalary.officeAllocation;

      for (const a of orderSalary.allocations) {
        if (a.workType === 'CUTTING') sumCutting += a.allocatedAmount;
        if (a.workType === 'STITCHING') sumStitching += a.allocatedAmount;
        allAllocations.push(a);
      }
    }
  }

  console.log(`Orders with salary allocations: ${ordersWithAllocations.length}`);
  console.log(`Total generated allocations: ${allAllocations.length}`);
  console.log(`Sum Agreed Order Price: LKR ${sumOrderPrice.toFixed(2)}`);
  console.log(`Sum Office Allocation (50%): LKR ${sumOffice.toFixed(2)} (${((sumOffice / sumOrderPrice) * 100).toFixed(2)}%)`);
  console.log(`Sum Cutting Allocation (25%): LKR ${sumCutting.toFixed(2)} (${((sumCutting / sumOrderPrice) * 100).toFixed(2)}%)`);
  console.log(`Sum Stitching Allocation (25%): LKR ${sumStitching.toFixed(2)} (${((sumStitching / sumOrderPrice) * 100).toFixed(2)}%)`);
  console.log(`Sum 50 + 25 + 25: LKR ${(sumOffice + sumCutting + sumStitching).toFixed(2)} (diff: ${(sumOrderPrice - (sumOffice + sumCutting + sumStitching)).toFixed(2)})\n`);

  // 5. Inspect status counts and amounts
  const statusSummary = {};
  for (const a of allAllocations) {
    statusSummary[a.status] = statusSummary[a.status] || { count: 0, amount: 0 };
    statusSummary[a.status].count++;
    statusSummary[a.status].amount += a.allocatedAmount;
  }
  console.log('Status Breakdown of All Allocations:');
  for (const [st, val] of Object.entries(statusSummary)) {
    console.log(`  ${st.padEnd(26)}: ${String(val.count).padStart(3)} allocations | LKR ${val.amount.toFixed(2)}`);
  }

  // 6. Inspect Active Tailors
  const tailorsMap = new Map();
  for (const a of allAllocations) {
    if (a.tailorId) {
      if (!tailorsMap.has(a.tailorId)) {
        tailorsMap.set(a.tailorId, { name: a.tailorName, cuttingCount: 0, stitchingCount: 0, totalAmt: 0 });
      }
      const t = tailorsMap.get(a.tailorId);
      if (a.workType === 'CUTTING') t.cuttingCount++;
      if (a.workType === 'STITCHING') t.stitchingCount++;
      t.totalAmt += a.allocatedAmount;
    }
  }
  console.log(`\nActive Assigned Tailors (${tailorsMap.size}):`);
  for (const [id, t] of tailorsMap.entries()) {
    console.log(`  Tailor #${id} (${t.name}): ${t.cuttingCount} cutting + ${t.stitchingCount} stitching = ${t.cuttingCount + t.stitchingCount} jobs | LKR ${t.totalAmt.toFixed(2)}`);
  }

  const unassigned = allAllocations.filter(a => !a.tailorId);
  console.log(`  Unassigned allocations: ${unassigned.length} | LKR ${unassigned.reduce((s, a) => s + a.allocatedAmount, 0).toFixed(2)}`);

  // 7. Test computeWeeklySalaryMetrics with current week
  const weeklyResult = computeWeeklySalaryMetrics(allAllocations, salaryPayments, currentWeekRange);
  console.log('\nWeekly Salary Metrics (Current Week):');
  console.log(JSON.stringify(weeklyResult.summary, null, 2));

  // 8. Investigate User's Specific Numbers:
  // - Total Earned: LKR 30,265
  // - Salary Payable: LKR 28,590
  // - Customer Payment Holds: LKR 1,675
  // - Work Pending: LKR 5,300
  // - Salary Paid: LKR 0
  // - Carried Forward: LKR 0
  // - Active Tailors: 5
  // - Total Allocations: 106
  console.log('\n--- COMPARISON WITH USER REPORTED FIGURES ---');
  console.log(`Total Allocations: DB=${allAllocations.length} vs User=106`);
  console.log(`Active Tailors:    DB=${tailorsMap.size} vs User=5`);
  console.log(`Payable:           DB=LKR ${statusSummary['PAYABLE']?.amount} vs User=LKR 28,590`);
  console.log(`Held on Cust Pay:  DB=LKR ${statusSummary['ON_HOLD_CUSTOMER_PAYMENT']?.amount} vs User=LKR 1,675`);
  console.log(`Work Pending:      DB=LKR ${statusSummary['WORK_PENDING']?.amount} vs User=LKR 5,300`);
  console.log(`Earned (Pay+Held): DB=LKR ${(Number(statusSummary['PAYABLE']?.amount || 0) + Number(statusSummary['ON_HOLD_CUSTOMER_PAYMENT']?.amount || 0))} vs User=LKR 30,265`);

  // Check week-by-week metrics to see if user was looking at a specific week or all-time
  console.log('\n--- CHECKING EARNED PER WEEK ---');
  // Check completion dates of all completed allocations
  const completedAllocations = allAllocations.filter(a => a.isWorkCompleted);
  console.log(`Completed allocations count: ${completedAllocations.length}`);
  const compDates = completedAllocations.map(a => a.workCompletedAt).filter(Boolean);
  console.log(`Completed allocations with dates: ${compDates.length}`);

  await prisma.$disconnect();
}

audit().catch(e => {
  console.error(e);
  process.exit(1);
});

