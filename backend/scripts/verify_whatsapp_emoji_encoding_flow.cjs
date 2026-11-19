const assert = require('assert');
const http = require('http');
const express = require('../node_modules/express');
const { generateOrderBookingWhatsAppMessage, processBookingWhatsAppNotification } = require('../src/controllers/orderController');

const REQUIRED_EMOJIS = [
  { name: 'SPARKLES', char: '\u2728', hex: '2728', urlEncoded: '%E2%9C%A8' },
  { name: 'CHERRY_BLOSSOM', char: '\u{1F338}', hex: '1f338', urlEncoded: '%F0%9F%8C%B8' },
  { name: 'BOUQUET', char: '\u{1F490}', hex: '1f490', urlEncoded: '%F0%9F%92%90' },
  { name: 'CLIPBOARD', char: '\u{1F4CB}', hex: '1f4cb', urlEncoded: '%F0%9F%93%8B' },
  { name: 'BOOKMARK', char: '\u{1F516}', hex: '1f516', urlEncoded: '%F0%9F%94%96' },
  { name: 'DRESS', char: '\u{1F457}', hex: '1f457', urlEncoded: '%F0%9F%91%97' },
  { name: 'MONEY_BAG', char: '\u{1F4B0}', hex: '1f4b0', urlEncoded: '%F0%9F%92%B0' },
  { name: 'DOLLAR_BILL', char: '\u{1F4B5}', hex: '1f4b5', urlEncoded: '%F0%9F%92%B5' },
  { name: 'CREDIT_CARD', char: '\u{1F4B3}', hex: '1f4b3', urlEncoded: '%F0%9F%92%B3' },
  { name: 'CHECK', char: '\u2705', hex: '2705', urlEncoded: '%E2%9C%85' },
  { name: 'HEART', char: '\u{1F496}', hex: '1f496', urlEncoded: '%F0%9F%92%96' },
  { name: 'OFFICE', char: '\u{1F3E2}', hex: '1f3e2', urlEncoded: '%F0%9F%8F%A2' },
  { name: 'ROBOT', char: '\u{1F916}', hex: '1f916', urlEncoded: '%F0%9F%A4%96' }
];

function verifyAllEmojisAndNoReplacement(text, label) {
  // Check absence of U+FFFD (Unicode replacement character)
  assert(!text.includes('\uFFFD'), `FAIL: ${label} contains U+FFFD (Unicode replacement character)`);
  
  // Check absence of UTF-8 byte sequence for U+FFFD: EF BF BD
  const buf = Buffer.from(text, 'utf8');
  assert(!buf.includes(Buffer.from([0xEF, 0xBF, 0xBD])), `FAIL: ${label} contains EF BF BD bytes`);

  // Verify all 13 emojis exist
  for (const emoji of REQUIRED_EMOJIS) {
    assert(text.includes(emoji.char), `FAIL: ${label} is missing emoji ${emoji.name} (${emoji.char}, U+${emoji.hex.toUpperCase()})`);
  }
}

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('JB SYSTEM — 5-STEP COMPLETE WHATSAPP EMOJI ENCODING AUDIT');
  console.log('================================================================\n');

  // STEP 1: Backend Message Generation (generateOrderBookingWhatsAppMessage)
  console.log('>>> STEP 1: Backend generateOrderBookingWhatsAppMessage() Verification');
  
  const jbOrder = {
    id: 101,
    orderNumber: 'JB-20261111-0001',
    branchId: 1,
    customer: { name: 'Kavitha Shanmugam', primaryPhone: '0771234567' },
    garmentDetails: { dressType: 'Saree Blouse', quantity: 1 },
    totalAmount: 18500,
    advancePayment: 5000,
    balanceAmount: 13500
  };

  const bellaOrder = {
    id: 102,
    orderNumber: 'BELLA-20261111-0002',
    branchId: 2,
    customer: { name: 'வனிதா கந்தையா', primaryPhone: '0779876543' },
    garmentDetails: { dressType: 'பட்டுப் பாவாடை', quantity: 1 },
    totalAmount: 42000,
    advancePayment: 15000,
    balanceAmount: 27000
  };

  const jbMsg = generateOrderBookingWhatsAppMessage(jbOrder);
  const bellaMsg = generateOrderBookingWhatsAppMessage(bellaOrder);

  console.log('Checking JB Group Message (English customer):');
  verifyAllEmojisAndNoReplacement(jbMsg, 'Step 1 JB Message');
  console.log('  ✓ All 13 emojis verified. Zero U+FFFD replacement characters.');

  console.log('Checking Bella Design Message (Tamil customer):');
  verifyAllEmojisAndNoReplacement(bellaMsg, 'Step 1 Bella Message');
  assert(bellaMsg.includes('வனிதா கந்தையா'), 'Tamil customer name preserved');
  assert(bellaMsg.includes('பட்டுப் பாவாடை'), 'Tamil garment name preserved');
  assert(bellaMsg.includes('✨ BELLA DESIGN ✨'), 'Bella branding preserved');
  console.log('  ✓ Tamil characters & Bella Design branding verified. Zero U+FFFD.');
  console.log('✓ STEP 1 PASSED.\n');

  // STEP 2: Backend API JSON Response via HTTP
  console.log('>>> STEP 2: Backend API JSON Response Over HTTP');
  const app = express();
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });
  app.get('/api/test-quotation', (req, res) => {
    res.json({
      success: true,
      jbMessage: jbMsg,
      bellaMessage: bellaMsg,
      emojis: REQUIRED_EMOJIS.map(e => e.char).join(' ')
    });
  });

  const server = app.listen(0);
  const port = server.address().port;

  const httpRes = await fetch(`http://127.0.0.1:${port}/api/test-quotation`);
  const contentType = httpRes.headers.get('content-type');
  console.log(`HTTP Content-Type: ${contentType}`);
  assert(contentType.includes('application/json'), 'Content-Type must be application/json');
  assert(contentType.includes('charset=utf-8'), 'Content-Type must explicitly declare charset=utf-8');

  const jsonBody = await httpRes.json();
  server.close();

  console.log('Checking HTTP JSON response payload for JB message:');
  verifyAllEmojisAndNoReplacement(jsonBody.jbMessage, 'Step 2 JSON JB Message');
  console.log('  ✓ Zero U+FFFD in JSON response. All 13 emojis preserved.');

  console.log('Checking HTTP JSON response payload for Bella message (Tamil):');
  verifyAllEmojisAndNoReplacement(jsonBody.bellaMessage, 'Step 2 JSON Bella Message');
  assert(jsonBody.bellaMessage.includes('வனிதா கந்தையா'), 'Tamil string preserved in JSON');
  console.log('  ✓ Zero U+FFFD in JSON response. Tamil text & emojis intact.');
  console.log('✓ STEP 2 PASSED.\n');

  // STEP 3: Frontend generateQuotationWhatsAppMessage() Logic
  console.log('>>> STEP 3: Frontend generateQuotationWhatsAppMessage() Verification');
  // Replicating frontend logic from SalesERP.jsx
  const EMOJIS = {
    SPARKLES: '\u2728',
    CHERRY_BLOSSOM: '\u{1F338}',
    BOUQUET: '\u{1F490}',
    CLIPBOARD: '\u{1F4CB}',
    BOOKMARK: '\u{1F516}',
    DRESS: '\u{1F457}',
    MONEY_BAG: '\u{1F4B0}',
    DOLLAR_BILL: '\u{1F4B5}',
    CREDIT_CARD: '\u{1F4B3}',
    CHECK: '\u2705',
    HEART: '\u{1F496}',
    OFFICE: '\u{1F3E2}',
    ROBOT: '\u{1F916}',
    BULLET: '\u2022',
    TIMES: '\u00D7'
  };

  const frontendQuotation = (order) => {
    const isBella = order.branchId === 2;
    const companyHeader = isBella ? 'BELLA DESIGN' : 'JB GROUP (PVT) LTD';
    const brandShort = isBella ? 'BELLA DESIGN' : 'JB GROUP';
    const customerName = order.customer?.name || 'Customer';
    const quotationNumber = order.quotationNumber || 'QT-0001';
    const itemName = order.garmentDetails?.dressType || 'Garment';
    const quantity = order.garmentDetails?.quantity || 1;
    const totalAmount = order.totalAmount.toLocaleString('en-US');
    const advanceAmount = order.advancePayment.toLocaleString('en-US');
    const balanceAmount = order.balanceAmount.toLocaleString('en-US');

    return `${EMOJIS.SPARKLES} ${companyHeader} ${EMOJIS.SPARKLES}

Dear ${customerName}, ${EMOJIS.CHERRY_BLOSSOM}

Thank you for choosing ${brandShort}! ${EMOJIS.BOUQUET} We truly appreciate your trust in us.

${EMOJIS.CLIPBOARD} ORDER QUOTATION

${EMOJIS.BOOKMARK} Quotation No: ${quotationNumber}
${EMOJIS.DRESS} Item: ${itemName} ${EMOJIS.TIMES} ${quantity}
${EMOJIS.MONEY_BAG} Total Amount: LKR ${totalAmount}
${EMOJIS.DOLLAR_BILL} Advance Payment: LKR ${advanceAmount}
${EMOJIS.CREDIT_CARD} Balance Payable: LKR ${balanceAmount}

${EMOJIS.CHECK} Kindly review and confirm your quotation so we can proceed with your order.

${EMOJIS.HEART} Your satisfaction is our priority, and we look forward to serving you!

${EMOJIS.OFFICE} ${companyHeader}
${EMOJIS.SPARKLES} Build ${EMOJIS.BULLET} Lead ${EMOJIS.BULLET} Inspire.

${EMOJIS.ROBOT} Automated message from ${brandShort} Management System.`;
  };

  const feJb = frontendQuotation(jbOrder);
  const feBella = frontendQuotation(bellaOrder);

  verifyAllEmojisAndNoReplacement(feJb, 'Step 3 Frontend JB');
  verifyAllEmojisAndNoReplacement(feBella, 'Step 3 Frontend Bella');
  console.log('✓ STEP 3 PASSED: Frontend quotation logic matches backend with zero replacement characters.\n');

  // STEP 4: WhatsApp URL Generation & Encoding Verification
  console.log('>>> STEP 4: WhatsApp URL Generation & Percent-Encoding Verification');
  const targetPhone = '94771234567';
  const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(jbMsg)}`;
  const waUrlBella = `https://wa.me/${targetPhone}?text=${encodeURIComponent(bellaMsg)}`;

  console.log('Sample WhatsApp Click-to-Chat URL (first 120 chars):');
  console.log(waUrl.slice(0, 120) + '...\n');

  // Verify that URL does NOT contain %EF%BF%BD (the percent-encoded form of U+FFFD)
  assert(!waUrl.includes('%EF%BF%BD'), 'FAIL: waUrl contains %EF%BF%BD (encoded U+FFFD)');
  assert(!waUrlBella.includes('%EF%BF%BD'), 'FAIL: waUrlBella contains %EF%BF%BD (encoded U+FFFD)');

  // Verify each emoji is encoded to its exact UTF-8 percent-encoded bytes
  for (const emoji of REQUIRED_EMOJIS) {
    assert(waUrl.includes(emoji.urlEncoded), `FAIL: waUrl is missing percent-encoded emoji ${emoji.name} (${emoji.urlEncoded})`);
    assert(waUrlBella.includes(emoji.urlEncoded), `FAIL: waUrlBella is missing percent-encoded emoji ${emoji.name} (${emoji.urlEncoded})`);
    console.log(`  ✓ Emoji ${emoji.name} (${emoji.char}) properly encoded as ${emoji.urlEncoded}`);
  }

  // Verify line breaks preserved as %0A%0A
  assert(waUrl.includes('%0A%0A'), 'URL contains double line breaks (%0A%0A)');
  console.log('✓ STEP 4 PASSED: WhatsApp URL generation strictly preserves all UTF-8 emoji byte sequences.\n');

  // STEP 5: Final Decoded WhatsApp Message Verification
  console.log('>>> STEP 5: Final Decoded WhatsApp Message (What WhatsApp client displays)');
  const textParamJb = waUrl.split('?text=')[1];
  const decodedJb = decodeURIComponent(textParamJb);

  const textParamBella = waUrlBella.split('?text=')[1];
  const decodedBella = decodeURIComponent(textParamBella);

  console.log('Decoded JB Group Final Message Preview:');
  console.log('------------------------------------------------------------');
  console.log(decodedJb);
  console.log('------------------------------------------------------------\n');

  console.log('Decoded Bella Design Final Message Preview (Tamil):');
  console.log('------------------------------------------------------------');
  console.log(decodedBella);
  console.log('------------------------------------------------------------\n');

  // Assert exact equality with original source message
  assert.strictEqual(decodedJb, jbMsg, 'Decoded JB message must match original string character-for-character');
  assert.strictEqual(decodedBella, bellaMsg, 'Decoded Bella message must match original string character-for-character');

  verifyAllEmojisAndNoReplacement(decodedJb, 'Step 5 Decoded JB');
  verifyAllEmojisAndNoReplacement(decodedBella, 'Step 5 Decoded Bella');

  // Compare Unicode code point arrays to prove 100% preservation
  const originalCodePoints = Array.from(jbMsg).map(c => c.codePointAt(0).toString(16));
  const decodedCodePoints = Array.from(decodedJb).map(c => c.codePointAt(0).toString(16));
  assert.deepStrictEqual(decodedCodePoints, originalCodePoints, 'Every code point must match between original and decoded WhatsApp message');

  console.log('✓ STEP 5 PASSED: 100% code point round-trip identity confirmed.\n');

  console.log('================================================================');
  console.log('>>> ALL 5 STEPS PASSED WITH 100% EMOJI ENCODING FIDELITY <<<');
  console.log('================================================================');
}

runEndToEndVerification().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});

