const { prisma, pool } = require('../backend/src/prisma');

async function main() {
  const orders = await prisma.order.findMany({
    take: 5,
    include: {
      payments: true,
      garmentDetails: true
    }
  });

  for (const o of orders) {
    console.log({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: o.totalAmount,
      advancePayment: o.advancePayment,
      balanceAmount: o.balanceAmount,
      calculatedPaid: (o.totalAmount || 0) - (o.balanceAmount || 0),
      paymentRecordsSum: o.payments.reduce((s, p) => s + (p.amount || 0), 0),
      dressType: o.garmentDetails?.dressType
    });
  }
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});

