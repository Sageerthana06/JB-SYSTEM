const { prisma, pool } = require('../backend/src/prisma');

async function inspectOrder221() {
  const o = await prisma.order.findUnique({
    where: { id: 221 },
    include: {
      payments: true,
      customer: true,
      garmentDetails: true
    }
  });
  console.log('Order 221 details:');
  console.dir(o, { depth: null });
}

inspectOrder221()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

