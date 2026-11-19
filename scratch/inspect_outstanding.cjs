const { prisma } = require('../backend/src/prisma');

async function inspectOutstanding() {
  const allOrders = await prisma.order.findMany({
    include: {
      payments: true,
      customer: { select: { id: true, name: true, primaryPhone: true } }
    },
    orderBy: { id: 'asc' }
  });

  const orders = allOrders.filter(o => !['CANCELLED', 'REJECTED', 'DECLINED'].includes(String(o.status || '').toUpperCase()));

  console.log(`Inspecting ${orders.length} valid orders...\n`);

  const outstanding = [];
  const settled = [];

  for (const o of orders) {
    const orderTotal = Number(o.agreedTotal) > 0 ? Number(o.agreedTotal) : Number(o.totalAmount || 0);
    const verifiedPayments = (o.payments || []).filter(p => String(p.status || 'VERIFIED').toUpperCase() === 'VERIFIED');
    const verifiedPaid = verifiedPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const advance = Number(o.advancePayment || 0);
    const legacyAdvance = Math.max(0, advance - verifiedPaid);
    const actualPaid = verifiedPaid + legacyAdvance;

    const appliedPaid = Math.min(orderTotal, actualPaid);
    const overpayment = Math.max(0, actualPaid - orderTotal);
    const balanceDue = Math.max(0, orderTotal - actualPaid);

    if (balanceDue > 0) {
      outstanding.push({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.customer?.name,
        status: o.status,
        orderTotal,
        actualPaid,
        balanceDue,
        dbBalance: Number(o.balanceAmount || 0)
      });
    } else {
      settled.push({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.customer?.name,
        orderTotal,
        actualPaid,
        overpayment
      });
    }
  }

  console.log(`=== OUTSTANDING ORDERS (${outstanding.length}) ===`);
  outstanding.forEach(o => {
    console.log(`Order #${o.id} (${o.orderNumber}) - ${o.customer}: Total=${o.orderTotal}, Paid=${o.actualPaid}, BalanceDue=${o.balanceDue}, DBBalance=${o.dbBalance}, Status=${o.status}`);
  });

  const overpaid = settled.filter(s => s.overpayment > 0);
  console.log(`\n=== OVERPAID ORDERS (${overpaid.length}) ===`);
  overpaid.forEach(o => {
    console.log(`Order #${o.id} (${o.orderNumber}) - ${o.customer}: Total=${o.orderTotal}, Paid=${o.actualPaid}, Overpayment=${o.overpayment}`);
  });

  console.log(`\nSettled count: ${settled.length}, Outstanding count: ${outstanding.length}, Total: ${settled.length + outstanding.length}`);
}

inspectOutstanding()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
