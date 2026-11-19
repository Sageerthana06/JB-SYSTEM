// backend/scripts/trace_order_emojis.js
const { prisma } = require('../src/prisma');

async function traceOrder() {
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'JB-20261110-0007' },
    include: { customer: true, payments: true, branch: true }
  });
  
  if (!order) {
    console.log('Order JB-20261110-0007 not found!');
    const recent = await prisma.order.findMany({
      where: { orderNumber: { contains: '0007' } },
      select: { id: true, orderNumber: true, customer: { select: { name: true } } }
    });
    console.log('Recent 0007 orders:', recent);
    return;
  }
  
  console.log('FOUND ORDER:', {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customer?.name,
    customerPhone: order.customer?.primaryPhone,
    bookingNotificationStatus: order.bookingNotificationStatus,
    bookingNotificationMessageLength: order.bookingNotificationMessage?.length
  });

  if (order.bookingNotificationMessage) {
    console.log('\n--- Stored bookingNotificationMessage ---');
    console.log(order.bookingNotificationMessage);
    const hasFFFD = order.bookingNotificationMessage.includes('\uFFFD');
    console.log('\nContains U+FFFD (replacement char):', hasFFFD);
    
    // Dump code points of characters with code > 127
    console.log('\n--- Characters with code > 127 in stored message ---');
    for (let i = 0; i < order.bookingNotificationMessage.length; i++) {
      const char = order.bookingNotificationMessage[i];
      const code = order.bookingNotificationMessage.charCodeAt(i);
      if (code === 0xFFFD || code > 127) {
        console.log(`pos ${i}: char "${char}" (U+${code.toString(16).toUpperCase().padStart(4, '0')})`);
      }
    }
  } else {
    console.log('\nNo stored bookingNotificationMessage on this order.');
  }

  // Also check all string fields on order
  for (const [key, val] of Object.entries(order)) {
    if (typeof val === 'string' && val.includes('\uFFFD')) {
      console.log(`\n⚠️ Field ${key} contains U+FFFD! Value:\n${val}`);
    }
  }
}

traceOrder().catch(console.error).finally(() => prisma.$disconnect());
