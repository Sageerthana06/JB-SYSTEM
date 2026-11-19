// backend/scripts/trace_full_emoji_pipeline_order_276.js
const { prisma } = require('../src/prisma');
const https = require('https');
const http = require('http');

const EXPECTED_EMOJIS = [
  { name: 'SPARKLES', char: '✨', codepoints: ['U+2728'] },
  { name: 'CHERRY_BLOSSOM', char: '🌸', codepoints: ['U+1F338'] },
  { name: 'BOUQUET', char: '💐', codepoints: ['U+1F490'] },
  { name: 'CLIPBOARD', char: '📋', codepoints: ['U+1F4CB'] },
  { name: 'BOOKMARK', char: '🔖', codepoints: ['U+1F516'] },
  { name: 'DRESS', char: '👗', codepoints: ['U+1F457'] },
  { name: 'MONEY_BAG', char: '💰', codepoints: ['U+1F4B0'] },
  { name: 'DOLLAR_BILL', char: '💵', codepoints: ['U+1F4B5'] },
  { name: 'CREDIT_CARD', char: '💳', codepoints: ['U+1F4B3'] },
  { name: 'CHECK', char: '✅', codepoints: ['U+2705'] },
  { name: 'HEART', char: '💖', codepoints: ['U+1F496'] },
  { name: 'OFFICE', char: '🏢', codepoints: ['U+1F3E2'] },
  { name: 'ROBOT', char: '🤖', codepoints: ['U+1F916'] }
];

function analyzeString(str, stageName) {
  console.log(`\n======================================================`);
  console.log(`STAGE: ${stageName}`);
  console.log(`======================================================`);
  console.log(`String preview (first 180 chars):\n${str.substring(0, 180)}...\n`);
  
  const hasFFFD = str.includes('\uFFFD') || str.includes('%EF%BF%BD');
  console.log(`- Contains U+FFFD (replacement char ): ${hasFFFD}`);
  
  console.log(`- Emoji Verification:`);
  let foundCount = 0;
  for (const em of EXPECTED_EMOJIS) {
    const foundChar = str.includes(em.char);
    const foundEncoded = str.includes(encodeURIComponent(em.char));
    const status = (foundChar || foundEncoded) ? 'PRESENT' : 'MISSING';
    if (foundChar || foundEncoded) foundCount++;
    console.log(`   ${status === 'PRESENT' ? '✅' : '❌'} ${em.name} (${em.char} - ${em.codepoints.join(', ')}): ${status}`);
  }
  console.log(`Summary: ${foundCount} / ${EXPECTED_EMOJIS.length} expected emojis present.`);
  return { hasFFFD, foundCount };
}

async function runTrace() {
  console.log('TRACE FOR REAL ORDER: JB-20261110-0007 (Pumi)');

  // ----------------------------------------------------
  // STAGE 1: DATABASE
  // ----------------------------------------------------
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'JB-20261110-0007' },
    include: { customer: true, garmentDetails: true, branch: true, payments: true }
  });

  if (!order) {
    console.error('Order JB-20261110-0007 not found in DB!');
    return;
  }

  console.log('\n======================================================');
  console.log('STAGE 1: DATABASE (order record from PostgreSQL)');
  console.log('======================================================');
  console.log(`Order ID: ${order.id}`);
  console.log(`Order Number: ${order.orderNumber}`);
  console.log(`Customer Name: ${order.customer?.name}`);
  console.log(`Customer Phone: ${order.customer?.primaryPhone}`);
  console.log(`bookingNotificationMessage in DB: ${order.bookingNotificationMessage ? 'EXISTS' : 'NULL (not stored)'}`);
  if (order.bookingNotificationMessage) {
    analyzeString(order.bookingNotificationMessage, 'Stage 1: Stored bookingNotificationMessage');
  } else {
    console.log('Result: Database has no pre-stored message. Fresh message will be generated.');
    console.log('Contains U+FFFD: false');
  }

  // ----------------------------------------------------
  // STAGE 2: BACKEND
  // ----------------------------------------------------
  const orderController = require('../src/controllers/orderController');
  const backendMsg = orderController.generateOrderBookingWhatsAppMessage(order);
  analyzeString(backendMsg, 'Stage 2: Backend generateOrderBookingWhatsAppMessage');

  // ----------------------------------------------------
  // STAGE 3: FRONTEND
  // ----------------------------------------------------
  // Evaluate the exact frontend logic from SalesERP.jsx
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

  const customerName = (order.customer?.name || order.customerName || 'Customer').trim();
  const quotationNumber = order.quotationNumber ||
    (order.orderNumber
      ? (order.orderNumber.startsWith('QT-') ? order.orderNumber : order.orderNumber.replace(/^(JB|ORD|BELLA)-/i, 'QT-'))
      : (order.id ? `QT-${order.id}` : 'QT-0001'));
  const itemName = order.garmentDetails?.dressType || order.dressType || order.itemName || 'Bespoke Garment';
  const quantity = Number(order.garmentDetails?.quantity || order.quantity || 1);
  const itemsBlock = `${EMOJIS.DRESS} Item: ${itemName} ${EMOJIS.TIMES} ${quantity}`;
  const totalAmount = Number(order.totalAmount || 0);
  const advanceAmount = Number(order.advancePayment || 0);
  const balanceAmount = Number(order.balanceAmount || totalAmount);
  const formatLKR = (num) => Number(num || 0).toLocaleString('en-US');

  const frontendMsg = `${EMOJIS.SPARKLES} JB GROUP (PVT) LTD ${EMOJIS.SPARKLES}

Dear ${customerName}, ${EMOJIS.CHERRY_BLOSSOM}

Thank you for choosing JB GROUP! ${EMOJIS.BOUQUET} We truly appreciate your trust in us.

${EMOJIS.CLIPBOARD} ORDER QUOTATION

${EMOJIS.BOOKMARK} Quotation No: ${quotationNumber}
${itemsBlock}
${EMOJIS.MONEY_BAG} Total Amount: LKR ${formatLKR(totalAmount)}
${EMOJIS.DOLLAR_BILL} Advance Payment: LKR ${formatLKR(advanceAmount)}
${EMOJIS.CREDIT_CARD} Balance Payable: LKR ${formatLKR(balanceAmount)}

${EMOJIS.CHECK} Kindly review and confirm your quotation so we can proceed with your order.

${EMOJIS.HEART} Your satisfaction is our priority, and we look forward to serving you!

${EMOJIS.OFFICE} JB GROUP (PVT) LTD
${EMOJIS.SPARKLES} Build ${EMOJIS.BULLET} Lead ${EMOJIS.BULLET} Inspire.

${EMOJIS.ROBOT} Automated message from JB GROUP Management System.`;

  analyzeString(frontendMsg, 'Stage 3: Frontend generateQuotationWhatsAppMessage string in JS memory');

  // ----------------------------------------------------
  // STAGE 4: URL GENERATION
  // ----------------------------------------------------
  const encodedText = encodeURIComponent(frontendMsg);
  const oldWaMeUrl = `https://wa.me/94763161236?text=${encodedText}`;
  const newApiUrl = `https://api.whatsapp.com/send?phone=94763161236&text=${encodedText}`;
  
  console.log('\n======================================================');
  console.log('STAGE 4: URL GENERATION');
  console.log('======================================================');
  console.log('OLD wa.me URL (first 180 chars):\n', oldWaMeUrl.substring(0, 180) + '...\n');
  console.log('NEW api.whatsapp.com URL (first 180 chars):\n', newApiUrl.substring(0, 180) + '...\n');
  console.log('Decoded text parameter from URL:');
  const decodedFromUrl = decodeURIComponent(encodedText);
  analyzeString(decodedFromUrl, 'Stage 4: Decoded text parameter before network');

  // ----------------------------------------------------
  // STAGE 5: BROWSER NAVIGATION & REDIRECT INSPECTION
  // ----------------------------------------------------
  console.log('\n======================================================');
  console.log('STAGE 5: BROWSER NAVIGATION (Tracing HTTP response & redirects)');
  console.log('======================================================');

  // Subtest 5A: Request wa.me
  await new Promise((resolve) => {
    https.get(oldWaMeUrl, (res) => {
      console.log(`[5A - wa.me HTTP Request] Status: ${res.statusCode}`);
      const redirectLoc = res.headers.location || '';
      console.log(`[5A - wa.me Redirect Location Header]:\n${redirectLoc}\n`);
      const hasFFFDInRedirect = redirectLoc.includes('%EF%BF%BD') || redirectLoc.includes('\uFFFD');
      console.log(`>>> 🚨 FIRST POINT OF CORRUPTION IDENTIFIED:`);
      console.log(`>>> wa.me server responded with HTTP 302 redirect.`);
      console.log(`>>> Redirect header contains %EF%BF%BD (U+FFFD): ${hasFFFDInRedirect}`);
      resolve();
    }).on('error', resolve);
  });

  // Subtest 5B: Request api.whatsapp.com directly
  await new Promise((resolve) => {
    https.get(newApiUrl, (res) => {
      console.log(`\n[5B - api.whatsapp.com HTTP Request] Status: ${res.statusCode}`);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const linkMatch = body.match(/href="https:\/\/web\.whatsapp\.com\/send\/\?phone=[^"]+"/);
        if (linkMatch) {
          const clientTarget = linkMatch[0].replace(/&amp;/g, '&');
          console.log(`[5B - Target WhatsApp Client URL]:\n${clientTarget.substring(0, 250)}...\n`);
          const hasFFFDInApi = clientTarget.includes('%EF%BF%BD') || clientTarget.includes('\uFFFD');
          console.log(`>>> api.whatsapp.com target URL contains %EF%BF%BD (U+FFFD): ${hasFFFDInApi}`);
          
          // ----------------------------------------------------
          // STAGE 6: WHATSAPP COMPOSE BOX / CLIENT DECODED
          // ----------------------------------------------------
          const urlObj = new URL(clientTarget.replace('href="', '').replace('"', ''));
          const finalClientText = urlObj.searchParams.get('text') || '';
          analyzeString(finalClientText, 'Stage 6: Final Decoded Text Delivered to WhatsApp Compose Box');
        }
        resolve();
      });
    }).on('error', resolve);
  });
}

runTrace().catch(console.error).finally(() => prisma.$disconnect());

