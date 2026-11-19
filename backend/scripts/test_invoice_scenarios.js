// backend/scripts/test_invoice_scenarios.js
const { generateDigitalInvoiceWhatsAppMessage } = require('../dist-test/DigitalInvoiceHelper.cjs');

// Mock scenarios
const scenarios = [
  {
    name: 'Case 1: Single-item Invoice (Saree Blouse)',
    order: {
      id: 266,
      orderNumber: 'JB-20261109-0003',
      branchId: 1,
      customer: { name: 'Dorin', primaryPhone: '+94 76 301 0582' },
      orderDate: '2026-11-09',
      bookedDate: '2026-11-09',
      totalAmount: 1600,
      balanceAmount: 1600,
      garmentDetails: { dressType: 'Saree Blouse', quantity: 1 }
    }
  },
  {
    name: 'Case 2: Multiple-item Invoice (3 Garments)',
    order: {
      id: 267,
      orderNumber: 'JB-20261109-0004',
      branchId: 1,
      customer: { name: 'Kavitha S.', primaryPhone: '+94 77 123 4567' },
      orderDate: '2026-11-09',
      bookedDate: '2026-11-09',
      totalAmount: 14500,
      balanceAmount: 4500,
      payments: [{ amount: 10000, status: 'VERIFIED' }],
      items: [
        { category: 'Stitching', itemName: 'Designer Bridal Saree Blouse', quantity: 1, unitPrice: 6500, total: 6500 },
        { category: 'Stitching', itemName: 'Anarkali Suit with Lining', quantity: 1, unitPrice: 5000, total: 5000 },
        { category: 'Stitching', itemName: 'Silk Kurti with Hand Embroidery', quantity: 2, unitPrice: 1500, total: 3000 }
      ]
    }
  },
  {
    name: 'Case 3: Long Customer Name',
    order: {
      id: 268,
      orderNumber: 'JB-20261109-0005',
      branchId: 1,
      customer: { name: 'Mrs. Chandramukhi Shivakumar Jayasundara Wickramaratne', primaryPhone: '+94 71 999 8888' },
      orderDate: '2026-11-09',
      bookedDate: '2026-11-09',
      totalAmount: 3200,
      balanceAmount: 0,
      payments: [{ amount: 3200, status: 'VERIFIED' }],
      garmentDetails: { dressType: 'Casual Frock', quantity: 2 }
    }
  },
  {
    name: 'Case 4: Long Garment Description',
    order: {
      id: 269,
      orderNumber: 'JB-20261109-0006',
      branchId: 1,
      customer: { name: 'Priya', primaryPhone: '+94 77 555 4433' },
      orderDate: '2026-11-09',
      bookedDate: '2026-11-09',
      totalAmount: 8500,
      balanceAmount: 3500,
      advancePayment: 5000,
      garmentDetails: {
        dressType: 'Heavy Zari Embroidery Wedding Lehanga Blouse with Latkan, Deep U-Back Neck, Princess Cut and Padded Cups',
        quantity: 1
      }
    }
  },
  {
    name: 'Case 5: Large Order Amount (Rs. 1,250,000.00)',
    order: {
      id: 270,
      orderNumber: 'JB-20261109-0007',
      branchId: 1,
      customer: { name: 'Royal Colombo Boutique', primaryPhone: '+94 11 234 5678' },
      orderDate: '2026-11-09',
      bookedDate: '2026-11-09',
      totalAmount: 1250000,
      balanceAmount: 250000,
      payments: [{ amount: 1000000, status: 'VERIFIED' }],
      items: [
        { category: 'Uniform Stitching', itemName: 'Luxury Corporate Uniform Suits (Full Set)', quantity: 100, unitPrice: 12500, total: 1250000 }
      ]
    }
  },
  {
    name: 'Case 6: JB GROUP Invoice Branding',
    order: {
      id: 271,
      orderNumber: 'JB-20261109-0008',
      branchId: 1,
      branchName: 'JB Group',
      customer: { name: 'Naveen Raj', primaryPhone: '+94 75 888 7777' },
      orderDate: '2026-11-09',
      totalAmount: 4200,
      balanceAmount: 4200,
      garmentDetails: { dressType: 'Men Bespoke Kurta', quantity: 1 }
    }
  },
  {
    name: 'Case 7: BELLA DESIGN Invoice Branding',
    order: {
      id: 272,
      orderNumber: 'BELLA-20261109-0001',
      branchId: 2,
      branchName: 'Bella Design',
      customer: { name: 'Ananya Fernando', primaryPhone: '+94 77 000 1122' },
      orderDate: '2026-11-09',
      totalAmount: 9800,
      balanceAmount: 0,
      payments: [{ amount: 9800, status: 'VERIFIED' }],
      garmentDetails: { dressType: 'Bespoke Evening Gown', quantity: 1 }
    }
  }
];

console.log('Running 7 test case scenarios for Digital Invoice Redesign:');
scenarios.forEach((sc, idx) => {
  console.log(`\n========================================`);
  console.log(`TEST ${idx + 1}: ${sc.name}`);
  console.log(`========================================`);
  const msg = generateDigitalInvoiceWhatsAppMessage(sc.order);
  console.log(`WhatsApp Message Preview:\n${msg}`);
  if (msg.includes('\uFFFD')) {
    console.error('❌ Found Unicode replacement character in message!');
    process.exit(1);
  }
  if (sc.order.branchId === 2) {
    if (!msg.includes('BELLA DESIGN')) {
      console.error('❌ Expected BELLA DESIGN branding!');
      process.exit(1);
    }
    if (msg.includes('JB GROUP')) {
      console.error('❌ Leaked JB GROUP into BELLA DESIGN message!');
      process.exit(1);
    }
  } else {
    if (!msg.includes('JB GROUP')) {
      console.error('❌ Expected JB GROUP branding!');
      process.exit(1);
    }
  }
  console.log(`✅ ${sc.name} verified successfully.`);
});
console.log('\n🎉 ALL 7 SCENARIOS VERIFIED WITHOUT ERRORS!');

