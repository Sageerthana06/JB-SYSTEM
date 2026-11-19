// backend/scripts/inspect_order_276.js
const { prisma } = require('../src/prisma');

async function run() {
  const order = await prisma.order.findUnique({
    where: { id: 276 },
    include: { customer: true, payments: true, garmentDetails: true }
  });
  console.log('Order 276 details:', {
    orderNumber: order.orderNumber,
    bookingNotificationSent: order.bookingNotificationSent,
    bookingNotificationStatus: order.bookingNotificationStatus,
    bookingNotificationError: order.bookingNotificationError,
    bookingNotificationPhone: order.bookingNotificationPhone,
    hasBookingNotificationMessage: !!order.bookingNotificationMessage,
    customerName: order.customer?.name,
    customerPhone: order.customer?.primaryPhone,
    customerAltPhone: order.customer?.secondaryPhone,
    totalAmount: order.totalAmount,
    advancePayment: order.advancePayment,
    balanceAmount: order.balanceAmount,
    garmentDetails: order.garmentDetails
  });
}

run().catch(console.error).finally(() => prisma.$disconnect());

