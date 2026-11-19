const { prisma, pool } = require('../backend/src/prisma');

async function main() {
  const count = await prisma.customerMeasurement.count();
  console.log('CustomerMeasurements count:', count);
  const sample = await prisma.customerMeasurement.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { id: true, name: true } } }
  });
  console.log('Sample measurements:', JSON.stringify(sample, null, 2));

  // Check orders with garmentDetails measurements
  const orders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { garmentDetails: true, customer: { select: { id: true, name: true } } }
  });
  console.log('Sample orders garmentDetails:', JSON.stringify(orders.map(o => ({
    orderNumber: o.orderNumber,
    customer: o.customer.name,
    garmentDetails: o.garmentDetails
  })), null, 2));
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  if (pool) await pool.end();
  process.exit(0);
});

