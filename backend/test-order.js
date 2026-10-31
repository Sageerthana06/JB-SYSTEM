require('dotenv').config();
const { prisma } = require('./src/prisma');

async function run() {
  try {
    const customer = await prisma.customer.findFirst();
    if (!customer) {
      console.log('No customer found to test with.');
      return;
    }
    console.log('Testing with customer:', customer.id);

    const orderData = {
      orderNumber: 'JB-TEST-0001',
      customerId: customer.id,
      previousOrderId: null,
      branchId: null,
      orderSource: 'SHOP',
      status: 'ORDER_CONFIRMED',
      priceStatus: 'PENDING',
      priceAcceptedByCustomer: false,
      totalAmount: 0,
      advancePayment: 0,
      balanceAmount: 0,
      paymentStatus: 'Unpaid',
      assignedTailorId: null,
      garmentDetails: {
        create: {
          dressType: 'Frock',
          quantity: 1,
          measurements: { bust: "34", waist: "28" },
          measurementUnit: 'cm',
          fitPreference: 'Regular'
        }
      }
    };

    const newOrder = await prisma.order.create({
      data: orderData,
      include: {
        garmentDetails: true,
        payments: true
      }
    });

    console.log('Success:', newOrder.id);
  } catch (error) {
    console.error('Prisma Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}
run();
