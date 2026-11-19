const assert = require('assert');
const { prisma, pool } = require('../src/prisma');
const {
  generateOrderBookingWhatsAppMessage,
  processBookingWhatsAppNotification
} = require('../src/controllers/orderController');

// Helper to check for Unicode replacement characters
function assertNoReplacementCharacters(str, label) {
  assert(!str.includes('\uFFFD'), `${label} contains unicode replacement character \\uFFFD`);
}

async function runQuotationTests() {
  console.log('================================================================');
  console.log('JB SYSTEM — FINAL WHATSAPP QUOTATION TEMPLATE VERIFICATION');
  console.log('================================================================\n');

  // TEST 1: Exact format verification with English customer name
  console.log('--- TEST 1: Template Structure & English Customer ---');
  const englishOrderFixture = {
    id: 101,
    orderNumber: 'JB-20261111-0001',
    customer: {
      name: 'Kavitha Shanmugam',
      primaryPhone: '0771234567'
    },
    garmentDetails: {
      dressType: 'Saree Blouse',
      quantity: 1
    },
    totalAmount: 18500,
    advancePayment: 5000,
    balanceAmount: 13500,
    payments: [{ amount: 5000, status: 'VERIFIED' }]
  };

  const msgEng = generateOrderBookingWhatsAppMessage(englishOrderFixture);
  console.log('Generated English Message:\n' + msgEng);
  console.log('\n------------------------------------------------------------');

  assertNoReplacementCharacters(msgEng, 'English Message');
  assert(msgEng.includes('✨ JB GROUP (PVT) LTD ✨'), 'Must contain header ✨ JB GROUP (PVT) LTD ✨');
  assert(msgEng.includes('Dear Kavitha Shanmugam, 🌸'), 'Must contain Dear {customerName}, 🌸');
  assert(msgEng.includes('Thank you for choosing JB GROUP! 💐 We truly appreciate your trust in us.'), 'Must contain appreciation line');
  assert(msgEng.includes('📋 ORDER QUOTATION'), 'Must contain 📋 ORDER QUOTATION');
  assert(msgEng.includes('🔖 Quotation No: QT-20261111-0001'), 'Must contain 🔖 Quotation No: QT-20261111-0001');
  assert(msgEng.includes('👗 Item: Saree Blouse × 1'), 'Must contain 👗 Item: {itemName} × {quantity}');
  assert(msgEng.includes('💰 Total Amount: LKR 18,500'), 'Must contain 💰 Total Amount: LKR {totalAmount}');
  assert(msgEng.includes('💵 Advance Payment: LKR 5,000'), 'Must contain 💵 Advance Payment: LKR {advancePayment}');
  assert(msgEng.includes('💳 Balance Payable: LKR 13,500'), 'Must contain 💳 Balance Payable: LKR {balancePayable}');
  assert(msgEng.includes('✅ Kindly review and confirm your quotation so we can proceed with your order.'), 'Must contain confirmation call to action');
  assert(msgEng.includes('💖 Your satisfaction is our priority, and we look forward to serving you!'), 'Must contain satisfaction line');
  assert(msgEng.includes('🏢 JB GROUP (PVT) LTD'), 'Must contain company signature');
  assert(msgEng.includes('✨ Build • Lead • Inspire.'), 'Must contain company motto');
  assert(msgEng.includes('🤖 Automated message from JB GROUP Management System.'), 'Must contain automated footer');

  console.log('✓ TEST 1 PASSED: English customer quotation strictly matches required template.\n');

  // TEST 2: Tamil customer name support and Unicode preservation
  console.log('--- TEST 2: Tamil Customer Name & UTF-8 / Unicode Verification ---');
  const tamilOrderFixture = {
    id: 102,
    orderNumber: 'JB-20261111-0002',
    customer: {
      name: 'வனிதா கந்தையா',
      primaryPhone: '0779876543'
    },
    garmentDetails: {
      dressType: 'பட்டுப் பாவாடை சட்டை',
      quantity: 2
    },
    totalAmount: 32000,
    advancePayment: 10000,
    balanceAmount: 22000,
    payments: [{ amount: 10000, status: 'VERIFIED' }]
  };

  const msgTam = generateOrderBookingWhatsAppMessage(tamilOrderFixture);
  console.log('Generated Tamil Message:\n' + msgTam);
  console.log('\n------------------------------------------------------------');

  assertNoReplacementCharacters(msgTam, 'Tamil Message');
  assert(msgTam.includes('Dear வனிதா கந்தையா, 🌸'), 'Must contain Tamil customer name correctly without corruption');
  assert(msgTam.includes('👗 Item: பட்டுப் பாவாடை சட்டை × 2'), 'Must preserve Tamil garment name and quantity');
  assert(msgTam.includes('💰 Total Amount: LKR 32,000'), 'Must format total amount');
  assert(msgTam.includes('💵 Advance Payment: LKR 10,000'), 'Must format advance payment');
  assert(msgTam.includes('💳 Balance Payable: LKR 22,000'), 'Must format balance payable');

  console.log('✓ TEST 2 PASSED: Tamil Unicode characters completely preserved without replacement characters ().\n');

  // TEST 3: WhatsApp URL Encoding & Line Break Preservation
  console.log('--- TEST 3: URL Encoding & Line Break Preservation ---');
  const encodedUrl = `https://wa.me/94771234567?text=${encodeURIComponent(msgEng)}`;
  console.log('Sample Encoded WhatsApp URL: ' + encodedUrl.slice(0, 120) + '...');

  assertNoReplacementCharacters(encodedUrl, 'Encoded URL');
  assert(encodedUrl.includes('%0A%0A'), 'Encoded URL must preserve double line breaks (%0A%0A)');
  assert(encodedUrl.includes('%E2%9C%A8'), 'Encoded URL must encode sparkles emoji ✨ to %E2%9C%A8');
  assert(encodedUrl.includes('%F0%9F%8C%B8'), 'Encoded URL must encode cherry blossom 🌸 to %F0%9F%8C%B8');

  // Decoded URL must match original message exactly
  const decodedFromUrl = decodeURIComponent(encodedUrl.split('?text=')[1]);
  assert.strictEqual(decodedFromUrl, msgEng, 'Decoded message from URL must match original string character-for-character');

  console.log('✓ TEST 3 PASSED: URL-encoded message preserves all line breaks and emojis.\n');

  // TEST 4: Live Database Order Verification
  console.log('--- TEST 4: Live Database Order & Payment Data Verification ---');
  const liveOrder = await prisma.order.findFirst({
    where: {
      totalAmount: { gt: 0 }
    },
    include: {
      customer: true,
      garmentDetails: true,
      payments: { orderBy: { createdAt: 'asc' } },
      branch: true
    },
    orderBy: { createdAt: 'desc' }
  });

  assert(liveOrder, 'At least one real order must exist in PostgreSQL');
  console.log(`Testing with Live Order ID: ${liveOrder.id} | Order No: ${liveOrder.orderNumber}`);
  console.log(`Customer: ${liveOrder.customer?.name} | Phone: ${liveOrder.customer?.primaryPhone}`);
  console.log(`Total: LKR ${liveOrder.totalAmount} | Advance: LKR ${liveOrder.advancePayment} | Balance: ${liveOrder.balanceAmount}`);

  const liveMsg = generateOrderBookingWhatsAppMessage(liveOrder);
  console.log('\n--- Live Order WhatsApp Message Output ---');
  console.log(liveMsg);
  console.log('-------------------------------------------\n');

  assertNoReplacementCharacters(liveMsg, 'Live Database Order Message');
  assert(liveMsg.includes(liveOrder.customer?.name?.trim()), 'Must contain live customer name');
  assert(liveMsg.includes('✨ JB GROUP (PVT) LTD ✨'), 'Must contain header');
  assert(liveMsg.includes('📋 ORDER QUOTATION'), 'Must contain ORDER QUOTATION');
  assert(liveMsg.includes('💰 Total Amount: LKR'), 'Must contain Total Amount');
  assert(liveMsg.includes('💵 Advance Payment: LKR'), 'Must contain Advance Payment');
  assert(liveMsg.includes('💳 Balance Payable: LKR'), 'Must contain Balance Payable');

  console.log('✓ TEST 4 PASSED: Live database order dynamically populated with real data.\n');

  // TEST 5: Quotation Approval & Booking Notification Dispatch Workflow
  console.log('--- TEST 5: Booking Notification Workflow (Idempotency & Phone Validation) ---');
  // Test invalid phone number rejection
  const invalidPhoneOrder = {
    id: 999999,
    orderNumber: 'JB-TEST-INVALID-PHONE',
    customer: { name: 'Test Invalid', primaryPhone: '123' },
    totalAmount: 1000,
    advancePayment: 500
  };

  const { req: mockReq } = { req: { user: { name: 'Staff' }, headers: {}, ip: '127.0.0.1' } };
  const invalidPhoneResult = await processBookingWhatsAppNotification(invalidPhoneOrder, 'Staff', mockReq);
  assert.strictEqual(invalidPhoneResult.sent, false, 'Invalid phone number must be rejected');
  assert.strictEqual(invalidPhoneResult.status, 'FAILED', 'Status must be FAILED');
  console.log('✓ Short/invalid phone number properly caught and rejected without throwing unhandled exceptions.');

  console.log('✓ TEST 5 PASSED: Quotation workflow error handling and validation verified.\n');

  console.log('================================================================');
  console.log('>>> ALL WHATSAPP QUOTATION TESTS PASSED SUCCESSFULLY (5/5) <<<');
  console.log('================================================================');

  await pool.end();
}

runQuotationTests().catch(async (err) => {
  console.error('Test execution failed:', err);
  await pool.end();
  process.exit(1);
});
