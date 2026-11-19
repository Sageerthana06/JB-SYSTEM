const { prisma, pool } = require('../backend/src/prisma');

async function inspectExpenses() {
  console.log('=== Inspecting Expense Management Records ===\n');

  const expenses = await prisma.businessExpense.findMany({
    include: {
      payments: true,
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });

  console.log(`Total BusinessExpense records: ${expenses.length}`);
  for (const exp of expenses) {
    console.log(`\nExpense ID: ${exp.id}`);
    console.log(`  Number: ${exp.expenseNumber}`);
    console.log(`  Title: ${exp.title}`);
    console.log(`  Category: ${exp.category}`);
    console.log(`  Branch: ${exp.branch?.name} (ID: ${exp.branchId})`);
    console.log(`  Total: LKR ${exp.totalAmount}`);
    console.log(`  Paid: LKR ${exp.paidAmount}`);
    console.log(`  Pending: LKR ${exp.pendingAmount}`);
    console.log(`  Status: ${exp.status}`);
    console.log(`  Date: ${exp.expenseDate}`);
    console.log(`  Created By: ${exp.createdBy?.name} (${exp.createdByName})`);
    console.log(`  Payments count: ${exp.payments.length}`);
    for (const p of exp.payments) {
      console.log(`    Payment ID: ${p.id}, Num: ${p.paymentNumber}, Amount: LKR ${p.amount}, Method: ${p.paymentMethod}, AccountId: ${p.accountId}, TransactionId: ${p.transactionId}`);
    }
  }

  const paymentHistories = await prisma.expensePaymentHistory.findMany({
    include: {
      expense: { select: { id: true, expenseNumber: true, title: true } }
    }
  });
  console.log(`\nTotal ExpensePaymentHistory records: ${paymentHistories.length}`);

  const monthlyBills = await prisma.monthlyBill.findMany({
    include: {
      branch: { select: { id: true, name: true } }
    }
  });
  console.log(`\nTotal MonthlyBill records: ${monthlyBills.length}`);
  for (const b of monthlyBills) {
    console.log(`  Bill ID: ${b.id}, Num: ${b.billNumber}, Name: ${b.billName}, Category: ${b.category}, Amount: ${b.expectedAmount}, Paid: ${b.paidAmount}, Month: ${b.billingMonth}`);
  }
}

inspectExpenses()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

