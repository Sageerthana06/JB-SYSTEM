const assert = require('assert');
const { prisma } = require('../src/prisma');
const { processDeliveryWhatsAppNotification, notifyOrderDelivered } = require('../src/controllers/orderController');

async function run() {
  console.log('Testing WhatsApp Delivered Automation with PostgreSQL...');

  // 1. Fetch an existing order from the database
  const order = await prisma.order.findFirst({
    where: {
      status: { in: ['DELIVERED', 'COMPLETED', 'READY'] }
    },
    include: {
      customer: true,
      garmentDetails: true,
      branch: true,
      payments: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!order) {
    console.log('No eligible order found for live test.');
    return;
  }

  console.log(`Using order #${order.id} (${order.orderNumber}), status: ${order.status}`);

  // Test Guard: If status is READY, verify it is blocked
  const readyOrder = { ...order, status: 'READY' };
  const blockedResult = await processDeliveryWhatsAppNotification(readyOrder, 'Tester', null, false);
  assert(blockedResult.sent === false, 'Blocked when order is only READY');
  console.log('✓ Guard passed: Order is blocked when status is only READY.');

  // Test Guard: If customer phone is missing
  const noPhoneOrder = { ...order, status: 'DELIVERED', customer: { ...order.customer, primaryPhone: '' } };
  const noPhoneResult = await processDeliveryWhatsAppNotification(noPhoneOrder, 'Tester', null, true);
  assert(noPhoneResult.sent === false && noPhoneResult.error.includes('phone'), 'Blocked when phone is missing');
  console.log('✓ Guard passed: Missing phone handled without crashing.');

  // Test with valid DELIVERED order
  const deliveredOrder = { ...order, status: 'DELIVERED' };
  
  // Call processDeliveryWhatsAppNotification with force: true
  const sendResult = await processDeliveryWhatsAppNotification(deliveredOrder, 'Manager Test', null, true);
  assert(sendResult.sent === true, 'Sent successfully');
  assert(sendResult.whatsAppMessage.includes('YOUR ORDER IS COMPLETED!'), 'Message content correct');
  assert(sendResult.waUrl.includes('whatsapp.com/send') || sendResult.waUrl.startsWith('https://wa.me/'), 'waUrl generated');
  console.log('✓ WhatsApp notification generated and recorded.');
  console.log(`WhatsApp URL: ${sendResult.waUrl}`);

  // Verify DB record
  const dbOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: {
      customer: true,
      garmentDetails: true,
      branch: true,
      payments: true
    }
  });

  assert(dbOrder.deliveryNotificationSent === true, 'deliveryNotificationSent is true');
  assert(dbOrder.deliveryNotificationSentAt !== null, 'deliveryNotificationSentAt timestamp saved');
  assert(dbOrder.deliveryNotificationSentBy === 'Manager Test', 'deliveryNotificationSentBy saved');
  assert(dbOrder.deliveryNotificationStatus === 'SENT', 'deliveryNotificationStatus is SENT');
  assert(Boolean(dbOrder.deliveryNotificationPhone), 'deliveryNotificationPhone saved');
  assert(Boolean(dbOrder.deliveryNotificationMessage), 'deliveryNotificationMessage saved');
  console.log('✓ Verified: PostgreSQL columns updated with delivery status, timestamp, actor, and message.');

  // Test Duplicate Prevention: calling without force must be blocked on a DELIVERED order
  const duplicateResult = await processDeliveryWhatsAppNotification({ ...dbOrder, status: 'DELIVERED' }, 'Manager Test', null, false);
  assert(duplicateResult.sent === false, 'Duplicate not sent');
  assert(duplicateResult.duplicatePrevented === true, 'Duplicate prevented flag returned');
  console.log('✓ Verified: Duplicate prevention stops re-sending on subsequent updates.');

  // Test Retry: calling with force = true succeeds on a DELIVERED order
  const retryResult = await processDeliveryWhatsAppNotification({ ...dbOrder, status: 'DELIVERED' }, 'Manager Test Retry', null, true);
  assert(retryResult.sent === true, 'Retry succeeds with force: true');
  console.log('✓ Verified: Retry mechanism allows re-sending if requested.');

  console.log('\nALL DATABASE & BUSINESS LOGIC TESTS PASSED!');
}

run()
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
