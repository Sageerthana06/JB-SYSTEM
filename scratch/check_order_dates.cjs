const { prisma, pool } = require('../backend/src/prisma');

async function main() {
  const diffs = await prisma.order.findMany({
    where: {
      NOT: {
        status: { in: ['REJECTED', 'CANCELLED', 'PRICE_DECLINED'] }
      }
    },
    select: {
      id: true,
      orderNumber: true,
      orderDate: true,
      createdAt: true
    }
  });

  let count = 0;
  for (const o of diffs) {
    const d1 = new Date(o.orderDate).toISOString().slice(0, 10);
    const d2 = new Date(o.createdAt).toISOString().slice(0, 10);
    if (d1 !== d2) {
      count++;
      console.log(`Diff: ${o.orderNumber} orderDate=${d1} createdAt=${d2}`);
    }
  }
  console.log(`Total orders checked: ${diffs.length}, with differing date: ${count}`);
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});

