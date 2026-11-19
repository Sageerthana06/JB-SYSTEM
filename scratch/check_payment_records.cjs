const { prisma } = require('../backend/src/prisma');

async function checkPaymentDoubleCounting() {
  const orders = await prisma.order.findMany({
    include: {
      payments: true
    }
  });

  console.log(`Checking ${orders.length} orders for payment double counting...`);

  let countWithPayments = 0;
  let countWithAdvanceOnly = 0;
  let countWithBoth = 0;
  let countMismatch = 0;

  for (const o of orders) {
    const verifiedPayments = (o.payments || []).filter(p => String(p.status || 'VERIFIED').toUpperCase() === 'VERIFIED');
    const verifiedSum = verifiedPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const advance = Number(o.advancePayment || 0);

    if (verifiedPayments.length > 0 && advance > 0) {
      countWithBoth++;
      if (verifiedSum !== advance) {
        console.log(`Order #${o.id} (${o.orderNumber}): Verified payments sum (${verifiedSum}) !== advancePayment (${advance}). Payments:`, verifiedPayments.map(p => ({ id: p.id, amt: p.amount, method: p.paymentMethod })));
        countMismatch++;
      }
    } else if (verifiedPayments.length > 0) {
      countWithPayments++;
    } else if (advance > 0) {
      countWithAdvanceOnly++;
    }
  }

  console.log(`Orders with both payments and advance: ${countWithBoth}`);
  console.log(`Orders with payments only: ${countWithPayments}`);
  console.log(`Orders with advance only: ${countWithAdvanceOnly}`);
  console.log(`Orders with mismatch between payment table and advance: ${countMismatch}`);
}

checkPaymentDoubleCounting()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

