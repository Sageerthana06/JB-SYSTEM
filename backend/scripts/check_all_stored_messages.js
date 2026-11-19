// backend/scripts/check_all_stored_messages.js
const { prisma } = require('../src/prisma');

async function run() {
  const orders = await prisma.order.findMany({
    where: {
      bookingNotificationMessage: { not: null }
    },
    select: {
      id: true,
      orderNumber: true,
      bookingNotificationMessage: true,
      bookingNotificationSentAt: true,
      bookingNotificationStatus: true
    }
  });

  console.log(`Found ${orders.length} orders with bookingNotificationMessage:`);
  for (const o of orders) {
    const hasFFFD = o.bookingNotificationMessage.includes('\uFFFD');
    console.log(`Order ${o.orderNumber} (ID: ${o.id}): has U+FFFD = ${hasFFFD}, status = ${o.bookingNotificationStatus}`);
    if (hasFFFD) {
      console.log('--- Corrupted Stored Message Snippet ---');
      console.log(o.bookingNotificationMessage.substring(0, 150));
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());

