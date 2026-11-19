const { prisma, pool } = require('../backend/src/prisma');

async function testCustomerFinancialCalculations() {
  console.log('=== CHECKING CUSTOMER FINANCIAL RECONCILIATION ===\n');

  const customers = await prisma.customer.findMany({
    include: {
      orders: {
        include: {
          payments: { where: { status: 'VERIFIED' } }
        }
      }
    }
  });

  for (const c of customers) {
    if (c.orders.length === 0) continue;

    const totalInvoiced = c.orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const totalBalance = c.orders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);
    const paidByCalc = c.orders.reduce((sum, o) => sum + Math.max(0, (Number(o.totalAmount) || 0) - (Number(o.balanceAmount) || 0)), 0);

    const paidByPayments = c.orders.reduce((sum, o) => {
      const orderPaid = o.payments.reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0);
      return sum + orderPaid;
    }, 0);

    console.log(`Customer #${c.id} (${c.name}): Orders=${c.orders.length}, Invoiced=LKR ${totalInvoiced}, Balance=LKR ${totalBalance}, Paid(Total-Bal)=LKR ${paidByCalc}, Paid(Payments)=LKR ${paidByPayments}`);
  }
}

testCustomerFinancialCalculations()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    if (pool) await pool.end();
    process.exit(0);
  });

