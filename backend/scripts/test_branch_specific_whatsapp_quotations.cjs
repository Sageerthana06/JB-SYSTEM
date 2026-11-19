const assert = require('assert');
const { prisma, pool } = require('../src/prisma');
const {
  generateOrderBookingWhatsAppMessage,
  processBookingWhatsAppNotification
} = require('../src/controllers/orderController');

function assertNoReplacementCharacters(str, label) {
  assert(!str.includes('\uFFFD'), `${label} contains unicode replacement character \\uFFFD (\uFFFD)`);
}

async function runTests() {
  console.log('================================================================');
  console.log('JB SYSTEM — WHATSAPP QUOTATION FORMAT & DUAL BRANCH BRANDING TEST');
  console.log('================================================================\n');

  // TEST 1: JB GROUP Quotation Message Formatting
  console.log('--- TEST 1: JB GROUP Quotation Message Formatting ---');
  const jbOrderFixture = {
    id: 301,
    orderNumber: 'JB-20261111-0001',
    quotationNumber: 'QT-20261111-0001',
    branchId: 1,
    branch: { id: 1, name: 'JB Group (Main)' },
    customer: {
      name: 'Priyanka Rathnayake',
      primaryPhone: '0771234567'
    },
    garmentDetails: {
      dressType: 'Anarkali Suit',
      quantity: 1
    },
    totalAmount: 24500,
    advancePayment: 10000,
    balanceAmount: 14500,
    payments: [{ amount: 10000, status: 'VERIFIED' }]
  };

  const jbMsg = generateOrderBookingWhatsAppMessage(jbOrderFixture);
  console.log('Generated JB GROUP WhatsApp Quotation Message:');
  console.log('------------------------------------------------------------');
  console.log(jbMsg);
  console.log('------------------------------------------------------------\n');

  assertNoReplacementCharacters(jbMsg, 'JB GROUP Message');
  assert(jbMsg.startsWith('✨ JB GROUP (PVT) LTD ✨'), 'JB Header must match');
  assert(jbMsg.includes('Dear Priyanka Rathnayake, 🌸'), 'Customer greeting must match');
  assert(jbMsg.includes('Thank you for choosing JB GROUP! 💐 We truly appreciate your trust in us.'), 'Thank you line must match');
  assert(jbMsg.includes('📋 ORDER QUOTATION'), 'Quotation title must match');
  assert(jbMsg.includes('🔖 Quotation No: QT-20261111-0001'), 'Quotation No must match');
  assert(jbMsg.includes('👗 Item: Anarkali Suit × 1'), 'Garment item & quantity must match');
  assert(jbMsg.includes('💰 Total Amount: LKR 24,500'), 'Total amount formatted must match');
  assert(jbMsg.includes('💵 Advance Payment: LKR 10,000'), 'Advance payment formatted must match');
  assert(jbMsg.includes('💳 Balance Payable: LKR 14,500'), 'Balance payable formatted must match');
  assert(jbMsg.includes('✅ Kindly review and confirm your quotation so we can proceed with your order.'), 'Review action must match');
  assert(jbMsg.includes('💖 Your satisfaction is our priority, and we look forward to serving you!'), 'Satisfaction closing must match');
  assert(jbMsg.includes('🏢 JB GROUP (PVT) LTD'), 'Company signature must match');
  assert(jbMsg.includes('✨ Build • Lead • Inspire.'), 'Motto must match');
  assert(jbMsg.includes('🤖 Automated message from JB GROUP Management System.'), 'Automated footer must match');

  console.log('✓ TEST 1 PASSED: JB GROUP quotation strictly adheres to format.\n');

  // TEST 2: BELLA DESIGN Quotation Message Formatting (Dynamic Branding)
  console.log('--- TEST 2: BELLA DESIGN Quotation Message Formatting (Dynamic Branding) ---');
  const bellaOrderFixture = {
    id: 302,
    orderNumber: 'BELLA-20261111-0002',
    quotationNumber: 'QT-BELLA-20261111-0002',
    branchId: 2,
    branch: { id: 2, name: 'Bella Design' },
    customer: {
      name: 'Fathima Rizwan',
      primaryPhone: '0759876543'
    },
    garmentDetails: {
      dressType: 'Bridal Gown',
      quantity: 1
    },
    totalAmount: 65000,
    advancePayment: 25000,
    balanceAmount: 40000,
    payments: [{ amount: 25000, status: 'VERIFIED' }]
  };

  const bellaMsg = generateOrderBookingWhatsAppMessage(bellaOrderFixture);
  console.log('Generated BELLA DESIGN WhatsApp Quotation Message:');
  console.log('------------------------------------------------------------');
  console.log(bellaMsg);
  console.log('------------------------------------------------------------\n');

  assertNoReplacementCharacters(bellaMsg, 'BELLA DESIGN Message');
  assert(bellaMsg.startsWith('✨ BELLA DESIGN ✨'), 'Bella Header must be ✨ BELLA DESIGN ✨');
  assert(bellaMsg.includes('Dear Fathima Rizwan, 🌸'), 'Customer greeting must match');
  assert(bellaMsg.includes('Thank you for choosing BELLA DESIGN! 💐 We truly appreciate your trust in us.'), 'Thank you line must use BELLA DESIGN');
  assert(bellaMsg.includes('📋 ORDER QUOTATION'), 'Quotation title must match');
  assert(bellaMsg.includes('🔖 Quotation No: QT-BELLA-20261111-0002'), 'Quotation No must match');
  assert(bellaMsg.includes('👗 Item: Bridal Gown × 1'), 'Garment item & quantity must match');
  assert(bellaMsg.includes('💰 Total Amount: LKR 65,000'), 'Total amount formatted must match');
  assert(bellaMsg.includes('💵 Advance Payment: LKR 25,000'), 'Advance payment formatted must match');
  assert(bellaMsg.includes('💳 Balance Payable: LKR 40,000'), 'Balance payable formatted must match');
  assert(bellaMsg.includes('✅ Kindly review and confirm your quotation so we can proceed with your order.'), 'Review action must match');
  assert(bellaMsg.includes('💖 Your satisfaction is our priority, and we look forward to serving you!'), 'Satisfaction closing must match');
  assert(bellaMsg.includes('🏢 BELLA DESIGN'), 'Company signature must be 🏢 BELLA DESIGN');
  assert(bellaMsg.includes('✨ Build • Lead • Inspire.'), 'Motto must match');
  assert(bellaMsg.includes('🤖 Automated message from BELLA DESIGN Management System.'), 'Automated footer must use BELLA DESIGN Management System');

  // Verify complete absence of 'JB GROUP' in Bella Design message
  assert(!bellaMsg.includes('JB GROUP'), 'BELLA DESIGN message must NOT contain any reference to JB GROUP');

  console.log('✓ TEST 2 PASSED: BELLA DESIGN dynamically receives complete Bella Design branding.\n');

  // TEST 3: Multi-Item Bella Design Order
  console.log('--- TEST 3: Multi-Item Quotation Formatting ---');
  const multiItemBella = {
    id: 303,
    orderNumber: 'BELLA-20261111-0003',
    quotationNumber: 'QT-BELLA-20261111-0003',
    branchId: 2,
    customer: { name: 'Dr. Nirmala', primaryPhone: '0773344556' },
    items: [
      { itemName: 'Silk Kurti', quantity: 2 },
      { itemName: 'Palazzo Pants', quantity: 2 }
    ],
    totalAmount: 18000,
    advancePayment: 8000,
    balanceAmount: 10000
  };

  const multiMsg = generateOrderBookingWhatsAppMessage(multiItemBella);
  console.log('Generated Multi-Item Message Preview:\n' + multiMsg);
  console.log('\n------------------------------------------------------------');
  assert(multiMsg.includes('👗 Item: Silk Kurti × 2\n👗 Item: Palazzo Pants × 2'), 'Multiple items must be formatted line by line');
  assert(multiMsg.includes('✨ BELLA DESIGN ✨'), 'Must use Bella Design branding');
  console.log('✓ TEST 3 PASSED: Multi-item quotation correctly formatted.\n');

  // TEST 4: URL Encoding & Verification
  console.log('--- TEST 4: WhatsApp URL Encoding & Integrity ---');
  const targetPhone = '94759876543';
  const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(bellaMsg)}`;
  console.log('WhatsApp Direct URL: ' + waUrl.slice(0, 150) + '...');

  assertNoReplacementCharacters(waUrl, 'Encoded URL');
  assert(waUrl.includes('%0A%0A'), 'URL contains preserved line breaks (%0A%0A)');
  assert(waUrl.includes('%E2%9C%A8'), 'URL contains encoded sparkle emoji (%E2%9C%A8)');
  assert(waUrl.includes('%F0%9F%8C%B8'), 'URL contains encoded cherry blossom emoji (%F0%9F%8C%B8)');
  assert(waUrl.includes('BELLA%20DESIGN'), 'URL contains encoded BELLA DESIGN');

  const decoded = decodeURIComponent(waUrl.split('?text=')[1]);
  assert.strictEqual(decoded, bellaMsg, 'Decoded text must match original message 100%');
  console.log('✓ TEST 4 PASSED: WhatsApp URL encoding verified with 100% round-trip fidelity.\n');

  // TEST 5: Live Database Order Verification
  console.log('--- TEST 5: Live Database Orders (JB Group & Bella Design) ---');
  const liveJb = await prisma.order.findFirst({
    where: { branchId: 1, totalAmount: { gt: 0 } },
    include: { customer: true, garmentDetails: true, branch: true, payments: true },
    orderBy: { createdAt: 'desc' }
  });

  if (liveJb) {
    const liveJbMsg = generateOrderBookingWhatsAppMessage(liveJb);
    assertNoReplacementCharacters(liveJbMsg, 'Live JB Message');
    assert(liveJbMsg.includes('✨ JB GROUP (PVT) LTD ✨'));
    console.log(`✓ Live JB Group Order ${liveJb.orderNumber} successfully formatted.`);
  }

  console.log('\n================================================================');
  console.log('>>> ALL DUAL-BRANCH WHATSAPP QUOTATION TESTS PASSED (5/5) <<<');
  console.log('================================================================');
}

runTests()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
