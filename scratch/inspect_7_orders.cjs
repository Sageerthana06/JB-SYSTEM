const { prisma } = require('../backend/src/prisma');

async function inspect7Orders() {
  const ids = [202, 215, 239, 240, 245, 246, 247];
  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    include: {
      tasks: {
        include: { assignedTailor: true }
      },
      assignedTailor: true
    }
  });

  console.log(`Inspecting ${orders.length} orders with priceStatus=SENT...\n`);
  for (const o of orders) {
    console.log(`Order #${o.id} (${o.orderNumber}): Status=${o.status}, PriceStatus=${o.priceStatus}, Total=${o.totalAmount}, Advance=${o.advancePayment}, AssignedTailor=${o.assignedTailor?.name || 'None'}`);
    console.log(`  Tasks (${o.tasks.length}):`, o.tasks.map(t => `${t.taskType}: ${t.status} (Tailor: ${t.assignedTailor?.name || 'None'})`));
  }

  await prisma.$disconnect();
}

inspect7Orders().catch(console.error);

