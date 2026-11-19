const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma, pool } = require('../src/prisma');

async function resetExpenseTestData() {
  console.log('===============================================================');
  console.log('   STEP 1: INSPECT TEST EXPENSE RECORDS BEFORE CLEANUP         ');
  console.log('===============================================================\n');

  // 1. Identify test records in BusinessExpense
  const testExpenses = await prisma.businessExpense.findMany({
    include: { payments: true }
  });

  console.log(`Found ${testExpenses.length} record(s) in BusinessExpense:`);
  for (const exp of testExpenses) {
    console.log(`  - ID: ${exp.id}, Number: ${exp.expenseNumber}, Title: "${exp.title}", Category: ${exp.category}, Total: LKR ${exp.totalAmount}, Paid: LKR ${exp.paidAmount}, Pending: LKR ${exp.pendingAmount}, Payments: ${exp.payments.length}`);
  }

  // 2. Identify test records in ExpensePaymentHistory
  const testPayments = await prisma.expensePaymentHistory.findMany();
  console.log(`\nFound ${testPayments.length} record(s) in ExpensePaymentHistory:`);
  for (const pay of testPayments) {
    console.log(`  - ID: ${pay.id}, ExpenseID: ${pay.expenseId}, Number: ${pay.paymentNumber}, Amount: LKR ${pay.amount}, Method: ${pay.paymentMethod}`);
  }

  // Safety confirmation: Verify each record is indeed a test record
  for (const exp of testExpenses) {
    const isTest = exp.title.toUpperCase().includes('TEST') ||
                   exp.expenseNumber.includes('EXP-202611-0001') ||
                   exp.id === 5;
    if (!isTest) {
      throw new Error(`ABORT: Record ID ${exp.id} ("${exp.title}") cannot be safely identified as test expense data!`);
    }
  }

  console.log('\n===============================================================');
  console.log('   STEP 2: PRE-CLEANUP NON-EXPENSE TABLE SAFETY COUNTS         ');
  console.log('===============================================================\n');

  const preCounts = {
    orders: await prisma.order.count(),
    customers: await prisma.customer.count(),
    payments: await prisma.payment.count(),
    users: await prisma.user.count(),
    employees: await prisma.employee.count(),
    financialTransactions: await prisma.financialTransaction.count(),
    attendances: await prisma.attendance.count(),
    garmentDetails: await prisma.garmentDetails.count()
  };
  console.log('Safety check on non-expense tables:');
  console.log(preCounts);

  console.log('\n===============================================================');
  console.log('   STEP 3: DELETING TEST EXPENSE RECORDS (FOREIGN-KEY ORDER)   ');
  console.log('===============================================================\n');

  const deleteResult = await prisma.$transaction(async (tx) => {
    // A. Delete child records: ExpensePaymentHistory
    const deletedPayments = await tx.expensePaymentHistory.deleteMany({
      where: {
        expenseId: { in: testExpenses.map(e => e.id) }
      }
    });
    console.log(`  ✓ Deleted ${deletedPayments.count} child record(s) from ExpensePaymentHistory.`);

    // B. Delete parent records: BusinessExpense
    const deletedExpenses = await tx.businessExpense.deleteMany({
      where: {
        id: { in: testExpenses.map(e => e.id) }
      }
    });
    console.log(`  ✓ Deleted ${deletedExpenses.count} parent record(s) from BusinessExpense.`);

    return {
      deletedPaymentsCount: deletedPayments.count,
      deletedExpensesCount: deletedExpenses.count
    };
  });

  console.log('\n===============================================================');
  console.log('   STEP 4: POST-CLEANUP DATABASE VERIFICATION                  ');
  console.log('===============================================================\n');

  const postExpenseCount = await prisma.businessExpense.count();
  const postPaymentHistCount = await prisma.expensePaymentHistory.count();
  const postMonthlyBillCount = await prisma.monthlyBill.count();

  console.log(`Post-cleanup BusinessExpense count:        ${postExpenseCount} (Target: 0)`);
  console.log(`Post-cleanup ExpensePaymentHistory count:  ${postPaymentHistCount} (Target: 0)`);
  console.log(`Post-cleanup MonthlyBill count:            ${postMonthlyBillCount} (Target: 0)`);

  if (postExpenseCount !== 0 || postPaymentHistCount !== 0) {
    throw new Error('Verification failed: Expense tables still have remaining records!');
  }

  // Verify non-expense tables remained 100% untouched
  const postCounts = {
    orders: await prisma.order.count(),
    customers: await prisma.customer.count(),
    payments: await prisma.payment.count(),
    users: await prisma.user.count(),
    employees: await prisma.employee.count(),
    financialTransactions: await prisma.financialTransaction.count(),
    attendances: await prisma.attendance.count(),
    garmentDetails: await prisma.garmentDetails.count()
  };

  for (const [key, val] of Object.entries(preCounts)) {
    if (postCounts[key] !== val) {
      throw new Error(`SAFETY VIOLATION: Table "${key}" count changed from ${val} to ${postCounts[key]}!`);
    }
  }
  console.log('✓ All non-expense tables are 100% untouched and preserved:');
  console.log(postCounts);

  console.log('\n===============================================================');
  console.log('   STEP 5: VERIFY EXPENSE DASHBOARD METRICS DISPLAY LKR 0.00   ');
  console.log('===============================================================\n');

  const expenseController = require('../src/controllers/expenseController');

  let dashboardResponse = null;
  await expenseController.getExpenseDashboard(
    { user: { role: 'SUPER_ADMIN', branchId: null }, query: { branchId: 'ALL' } },
    { status: () => ({ json: (d) => { dashboardResponse = d; } }), json: (d) => { dashboardResponse = d; } }
  );

  if (!dashboardResponse?.success) {
    throw new Error('getExpenseDashboard failed: ' + JSON.stringify(dashboardResponse));
  }

  const s = dashboardResponse.data.summary;
  console.log('Expense Management Dashboard Summary Metrics:');
  console.log(`  - This Month:      LKR ${s.totalExpensesThisMonth.toFixed(2)}`);
  console.log(`  - This Year:       LKR ${s.totalExpensesThisYear.toFixed(2)}`);
  console.log(`  - Total Paid:      LKR ${s.totalPaidExpenses.toFixed(2)}`);
  console.log(`  - Total Pending:   LKR ${s.totalPendingExpenses.toFixed(2)}`);
  console.log(`  - Overdue Bills:   ${s.overdueCount} (LKR ${s.overdueAmount.toFixed(2)})`);
  console.log(`  - Staff Salary:    LKR ${s.salaryExpenses.toFixed(2)}`);
  console.log(`  - Monthly Rent:    LKR ${s.monthlyRent.toFixed(2)}`);
  console.log(`  - Electricity:     LKR ${s.electricityExpenses.toFixed(2)}`);
  console.log(`  - Other Expenses:  LKR ${s.otherExpenses.toFixed(2)}`);

  const requiredZeroes = [
    ['totalExpensesThisMonth', s.totalExpensesThisMonth],
    ['totalExpensesThisYear', s.totalExpensesThisYear],
    ['totalPaidExpenses', s.totalPaidExpenses],
    ['totalPendingExpenses', s.totalPendingExpenses],
    ['overdueCount', s.overdueCount],
    ['overdueAmount', s.overdueAmount],
    ['salaryExpenses', s.salaryExpenses],
    ['monthlyRent', s.monthlyRent],
    ['electricityExpenses', s.electricityExpenses],
    ['otherExpenses', s.otherExpenses]
  ];

  for (const [metric, val] of requiredZeroes) {
    if (val !== 0) {
      throw new Error(`Metric "${metric}" is ${val}, expected 0!`);
    }
  }
  console.log('\n✅ All 9 Expense Management Dashboard metrics confirmed at LKR 0.00!');

  // Check Category Breakdown: all 15 categories should have 0
  const catBreakdown = dashboardResponse.data.categoryBreakdown;
  const nonZeroCats = catBreakdown.filter(c => c.totalAmount !== 0 || c.paidAmount !== 0 || c.pendingAmount !== 0);
  if (nonZeroCats.length > 0) {
    throw new Error(`Category breakdown has non-zero categories: ${JSON.stringify(nonZeroCats)}`);
  }
  console.log(`✅ All ${catBreakdown.length} expense categories confirmed preserved with 0.00 balances.`);

  console.log('\n🎉 EXPENSE MANAGEMENT TEST DATA RESET COMPLETED WITH 100% SUCCESS!');
}

resetExpenseTestData()
  .catch(err => {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

