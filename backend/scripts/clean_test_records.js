require('dotenv').config();
const { prisma } = require('../src/prisma');

async function cleanTestRecords() {
  console.log('Finding test customers and orders...');
  const testCustomers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: 'Kavitha Sivarajah', mode: 'insensitive' } },
        { name: { contains: 'Test API User', mode: 'insensitive' } },
        { name: { contains: 'API Test User', mode: 'insensitive' } },
        { name: { contains: 'Test Measurement Customer', mode: 'insensitive' } },
        { id: { in: [1, 2, 27, 31] } }
      ]
    },
    include: { orders: true }
  });

  console.log('Found', testCustomers.length, 'test customer accounts.');

  const orderIds = [];
  for (const cust of testCustomers) {
    for (const ord of cust.orders) {
      orderIds.push(ord.id);
    }
  }

  // Also find any order specifically with number like JB-20260930-0001, 0002, 0003, 0005, 0006, 0007
  const extraTestOrders = await prisma.order.findMany({
    where: {
      orderNumber: {
        in: [
          'JB-20260930-0001',
          'JB-20260930-0002',
          'JB-20260930-0003',
          'JB-20260930-0005',
          'JB-20260930-0006',
          'JB-20260930-0007'
        ]
      }
    }
  });
  for (const ord of extraTestOrders) {
    if (!orderIds.includes(ord.id)) {
      orderIds.push(ord.id);
    }
  }

  console.log('Total test order IDs to clean up:', orderIds);

  if (orderIds.length > 0) {
    await prisma.productionHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.garmentDetails.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    console.log('Successfully deleted test orders and dependent records.');
  }

  for (const cust of testCustomers) {
    await prisma.customerMeasurement.deleteMany({ where: { customerId: cust.id } });
    await prisma.customer.delete({ where: { id: cust.id } }).catch(err => {
      console.warn('Customer delete notice:', cust.id, err.message);
    });
    console.log(`Deleted test customer: ${cust.name} (ID: ${cust.id})`);
  }

  console.log('=== Cleanup finished successfully ===');
  process.exit(0);
}

cleanTestRecords().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
