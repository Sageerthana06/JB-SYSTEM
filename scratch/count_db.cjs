const { prisma, pool } = require('../backend/src/prisma');

async function main() {
  const custCount = await prisma.customer.count();
  const orderCount = await prisma.order.count();
  const paymentCount = await prisma.payment.count();
  const measurementCount = await prisma.customerMeasurement.count();

  console.log({
    custCount,
    orderCount,
    paymentCount,
    measurementCount
  });
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  if (pool) await pool.end();
  process.exit(0);
});

