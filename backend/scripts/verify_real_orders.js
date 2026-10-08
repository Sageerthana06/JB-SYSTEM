require('dotenv').config();
const { prisma } = require('../src/prisma');

async function checkRealOrders() {
  console.log('=== VERIFYING REAL DATABASE ORDERS ===');
  const orders = await prisma.order.findMany({
    orderBy: { orderDate: 'desc' },
    include: { customer: true, garmentDetails: true, payments: true }
  });

  console.log(`Total orders in DB: ${orders.length}`);
  for (const o of orders) {
    const custName = o.customer ? o.customer.name : 'Unknown Customer';
    const garment = o.garmentDetails ? o.garmentDetails.dressType : 'Not specified';
    const total = o.totalAmount > 0 ? `LKR ${o.totalAmount}` : 'PRICE PENDING';
    const paid = o.advancePayment;
    const balance = o.totalAmount > 0 ? Math.max(0, o.totalAmount - paid) : 0;
    console.log(`ID: #${o.id} | Order No: ${o.orderNumber} | Customer: ${custName} | Garment: ${garment} | Price: ${total} | Paid: LKR ${paid} | Balance: LKR ${balance} | Status: ${o.status}`);
  }

  // Check for any dummy or test references
  const dummyFound = orders.filter(o => 
    (o.customer && (o.customer.name.includes('Kavitha Sivarajah') || o.customer.name.includes('Test API User'))) ||
    ['JB-20260930-0005', 'JB-20260930-0006', 'JB-20260930-0007'].includes(o.orderNumber)
  );

  console.log(`\nDummy/Test records found: ${dummyFound.length}`);
  if (dummyFound.length === 0) {
    console.log('✓ PASS: Zero dummy/test orders exist in PostgreSQL.');
  } else {
    console.error('✕ FAIL: Dummy records still found:', dummyFound.map(d => d.orderNumber));
  }

  process.exit(dummyFound.length > 0 ? 1 : 0);
}

checkRealOrders().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
