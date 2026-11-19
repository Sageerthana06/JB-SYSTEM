const { prisma, pool } = require('../backend/src/prisma');

async function findOrder54() {
  const allOrders = await prisma.order.findMany({
    where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      orderDate: true
    },
    orderBy: { id: 'asc' }
  });

  console.log(`Total non-cancelled orders: ${allOrders.length}`);
  const target7Ids = new Set([202, 215, 239, 240, 245, 246, 247]);
  const non7 = allOrders.filter(o => !target7Ids.has(o.id));
  console.log(`Non-7 orders: ${non7.length}`);
  for (const o of non7) {
    console.log(`Order #${o.id} (${o.orderNumber}): Status=${o.status}, Amount=${o.totalAmount}, Created=${o.createdAt.toISOString().slice(0, 10)}`);
  }
  await prisma.$disconnect();
  await pool.end();
}

findOrder54().catch(console.error);

