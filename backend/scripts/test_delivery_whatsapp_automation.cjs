const assert = require('assert');
const { generateOrderDeliveredWhatsAppMessage } = require('../src/controllers/orderController');

function runUnitTests() {
  console.log('Testing WhatsApp Delivered Message Formatting...');

  const mockOrder1 = {
    id: 255,
    orderNumber: 'JB-20261107-0003',
    customer: {
      name: 'Vijitha',
      primaryPhone: '+94759737340'
    },
    garmentDetails: {
      dressType: 'Saree Blouse',
      quantity: 1
    },
    totalAmount: 3500,
    advancePayment: 3500,
    payments: [
      { amount: 3500, status: 'VERIFIED' }
    ]
  };

  const msg1 = generateOrderDeliveredWhatsAppMessage(mockOrder1);
  console.log('Generated Message 1 (Fully Paid):\n' + msg1);

  assert(msg1.includes('✨ JB GROUP (PVT) LTD ✨'), 'Header present');
  assert(msg1.includes('Dear Vijitha, 🌸'), 'Customer name present');
  assert(msg1.includes('🎉 YOUR ORDER IS COMPLETED!'), 'Banner present');
  assert(msg1.includes('🔖 Order No: JB-20261107-0003'), 'Order number present');
  assert(msg1.includes('👗 Item: Saree Blouse × 1'), 'Item present');
  assert(msg1.includes('💰 Total Amount: LKR 3,500.00'), 'Total amount present');
  assert(msg1.includes('💵 Amount Paid: LKR 3,500.00'), 'Amount paid present');
  assert(msg1.includes('💳 Balance Due: LKR 0.00'), 'Balance due present');
  assert(msg1.includes('💖 We hope you love your outfit! Your satisfaction is our priority.'), 'Satisfaction note present');
  assert(msg1.includes('🏢 JB GROUP (PVT) LTD\n✨ Build • Lead • Inspire.'), 'Brand tag present');
  assert(msg1.includes('🤖 Automated message from JB GROUP Management System.'), 'Footer present');

  console.log('\nTesting Partial Payment Scenario...');
  const mockOrder2 = {
    id: 104,
    orderNumber: 'ORD-104',
    customer: {
      name: 'Nirosha',
      primaryPhone: '0771234567'
    },
    garmentDetails: {
      dressType: 'Frock',
      quantity: 2
    },
    totalAmount: 5000,
    advancePayment: 2000,
    payments: [
      { amount: 2000, status: 'VERIFIED' }
    ]
  };

  const msg2 = generateOrderDeliveredWhatsAppMessage(mockOrder2);
  console.log('Generated Message 2 (Partial Payment):\n' + msg2);

  assert(msg2.includes('Dear Nirosha, 🌸'), 'Customer Nirosha');
  assert(msg2.includes('👗 Item: Frock × 2'), 'Item and quantity');
  assert(msg2.includes('💰 Total Amount: LKR 5,000.00'), 'Total 5,000.00');
  assert(msg2.includes('💵 Amount Paid: LKR 2,000.00'), 'Paid 2,000.00');
  assert(msg2.includes('💳 Balance Due: LKR 3,000.00'), 'Balance 3,000.00');

  console.log('\nAll Unit Tests Passed Successfully!');
}

runUnitTests();

