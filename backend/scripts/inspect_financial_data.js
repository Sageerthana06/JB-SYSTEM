require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { prisma, pool } = require('../src/prisma');

async function main() {
  const accounts = await prisma.financialAccount.findMany({ include: { branch: true } });
  console.log('=== FINANCIAL ACCOUNTS ===', accounts.length);

  const payments = await prisma.payment.findMany({
    where: { status: 'VERIFIED' },
    select: { id: true, amount: true, paymentMethod: true, createdAt: true, order: { select: { branchId: true } } }
  });
  console.log('=== VERIFIED PAYMENTS COUNT ===', payments.length);
  const totalVerifiedPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  console.log('=== TOTAL VERIFIED PAYMENTS === LKR', totalVerifiedPayments);

  const expenses = await prisma.businessExpense.findMany();
  console.log('=== BUSINESS EXPENSES COUNT ===', expenses.length);
  const totalExpensePaid = expenses.reduce((sum, e) => sum + Number(e.paidAmount), 0);
  const totalExpensePending = expenses.reduce((sum, e) => sum + Number(e.pendingAmount), 0);
  console.log('=== TOTAL EXPENSE PAID === LKR', totalExpensePaid);
  console.log('=== TOTAL EXPENSE PENDING === LKR', totalExpensePending);

  const bills = await prisma.monthlyBill.findMany();
  console.log('=== MONTHLY BILLS COUNT ===', bills.length);

  const salaries = await prisma.employeeSalary.findMany();
  console.log('=== EMPLOYEE SALARIES COUNT ===', salaries.length);

  try {
    const res = await pool.query('SELECT count(*), COALESCE(SUM("amountPaid"), 0) as total FROM "TailorSalaryPayment"');
    console.log('=== TAILOR SALARY PAYMENTS ===', res.rows[0]);
  } catch (e) {
    console.log('TailorSalaryPayment query error:', e.message);
  }

  const txns = await prisma.financialTransaction.findMany();
  console.log('=== FINANCIAL TRANSACTIONS COUNT ===', txns.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
