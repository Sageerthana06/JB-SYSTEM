const assert = require('assert');
const {
  generateOrderBookingWhatsAppMessage,
  processBookingWhatsAppNotification
} = require('../src/controllers/orderController');
const { prisma, pool } = require('../src/prisma');

async function runTests() {
  console.log('====================================================');
  console.log('JB SYSTEM — AUTOMATIC WHATSAPP ORDER BOOKING TESTS');
  console.log('====================================================\n');

  // TEST 1: Message Template & Dynamic Variable Formatting
  console.log('--- TEST 1: Message Formatting & Dynamic Variables ---');
  const mockOrder = {
    id: 991,
    orderNumber: 'ORD-2026-0042',
    quotationNumber: 'QT-2026-0042',
    customer: {
      name: 'Dilani Perera',
      primaryPhone: '+94712345678'
    },
    garmentDetails: {
      dressType: 'Designer Lehanga',
      quantity: 2
    },
    totalAmount: 45000,
    advancePayment: 15000,
    balanceAmount: 30000
  };

  const msg = generateOrderBookingWhatsAppMessage(mockOrder);
  console.log('Generated Message:\n----------------------------------------');
  console.log(msg);
  console.log('----------------------------------------\n');

  assert(msg.includes('✨ JB GROUP (PVT) LTD ✨'), 'Header banner must match');
  assert(msg.includes('Dear Dilani Perera, 🌸'), 'Customer name must match dynamic value');
  assert(msg.includes('Thank you for choosing JB GROUP! 💐 We truly appreciate your trust in us.'), 'Greeting must match');
  assert(msg.includes('📋 ORDER QUOTATION'), 'Order quotation header must match');
  assert(msg.includes('🔖 Quotation No: QT-2026-0042'), 'Quotation No must match dynamic value');
  assert(msg.includes('👗 Item: Designer Lehanga × 2'), 'Item and quantity must match dynamic values');
  assert(msg.includes('💰 Total Amount: LKR 45,000'), 'Total Amount must match formatted LKR without unnecessary decimals');
  assert(msg.includes('💵 Advance Payment: LKR 15,000'), 'Advance Payment must match formatted LKR without unnecessary decimals');
  assert(msg.includes('💳 Balance Payable: LKR 30,000'), 'Balance Payable must match formatted LKR without unnecessary decimals');
  assert(msg.includes('✅ Kindly review and confirm your quotation so we can proceed with your order.'), 'Review note must match');
  assert(msg.includes('💖 Your satisfaction is our priority, and we look forward to serving you!'), 'Satisfaction message must match');
  assert(msg.includes('🏢 JB GROUP (PVT) LTD\n✨ Build • Lead • Inspire.'), 'Brand slogan must match');
  assert(msg.includes('🤖 Automated message from JB GROUP Management System.'), 'Footer notice must match');
  console.log('✓ TEST 1 PASSED: Message template matches exact JB GROUP design.\n');

  // TEST 1B: User Example Formatting (e.g. 1,600, not 1,600.00)
  console.log('--- TEST 1B: Integer vs Decimal Formatting (Example: 1,600, not 1,600.00) ---');
  const mockOrder1600 = {
    orderNumber: 'ORD-2026-0088',
    customer: { name: 'Tharushi' },
    garmentDetails: { dressType: 'Blouse', quantity: 1 },
    totalAmount: 1600,
    advancePayment: 600,
    balanceAmount: 1000
  };
  const msg1600 = generateOrderBookingWhatsAppMessage(mockOrder1600);
  assert(msg1600.includes('💰 Total Amount: LKR 1,600'), '1,600 formatted without .00');
  assert(msg1600.includes('💵 Advance Payment: LKR 600'), '600 formatted without .00');
  assert(msg1600.includes('💳 Balance Payable: LKR 1,000'), '1,000 formatted without .00');

  // Decimal case
  const mockOrderDecimal = {
    orderNumber: 'ORD-2026-0089',
    customer: { name: 'Ravi' },
    garmentDetails: { dressType: 'Shirt', quantity: 1 },
    totalAmount: 1600.5,
    advancePayment: 600.25,
    balanceAmount: 1000.25
  };
  const msgDec = generateOrderBookingWhatsAppMessage(mockOrderDecimal);
  assert(msgDec.includes('💰 Total Amount: LKR 1,600.50'), 'Fractional .50 formatted');
  assert(msgDec.includes('💵 Advance Payment: LKR 600.25'), 'Fractional .25 formatted');
  assert(msgDec.includes('💳 Balance Payable: LKR 1,000.25'), 'Fractional .25 balance formatted');
  console.log('✓ TEST 1B PASSED: Integer amounts formatted without .00 (e.g., 1,600), decimals preserved.\n');

  // TEST 1C: Unicode Emoji Encoding & Replacement Character Immunity
  console.log('--- TEST 1C: Unicode Emoji Encoding Integrity & Replacement Immunity ---');
  // Check no replacement characters (\uFFFD or byte sequence EF BF BD) in message
  assert(!msg.includes('\uFFFD'), 'Message must NOT contain Unicode replacement character \uFFFD');
  assert(!Buffer.from(msg, 'utf8').includes(Buffer.from([0xEF, 0xBF, 0xBD])), 'Message UTF-8 buffer must not contain EF BF BD');

  // Check all specific emoji code points
  const expectedEmojis = [
    { name: 'SPARKLES', char: '\u2728', hex: '2728' },
    { name: 'CHERRY_BLOSSOM', char: '\u{1F338}', hex: '1f338' },
    { name: 'BOUQUET', char: '\u{1F490}', hex: '1f490' },
    { name: 'CLIPBOARD', char: '\u{1F4CB}', hex: '1f4cb' },
    { name: 'BOOKMARK', char: '\u{1F516}', hex: '1f516' },
    { name: 'DRESS', char: '\u{1F457}', hex: '1f457' },
    { name: 'MONEY_BAG', char: '\u{1F4B0}', hex: '1f4b0' },
    { name: 'DOLLAR_BILL', char: '\u{1F4B5}', hex: '1f4b5' },
    { name: 'CREDIT_CARD', char: '\u{1F4B3}', hex: '1f4b3' },
    { name: 'CHECK', char: '\u2705', hex: '2705' },
    { name: 'HEART', char: '\u{1F496}', hex: '1f496' },
    { name: 'OFFICE', char: '\u{1F3E2}', hex: '1f3e2' },
    { name: 'ROBOT', char: '\u{1F916}', hex: '1f916' },
    { name: 'BULLET', char: '\u2022', hex: '2022' },
    { name: 'TIMES', char: '\u00D7', hex: '00d7' }
  ];

  for (const item of expectedEmojis) {
    assert(msg.includes(item.char), `Message must include valid emoji ${item.name} (${item.char}, U+${item.hex.toUpperCase()})`);
  }

  // Check URL encoding
  const encodedUrlText = encodeURIComponent(msg);
  assert(!encodedUrlText.includes('%EF%BF%BD'), 'Encoded URL must NOT contain %EF%BF%BD replacement bytes');
  // Check that sparks %E2%9C%A8 and cherry blossom %F0%9F%8C%B8 are properly encoded
  assert(encodedUrlText.includes('%E2%9C%A8'), 'Sparkles must be properly percent-encoded as %E2%9C%A8');
  assert(encodedUrlText.includes('%F0%9F%8C%B8'), 'Cherry blossom must be properly percent-encoded as %F0%9F%8C%B8');
  console.log('✓ TEST 1C PASSED: Unicode emojis match exact code points without replacement characters.\n');

  // TEST 2: Multi-Item Support & Automatic Quotation Fallback
  console.log('--- TEST 2: Multi-Item & Dynamic Quotation Number Fallback ---');
  const mockOrderMulti = {
    id: 105,
    orderNumber: 'ORD-2026-0105',
    customer: {
      name: 'Fathima',
      primaryPhone: '0779876543'
    },
    items: [
      { itemName: 'Abaya Silk', quantity: 1 },
      { itemName: 'Matching Hijab', quantity: 2 }
    ],
    totalAmount: 18500,
    advancePayment: 18500,
    balanceAmount: 0
  };

  const msgMulti = generateOrderBookingWhatsAppMessage(mockOrderMulti);
  assert(msgMulti.includes('🔖 Quotation No: QT-2026-0105'), 'Quotation number auto-derived from orderNumber');
  assert(msgMulti.includes('👗 Item: Abaya Silk × 1'), 'Multi item 1 formatted');
  assert(msgMulti.includes('👗 Item: Matching Hijab × 2'), 'Multi item 2 formatted');
  assert(msgMulti.includes('💰 Total Amount: LKR 18,500'), 'Total 18,500 without .00');
  assert(msgMulti.includes('💵 Advance Payment: LKR 18,500'), 'Advance 18,500 without .00');
  assert(msgMulti.includes('💳 Balance Payable: LKR 0'), 'Balance 0 without .00');
  console.log('✓ TEST 2 PASSED: Multi-item & Quotation Number fallback verified.\n');

  // TEST 3: Duplicate Message Prevention
  console.log('--- TEST 3: Duplicate Message Prevention ---');
  const alreadySentOrder = {
    id: 501,
    orderNumber: 'ORD-2026-0501',
    bookingNotificationSent: true,
    bookingNotificationSentAt: new Date('2026-11-10T08:00:00Z'),
    bookingNotificationSentBy: 'Manager',
    bookingNotificationStatus: 'SENT',
    customer: {
      name: 'Kamal',
      primaryPhone: '+94771122334'
    }
  };

  const dupResult = await processBookingWhatsAppNotification(alreadySentOrder, 'Staff', null, false);
  assert.strictEqual(dupResult.sent, false, 'Should not resend if already sent');
  assert.strictEqual(dupResult.duplicatePrevented, true, 'Duplicate flag must be true');
  console.log('Duplicate Prevention Output:', dupResult.message);
  console.log('✓ TEST 3 PASSED: Duplicate sending prevented on page refresh.\n');

  // TEST 4: Non-blocking Failure Handling (Order is preserved if phone is invalid)
  console.log('--- TEST 4: Failure Handling (Invalid phone does not cancel order) ---');
  // Create a temporary test customer & order in PostgreSQL
  const testCustomer = await prisma.customer.upsert({
    where: { primaryPhone: '+94700000001' },
    update: { name: 'Test Fail Safe Cust' },
    create: {
      name: 'Test Fail Safe Cust',
      primaryPhone: '+94700000001'
    }
  });

  const testOrderInvalid = await prisma.order.create({
    data: {
      orderNumber: `TEST-FAIL-${Date.now()}`,
      customerId: testCustomer.id,
      orderSource: 'SHOP',
      totalAmount: 12000,
      advancePayment: 4000,
      balanceAmount: 8000,
      garmentDetails: {
        create: {
          dressType: 'Kurti',
          quantity: 1
        }
      }
    },
    include: { customer: true, garmentDetails: true }
  });

  // Temporarily wipe phone to test failure handling
  testOrderInvalid.customer.primaryPhone = '';

  const failResult = await processBookingWhatsAppNotification(testOrderInvalid, 'Staff', null, false);
  assert.strictEqual(failResult.status, 'FAILED', 'Status must be FAILED');
  assert(failResult.error.includes('phone number is missing'), 'Error message accurate');

  // Verify order STILL EXISTS in database and status recorded
  const reCheckOrder = await prisma.order.findUnique({ where: { id: testOrderInvalid.id } });
  assert(reCheckOrder !== null, 'Order MUST NOT be deleted or canceled on notification failure');
  assert.strictEqual(reCheckOrder.bookingNotificationStatus, 'FAILED', 'PostgreSQL status recorded as FAILED');
  console.log('✓ TEST 4 PASSED: Failure handled safely; order preserved with FAILED status.\n');

  // TEST 5: Live Database Order Booking Notification & Retry Verification
  console.log('--- TEST 5: Live Database Booking Notification & Retry ---');
  // Update customer with valid WhatsApp phone
  const validPhone = '+94778899001';
  await prisma.customer.update({
    where: { id: testCustomer.id },
    data: { primaryPhone: validPhone }
  });

  const liveOrder = await prisma.order.findUnique({
    where: { id: testOrderInvalid.id },
    include: { customer: true, garmentDetails: true }
  });

  // Dispatch / Retry
  const successResult = await processBookingWhatsAppNotification(liveOrder, 'Manager Test', null, true);
  assert.strictEqual(successResult.sent, true, 'Must report sent: true');
  assert.strictEqual(successResult.status, 'SENT', 'Must report status: SENT');
  assert.strictEqual(successResult.phone, '94778899001', 'Target phone normalized');
  assert(successResult.waUrl.startsWith('https://wa.me/94778899001?text='), 'WhatsApp URL formed correctly');
  assert(successResult.whatsAppMessage.includes('Kurti × 1'), 'Item details present');
  assert(successResult.whatsAppMessage.includes('LKR 12,000'), 'Total amount present without unnecessary decimal zeros');

  // Verify database record
  const verifiedDbOrder = await prisma.order.findUnique({ where: { id: testOrderInvalid.id } });
  assert.strictEqual(verifiedDbOrder.bookingNotificationSent, true, 'bookingNotificationSent is true');
  assert.strictEqual(verifiedDbOrder.bookingNotificationStatus, 'SENT', 'bookingNotificationStatus is SENT');
  assert.strictEqual(verifiedDbOrder.bookingNotificationPhone, '94778899001', 'bookingNotificationPhone is recorded');
  assert(verifiedDbOrder.bookingNotificationSentAt !== null, 'bookingNotificationSentAt timestamp is recorded');
  assert(verifiedDbOrder.quotationNumber !== null, 'quotationNumber is generated and saved');
  console.log('Verified Database Record:');
  console.log({
    id: verifiedDbOrder.id,
    orderNumber: verifiedDbOrder.orderNumber,
    quotationNumber: verifiedDbOrder.quotationNumber,
    bookingNotificationStatus: verifiedDbOrder.bookingNotificationStatus,
    bookingNotificationPhone: verifiedDbOrder.bookingNotificationPhone,
    bookingNotificationSentAt: verifiedDbOrder.bookingNotificationSentAt
  });
  console.log('✓ TEST 5 PASSED: Live database booking notification successfully processed & persisted.\n');

  // Clean up test order
  await prisma.garmentDetails.deleteMany({ where: { orderId: testOrderInvalid.id } });
  await prisma.order.delete({ where: { id: testOrderInvalid.id } });
  await prisma.customer.delete({ where: { id: testCustomer.id } });
  console.log('✓ Test cleanup completed.\n');

  console.log('====================================================');
  console.log('>>> ALL 5 WHATSAPP BOOKING AUTOMATION TESTS PASSED <<<');
  console.log('====================================================');

  await pool.end();
}

runTests().catch(async (err) => {
  console.error('Test execution failed:', err);
  await pool.end();
  process.exit(1);
});

